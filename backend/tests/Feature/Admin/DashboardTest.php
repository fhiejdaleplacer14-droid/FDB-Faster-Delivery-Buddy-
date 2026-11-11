<?php

use App\Domain\Orders\CheckoutService;
use App\Models\Address;
use App\Models\Product;
use App\Models\SellerOrder;
use App\Models\User;
use App\Support\Money;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;

beforeEach(function () {
    Notification::fake();
    $this->admin = User::factory()->admin()->create();
    $this->customer = User::factory()->customer()->create();
    $this->address = Address::forceCreate([
        'user_id' => $this->customer->id, 'recipient_name' => 'Maria', 'phone' => '09171234567',
        'municipality' => 'guihulngan', 'barangay' => 'Poblacion', 'street' => '1 Main', 'is_default' => true,
    ]);
});

function dashBuy(object $test, Product $product, int $quantity): SellerOrder
{
    $test->customer->cartItems()->create(['product_variant_id' => $product->variants()->sole()->id, 'quantity' => $quantity]);
    [$order] = app(CheckoutService::class)->place($test->customer, $test->address, 'cash_on_delivery', (string) Str::uuid(), Money::times($product->variants()->sole()->price, $quantity), null);

    return SellerOrder::where('order_id', $order->id)->sole();
}

function dashDeliver(SellerOrder $so): void
{
    test()->actingAs($so->seller->user)->postJson("/api/v1/seller/orders/{$so->id}/status", ['status' => 'delivered'])->assertOk();
}

it('summarises the period from real orders, with exact money', function () {
    $mangoes = Product::factory()->published()->priced('100.00', 10)->create();
    $chips = Product::factory()->published()->priced('50.00', 10)->create();
    dashDeliver(dashBuy($this, $mangoes, 2));
    dashBuy($this, $chips, 1);

    $res = $this->actingAs($this->admin)->getJson('/api/v1/admin/dashboard?days=30')->assertOk();

    $res->assertJsonPath('data.period.days', 30)
        ->assertJsonPath('data.kpis.gmv_delivered.value', '200.00')
        ->assertJsonPath('data.kpis.gmv_delivered.change_pct', null)
        ->assertJsonPath('data.kpis.commission_earned.value', '15.00')
        ->assertJsonPath('data.kpis.orders.value', '2')
        ->assertJsonPath('data.kpis.average_order.value', '125.00')
        ->assertJsonCount(30, 'data.daily')
        ->assertJsonPath('data.daily.29.gmv', '200.00')
        ->assertJsonPath('data.daily.29.orders', 2)
        ->assertJsonPath('data.top_stores.0.gmv', '200.00')
        ->assertJsonPath('data.categories.0.gmv', '200.00')
        ->assertJsonCount(2, 'data.recent_orders');

    $status = collect($res->json('data.order_status'))->pluck('count', 'key');
    expect($status->all())->toBe(['waiting' => 1, 'in_progress' => 0, 'on_the_way' => 0, 'delivered' => 1, 'cancelled' => 0]);
});

it('compares with the previous period of the same length', function () {
    $product = Product::factory()->published()->priced('100.00', 20)->create();

    $this->travel(-10)->days();
    dashDeliver(dashBuy($this, $product, 1));
    $this->travelBack();
    dashDeliver(dashBuy($this, $product, 3));

    $this->actingAs($this->admin)->getJson('/api/v1/admin/dashboard?days=7')
        ->assertOk()
        ->assertJsonPath('data.kpis.gmv_delivered.value', '300.00')
        ->assertJsonPath('data.kpis.gmv_delivered.previous', '100.00')
        ->assertJsonPath('data.kpis.gmv_delivered.change_pct', '200.0')
        ->assertJsonCount(7, 'data.daily');
});

it('is limited to people who can see reports, and to the offered ranges', function () {
    $this->actingAs($this->customer)->getJson('/api/v1/admin/dashboard')->assertForbidden();
    $this->actingAs($this->admin)->getJson('/api/v1/admin/dashboard?days=15')->assertJsonValidationErrors('days');
    $this->actingAs($this->admin)->getJson('/api/v1/admin/dashboard')->assertOk()->assertJsonPath('data.period.days', 30);
});
