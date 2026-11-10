<?php

use App\Models\Address;
use App\Models\Product;
use App\Models\Seller;
use App\Models\User;

beforeEach(function () {
    $this->customer = User::factory()->customer()->create();
});

it('adds items, merges quantities, and groups the cart by store with exact totals', function () {
    $mangoes = Product::factory()->published()->priced('33.33', 10)->create();
    $chips = Product::factory()->published()->priced('45.50', 10)->create();

    $this->actingAs($this->customer)->postJson('/api/v1/cart/items', ['variant_id' => $mangoes->variants()->sole()->id, 'quantity' => 2])->assertCreated();
    $this->actingAs($this->customer)->postJson('/api/v1/cart/items', ['variant_id' => $mangoes->variants()->sole()->id, 'quantity' => 1])->assertCreated();
    $this->actingAs($this->customer)->postJson('/api/v1/cart/items', ['variant_id' => $chips->variants()->sole()->id, 'quantity' => 1])
        ->assertCreated()
        ->assertJsonPath('data.item_count', 4)
        ->assertJsonPath('data.total', '145.49')
        ->assertJsonPath('data.can_checkout', true)
        ->assertJsonCount(2, 'data.groups')
        ->assertJsonPath('data.groups.0.items.0.quantity', 3)
        ->assertJsonPath('data.groups.0.subtotal', '99.99')
        ->assertJsonPath('meta.payment_methods.0.value', 'cash_on_delivery');
});

it('refuses more than the available stock', function () {
    $product = Product::factory()->published()->priced('10.00', 2)->create();

    $this->actingAs($this->customer)->postJson('/api/v1/cart/items', ['variant_id' => $product->variants()->sole()->id, 'quantity' => 3])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['quantity' => 'Only 2 left.']);
});

it('refuses products that are not for sale, and the customer own store', function () {
    $draft = Product::factory()->create();
    $ownStore = Seller::factory()->approved()->create(['user_id' => $this->customer->id]);
    $own = Product::factory()->published()->create(['seller_id' => $ownStore->id]);

    foreach ([$draft, $own] as $product) {
        $this->actingAs($this->customer)->postJson('/api/v1/cart/items', ['variant_id' => $product->variants()->sole()->id, 'quantity' => 1])
            ->assertJsonValidationErrors('variant_id');
    }
});

it('flags cart lines that changed after they were added', function () {
    $low = Product::factory()->published()->priced('10.00', 5)->create();
    $gone = Product::factory()->published()->priced('20.00', 5)->create();
    $this->customer->cartItems()->create(['product_variant_id' => $low->variants()->sole()->id, 'quantity' => 4]);
    $this->customer->cartItems()->create(['product_variant_id' => $gone->variants()->sole()->id, 'quantity' => 1]);

    $low->variants()->sole()->update(['stock' => 2]);
    $gone->seller->forceFill(['status' => 'suspended'])->save();

    $this->actingAs($this->customer)->getJson('/api/v1/cart')
        ->assertOk()
        ->assertJsonPath('data.can_checkout', false)
        ->assertJsonPath('data.total', '0.00')
        ->assertJsonPath('data.groups.0.items.0.problem', 'not_enough_stock')
        ->assertJsonPath('data.groups.1.items.0.problem', 'unavailable');
});

it('updates and removes only the customer own cart lines', function () {
    $product = Product::factory()->published()->priced('10.00', 9)->create();
    $mine = $this->customer->cartItems()->create(['product_variant_id' => $product->variants()->sole()->id, 'quantity' => 1]);
    $theirs = User::factory()->customer()->create()->cartItems()->create(['product_variant_id' => $product->variants()->sole()->id, 'quantity' => 1]);

    $this->actingAs($this->customer)->patchJson("/api/v1/cart/items/{$mine->id}", ['quantity' => 5])->assertOk()->assertJsonPath('data.total', '50.00');
    $this->actingAs($this->customer)->patchJson("/api/v1/cart/items/{$theirs->id}", ['quantity' => 5])->assertNotFound();
    $this->actingAs($this->customer)->deleteJson("/api/v1/cart/items/{$theirs->id}")->assertNotFound();
    $this->actingAs($this->customer)->deleteJson("/api/v1/cart/items/{$mine->id}")->assertOk()->assertJsonPath('data.item_count', 0);

    expect($theirs->fresh())->not->toBeNull();
});

it('keeps one default address and promotes another when the default is removed', function () {
    $payload = fn (array $o = []) => array_replace([
        'recipient_name' => 'Maria Santos', 'phone' => '09171234567', 'municipality' => 'guihulngan',
        'barangay' => 'Poblacion', 'street' => '12 Rizal St',
    ], $o);

    $first = $this->actingAs($this->customer)->postJson('/api/v1/addresses', $payload())->assertCreated()->assertJsonPath('data.is_default', true)->json('data.id');
    $second = $this->actingAs($this->customer)->postJson('/api/v1/addresses', $payload(['label' => 'Work', 'is_default' => true]))->assertCreated()->json('data.id');

    expect(Address::find($first)->is_default)->toBeFalse()->and(Address::find($second)->is_default)->toBeTrue();

    $this->actingAs($this->customer)->deleteJson("/api/v1/addresses/{$second}")->assertNoContent();
    expect(Address::find($first)->is_default)->toBeTrue();

    $this->actingAs($this->customer)->postJson('/api/v1/addresses', $payload(['phone' => '123', 'municipality' => 'cebu']))
        ->assertJsonValidationErrors(['phone', 'municipality']);

    $other = User::factory()->customer()->create();
    $this->actingAs($other)->putJson("/api/v1/addresses/{$first}", $payload())->assertNotFound();
});
