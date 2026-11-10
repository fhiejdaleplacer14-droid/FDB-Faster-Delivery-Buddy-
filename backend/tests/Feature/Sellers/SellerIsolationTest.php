<?php

use App\Models\Seller;

it('does not let one seller read another seller application by id', function () {
    $sellerA = Seller::factory()->approved()->create();
    $sellerB = Seller::factory()->approved()->create();

    $this->actingAs($sellerA->user)->getJson("/api/v1/admin/sellers/{$sellerB->id}")->assertForbidden();
});

it('does not let one seller change another seller status', function (string $action) {
    $sellerA = Seller::factory()->approved()->create();
    $sellerB = Seller::factory()->create();

    $this->actingAs($sellerA->user)
        ->postJson("/api/v1/admin/sellers/{$sellerB->id}/{$action}", ['reason' => 'Trying to interfere.'])
        ->assertForbidden();

    expect($sellerB->fresh()->status->value)->toBe('pending');
})->with(['approve', 'reject', 'suspend', 'reactivate']);

it('only ever returns the signed-in user own application', function () {
    $sellerA = Seller::factory()->create();
    Seller::factory()->create();

    $this->actingAs($sellerA->user)->getJson('/api/v1/seller-application?id=999')
        ->assertOk()
        ->assertJsonPath('data.id', $sellerA->id);
});
