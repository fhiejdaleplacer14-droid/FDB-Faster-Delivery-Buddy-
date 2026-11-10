<?php

use App\Domain\Commissions\CommissionService;
use App\Domain\Orders\CheckoutService;
use App\Models\Address;
use App\Models\AuditLog;
use App\Models\CommissionPolicy;
use App\Models\CommissionRecord;
use App\Models\Order;
use App\Models\Product;
use App\Models\Seller;
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

function buy(object $test, Product $product, int $quantity): SellerOrder
{
    $test->customer->cartItems()->create(['product_variant_id' => $product->variants()->sole()->id, 'quantity' => $quantity]);
    $total = Money::times($product->variants()->sole()->price, $quantity);
    [$order] = app(CheckoutService::class)->place($test->customer, $test->address, 'cash_on_delivery', (string) Str::uuid(), $total, null);

    return SellerOrder::where('order_id', $order->id)->sole();
}

function deliver(SellerOrder $so): void
{
    test()->actingAs($so->seller->user)->postJson("/api/v1/seller/orders/{$so->id}/status", ['status' => 'delivered'])->assertOk();
}

it('snapshots the default rate at checkout, using the spec example', function () {
    $so = buy($this, Product::factory()->published()->priced('500.00', 5)->create(), 1);

    expect($so->fresh()->commission_rate)->toBe('0.0750')
        ->and($so->fresh()->commission_amount)->toBe('37.50');

    $record = CommissionRecord::sole();
    expect($record->status->value)->toBe('pending')
        ->and($record->base_amount)->toBe('500.00')
        ->and($record->amount)->toBe('37.50');
});

it('rounds half up to the centavo', function (string $price, int $qty, string $expected) {
    $so = buy($this, Product::factory()->published()->priced($price, 50)->create(), $qty);

    expect($so->fresh()->commission_amount)->toBe($expected);
})->with([
    '99.99 x 7.5% = 7.49925' => ['33.33', 3, '7.50'],
    '1.00 x 7.5% = 0.075' => ['1.00', 1, '0.08'],
    '1,350 x 7.5% = 101.25' => ['1350.00', 1, '101.25'],
]);

it('keeps past orders on their original rate when the rate changes', function () {
    $product = Product::factory()->published()->priced('200.00', 10)->create();
    $first = buy($this, $product, 1);

    $this->actingAs($this->admin)->postJson('/api/v1/admin/commission-policies', ['rate_percent' => '10', 'notes' => 'New rate'])->assertCreated();
    $second = buy($this, $product, 1);

    expect($first->fresh()->commission_amount)->toBe('15.00')
        ->and($second->fresh()->commission_amount)->toBe('20.00')
        ->and(CommissionPolicy::whereNull('seller_id')->whereNull('effective_until')->sole()->rate)->toBe('0.1000')
        ->and(AuditLog::where('action', 'commission_policy.set')->count())->toBe(1);
});

it('applies a seller-specific rate over the default', function () {
    $special = Seller::factory()->approved()->create();
    $this->actingAs($this->admin)->postJson('/api/v1/admin/commission-policies', ['rate_percent' => '5', 'seller_id' => $special->id])->assertCreated();

    $theirs = buy($this, Product::factory()->published()->priced('100.00', 5)->create(['seller_id' => $special->id]), 1);
    $others = buy($this, Product::factory()->published()->priced('100.00', 5)->create(), 1);

    expect($theirs->fresh()->commission_amount)->toBe('5.00')
        ->and($others->fresh()->commission_amount)->toBe('7.50');
});

it('validates commission rates', function () {
    $this->actingAs($this->admin)->postJson('/api/v1/admin/commission-policies', ['rate_percent' => '60'])->assertJsonValidationErrors('rate_percent');
    $this->actingAs($this->admin)->postJson('/api/v1/admin/commission-policies', ['rate_percent' => '7.555'])->assertJsonValidationErrors('rate_percent');
    $this->actingAs($this->admin)->postJson('/api/v1/admin/commission-policies', ['rate_percent' => '-1'])->assertJsonValidationErrors('rate_percent');
});

