<?php

use App\Domain\Orders\CheckoutService;
use App\Models\Address;
use App\Models\AuditLog;
use App\Models\Product;
use App\Models\SellerOrder;
use App\Models\SupportTicket;
use App\Models\User;
use App\Notifications\TicketUpdated;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;

beforeEach(function () {
    Notification::fake();
    $this->customer = User::factory()->customer()->create();
    $address = Address::forceCreate([
        'user_id' => $this->customer->id, 'recipient_name' => 'Maria Santos', 'phone' => '09171234567',
        'municipality' => 'guihulngan', 'barangay' => 'Poblacion', 'street' => '12 Rizal St', 'is_default' => true,
    ]);
    $this->product = Product::factory()->published()->priced('100.00', 10)->create();
    $this->customer->cartItems()->create(['product_variant_id' => $this->product->variants()->sole()->id, 'quantity' => 1]);

    app(CheckoutService::class)->place($this->customer, $address, 'cash_on_delivery', (string) Str::uuid(), '100.00', null);
    $this->sellerOrder = SellerOrder::query()->sole();
    $this->sellerUser = $this->product->seller->user;
    $this->admin = User::factory()->admin()->create();
});

function ticketPayload(array $overrides = []): array
{
    return array_replace([
        'category' => 'order_problem',
        'subject' => 'Missing item',
        'body' => 'One of the items was not in the bag.',
    ], $overrides);
}

it('opens a ticket linked to the customer\'s own order and lets the seller join', function () {
    $number = $this->actingAs($this->customer)
        ->postJson('/api/v1/support/tickets', ticketPayload(['seller_order_number' => $this->sellerOrder->number]))
        ->assertCreated()
        ->assertJsonPath('data.status', 'open')
        ->assertJsonPath('data.seller_order.number', $this->sellerOrder->number)
        ->json('data.number');

    Notification::assertSentTo($this->sellerUser, TicketUpdated::class);

    $this->actingAs($this->sellerUser)->getJson('/api/v1/seller/support-tickets')->assertJsonPath('data.0.number', $number);
    $this->actingAs($this->sellerUser)->postJson("/api/v1/support/tickets/{$number}/messages", ['body' => 'Sorry, sending it today.'])
        ->assertOk()
        ->assertJsonPath('data.messages.1.role', 'seller')
        ->assertJsonPath('data.messages.1.author', $this->product->seller->store_name)
        ->assertJsonMissingPath('data.customer.email');

    Notification::assertSentTo($this->customer, TicketUpdated::class);
});

it('keeps tickets private from other users and other sellers', function () {
    $number = $this->actingAs($this->customer)->postJson('/api/v1/support/tickets', ticketPayload(['seller_order_number' => $this->sellerOrder->number]))->json('data.number');
    $account = $this->actingAs($this->customer)->postJson('/api/v1/support/tickets', ticketPayload(['category' => 'account']))->json('data.number');

    $stranger = User::factory()->customer()->create();
    $otherSeller = Product::factory()->published()->create()->seller->user;

    $this->actingAs($stranger)->getJson("/api/v1/support/tickets/{$number}")->assertNotFound();
    $this->actingAs($stranger)->postJson("/api/v1/support/tickets/{$number}/messages", ['body' => 'Hello'])->assertNotFound();
    $this->actingAs($otherSeller)->getJson("/api/v1/support/tickets/{$number}")->assertNotFound();
    // The seller sees order conversations, not the customer's account questions.
    $this->actingAs($this->sellerUser)->getJson("/api/v1/support/tickets/{$account}")->assertNotFound();
    $this->actingAs($stranger)->getJson('/api/v1/admin/support-tickets')->assertForbidden();
});

it('refuses to link an order from another account', function () {
    $stranger = User::factory()->customer()->create();

    $this->actingAs($stranger)->postJson('/api/v1/support/tickets', ticketPayload(['seller_order_number' => $this->sellerOrder->number]))
        ->assertJsonValidationErrors('seller_order_number');
});

it('allows a dispute only for a delivered order inside the window, once at a time', function () {
    $dispute = ticketPayload(['category' => 'dispute', 'seller_order_number' => $this->sellerOrder->number]);

    $this->actingAs($this->customer)->postJson('/api/v1/support/tickets', ticketPayload(['category' => 'dispute']))->assertJsonValidationErrors('seller_order_number');
    $this->actingAs($this->customer)->postJson('/api/v1/support/tickets', $dispute)->assertJsonValidationErrors('seller_order_number');

    $this->actingAs($this->sellerUser)->postJson("/api/v1/seller/orders/{$this->sellerOrder->id}/status", ['status' => 'delivered'])->assertOk();

    $this->actingAs($this->customer)->postJson('/api/v1/support/tickets', $dispute)->assertCreated();
    $this->actingAs($this->customer)->postJson('/api/v1/support/tickets', $dispute)->assertJsonValidationErrors('seller_order_number');

    SupportTicket::query()->update(['status' => 'resolved']);
    $this->travel(config('fdb.support.dispute_window_days') + 1)->days();
    $this->actingAs($this->customer)->postJson('/api/v1/support/tickets', $dispute)->assertJsonValidationErrors('seller_order_number');
});

it('lets staff reply, resolve with an explanation, and records it', function () {
    $this->actingAs($this->sellerUser)->postJson("/api/v1/seller/orders/{$this->sellerOrder->id}/status", ['status' => 'delivered'])->assertOk();
    $number = $this->actingAs($this->customer)
        ->postJson('/api/v1/support/tickets', ticketPayload(['category' => 'dispute', 'seller_order_number' => $this->sellerOrder->number]))
        ->json('data.number');

    $this->actingAs($this->admin)->getJson('/api/v1/admin/support-tickets?status=active')->assertJsonPath('data.0.number', $number);
    $this->actingAs($this->admin)->postJson("/api/v1/admin/support-tickets/{$number}/messages", ['body' => 'We are checking with the store.'])
        ->assertOk()
        ->assertJsonPath('data.status', 'waiting_on_user')
        ->assertJsonPath('data.messages.1.author', $this->admin->name);

    // Customers see "FDB Support", not the staff member's name.
    $this->actingAs($this->customer)->getJson("/api/v1/support/tickets/{$number}")->assertJsonPath('data.messages.1.author', 'FDB Support');

    $this->actingAs($this->admin)->postJson("/api/v1/admin/support-tickets/{$number}/status", ['status' => 'resolved'])->assertJsonValidationErrors('resolution');
    $this->actingAs($this->admin)->postJson("/api/v1/admin/support-tickets/{$number}/status", ['status' => 'closed', 'resolution' => 'Store sent the missing item.'])
        ->assertOk()
        ->assertJsonPath('data.status', 'closed')
        ->assertJsonPath('data.resolution', 'Store sent the missing item.');

    expect(AuditLog::where('action', 'support_ticket.closed')->exists())->toBeTrue();
    $this->actingAs($this->customer)->postJson("/api/v1/support/tickets/{$number}/messages", ['body' => 'One more thing'])->assertJsonValidationErrors('body');
});

it('lists the categories with the dispute window', function () {
    $this->getJson('/api/v1/support/categories')
        ->assertOk()
        ->assertJsonPath('dispute_window_days', config('fdb.support.dispute_window_days'))
        ->assertJsonFragment(['value' => 'dispute', 'needs_order' => true]);
});
