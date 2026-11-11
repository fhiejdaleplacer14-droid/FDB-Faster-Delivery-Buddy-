<?php

use App\Domain\Orders\CheckoutProblem;
use App\Domain\Orders\StockService;
use App\Models\Address;
use App\Models\Order;
use App\Models\Product;
use App\Models\SellerOrder;
use App\Models\User;
use App\Notifications\NewOrderReceived;
use App\Notifications\OrderPlaced;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;

beforeEach(function () {
    Notification::fake();
    $this->customer = User::factory()->customer()->create();
    $this->address = Address::forceCreate([
        'user_id' => $this->customer->id, 'recipient_name' => 'Maria Santos', 'phone' => '09171234567',
        'municipality' => 'guihulngan', 'barangay' => 'Poblacion', 'street' => '12 Rizal St', 'is_default' => true,
    ]);
});

function addToCart(User $user, Product $product, int $quantity): void
{
    $user->cartItems()->create(['product_variant_id' => $product->variants()->sole()->id, 'quantity' => $quantity]);
}

function checkout(object $test, array $overrides = [], ?string $key = null): \Illuminate\Testing\TestResponse
{
    return $test->actingAs($test->customer)
        ->withHeader('Idempotency-Key', $key ?? (string) Str::uuid())
        ->postJson('/api/v1/checkout', array_replace([
            'address_id' => $test->address->id,
            'payment_method' => 'cash_on_delivery',
            'expected_total' => '0',
        ], $overrides));
}

it('splits one checkout into an order per seller with exact totals and snapshots', function () {
    $mangoes = Product::factory()->published()->priced('33.33', 10)->create(['name' => 'Dried Mangoes']);
    $chips = Product::factory()->published()->priced('45.50', 4)->create(['seller_id' => $mangoes->seller_id]);
    $rice = Product::factory()->published()->priced('1250.00', 2)->create();
    addToCart($this->customer, $mangoes, 3);
    addToCart($this->customer, $rice, 2);
    addToCart($this->customer, $chips, 1);

    $response = checkout($this, ['expected_total' => '2645.49', 'note' => 'Please call before delivery.'])
        ->assertCreated()
        ->assertJsonPath('data.grand_total', '2645.49')
        ->assertJsonPath('data.status', 'in_progress')
        ->assertJsonPath('data.delivery.recipient_name', 'Maria Santos')
        ->assertJsonCount(2, 'data.seller_orders');

    $order = Order::sole();
    expect($response->json('data.number'))->toMatch('/^FDB-\d{6}-[2-9A-Z]{6}$/');

    $first = SellerOrder::where('seller_id', $mangoes->seller_id)->sole();
    expect($first->items_total)->toBe('145.49')
        ->and($first->status->value)->toBe('pending_confirmation')
        ->and($first->number)->toStartWith($order->number.'-')
        ->and($first->items()->count())->toBe(2)
        ->and($first->history()->count())->toBe(1);
    expect(SellerOrder::where('seller_id', $rice->seller_id)->sole()->total)->toBe('2500.00');

    expect($mangoes->variants()->sole()->stock)->toBe(7)
        ->and($mangoes->fresh()->stock_total)->toBe(7)
        ->and($rice->fresh()->stock_total)->toBe(0)
        ->and($this->customer->cartItems()->count())->toBe(0);

    Notification::assertSentTo($this->customer, OrderPlaced::class);
    Notification::assertSentTo($mangoes->seller->user, NewOrderReceived::class);
    Notification::assertSentTo($rice->seller->user, NewOrderReceived::class);

    // Later edits by the seller must not rewrite the order.
    $mangoes->update(['name' => 'Renamed']);
    $mangoes->variants()->sole()->update(['price' => '99.00']);
    $item = $first->items()->where('product_id', $mangoes->id)->sole();
    expect($item->product_name)->toBe('Dried Mangoes')->and($item->unit_price)->toBe('33.33')->and($item->line_total)->toBe('99.99');
});

it('returns the same order when a checkout request is repeated', function () {
    $product = Product::factory()->published()->priced('100.00', 5)->create();
    addToCart($this->customer, $product, 2);
    $key = (string) Str::uuid();

    $first = checkout($this, ['expected_total' => '200.00'], $key)->assertCreated()->json('data.number');
    $second = checkout($this, ['expected_total' => '200.00'], $key)->assertOk()->json('data.number');

    expect($second)->toBe($first)
        ->and(Order::count())->toBe(1)
        ->and($product->variants()->sole()->stock)->toBe(3);
    Notification::assertSentTimes(OrderPlaced::class, 1);
});

it('does not place a second order from an emptied cart with a new key', function () {
    $product = Product::factory()->published()->priced('100.00', 5)->create();
    addToCart($this->customer, $product, 1);

    checkout($this, ['expected_total' => '100.00'])->assertCreated();
    checkout($this, ['expected_total' => '100.00'])->assertUnprocessable()->assertJsonPath('reason', 'empty_cart');

    expect(Order::count())->toBe(1);
});

