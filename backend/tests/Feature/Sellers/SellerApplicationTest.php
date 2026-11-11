<?php

use App\Domain\Sellers\SellerStatus;
use App\Models\Seller;
use App\Models\SellerDocument;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

beforeEach(fn () => Storage::fake('seller_documents'));

it('lets a verified customer apply to sell', function () {
    $user = User::factory()->customer()->create();

    $response = $this->actingAs($user)->post('/api/v1/seller-application', sellerApplicationPayload(), ['Accept' => 'application/json'])
        ->assertCreated()
        ->assertJsonPath('data.status', 'pending')
        ->assertJsonPath('data.slug', 'aling-rosa-sari-sari')
        ->assertJsonPath('data.municipality.label', 'Guihulngan')
        ->assertJsonPath('data.documents.0.type', 'government_id')
        ->assertJsonPath('data.documents.0.original_name', 'my id.jpg')
        ->assertJsonPath('data.history.0.to', 'pending')
        ->assertJsonMissingPath('data.applicant')
        ->assertJsonMissingPath('data.documents.0.download_url');

    $document = SellerDocument::sole();
    Storage::disk('seller_documents')->assertExists($document->path);
    expect($document->path)->not->toContain('my id')
        ->and($document->mime_type)->toBe('image/jpeg')
        ->and($document->sha256)->toHaveLength(64);
    expect($response->json('data'))->not->toHaveKey('path');
});

it('requires a verified email before applying', function () {
    $user = User::factory()->unverified()->customer()->create();

    $this->actingAs($user)->post('/api/v1/seller-application', sellerApplicationPayload(), ['Accept' => 'application/json'])
        ->assertForbidden();

    expect(Seller::count())->toBe(0);
});

it('accepts applications from unverified accounts when verification is turned off, still pending admin approval', function () {
    config(['fdb.accounts.require_email_verification' => false]);
    $user = User::factory()->unverified()->customer()->create();

    $this->actingAs($user)->post('/api/v1/seller-application', sellerApplicationPayload(), ['Accept' => 'application/json'])
        ->assertCreated()
        ->assertJsonPath('data.status', 'pending');

    $this->actingAs($user)->getJson('/api/v1/user')->assertJsonPath('data.email_verification_required', false);
});

