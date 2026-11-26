<?php

use App\Models\AuditLog;
use App\Models\Category;
use App\Models\Product;
use App\Models\Seller;
use App\Models\User;
use App\Notifications\ProductModerated;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Notification;

beforeEach(function () {
    Notification::fake();
    $this->admin = User::factory()->admin()->create();
});

it('lists listings waiting for review, oldest first', function () {
    $newer = Product::factory()->pendingReview()->create(['submitted_at' => now()]);
    $older = Product::factory()->pendingReview()->create(['submitted_at' => now()->subHour()]);
    Product::factory()->published()->create();

    $this->actingAs($this->admin)->getJson('/api/v1/admin/products?status=pending_review')
        ->assertOk()
        ->assertJsonCount(2, 'data')
        ->assertJsonPath('data.0.id', $older->id)
        ->assertJsonPath('data.1.id', $newer->id);
});

it('approves a listing and tells the seller', function () {
    $product = Product::factory()->pendingReview()->create();

    $this->actingAs($this->admin)->postJson("/api/v1/admin/products/{$product->id}/approve")
        ->assertOk()->assertJsonPath('data.status', 'published');

    expect($product->fresh()->published_at)->not->toBeNull()
        ->and(AuditLog::where('action', 'product.approved')->where('subject_id', $product->id)->exists())->toBeTrue();
    Notification::assertSentTo($product->seller->user, ProductModerated::class);

    $this->actingAs($this->admin)->postJson("/api/v1/admin/products/{$product->id}/approve")->assertConflict();
});

it('removes a published listing with a reason', function () {
    $product = Product::factory()->published()->create();

    $this->actingAs($this->admin)->postJson("/api/v1/admin/products/{$product->id}/reject")
        ->assertUnprocessable()->assertJsonValidationErrors('reason');

    $this->actingAs($this->admin)->postJson("/api/v1/admin/products/{$product->id}/reject", ['reason' => 'Photos show a different item.'])
        ->assertOk()
        ->assertJsonPath('data.status', 'rejected')
        ->assertJsonPath('data.moderation_reason', 'Photos show a different item.');

    $this->getJson("/api/v1/products/{$product->slug}")->assertNotFound();
});

it('cannot moderate drafts or archived listings', function () {
    $draft = Product::factory()->create();

    $this->actingAs($this->admin)->postJson("/api/v1/admin/products/{$draft->id}/approve")->assertConflict();
    $this->actingAs($this->admin)->postJson("/api/v1/admin/products/{$draft->id}/reject", ['reason' => 'Not allowed here.'])->assertConflict();
});

it('keeps moderation and category tools from non-admins', function () {
    $seller = Seller::factory()->approved()->create();
    $product = Product::factory()->pendingReview()->create(['seller_id' => $seller->id]);

    $this->actingAs($seller->user)->getJson('/api/v1/admin/products')->assertForbidden();
    $this->actingAs($seller->user)->postJson("/api/v1/admin/products/{$product->id}/approve")->assertForbidden();
    $this->actingAs($seller->user)->postJson('/api/v1/admin/categories', ['name' => 'Mine'])->assertForbidden();

    expect($product->fresh()->status->value)->toBe('pending_review');
});

it('manages categories and clears the public cache', function () {
    Cache::put(Category::TREE_CACHE_KEY, ['stale'], 600);

    $food = $this->actingAs($this->admin)->postJson('/api/v1/admin/categories', ['name' => 'Food & Drinks'])
        ->assertCreated()->assertJsonPath('data.slug', 'food-drinks')->json('data');
    expect(Cache::has(Category::TREE_CACHE_KEY))->toBeFalse();

    $snacks = $this->actingAs($this->admin)->postJson('/api/v1/admin/categories', ['name' => 'Snacks', 'parent_id' => $food['id']])
        ->assertCreated()->json('data');

    // Only two levels: a subcategory cannot be a parent.
    $this->actingAs($this->admin)->postJson('/api/v1/admin/categories', ['name' => 'Chips', 'parent_id' => $snacks['id']])
        ->assertJsonValidationErrors('parent_id');

    $this->actingAs($this->admin)->patchJson("/api/v1/admin/categories/{$food['id']}", ['name' => 'Food', 'is_active' => false])
        ->assertOk()->assertJsonPath('data.is_active', false)->assertJsonPath('data.slug', 'food');

    expect(AuditLog::where('action', 'like', 'category.%')->count())->toBe(3);
});

it('only deletes categories that are unused', function () {
    $used = Product::factory()->create()->category;
    $empty = Category::factory()->create();

    $this->actingAs($this->admin)->deleteJson("/api/v1/admin/categories/{$used->id}")->assertConflict();
    $this->actingAs($this->admin)->deleteJson("/api/v1/admin/categories/{$empty->id}")->assertNoContent();
});

it('moves a listing out of Others and clears the seller suggestion', function () {
    $product = Product::factory()->pendingReview()->create(['category_id' => Category::others()->id, 'suggested_category' => 'Handmade soap']);
    $target = Category::factory()->create();

    $this->actingAs($this->admin)->postJson("/api/v1/admin/products/{$product->id}/category", ['category_id' => $target->id])
        ->assertOk()
        ->assertJsonPath('data.category_id', $target->id)
        ->assertJsonPath('data.suggested_category', null)
        ->assertJsonPath('data.status', 'pending_review');

    expect(AuditLog::where('action', 'product.recategorized')->where('subject_id', $product->id)->exists())->toBeTrue();

    $closed = Category::factory()->inactive()->create();
    $this->actingAs($this->admin)->postJson("/api/v1/admin/products/{$product->id}/category", ['category_id' => $closed->id])
        ->assertJsonValidationErrors('category_id');
});

it('keeps the Others category on and undeletable', function () {
    $others = Category::others();

    $this->actingAs($this->admin)->patchJson("/api/v1/admin/categories/{$others->id}", ['name' => 'Others', 'is_active' => false])->assertConflict();
    $this->actingAs($this->admin)->deleteJson("/api/v1/admin/categories/{$others->id}")->assertConflict();
});