it('earns commission only on delivery and voids it on cancellation', function () {
    $delivered = buy($this, Product::factory()->published()->priced('100.00', 5)->create(), 2);
    $cancelled = buy($this, Product::factory()->published()->priced('100.00', 5)->create(), 1);

    deliver($delivered);
    $this->actingAs($cancelled->seller->user)->postJson("/api/v1/seller/orders/{$cancelled->id}/cancel", ['reason' => 'Out of stock'])->assertOk();

    $earned = CommissionRecord::where('seller_order_id', $delivered->id)->sole();
    expect($earned->status->value)->toBe('due')->and($earned->due_at)->not->toBeNull();
    expect(CommissionRecord::where('seller_order_id', $cancelled->id)->sole()->status->value)->toBe('voided');
});

it('adjusts commissions with a reason, never below zero, and only before collection', function () {
    $so = buy($this, Product::factory()->published()->priced('100.00', 5)->create(), 2);
    $record = CommissionRecord::sole();

    $this->actingAs($this->admin)->postJson("/api/v1/admin/commissions/{$record->id}/adjustments", ['amount' => '-5.00', 'reason' => 'Agreed discount for damaged box'])
        ->assertOk()->assertJsonPath('data.net_amount', '10.00')->assertJsonPath('data.adjustments.0.amount', '-5.00');

    $this->actingAs($this->admin)->postJson("/api/v1/admin/commissions/{$record->id}/adjustments", ['amount' => '-10.01', 'reason' => 'Too much'])
        ->assertJsonValidationErrors('amount');
    $this->actingAs($this->admin)->postJson("/api/v1/admin/commissions/{$record->id}/adjustments", ['amount' => '0', 'reason' => 'Nothing at all'])
        ->assertJsonValidationErrors('amount');

    deliver($so);
    $this->actingAs($this->admin)->postJson('/api/v1/admin/commission-collections', ['seller_id' => $so->seller_id, 'record_ids' => [$record->id], 'method' => 'gcash', 'reference' => 'REF123'])
        ->assertCreated()->assertJsonPath('data.amount', '10.00');

    $this->actingAs($this->admin)->postJson("/api/v1/admin/commissions/{$record->id}/adjustments", ['amount' => '1.00', 'reason' => 'After collection'])
        ->assertJsonValidationErrors('amount');
});

it('collects due commissions in a batch exactly once', function () {
    $seller = Seller::factory()->approved()->create();
    $a = buy($this, Product::factory()->published()->priced('100.00', 5)->create(['seller_id' => $seller->id]), 1);
    $b = buy($this, Product::factory()->published()->priced('300.00', 5)->create(['seller_id' => $seller->id]), 1);
    $pending = buy($this, Product::factory()->published()->priced('50.00', 5)->create(['seller_id' => $seller->id]), 1);
    $otherSeller = buy($this, Product::factory()->published()->priced('100.00', 5)->create(), 1);
    deliver($a);
    deliver($b);
    deliver($otherSeller);
    $ids = fn (SellerOrder ...$sos) => collect($sos)->map(fn ($so) => CommissionRecord::where('seller_order_id', $so->id)->value('id'))->all();

    $this->actingAs($this->admin)->getJson('/api/v1/admin/commissions/balances')
        ->assertOk()->assertJsonFragment(['seller_id' => $seller->id, 'records' => 2, 'due' => '30.00']);

    $payload = fn (array $recordIds) => ['seller_id' => $seller->id, 'record_ids' => $recordIds, 'method' => 'cash'];
    $this->actingAs($this->admin)->postJson('/api/v1/admin/commission-collections', $payload($ids($a, $pending)))->assertJsonValidationErrors('record_ids');
    $this->actingAs($this->admin)->postJson('/api/v1/admin/commission-collections', $payload($ids($a, $otherSeller)))->assertJsonValidationErrors('record_ids');

    $this->actingAs($this->admin)->postJson('/api/v1/admin/commission-collections', $payload($ids($a, $b)))->assertCreated()->assertJsonPath('data.amount', '30.00');
    $this->actingAs($this->admin)->postJson('/api/v1/admin/commission-collections', $payload($ids($a, $b)))->assertJsonValidationErrors('record_ids');

    expect(CommissionRecord::whereIn('id', $ids($a, $b))->pluck('status')->map->value->unique()->all())->toBe(['collected'])
        ->and(AuditLog::where('action', 'commission.collected')->count())->toBe(1);
});

