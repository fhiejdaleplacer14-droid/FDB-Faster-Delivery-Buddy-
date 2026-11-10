<?php

use App\Domain\Orders\CheckoutService;
use App\Models\Address;
use App\Models\AuditLog;
use App\Models\Order;
use App\Models\Product;
use App\Models\Seller;
use App\Models\SellerOrder;
use App\Models\User;
use App\Notifications\SellerOrderUpdated;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;

beforeEach(function () {
    Notification::fake();
    $this->customer = User::factory()->customer()->create();
    $this->address = Address::forceCreate([
        'user_id' => $this->customer->id, 'recipient_name' => 'Maria Santos', 'phone' => '09171234567',
        'municipality' => 'guihulngan', 'barangay' => 'Poblacion', 'street' => '12 Rizal St', 'is_default' => true,
    ]);
    $this->productA = Product::factory()->published()->priced('100.00', 10)->create();
    $this->productB = Product::factory()->published()->priced('40.00', 10)->create();
    $this->customer->cartItems()->create(['product_variant_id' => $this->productA->variants()->sole()->id, 'quantity' => 2]);
    $this->customer->cartItems()->create(['product_variant_id' => $this->productB->variants()->sole()->id, 'quantity' => 1]);

    [$this->order] = app(CheckoutService::class)->place($this->customer, $this->address, 'cash_on_delivery', (string) Str::uuid(), '240.00', null);
    $this->sellerA = $this->productA->seller;
    $this->soA = SellerOrder::where('seller_id', $this->sellerA->id)->sole();
    $this->soB = SellerOrder::where('seller_id', $this->productB->seller_id)->sole();
});

it('shows customers only their own orders', function () {
    $this->actingAs($this->customer)->getJson('/api/v1/orders')->assertOk()->assertJsonPath('data.0.number', $this->order->number);
    $this->actingAs($this->customer)->getJson("/api/v1/orders/{$this->order->number}")
        ->assertOk()
        ->assertJsonCount(2, 'data.seller_orders')
        ->assertJsonPath('data.seller_orders.0.history.0.actor', null);

    $stranger = User::factory()->customer()->create();
    $this->actingAs($stranger)->getJson("/api/v1/orders/{$this->order->number}")->assertNotFound();
    $this->actingAs($stranger)->getJson('/api/v1/orders')->assertOk()->assertJsonCount(0, 'data');
});

it('lets the customer cancel before confirmation and returns the stock', function () {
    $this->actingAs($this->customer)
        ->postJson("/api/v1/orders/{$this->order->number}/seller-orders/{$this->soA->number}/cancel", ['reason' => 'Ordered by mistake'])
        ->assertOk()
        ->assertJsonPath('data.status', 'in_progress')
        ->assertJsonPath('data.seller_orders.0.status', 'cancelled')
        ->assertJsonPath('data.seller_orders.0.cancelled_by', 'customer');

    expect($this->productA->variants()->sole()->stock)->toBe(10)
        ->and($this->productA->fresh()->stock_total)->toBe(10);
    Notification::assertSentTo($this->sellerA->user, SellerOrderUpdated::class);

    $this->actingAs($this->customer)->postJson("/api/v1/orders/{$this->order->number}/seller-orders/{$this->soA->number}/cancel")->assertConflict();
    expect($this->productA->variants()->sole()->stock)->toBe(10);

    $this->actingAs($this->customer)->postJson("/api/v1/orders/{$this->order->number}/seller-orders/{$this->soB->number}/cancel")->assertOk()->assertJsonPath('data.status', 'cancelled');
});

it('does not let the customer cancel after the seller confirms', function () {
    $this->actingAs($this->sellerA->user)->postJson("/api/v1/seller/orders/{$this->soA->id}/status", ['status' => 'confirmed'])->assertOk();

    $this->actingAs($this->customer)->postJson("/api/v1/orders/{$this->order->number}/seller-orders/{$this->soA->number}/cancel")->assertConflict();
    expect($this->productA->variants()->sole()->stock)->toBe(8);
});

