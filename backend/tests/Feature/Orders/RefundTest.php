<?php

use App\Domain\Orders\CheckoutService;
use App\Models\Address;
use App\Models\AuditLog;
use App\Models\CommissionRecord;
use App\Models\Product;
use App\Models\Refund;
use App\Models\SellerOrder;
use App\Models\User;
use App\Notifications\RefundRecorded;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;

beforeEach(function () {
    Notification::fake();
    $this->admin = User::factory()->admin()->create();
    $this->customer = User::factory()->customer()->create();
    $address = Address::forceCreate([
        'user_id' => $this->customer->id, 'recipient_name' => 'Maria', 'phone' => '09171234567',
        'municipality' => 'guihulngan', 'barangay' => 'Poblacion', 'street' => '1 Main', 'is_default' => true,
    ]);
    // 2 × 250.00 at the seeded 7.5% default rate: 37.50 commission.
    $product = Product::factory()->published()->priced('250.00', 10)->create();
    $this->customer->cartItems()->create(['product_variant_id' => $product->variants()->sole()->id, 'quantity' => 2]);
    [$this->order] = app(CheckoutService::class)->place($this->customer, $address, 'cash_on_delivery', (string) Str::uuid(), '500.00', null);
    $this->so = SellerOrder::query()->sole();
    $this->sellerUser = $product->seller->user;
    $this->sellerUrl = "/api/v1/seller/orders/{$this->so->id}";
});

function refundPayload(array $overrides = []): array
{
    return array_replace(['amount' => '100.00', 'method' => 'gcash', 'reference' => 'GC-123', 'reason' => 'One pack was damaged'], $overrides);
}

function paidAndDelivered(object $test): void
{
    $test->actingAs($test->sellerUser)->postJson("{$test->sellerUrl}/status", ['status' => 'delivered'])->assertOk();
    $test->actingAs($test->sellerUser)->postJson("{$test->sellerUrl}/payment-received")->assertOk();
}

it('refuses refunds before the seller has received the payment', function () {
    $this->actingAs($this->sellerUser)->postJson("{$this->sellerUrl}/refunds", refundPayload())->assertJsonValidationErrors('amount');
    expect(Refund::count())->toBe(0);
});

it('lets the seller record a partial refund that lowers the due commission proportionally', function () {
    paidAndDelivered($this);

    $this->actingAs($this->sellerUser)->postJson("{$this->sellerUrl}/refunds", refundPayload())
        ->assertOk()
        ->assertJsonPath('data.payment_status', 'partially_refunded')
        ->assertJsonPath('data.refunded_total', '100.00')
        ->assertJsonPath('data.refunds.0.method_label', 'GCash')
        ->assertJsonPath('data.refunds.0.commission_reduction', '7.50')
        ->assertJsonPath('data.commission.amount', '30.00')
        ->assertJsonPath('data.commission.seller_amount', '370.00');

    $record = CommissionRecord::sole();
    expect($record->netAmount())->toBe('30.00')
        ->and($record->adjustments()->sole()->amount)->toBe('-7.50');

    Notification::assertSentTo($this->customer, RefundRecorded::class);
    Notification::assertNotSentTo($this->sellerUser, RefundRecorded::class);
    expect(AuditLog::where('action', 'refund.recorded')->exists())->toBeTrue();

    // Customers see the refund but never the commission effect.
    $this->actingAs($this->customer)->getJson("/api/v1/orders/{$this->order->number}")
        ->assertJsonPath('data.seller_orders.0.refunds.0.amount', '100.00')
        ->assertJsonMissingPath('data.seller_orders.0.refunds.0.commission_reduction');
});

it('never refunds more than was paid, and marks a full refund', function () {
    paidAndDelivered($this);

    $this->actingAs($this->sellerUser)->postJson("{$this->sellerUrl}/refunds", refundPayload(['amount' => '500.01']))->assertJsonValidationErrors('amount');
    $this->actingAs($this->sellerUser)->postJson("{$this->sellerUrl}/refunds", refundPayload(['amount' => '400.00']))->assertOk();
    $this->actingAs($this->sellerUser)->postJson("{$this->sellerUrl}/refunds", refundPayload(['amount' => '100.01']))
        ->assertJsonValidationErrors(['amount' => 'At most ₱100.00 can still be refunded on this order.']);
    $this->actingAs($this->sellerUser)->postJson("{$this->sellerUrl}/refunds", refundPayload(['amount' => '100']))
        ->assertOk()
        ->assertJsonPath('data.payment_status', 'refunded');

    // The whole commission is gone, never below zero.
    expect(CommissionRecord::sole()->netAmount())->toBe('0.00');
    $this->actingAs($this->sellerUser)->postJson("{$this->sellerUrl}/payment-received")->assertConflict();
});