it('reports GMV, FDB revenue, and seller earnings separately', function () {
    $delivered = buy($this, Product::factory()->published()->priced('500.00', 5)->create(), 1);
    $deliveredToo = buy($this, Product::factory()->published()->priced('200.00', 5)->create(), 1);
    $open = buy($this, Product::factory()->published()->priced('80.00', 5)->create(), 1);
    $cancelled = buy($this, Product::factory()->published()->priced('1000.00', 5)->create(), 1);
    deliver($delivered);
    deliver($deliveredToo);
    $this->actingAs($cancelled->seller->user)->postJson("/api/v1/seller/orders/{$cancelled->id}/cancel", ['reason' => 'Unavailable'])->assertOk();
    $this->actingAs($this->admin)->postJson('/api/v1/admin/commission-collections', [
        'seller_id' => $delivered->seller_id,
        'record_ids' => [CommissionRecord::where('seller_order_id', $delivered->id)->value('id')],
        'method' => 'cash',
    ])->assertCreated();

    $today = now(config('app.display_timezone'))->toDateString();
    $this->actingAs($this->admin)->getJson("/api/v1/admin/reports/financial?from={$today}&to={$today}")
        ->assertOk()
        ->assertJsonPath('data.orders_placed', 3)
        ->assertJsonPath('data.gmv_placed', '780.00')
        ->assertJsonPath('data.gmv_delivered', '700.00')
        ->assertJsonPath('data.commission_earned', '52.50')
        ->assertJsonPath('data.seller_earnings', '647.50')
        ->assertJsonPath('data.commission_collected', '37.50')
        ->assertJsonPath('data.commission_outstanding', '15.00')
        ->assertJsonPath('data.commission_pending', '6.00')
        ->assertJsonCount(2, 'data.sellers');
});

it('keeps commission tools and figures away from the wrong people', function () {
    $so = buy($this, Product::factory()->published()->priced('100.00', 5)->create(), 1);
    $order = Order::sole();

    foreach (['/api/v1/admin/commissions', '/api/v1/admin/commission-policies', '/api/v1/admin/reports/financial?from=2026-01-01&to=2026-01-31'] as $uri) {
        $this->actingAs($so->seller->user)->getJson($uri)->assertForbidden();
        $this->actingAs($this->customer)->getJson($uri)->assertForbidden();
    }

    $this->actingAs($this->customer)->getJson("/api/v1/orders/{$order->number}")->assertJsonMissingPath('data.seller_orders.0.commission');
    $this->actingAs($so->seller->user)->getJson("/api/v1/seller/orders/{$so->id}")
        ->assertJsonPath('data.commission.amount', '7.50')
        ->assertJsonPath('data.commission.seller_amount', '92.50');

    $this->actingAs($so->seller->user)->getJson('/api/v1/seller/commissions')
        ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('summary.pending', '7.50');
    $this->actingAs(Seller::factory()->approved()->create()->user)->getJson('/api/v1/seller/commissions')
        ->assertOk()->assertJsonCount(0, 'data')->assertJsonPath('summary.pending', '0.00');
});

it('records nothing when no policy exists rather than blocking checkout', function () {
    CommissionPolicy::query()->delete();

    $so = buy($this, Product::factory()->published()->priced('100.00', 5)->create(), 1);

    expect($so->fresh()->commission_amount)->toBe('0.00')->and(CommissionRecord::sole()->rate)->toBe('0.0000');
    expect(app(CommissionService::class)->policyFor($so->seller_id))->toBeNull();
});
