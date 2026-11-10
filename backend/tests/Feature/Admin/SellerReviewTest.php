<?php

use App\Domain\Identity\RoleSlug;
use App\Domain\Sellers\SellerStatus;
use App\Models\AuditLog;
use App\Models\Seller;
use App\Models\User;
use App\Notifications\SellerStatusChanged;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    Notification::fake();
    $this->admin = User::factory()->admin()->create();
});

it('blocks non-admins from the review queue', function (string $who) {
    $user = match ($who) {
        'customer' => User::factory()->customer()->create(),
        'seller' => Seller::factory()->approved()->create()->user,
    };

    $this->actingAs($user)->getJson('/api/v1/admin/sellers')->assertForbidden();
})->with(['customer', 'seller']);

it('lists applications with status filter and search', function () {
    Seller::factory()->create(['store_name' => 'Kape ni Lola']);
    Seller::factory()->create(['store_name' => 'Bakery Uno']);
    Seller::factory()->approved()->create(['store_name' => 'Kape Approved']);

    $this->actingAs($this->admin)->getJson('/api/v1/admin/sellers?status=pending&search=kape')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.store_name', 'Kape ni Lola')
        ->assertJsonStructure(['data' => [['applicant' => ['name', 'email']]], 'meta' => ['total', 'per_page']]);
});

it('treats search wildcards as plain text', function () {
    Seller::factory()->create(['store_name' => 'Store One']);

    $this->actingAs($this->admin)->getJson('/api/v1/admin/sellers?search=%25')
        ->assertOk()
        ->assertJsonCount(0, 'data');
});

it('approves a pending application and grants seller access', function () {
    $seller = Seller::factory()->create();

    $this->actingAs($this->admin)->postJson("/api/v1/admin/sellers/{$seller->id}/approve")
        ->assertOk()
        ->assertJsonPath('data.status', 'approved')
        ->assertJsonPath('data.reviewer.id', $this->admin->id)
        ->assertJsonPath('data.history.0.to', 'approved');

    $seller->refresh();
    expect($seller->status)->toBe(SellerStatus::Approved)
        ->and($seller->approved_at)->not->toBeNull()
        ->and($seller->user->hasRole(RoleSlug::Seller))->toBeTrue();

    $log = AuditLog::where('action', 'seller.approved')->sole();
    expect($log->actor_id)->toBe($this->admin->id)
        ->and($log->subject_id)->toBe($seller->id);

    Notification::assertSentTo($seller->user, SellerStatusChanged::class, fn ($n) => $n->to === SellerStatus::Approved);
});

it('requires a reason to reject or suspend', function (string $action, string $state) {
    $seller = Seller::factory()->{$state}()->create();

    $this->actingAs($this->admin)->postJson("/api/v1/admin/sellers/{$seller->id}/{$action}")
        ->assertUnprocessable()
        ->assertJsonValidationErrors('reason');

    expect($seller->fresh()->status->value)->toBe($state === 'approved' ? 'approved' : 'pending');
})->with([
    'reject' => ['reject', 'pending'],
    'suspend' => ['suspend', 'approved'],
]);

it('rejects with a reason the applicant can see', function () {
    $seller = Seller::factory()->create();

    $this->actingAs($this->admin)->postJson("/api/v1/admin/sellers/{$seller->id}/reject", ['reason' => 'ID photo is blurry.'])
        ->assertOk()
        ->assertJsonPath('data.status', 'rejected')
        ->assertJsonPath('data.decision_reason', 'ID photo is blurry.');

    expect($seller->user->fresh()->hasRole(RoleSlug::Seller))->toBeFalse();
});

it('suspends and reactivates an approved seller', function () {
    $seller = Seller::factory()->approved()->create();

    $this->actingAs($this->admin)->postJson("/api/v1/admin/sellers/{$seller->id}/suspend", ['reason' => 'Repeated customer complaints.'])
        ->assertOk()->assertJsonPath('data.status', 'suspended');
    expect($seller->fresh()->suspended_at)->not->toBeNull();

    $this->actingAs($this->admin)->postJson("/api/v1/admin/sellers/{$seller->id}/reactivate")
        ->assertOk()->assertJsonPath('data.status', 'approved');
    expect($seller->fresh()->suspended_at)->toBeNull();

    expect(AuditLog::pluck('action')->all())->toBe(['seller.suspended', 'seller.reactivated']);
});

it('rejects actions that do not fit the current status', function (string $state, string $action) {
    $seller = Seller::factory()->{$state}()->create();
    $before = $seller->fresh()->status;

    $this->actingAs($this->admin)->postJson("/api/v1/admin/sellers/{$seller->id}/{$action}", ['reason' => 'Some reason here.'])
        ->assertConflict();

    expect($seller->fresh()->status)->toBe($before)
        ->and(AuditLog::count())->toBe(0);
})->with([
    'approve twice' => ['approved', 'approve'],
    'approve a suspended seller' => ['suspended', 'approve'],
    'reactivate a pending application' => ['pending', 'reactivate'],
    'suspend a pending application' => ['pending', 'suspend'],
    'reject an approved seller' => ['approved', 'reject'],
]);

it('does not let admins review their own application', function () {
    $seller = Seller::factory()->create(['user_id' => $this->admin->id]);

    $this->actingAs($this->admin)->postJson("/api/v1/admin/sellers/{$seller->id}/approve")->assertForbidden();
});

it('lets admins download verification documents and records the access', function () {
    Storage::fake('seller_documents');
    Storage::disk('seller_documents')->put('documents/id.jpg', 'image-bytes');
    $seller = Seller::factory()->create();
    $document = $seller->documents()->create([
        'type' => 'government_id', 'disk' => 'seller_documents', 'path' => 'documents/id.jpg',
        'original_name' => 'id.jpg', 'mime_type' => 'image/jpeg', 'size_bytes' => 11, 'sha256' => str_repeat('a', 64),
    ]);

    $this->actingAs($this->admin)->getJson("/api/v1/admin/sellers/{$seller->id}")
        ->assertJsonPath('data.documents.0.download_url', "/api/v1/admin/sellers/{$seller->id}/documents/{$document->id}");

    $response = $this->actingAs($this->admin)->get("/api/v1/admin/sellers/{$seller->id}/documents/{$document->id}")
        ->assertOk()
        ->assertHeader('X-Content-Type-Options', 'nosniff')
        ->assertDownload('id.jpg');
    expect($response->streamedContent())->toBe('image-bytes');

    expect(AuditLog::where('action', 'seller_document.viewed')->sole()->subject_id)->toBe($document->id);
});

it('keeps verification documents away from everyone else', function () {
    Storage::fake('seller_documents');
    Storage::disk('seller_documents')->put('documents/id.jpg', 'image-bytes');
    $seller = Seller::factory()->create();
    $document = $seller->documents()->create([
        'type' => 'government_id', 'disk' => 'seller_documents', 'path' => 'documents/id.jpg',
        'original_name' => 'id.jpg', 'mime_type' => 'image/jpeg', 'size_bytes' => 11, 'sha256' => str_repeat('a', 64),
    ]);
    $otherSeller = Seller::factory()->approved()->create();

    $this->actingAs($seller->user)->getJson("/api/v1/admin/sellers/{$seller->id}/documents/{$document->id}")->assertForbidden();
    $this->actingAs($otherSeller->user)->getJson("/api/v1/admin/sellers/{$seller->id}/documents/{$document->id}")->assertForbidden();

    // A document can only be reached through the seller it belongs to.
    $this->actingAs($this->admin)->getJson("/api/v1/admin/sellers/{$otherSeller->id}/documents/{$document->id}")->assertNotFound();
});
