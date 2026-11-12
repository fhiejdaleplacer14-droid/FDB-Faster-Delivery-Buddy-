<?php

use App\Models\Category;
use App\Models\Product;
use App\Models\Seller;
use Illuminate\Support\Facades\Cache;

it('lists only published products from approved, active sellers in open categories', function () {
    $visible = Product::factory()->published()->withImage()->create(['name' => 'Visible Mangoes']);
    Product::factory()->create(['name' => 'Draft Item']);
    Product::factory()->pendingReview()->create(['name' => 'Pending Item']);
    Product::factory()->published()->create(['name' => 'Suspended Store Item', 'seller_id' => Seller::factory()->suspended()]);
    Product::factory()->published()->create(['name' => 'Closed Category Item', 'category_id' => Category::factory()->inactive()]);
    $bannedOwner = Product::factory()->published()->create(['name' => 'Banned Owner Item']);
    $bannedOwner->seller->user->forceFill(['status' => 'suspended'])->save();
    Product::factory()->published()->create(['name' => 'Deleted Item'])->delete();

    $this->getJson('/api/v1/products')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $visible->id)
        ->assertJsonPath('data.0.price_from', '100.00')
        ->assertJsonPath('data.0.in_stock', true)
        ->assertJsonPath('data.0.store.slug', $visible->seller->slug)
        ->assertJsonStructure(['data' => [['image' => ['url', 'width', 'height']]], 'meta' => ['total']]);
});

it('searches by name and tolerates small typos', function () {
    Product::factory()->published()->create(['name' => 'Dried Mangoes']);
    Product::factory()->published()->create(['name' => 'Fresh Fish']);

    $this->getJson('/api/v1/products?search=mango')->assertJsonCount(1, 'data')->assertJsonPath('data.0.name', 'Dried Mangoes');
    $this->getJson('/api/v1/products?search=Dried Mangos')->assertJsonCount(1, 'data')->assertJsonPath('data.0.name', 'Dried Mangoes');
    $this->getJson('/api/v1/products?search=%25')->assertJsonCount(0, 'data');
});

it('filters by category including subcategories, town, price, and stock', function () {
    $food = Category::factory()->create(['slug' => 'food']);
    $snacks = Category::factory()->create(['slug' => 'snacks', 'parent_id' => $food->id]);
    $other = Category::factory()->create(['slug' => 'tools']);
    $guihulngan = Seller::factory()->approved()->create(['municipality' => 'guihulngan']);
    $elsewhere = Seller::factory()->approved()->create(['municipality' => 'vallehermoso']);

    $chips = Product::factory()->published()->priced('45.00')->create(['category_id' => $snacks->id, 'seller_id' => $guihulngan->id]);
    $rice = Product::factory()->published()->priced('1250.00', 0)->create(['category_id' => $food->id, 'seller_id' => $elsewhere->id]);
    Product::factory()->published()->priced('300.00')->create(['category_id' => $other->id, 'seller_id' => $elsewhere->id]);

    $ids = fn (string $query) => collect($this->getJson("/api/v1/products?{$query}")->assertOk()->json('data'))->pluck('id')->sort()->values()->all();

    expect($ids('category=food'))->toBe(collect([$chips->id, $rice->id])->sort()->values()->all())
        ->and($ids('category=snacks'))->toBe([$chips->id])
        ->and($ids('municipality=guihulngan'))->toBe([$chips->id])
        ->and($ids('min_price=100&max_price=1300&category=food'))->toBe([$rice->id])
        ->and($ids('category=food&in_stock=1'))->toBe([$chips->id])
        ->and($ids('category=missing'))->toBe([]);
});

it('sorts by price with exact decimal values', function () {
    Product::factory()->published()->priced('99.99')->create();
    Product::factory()->published()->priced('100.01')->create();
    Product::factory()->published()->priced('5.50')->create();

    expect(collect($this->getJson('/api/v1/products?sort=price_asc')->json('data'))->pluck('price_from')->all())
        ->toBe(['5.50', '99.99', '100.01']);
    expect(collect($this->getJson('/api/v1/products?sort=price_desc')->json('data'))->pluck('price_from')->all())
        ->toBe(['100.01', '99.99', '5.50']);
});