it('requires the configured verification documents', function () {
    $user = User::factory()->customer()->create();

    $this->actingAs($user)->post('/api/v1/seller-application', sellerApplicationPayload(['documents' => []]), ['Accept' => 'application/json'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['documents' => 'Upload your Government-issued ID.']);
});

it('checks the real file type, not just the extension', function (UploadedFile $file) {
    $user = User::factory()->customer()->create();

    $this->actingAs($user)->post('/api/v1/seller-application', sellerApplicationPayload([
        'documents' => [['type' => 'government_id', 'file' => $file]],
    ]), ['Accept' => 'application/json'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('documents.0.file');

    Storage::disk('seller_documents')->assertDirectoryEmpty('/');
})->with([
    'script renamed to jpg' => fn () => realUpload('id.jpg', '<?php echo "hi";'),
    'html renamed to pdf' => fn () => realUpload('id.pdf', '<html><script>alert(1)</script></html>'),
    'oversized image' => fn () => UploadedFile::fake()->image('id.jpg')->size(6000),
]);

it('accepts a real PDF', function () {
    $user = User::factory()->customer()->create();
    $pdf = realUpload('permit.pdf', "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF");

    $this->actingAs($user)->post('/api/v1/seller-application', sellerApplicationPayload([
        'documents' => [
            ['type' => 'government_id', 'file' => UploadedFile::fake()->image('id.png')],
            ['type' => 'business_permit', 'file' => $pdf],
        ],
    ]), ['Accept' => 'application/json'])->assertCreated();

    expect(SellerDocument::where('type', 'business_permit')->sole()->mime_type)->toBe('application/pdf');
});

it('validates Philippine mobile numbers and service areas', function () {
    $user = User::factory()->customer()->create();

    $this->actingAs($user)->post('/api/v1/seller-application', sellerApplicationPayload([
        'contact_phone' => '12345',
        'municipality' => 'manila',
    ]), ['Accept' => 'application/json'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['contact_phone', 'municipality']);
});

it('requires a business name for registered businesses', function () {
    $user = User::factory()->customer()->create();

    $this->actingAs($user)->post('/api/v1/seller-application', sellerApplicationPayload([
        'business_type' => 'registered_business',
    ]), ['Accept' => 'application/json'])->assertJsonValidationErrors('business_name');
});

it('rejects a store name already in use, ignoring case', function () {
    Seller::factory()->create(['store_name' => 'Aling Rosa Sari-Sari']);
    $user = User::factory()->customer()->create();

    $this->actingAs($user)->post('/api/v1/seller-application', sellerApplicationPayload([
        'store_name' => 'ALING ROSA SARI-SARI',
    ]), ['Accept' => 'application/json'])->assertJsonValidationErrors('store_name');
});

it('allows only one application per account', function () {
    $seller = Seller::factory()->create();

    $this->actingAs($seller->user)->post('/api/v1/seller-application', sellerApplicationPayload(), ['Accept' => 'application/json'])
        ->assertConflict();
});

it('ignores status and review fields sent by the applicant', function () {
    $user = User::factory()->customer()->create();

    $this->actingAs($user)->post('/api/v1/seller-application', sellerApplicationPayload([
        'status' => 'approved',
        'user_id' => 999,
        'reviewed_by' => $user->id,
        'approved_at' => now()->toIso8601String(),
    ]), ['Accept' => 'application/json'])->assertCreated()->assertJsonPath('data.status', 'pending');

    $seller = Seller::sole();
    expect($seller->user_id)->toBe($user->id)
        ->and($seller->reviewed_by)->toBeNull()
        ->and($seller->approved_at)->toBeNull();
});

it('shows the applicant their own application', function () {
    $seller = Seller::factory()->rejected()->create();

    $this->actingAs($seller->user)->getJson('/api/v1/seller-application')
        ->assertOk()
        ->assertJsonPath('data.id', $seller->id)
        ->assertJsonPath('data.status', 'rejected')
        ->assertJsonPath('data.decision_reason', 'Government ID was unreadable.')
        ->assertJsonMissingPath('data.reviewer');
});

it('returns 404 when the user has not applied', function () {
    $this->actingAs(User::factory()->customer()->create())->getJson('/api/v1/seller-application')->assertNotFound();
});

it('lets a rejected applicant correct and resubmit', function () {
    $seller = Seller::factory()->rejected()->create();
    $seller->documents()->create([
        'type' => 'government_id', 'disk' => 'seller_documents', 'path' => 'documents/old.jpg',
        'original_name' => 'old.jpg', 'mime_type' => 'image/jpeg', 'size_bytes' => 10, 'sha256' => str_repeat('a', 64),
    ]);

    $this->actingAs($seller->user)->post('/api/v1/seller-application/resubmit', sellerApplicationPayload([
        'store_name' => 'Rosa Store',
        'documents' => [],
    ]), ['Accept' => 'application/json'])
        ->assertOk()
        ->assertJsonPath('data.status', 'pending')
        ->assertJsonPath('data.store_name', 'Rosa Store')
        ->assertJsonPath('data.decision_reason', null);

    expect($seller->fresh()->statusHistory()->latest('id')->first()->from_status)->toBe(SellerStatus::Rejected);
});

it('does not allow resubmitting an application that is not rejected', function (string $state) {
    $seller = Seller::factory()->{$state}()->create();

    $this->actingAs($seller->user)->post('/api/v1/seller-application/resubmit', sellerApplicationPayload(), ['Accept' => 'application/json'])
        ->assertConflict();

    Storage::disk('seller_documents')->assertDirectoryEmpty('/');
})->with(['approved', 'suspended']);