it('never sells more than the stock', function () {
    $product = Product::factory()->published()->priced('50.00', 1)->create();
    $rival = User::factory()->customer()->create();
    addToCart($this->customer, $product, 1);
    addToCart($rival, $product, 1);

    $this->actingAs($rival)->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/checkout', [
        'address_id' => Address::forceCreate([
            'user_id' => $rival->id, 'recipient_name' => 'R', 'phone' => '09170000000', 'municipality' => 'vallehermoso',
            'barangay' => 'B', 'street' => 'S', 'is_default' => true,
        ])->id,
        'payment_method' => 'cash_on_delivery',
        'expected_total' => '50.00',
    ])->assertCreated();

    checkout($this, ['expected_total' => '50.00'])->assertConflict()->assertJsonPath('reason', 'cart_changed');

    expect(Order::count())->toBe(1)
        ->and($product->variants()->sole()->stock)->toBe(0)
        ->and($this->customer->cartItems()->count())->toBe(1);
});

it('refuses a stock decrement that would go below zero even without a lock', function () {
    $product = Product::factory()->published()->priced('50.00', 2)->create();
    $variantId = $product->variants()->sole()->id;

    expect(fn () => app(StockService::class)->take([['variant_id' => $variantId, 'quantity' => 3]]))->toThrow(CheckoutProblem::class);
    expect($product->variants()->sole()->stock)->toBe(2);
});

it('stops when prices changed since the customer saw them', function () {
    $product = Product::factory()->published()->priced('100.00', 5)->create();
    addToCart($this->customer, $product, 1);
    $product->variants()->sole()->update(['price' => '120.00']);

    checkout($this, ['expected_total' => '100.00'])
        ->assertConflict()
        ->assertJsonPath('reason', 'price_changed')
        ->assertJsonPath('total', '120.00');

    expect(Order::count())->toBe(0)->and($product->variants()->sole()->stock)->toBe(5);
});

it('stops when a store closes or a product is withdrawn before checkout', function (string $change) {
    $product = Product::factory()->published()->priced('100.00', 5)->create();
    addToCart($this->customer, $product, 1);

    match ($change) {
        'seller suspended' => $product->seller->forceFill(['status' => 'suspended'])->save(),
        'product archived' => $product->forceFill(['status' => 'archived'])->save(),
        'option removed' => $product->variants()->sole()->delete(),
    };

    checkout($this, ['expected_total' => '100.00'])->assertConflict();
    expect(Order::count())->toBe(0);
})->with(['seller suspended', 'product archived', 'option removed']);

it('validates the address, payment method, and idempotency key', function () {
    $product = Product::factory()->published()->priced('100.00', 5)->create();
    addToCart($this->customer, $product, 1);
    $foreign = Address::forceCreate([
        'user_id' => User::factory()->create()->id, 'recipient_name' => 'X', 'phone' => '09170000000',
        'municipality' => 'guihulngan', 'barangay' => 'B', 'street' => 'S', 'is_default' => true,
    ]);

    checkout($this, ['address_id' => $foreign->id, 'payment_method' => 'credit_card', 'expected_total' => '100.00'])
        ->assertJsonValidationErrors(['address_id', 'payment_method']);

    $this->actingAs($this->customer)->withHeader('Idempotency-Key', '')->postJson('/api/v1/checkout', ['address_id' => $this->address->id, 'payment_method' => 'cash_on_delivery', 'expected_total' => '100.00'])
        ->assertJsonValidationErrors('idempotency_key');
    $this->actingAs($this->customer)->withHeader('Idempotency-Key', 'not-a-uuid')->postJson('/api/v1/checkout', [])
        ->assertJsonValidationErrors('idempotency_key');

    expect(Order::count())->toBe(0);
});

it('lists placeholder payment methods but refuses them at checkout', function () {
    $product = Product::factory()->published()->priced('100.00', 5)->create();
    addToCart($this->customer, $product, 1);

    $methods = $this->actingAs($this->customer)->getJson('/api/v1/cart')->json('meta.payment_methods');
    expect(collect($methods)->pluck('available', 'value')->all())
        ->toBe(['cash_on_delivery' => true, 'gcash' => false, 'maya' => false, 'other' => false]);

    foreach (['gcash', 'maya', 'other'] as $method) {
        checkout($this, ['payment_method' => $method, 'expected_total' => '100.00'])->assertJsonValidationErrors('payment_method');
    }
    expect(Order::count())->toBe(0);
});

it('requires a verified email to check out', function () {
    $this->customer->forceFill(['email_verified_at' => null])->save();

    checkout($this, ['expected_total' => '1.00'])->assertForbidden();
});

it('lets unverified customers check out when verification is turned off', function () {
    config(['fdb.accounts.require_email_verification' => false]);
    $this->customer->forceFill(['email_verified_at' => null])->save();
    addToCart($this->customer, Product::factory()->published()->priced('100.00', 5)->create(), 1);

    checkout($this, ['expected_total' => '100.00'])->assertCreated();
    expect(Order::count())->toBe(1);
});
