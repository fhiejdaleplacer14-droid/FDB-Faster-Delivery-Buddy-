<?php

use App\Models\AuditLog;
use App\Models\Product;
use App\Models\Seller;
use App\Models\User;
use Illuminate\Support\Facades\Storage;

beforeEach(fn () => Storage::fake('seller_documents'));

it('lets an admin switch seller documents off and on, and audits each change', function () {
    $admin = User::factory()->admin()->create();

    $this->actingAs($admin)->getJson('/api/v1/admin/settings')
        ->assertOk()
        ->assertJsonPath('data.seller_documents_required', true);

    $this->actingAs($admin)->putJson('/api/v1/admin/settings', ['seller_documents_required' => false])
        ->assertOk()
        ->assertJsonPath('data.seller_documents_required', false);
    $this->actingAs($admin)->putJson('/api/v1/admin/settings', ['seller_documents_required' => false])->assertOk();

    $this->actingAs(User::factory()->customer()->create())->getJson('/api/v1/seller-application/requirements')
        ->assertOk()
        ->assertJsonPath('data.documents_required', false)
        ->assertJsonPath('data.required_documents', []);

    $logs = AuditLog::where('action', 'settings.updated')->get();
    expect($logs)->toHaveCount(1)
        ->and($logs->first()->actor_id)->toBe($admin->id)
        ->and($logs->first()->context)->toMatchArray(['key' => 'sellers.documents_required', 'from' => true, 'to' => false]);
});

it('keeps the switch away from customers and visitors', function () {
    $this->getJson('/api/v1/seller-application/requirements')->assertUnauthorized();
    $this->getJson('/api/v1/admin/settings')->assertUnauthorized();
    $this->actingAs(User::factory()->customer()->create())->putJson('/api/v1/admin/settings', ['seller_documents_required' => false])->assertForbidden();
    $this->actingAs(User::factory()->customer()->create())->getJson('/api/v1/admin/settings')->assertForbidden();
});

it('accepts an application without documents only while the switch is off', function () {
    $admin = User::factory()->admin()->create();
    $payload = sellerApplicationPayload(['documents' => []]);

    $this->actingAs(User::factory()->customer()->create())->post('/api/v1/seller-application', $payload, ['Accept' => 'application/json'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['documents' => 'Upload your Government-issued ID.']);

    $this->actingAs($admin)->putJson('/api/v1/admin/settings', ['seller_documents_required' => false])->assertOk();

    $this->actingAs(User::factory()->customer()->create())->post('/api/v1/seller-application', $payload, ['Accept' => 'application/json'])
        ->assertCreated()
        ->assertJsonPath('data.status', 'pending')
        ->assertJsonPath('data.documents', []);

    expect(Seller::count())->toBe(1);
});

it('keeps admin accounts out of shopping, ordering, and selling', function () {
    $admin = User::factory()->admin()->create();
    $product = Product::factory()->published()->priced('100.00', 10)->create();
    $sellers = Seller::count();

    $this->actingAs($admin)->getJson('/api/v1/cart')->assertForbidden();
    $this->actingAs($admin)->postJson('/api/v1/cart/items', ['product_variant_id' => $product->variants()->sole()->id, 'quantity' => 1])->assertForbidden();
    $this->actingAs($admin)->postJson('/api/v1/checkout', [])->assertForbidden();
    $this->actingAs($admin)->getJson('/api/v1/addresses')->assertForbidden();
    $this->actingAs($admin)->getJson('/api/v1/orders')->assertForbidden();
    $this->actingAs($admin)->post('/api/v1/seller-application', sellerApplicationPayload(), ['Accept' => 'application/json'])->assertForbidden();
    $this->actingAs($admin)->postJson('/api/v1/support/tickets', [])->assertForbidden();

    $this->actingAs($admin)->getJson('/api/v1/admin/dashboard')->assertOk();
    $this->actingAs($admin)->getJson('/api/v1/notifications')->assertOk();
    expect($admin->cartItems()->count())->toBe(0)->and(Seller::count())->toBe($sellers);
});