it('moves seller orders forward only and completes the order when every part is done', function () {
    $seller = $this->sellerA->user;

    $this->actingAs($seller)->postJson("/api/v1/seller/orders/{$this->soA->id}/status", ['status' => 'out_for_delivery', 'note' => 'Rider is on the way'])
        ->assertOk()->assertJsonPath('data.status', 'out_for_delivery');
    expect($this->soA->fresh()->confirmed_at)->not->toBeNull();

    $this->actingAs($seller)->postJson("/api/v1/seller/orders/{$this->soA->id}/status", ['status' => 'preparing'])->assertConflict();
    $this->actingAs($seller)->postJson("/api/v1/seller/orders/{$this->soA->id}/status", ['status' => 'cancelled'])->assertJsonValidationErrors('status');
    $this->actingAs($seller)->postJson("/api/v1/seller/orders/{$this->soA->id}/cancel", ['reason' => 'Changed my mind'])->assertConflict();

    $this->actingAs($seller)->postJson("/api/v1/seller/orders/{$this->soA->id}/status", ['status' => 'delivered'])->assertOk();
    expect($this->order->fresh()->status->value)->toBe('in_progress');

    $this->actingAs($this->productB->seller->user)->postJson("/api/v1/seller/orders/{$this->soB->id}/cancel", ['reason' => 'Out of stock today'])->assertOk();
    expect($this->order->fresh()->status->value)->toBe('completed')
        ->and($this->productB->variants()->sole()->stock)->toBe(10);

    Notification::assertSentTo($this->customer, SellerOrderUpdated::class, fn ($n) => $n->status->value === 'delivered');
});

it('returns stock even if the seller removed the option after the order', function () {
    $this->productA->variants()->sole()->delete();

    $this->actingAs($this->sellerA->user)->postJson("/api/v1/seller/orders/{$this->soA->id}/cancel", ['reason' => 'No longer selling this'])->assertOk();

    expect($this->productA->variants()->withTrashed()->sole()->stock)->toBe(10);
});

it('shows a seller only their part of the order, with the delivery address', function () {
    $this->actingAs($this->sellerA->user)->getJson("/api/v1/seller/orders/{$this->soA->id}")
        ->assertOk()
        ->assertJsonCount(1, 'data.items')
        ->assertJsonPath('data.items.0.product_id', $this->productA->id)
        ->assertJsonPath('data.order.delivery.phone', '09171234567')
        ->assertJsonPath('data.order.customer_name', $this->customer->name);

    $this->actingAs($this->sellerA->user)->getJson('/api/v1/seller/orders')->assertOk()->assertJsonCount(1, 'data');
});

it('keeps sellers out of other sellers orders', function (string $method, string $path, array $body) {
    $this->actingAs($this->sellerA->user)->json($method, str_replace('{id}', (string) $this->soB->id, $path), $body)->assertNotFound();

    expect($this->soB->fresh()->status->value)->toBe('pending_confirmation')
        ->and($this->soB->fresh()->payment_status->value)->toBe('unpaid');
})->with([
    ['GET', '/api/v1/seller/orders/{id}', []],
    ['POST', '/api/v1/seller/orders/{id}/status', ['status' => 'confirmed']],
    ['POST', '/api/v1/seller/orders/{id}/cancel', ['reason' => 'Interfering here']],
    ['POST', '/api/v1/seller/orders/{id}/payment-received', []],
    ['PUT', '/api/v1/seller/orders/{id}/delivery', ['delivery_note' => 'x']],
]);

it('records payment received once and never for cancelled orders', function () {
    $seller = $this->sellerA->user;

    $this->actingAs($seller)->postJson("/api/v1/seller/orders/{$this->soA->id}/payment-received")->assertOk()->assertJsonPath('data.payment_status', 'paid');
    $this->actingAs($seller)->postJson("/api/v1/seller/orders/{$this->soA->id}/payment-received")->assertConflict();
    expect(AuditLog::where('action', 'seller_order.payment_received')->count())->toBe(1);

    $sellerB = $this->productB->seller->user;
    $this->actingAs($sellerB)->postJson("/api/v1/seller/orders/{$this->soB->id}/cancel", ['reason' => 'Closed today'])->assertOk();
    $this->actingAs($sellerB)->postJson("/api/v1/seller/orders/{$this->soB->id}/payment-received")->assertConflict();
});

it('does not let customers mark their own order as paid', function () {
    $this->actingAs($this->customer)->postJson("/api/v1/seller/orders/{$this->soA->id}/payment-received")->assertForbidden();
});

it('lets a suspended seller finish orders already placed', function () {
    $this->sellerA->forceFill(['status' => 'suspended'])->save();

    $this->actingAs($this->sellerA->user)->postJson("/api/v1/seller/orders/{$this->soA->id}/status", ['status' => 'confirmed'])->assertOk();
});

it('gives admins a read-only view of every order', function () {
    $admin = User::factory()->admin()->create();

    $this->actingAs($admin)->getJson('/api/v1/admin/orders')->assertOk()->assertJsonPath('data.0.customer.email', $this->customer->email);
    $this->actingAs($admin)->getJson("/api/v1/admin/orders/{$this->order->number}")->assertOk()->assertJsonCount(2, 'data.seller_orders');

    $this->actingAs($this->customer)->getJson('/api/v1/admin/orders')->assertForbidden();
    $this->actingAs(Seller::factory()->approved()->create()->user)->getJson('/api/v1/admin/orders')->assertForbidden();
});