it('rejects bad input', function (array $payload, string $field) {
    paidAndDelivered($this);
    $this->actingAs($this->sellerUser)->postJson("{$this->sellerUrl}/refunds", refundPayload($payload))->assertJsonValidationErrors($field);
})->with([
    'zero' => [['amount' => '0'], 'amount'],
    'negative' => [['amount' => '-5'], 'amount'],
    'three decimals' => [['amount' => '1.005'], 'amount'],
    'unknown method' => [['method' => 'crypto'], 'method'],
    'no reason' => [['reason' => ''], 'reason'],
    'future date' => [['refunded_at' => now()->addDay()->toIso8601String()], 'refunded_at'],
]);

it('keeps sellers to their own orders and admins to the permission', function () {
    paidAndDelivered($this);
    $other = Product::factory()->published()->create()->seller->user;

    $this->actingAs($other)->postJson("{$this->sellerUrl}/refunds", refundPayload())->assertNotFound();
    $this->actingAs($this->customer)->postJson("/api/v1/admin/seller-orders/{$this->so->id}/refunds", refundPayload())->assertForbidden();
    expect(Refund::count())->toBe(0);
});

it('lets an admin record a refund linked to the dispute and tells the seller', function () {
    paidAndDelivered($this);
    $ticket = $this->actingAs($this->customer)->postJson('/api/v1/support/tickets', [
        'category' => 'dispute', 'subject' => 'Damaged', 'body' => 'Both packs were crushed.', 'seller_order_number' => $this->so->number,
    ])->assertCreated()->json('data.number');

    $this->actingAs($this->admin)->postJson("/api/v1/admin/seller-orders/{$this->so->id}/refunds", refundPayload(['support_ticket_number' => 'SUP-NOPE00']))
        ->assertJsonValidationErrors('support_ticket_number');

    $this->actingAs($this->admin)->postJson("/api/v1/admin/seller-orders/{$this->so->id}/refunds", refundPayload(['support_ticket_number' => $ticket]))
        ->assertOk()
        ->assertJsonPath('data.refunds.0.recorded_as', 'admin')
        ->assertJsonPath('data.refunds.0.recorded_by', $this->admin->name)
        ->assertJsonPath('data.refunds.0.ticket_number', $ticket);

    Notification::assertSentTo($this->sellerUser, RefundRecorded::class);
});

it('turns the reduction into a credit owed when FDB already collected the commission', function () {
    paidAndDelivered($this);
    $record = CommissionRecord::sole();
    $this->actingAs($this->admin)->postJson('/api/v1/admin/commission-collections', [
        'seller_id' => $this->so->seller_id, 'record_ids' => [$record->id], 'method' => 'gcash',
    ])->assertCreated();

    $this->actingAs($this->sellerUser)->postJson("{$this->sellerUrl}/refunds", refundPayload(['amount' => '250.00']))
        ->assertOk()
        ->assertJsonPath('data.refunds.0.commission_reduction', '0.00')
        ->assertJsonPath('data.refunds.0.commission_credit', '18.75');

    expect($record->fresh()->netAmount())->toBe('37.50');
    $this->actingAs($this->admin)->getJson('/api/v1/admin/refunds?credit=owed')->assertJsonPath('summary.credit_owed', '18.75')->assertJsonCount(1, 'data');

    $today = now('Asia/Manila')->toDateString();
    $this->actingAs($this->admin)->getJson("/api/v1/admin/reports/financial?from={$today}&to={$today}")
        ->assertJsonPath('data.refunds_recorded', '250.00')
        ->assertJsonPath('data.commission_credits_owed', '18.75');

    $id = Refund::sole()->id;
    $this->actingAs($this->admin)->postJson("/api/v1/admin/refunds/{$id}/settle-credit")->assertOk()->assertJsonPath('data.credit_settled_at', fn ($v) => $v !== null);
    $this->actingAs($this->admin)->postJson("/api/v1/admin/refunds/{$id}/settle-credit")->assertJsonValidationErrors('refund');
    $this->actingAs($this->admin)->getJson('/api/v1/admin/refunds?credit=owed')->assertJsonPath('summary.credit_owed', '0.00');
});

it('leaves commission alone when the policy says so', function () {
    config(['fdb.refunds.commission_treatment' => 'none']);
    paidAndDelivered($this);

    $this->actingAs($this->sellerUser)->postJson("{$this->sellerUrl}/refunds", refundPayload())->assertOk();
    expect(CommissionRecord::sole()->netAmount())->toBe('37.50');
});

it('counts refunds against items before the delivery fee', function () {
    paidAndDelivered($this);
    $this->so->forceFill(['delivery_fee' => '50.00', 'total' => '550.00'])->save();

    $this->actingAs($this->sellerUser)->postJson("{$this->sellerUrl}/refunds", refundPayload(['amount' => '480.00']))->assertOk();
    // Only 20.00 of item value is left, so the last 70.00 reduces commission by 1.50.
    $this->actingAs($this->sellerUser)->postJson("{$this->sellerUrl}/refunds", refundPayload(['amount' => '70.00']))
        ->assertOk()
        ->assertJsonPath('data.refunds.1.commission_reduction', '1.50');
    expect(CommissionRecord::sole()->netAmount())->toBe('0.00');
});