it('rejects invalid filters', function () {
    $this->getJson('/api/v1/products?sort=random&municipality=manila&per_page=500')
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['sort', 'municipality', 'per_page']);
});

it('shows a published product with its options, photos, and a public store profile', function () {
    $product = Product::factory()->published()->withImage()->create();

    $this->getJson("/api/v1/products/{$product->slug}")
        ->assertOk()
        ->assertJsonPath('data.variants.0.price', '100.00')
        ->assertJsonPath('data.store.name', $product->seller->store_name)
        ->assertJsonMissingPath('data.store.contact_phone')
        ->assertJsonMissingPath('data.store.address_line')
        ->assertJsonMissingPath('data.status');
});

it('hides products that are not public', function () {
    $draft = Product::factory()->create();

    $this->getJson("/api/v1/products/{$draft->slug}")->assertNotFound();
});

it('shows approved stores and hides others', function () {
    $approved = Seller::factory()->approved()->create();
    $pending = Seller::factory()->create();
    $suspended = Seller::factory()->suspended()->create();

    $this->getJson("/api/v1/stores/{$approved->slug}")->assertOk()->assertJsonPath('data.name', $approved->store_name);
    $this->getJson("/api/v1/stores/{$pending->slug}")->assertNotFound();
    $this->getJson("/api/v1/stores/{$suspended->slug}")->assertNotFound();
});

it('lists active categories as a cached tree', function () {
    $food = Category::factory()->create(['name' => 'Food']);
    Category::factory()->create(['name' => 'Snacks', 'parent_id' => $food->id]);
    Category::factory()->inactive()->create(['name' => 'Hidden', 'parent_id' => $food->id]);
    Category::factory()->inactive()->create(['name' => 'Closed']);

    $this->getJson('/api/v1/categories')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.name', 'Food')
        ->assertJsonCount(1, 'data.0.children')
        ->assertJsonPath('data.0.children.0.name', 'Snacks');

    expect(Cache::has(Category::TREE_CACHE_KEY))->toBeTrue();
});

it('shows shoppers only categories with something to buy, and sellers all of them', function () {
    $clothing = Category::factory()->create(['name' => 'Clothing']);
    $shirts = Category::factory()->create(['name' => 'Shirts', 'parent_id' => $clothing->id]);
    Category::factory()->create(['name' => 'Shoes', 'parent_id' => $clothing->id]);
    $food = Category::factory()->create(['name' => 'Food']);
    $snacks = Category::factory()->create(['name' => 'Snacks', 'parent_id' => $food->id]);
    $crafts = Category::factory()->create(['name' => 'Crafts']);
    Category::factory()->create(['name' => 'Empty']);

    Product::factory()->published()->create(['category_id' => $shirts->id]);
    Product::factory()->create(['category_id' => $snacks->id]);
    Product::factory()->published()->create(['category_id' => $crafts->id]);

    $this->getJson('/api/v1/categories?with_products=1')
        ->assertOk()
        ->assertJsonCount(2, 'data')
        ->assertJsonPath('data.0.name', 'Clothing')
        ->assertJsonCount(1, 'data.0.children')
        ->assertJsonPath('data.0.children.0.name', 'Shirts')
        ->assertJsonPath('data.1.name', 'Crafts')
        ->assertJsonCount(0, 'data.1.children');

    $this->getJson('/api/v1/categories')->assertOk()->assertJsonCount(4, 'data');
});

it('caches the category tree as plain data that survives a Redis round trip', function () {
    $food = Category::factory()->create(['name' => 'Food']);
    Category::factory()->create(['name' => 'Snacks', 'parent_id' => $food->id]);

    $this->getJson('/api/v1/categories')->assertOk();

    // Redis stores serialized PHP; objects inside would come back as __PHP_Incomplete_Class.
    $cached = unserialize(serialize(Cache::get(Category::TREE_CACHE_KEY)), ['allowed_classes' => false]);
    expect($cached[0]['children'])->toBeArray()
        ->and($cached[0]['children'][0]['name'])->toBe('Snacks');

    Cache::put(Category::TREE_CACHE_KEY, $cached, 600);
    $this->getJson('/api/v1/categories')->assertJsonPath('data.0.children.0.name', 'Snacks');
});
