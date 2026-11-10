<?php

use App\Domain\Orders\CheckoutService;
use App\Models\Address;
use App\Models\AuditLog;
use App\Models\Product;
use App\Models\SellerOrder;
use App\Models\User;
use App\Notifications\ReviewReceived;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;

beforeEach(function () {
    Notification::fake();
    $this->customer = User::factory()->customer()->create(['name' => 'Maria Clara Santos']);
    $address = Address::forceCreate([
        'user_id' => $this->customer->id, 'recipient_name' => 'Maria Santos', 'phone' => '09171234567',
        'municipality' => 'guihulngan', 'barangay' => 'Poblacion', 'street' => '12 Rizal St', 'is_default' => true,
    ]);
    $this->product = Product::factory()->published()->priced('100.00', 10)->create();
    $this->customer->cartItems()->create(['product_variant_id' => $this->product->variants()->sole()->id, 'quantity' => 1]);

    [$this->order] = app(CheckoutService::class)->place($this->customer, $address, 'cash_on_delivery', (string) Str::uuid(), '100.00', null);
    $this->sellerOrder = SellerOrder::query()->sole();
    $this->item = $this->sellerOrder->items()->sole();
    $this->sellerUser = $this->product->seller->user;
    $this->reviewUrl = "/api/v1/orders/{$this->order->number}/items/{$this->item->id}/review";
});

function deliverForReview(object $test): void
{
    $test->actingAs($test->sellerUser)->postJson("/api/v1/seller/orders/{$test->sellerOrder->id}/status", ['status' => 'delivered'])->assertOk();
}

it('accepts a review only after delivery and only once per item', function () {
    $this->actingAs($this->customer)->postJson($this->reviewUrl, ['rating' => 5])->assertJsonValidationErrors('rating');

    deliverForReview($this);

    $this->actingAs($this->customer)->postJson($this->reviewUrl, ['rating' => 4, 'comment' => '  Fresh and well packed.  '])
        ->assertCreated()
        ->assertJsonPath('data.rating', 4)
        ->assertJsonPath('data.comment', 'Fresh and well packed.')
        ->assertJsonPath('data.author', 'Maria S.');

    $this->actingAs($this->customer)->postJson($this->reviewUrl, ['rating' => 1])->assertJsonValidationErrors('rating');

    expect($this->product->fresh())
        ->rating_count->toBe(1)
        ->rating_average->toBe('4.00');
    Notification::assertSentTo($this->sellerUser, ReviewReceived::class);

    $this->actingAs($this->customer)->getJson("/api/v1/orders/{$this->order->number}")
        ->assertJsonPath('data.seller_orders.0.items.0.review.rating', 4);
});

it('rejects reviews on someone else\'s order and bad ratings', function () {
    deliverForReview($this);
    $stranger = User::factory()->customer()->create();

    $this->actingAs($stranger)->postJson($this->reviewUrl, ['rating' => 5])->assertNotFound();
    $this->actingAs($this->customer)->postJson($this->reviewUrl, ['rating' => 6])->assertJsonValidationErrors('rating');
    $this->actingAs($this->customer)->postJson($this->reviewUrl, ['rating' => 0])->assertJsonValidationErrors('rating');
    $this->actingAs($this->customer)->postJson("/api/v1/orders/{$this->order->number}/items/999999/review", ['rating' => 5])->assertNotFound();
});

it('shows published reviews publicly without the reviewer\'s full name', function () {
    deliverForReview($this);
    $this->actingAs($this->customer)->postJson($this->reviewUrl, ['rating' => 5, 'comment' => 'Great'])->assertCreated();

    auth()->forgetGuards();
    $this->getJson("/api/v1/products/{$this->product->slug}/reviews")
        ->assertOk()
        ->assertJsonPath('data.0.author', 'Maria S.')
        ->assertJsonMissingPath('data.0.author_email')
        ->assertJsonMissingPath('data.0.status')
        ->assertJsonPath('summary.count', 1);

    $this->getJson("/api/v1/products/{$this->product->slug}")->assertJsonPath('data.rating.average', '5.00');
});

it('lets the seller reply only to reviews of their own products', function () {
    deliverForReview($this);
    $id = $this->actingAs($this->customer)->postJson($this->reviewUrl, ['rating' => 3])->json('data.id');

    $other = Product::factory()->published()->create()->seller->user;
    $this->actingAs($other)->postJson("/api/v1/seller/reviews/{$id}/reply", ['reply' => 'Thanks!'])->assertNotFound();
    $this->actingAs($other)->getJson('/api/v1/seller/reviews')->assertOk()->assertJsonCount(0, 'data');

    $this->actingAs($this->sellerUser)->getJson('/api/v1/seller/reviews?unanswered=1')->assertJsonCount(1, 'data');
    $this->actingAs($this->sellerUser)->postJson("/api/v1/seller/reviews/{$id}/reply", ['reply' => 'Salamat po!'])
        ->assertOk()->assertJsonPath('data.seller_reply', 'Salamat po!');
    $this->actingAs($this->sellerUser)->getJson('/api/v1/seller/reviews?unanswered=1')->assertJsonCount(0, 'data');
});

it('lets moderators hide and restore reviews, updating the rating and audit log', function () {
    deliverForReview($this);
    $id = $this->actingAs($this->customer)->postJson($this->reviewUrl, ['rating' => 1, 'comment' => 'spam spam'])->json('data.id');

    $this->actingAs($this->customer)->postJson("/api/v1/admin/reviews/{$id}/hide", ['reason' => 'Spam content'])->assertForbidden();

    $admin = User::factory()->admin()->create();
    $this->actingAs($admin)->postJson("/api/v1/admin/reviews/{$id}/hide", ['reason' => 'x'])->assertJsonValidationErrors('reason');
    $this->actingAs($admin)->postJson("/api/v1/admin/reviews/{$id}/hide", ['reason' => 'Spam content'])
        ->assertOk()->assertJsonPath('data.status', 'hidden')->assertJsonPath('data.author_email', $this->customer->email);

    expect($this->product->fresh())->rating_count->toBe(0)->rating_average->toBeNull();
    $this->getJson("/api/v1/products/{$this->product->slug}/reviews")->assertJsonCount(0, 'data');
    expect(AuditLog::where('action', 'review.hidden')->exists())->toBeTrue();

    $this->actingAs($admin)->getJson('/api/v1/admin/reviews?status=hidden')->assertJsonCount(1, 'data');
    $this->actingAs($admin)->postJson("/api/v1/admin/reviews/{$id}/restore")->assertOk()->assertJsonPath('data.status', 'published');
    expect($this->product->fresh()->rating_count)->toBe(1);
});
