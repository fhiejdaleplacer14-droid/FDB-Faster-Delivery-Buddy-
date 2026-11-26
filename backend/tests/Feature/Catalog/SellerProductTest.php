<?php

use App\Domain\Catalog\ProductStatus;
use App\Models\Category;
use App\Models\Product;
use App\Models\Seller;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    Storage::fake('media');
    $this->seller = Seller::factory()->approved()->create();
    $this->category = Category::factory()->create();
});

function productPayload(int $categoryId, array $overrides = []): array
{
    return array_replace([
        'category_id' => $categoryId,
        'name' => 'Dried Mangoes 250g',
        'description' => 'Sweet dried mangoes from Guihulngan.',
        'variants' => [
            ['name' => '250 g', 'price' => '120.50', 'stock' => 15],
            ['name' => '500 g', 'price' => 220, 'stock' => 0],
        ],
    ], $overrides);
}

it('creates a draft listing with options and cached price and stock', function () {
    $this->actingAs($this->seller->user)->postJson('/api/v1/seller/products', productPayload($this->category->id))
        ->assertCreated()
        ->assertJsonPath('data.status', 'draft')
        ->assertJsonPath('data.price_from', '120.50')
        ->assertJsonPath('data.stock_total', 15)
        ->assertJsonPath('data.variants.1.price', '220.00')
        ->assertJsonCount(2, 'data.variants');

    expect(Product::sole()->seller_id)->toBe($this->seller->id);
});

it('ignores seller, status, and price fields sent at the top level', function () {
    $other = Seller::factory()->approved()->create();

    $this->actingAs($this->seller->user)->postJson('/api/v1/seller/products', productPayload($this->category->id, [
        'seller_id' => $other->id,
        'status' => 'published',
        'price_from' => '0.01',
    ]))->assertCreated()->assertJsonPath('data.status', 'draft')->assertJsonPath('data.price_from', '120.50');

    expect(Product::sole()->seller_id)->toBe($this->seller->id);
});

it('validates prices, stock, and option names', function (array $variants, string $field) {
    $this->actingAs($this->seller->user)->postJson('/api/v1/seller/products', productPayload($this->category->id, ['variants' => $variants]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors($field);
})->with([
    'three decimals' => [[['name' => 'A', 'price' => '10.999', 'stock' => 1]], 'variants.0.price'],
    'zero price' => [[['name' => 'A', 'price' => '0', 'stock' => 1]], 'variants.0.price'],
    'negative stock' => [[['name' => 'A', 'price' => '10', 'stock' => -1]], 'variants.0.stock'],
    'duplicate names' => [[['name' => 'Big', 'price' => '10', 'stock' => 1], ['name' => 'big', 'price' => '12', 'stock' => 1]], 'variants.1.name'],
    'no options' => [[], 'variants'],
]);

it('rejects inactive categories', function () {
    $closed = Category::factory()->inactive()->create();

    $this->actingAs($this->seller->user)->postJson('/api/v1/seller/products', productPayload($closed->id))
        ->assertJsonValidationErrors('category_id');
});

it('updates options, keeping removed ones for order history', function () {
    $product = Product::factory()->create(['seller_id' => $this->seller->id, 'category_id' => $this->category->id]);
    $regular = $product->variants()->sole();

    $this->actingAs($this->seller->user)->putJson("/api/v1/seller/products/{$product->id}", productPayload($this->category->id, [
        'variants' => [['name' => 'Regular', 'price' => '80.00', 'stock' => 3], ['id' => $regular->id, 'name' => 'Large', 'price' => '150', 'stock' => 2]],
    ]))->assertOk()->assertJsonPath('data.price_from', '80.00')->assertJsonPath('data.stock_total', 5);

    expect($regular->fresh()->name)->toBe('Large');

    $this->actingAs($this->seller->user)->putJson("/api/v1/seller/products/{$product->id}", productPayload($this->category->id, [
        'variants' => [['id' => $regular->id, 'name' => 'Large', 'price' => '150', 'stock' => 2]],
    ]))->assertOk()->assertJsonCount(1, 'data.variants');

    expect($product->variants()->withTrashed()->count())->toBe(2);
});

it('re-adds an option with the name of one removed in the same save', function () {
    $product = Product::factory()->create(['seller_id' => $this->seller->id, 'category_id' => $this->category->id]);

    $this->actingAs($this->seller->user)->putJson("/api/v1/seller/products/{$product->id}", productPayload($this->category->id, [
        'variants' => [['name' => 'Regular', 'price' => '90', 'stock' => 1]],
    ]))->assertOk()->assertJsonPath('data.variants.0.price', '90.00');
});

it('requires a photo before submitting, then sends the listing for review', function () {
    config(['fdb.catalog.requires_review' => true]);
    $product = Product::factory()->create(['seller_id' => $this->seller->id, 'category_id' => $this->category->id]);

    $this->actingAs($this->seller->user)->postJson("/api/v1/seller/products/{$product->id}/submit")
        ->assertUnprocessable()->assertJsonValidationErrors('images');

    $this->actingAs($this->seller->user)
        ->post("/api/v1/seller/products/{$product->id}/images", ['image' => UploadedFile::fake()->image('photo.jpg', 2400, 1800)], ['Accept' => 'application/json'])
        ->assertCreated();

    $this->actingAs($this->seller->user)->postJson("/api/v1/seller/products/{$product->id}/submit")
        ->assertOk()->assertJsonPath('data.status', 'pending_review');
});

it('publishes immediately when review is turned off', function () {
    config(['fdb.catalog.requires_review' => false]);
    $product = Product::factory()->withImage()->create(['seller_id' => $this->seller->id, 'category_id' => $this->category->id]);

    $this->actingAs($this->seller->user)->postJson("/api/v1/seller/products/{$product->id}/submit")
        ->assertOk()->assertJsonPath('data.status', 'published');
});

it('sends a published listing back for review when its content changes, but not for price or stock', function () {
    config(['fdb.catalog.requires_review' => true]);
    $product = Product::factory()->published()->create(['seller_id' => $this->seller->id, 'category_id' => $this->category->id, 'name' => 'Rice', 'description' => 'Well-milled rice.']);
    $variant = $product->variants()->sole();
    $payload = fn (array $o = []) => productPayload($this->category->id, array_replace([
        'name' => 'Rice', 'description' => 'Well-milled rice.',
        'variants' => [['id' => $variant->id, 'name' => 'Regular', 'price' => '55', 'stock' => 40]],
    ], $o));

    $this->actingAs($this->seller->user)->putJson("/api/v1/seller/products/{$product->id}", $payload())
        ->assertOk()->assertJsonPath('data.status', 'published');

    $this->actingAs($this->seller->user)->putJson("/api/v1/seller/products/{$product->id}", $payload(['name' => 'Premium Rice']))
        ->assertOk()->assertJsonPath('data.status', 'pending_review');
});

it('processes photos: strips metadata, limits size, and stores webp under a random name', function () {
    $product = Product::factory()->create(['seller_id' => $this->seller->id, 'category_id' => $this->category->id]);

    $this->actingAs($this->seller->user)
        ->post("/api/v1/seller/products/{$product->id}/images", ['image' => UploadedFile::fake()->image('IMG_2024 my house.jpg', 3000, 2000)], ['Accept' => 'application/json'])
        ->assertCreated()
        ->assertJsonPath('data.images.0.width', 1600)
        ->assertJsonPath('data.images.0.height', 1067);

    $image = $product->images()->sole();
    Storage::disk('media')->assertExists($image->path);
    expect($image->path)->toEndWith('.webp')->not->toContain('my house');

    $stored = Storage::disk('media')->get($image->path);
    expect(substr($stored, 0, 4))->toBe('RIFF')->and(str_contains($stored, 'Exif'))->toBeFalse();
});

it('turns phone photos upright using their EXIF orientation', function () {
    $product = Product::factory()->create(['seller_id' => $this->seller->id, 'category_id' => $this->category->id]);
    $path = base_path('tests/Fixtures/rotated-orientation-6.jpg');

    $this->actingAs($this->seller->user)
        ->post("/api/v1/seller/products/{$product->id}/images", ['image' => new UploadedFile($path, 'phone.jpg', null, null, true)], ['Accept' => 'application/json'])
        ->assertCreated()
        ->assertJsonPath('data.images.0.width', 20)
        ->assertJsonPath('data.images.0.height', 40);
});

it('rejects files that are not real images', function () {
    $product = Product::factory()->create(['seller_id' => $this->seller->id, 'category_id' => $this->category->id]);

    $this->actingAs($this->seller->user)
        ->post("/api/v1/seller/products/{$product->id}/images", ['image' => realUpload('photo.jpg', '<?php system($_GET["c"]);')], ['Accept' => 'application/json'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('image');

    expect(Storage::disk('media')->allFiles())->toBe([]);
});

it('limits photos per listing and reorders them', function () {
    config(['fdb.catalog.max_images' => 2]);
    $product = Product::factory()->create(['seller_id' => $this->seller->id, 'category_id' => $this->category->id]);
    $upload = fn () => $this->actingAs($this->seller->user)->post("/api/v1/seller/products/{$product->id}/images", ['image' => UploadedFile::fake()->image('p.png', 100, 100)], ['Accept' => 'application/json']);

    $upload()->assertCreated();
    $upload()->assertCreated();
    $upload()->assertUnprocessable()->assertJsonValidationErrors('image');
    expect(Storage::disk('media')->allFiles())->toHaveCount(2);

    [$first, $second] = $product->images()->pluck('id')->all();
    $this->actingAs($this->seller->user)->putJson("/api/v1/seller/products/{$product->id}/images/order", ['image_ids' => [$second, $first]])
        ->assertOk()->assertJsonPath('data.images.0.id', $second);
    $this->actingAs($this->seller->user)->putJson("/api/v1/seller/products/{$product->id}/images/order", ['image_ids' => [$second]])
        ->assertUnprocessable();
});

it('deletes a photo and its file', function () {
    $product = Product::factory()->create(['seller_id' => $this->seller->id, 'category_id' => $this->category->id]);
    $this->actingAs($this->seller->user)->post("/api/v1/seller/products/{$product->id}/images", ['image' => UploadedFile::fake()->image('p.png')], ['Accept' => 'application/json']);
    $image = $product->images()->sole();

    $this->actingAs($this->seller->user)->deleteJson("/api/v1/seller/products/{$product->id}/images/{$image->id}")->assertOk();

    Storage::disk('media')->assertMissing($image->path);
});

it('archives and restores a listing', function () {
    $product = Product::factory()->published()->create(['seller_id' => $this->seller->id, 'category_id' => $this->category->id]);

    $this->actingAs($this->seller->user)->postJson("/api/v1/seller/products/{$product->id}/archive")->assertOk()->assertJsonPath('data.status', 'archived');
    $this->actingAs($this->seller->user)->putJson("/api/v1/seller/products/{$product->id}", productPayload($this->category->id))->assertConflict();
    $this->actingAs($this->seller->user)->postJson("/api/v1/seller/products/{$product->id}/restore")->assertOk()->assertJsonPath('data.status', 'draft');
});

it('lists only the signed-in seller own listings', function () {
    Product::factory()->count(2)->create(['seller_id' => $this->seller->id]);
    Product::factory()->create();

    $this->actingAs($this->seller->user)->getJson('/api/v1/seller/products')->assertOk()->assertJsonCount(2, 'data');
});

it('keeps sellers out of each other listings', function (string $method, string $path) {
    $mine = Product::factory()->create(['seller_id' => $this->seller->id]);
    $theirs = Product::factory()->withImage()->create();
    $image = $theirs->images()->sole();
    $uri = str_replace(['{id}', '{image}'], [$theirs->id, $image->id], $path);

    $this->actingAs($this->seller->user)->json($method, $uri, productPayload($this->category->id) + ['image_ids' => [$image->id]])
        ->assertNotFound();

    expect($theirs->fresh()->status)->toBe(ProductStatus::Draft)
        ->and($theirs->images()->count())->toBe(1)
        ->and($mine->fresh())->not->toBeNull();
})->with([
    ['GET', '/api/v1/seller/products/{id}'],
    ['PUT', '/api/v1/seller/products/{id}'],
    ['POST', '/api/v1/seller/products/{id}/submit'],
    ['POST', '/api/v1/seller/products/{id}/archive'],
    ['PUT', '/api/v1/seller/products/{id}/images/order'],
    ['DELETE', '/api/v1/seller/products/{id}/images/{image}'],
]);

it('blocks accounts without an approved store', function (string $who) {
    $user = match ($who) {
        'customer' => User::factory()->customer()->create(),
        'pending applicant' => Seller::factory()->create()->user,
        'rejected applicant' => Seller::factory()->rejected()->create()->user,
    };

    $this->actingAs($user)->getJson('/api/v1/seller/products')->assertForbidden();
    $this->actingAs($user)->postJson('/api/v1/seller/products', productPayload($this->category->id))->assertForbidden();
})->with(['customer', 'pending applicant', 'rejected applicant']);

it('lets suspended sellers view but not change listings', function () {
    $suspended = Seller::factory()->suspended()->create();
    $product = Product::factory()->withImage()->create(['seller_id' => $suspended->id]);

    $this->actingAs($suspended->user)->getJson('/api/v1/seller/products')->assertOk();
    $this->actingAs($suspended->user)->postJson('/api/v1/seller/products', productPayload($this->category->id))->assertForbidden();
    $this->actingAs($suspended->user)->postJson("/api/v1/seller/products/{$product->id}/submit")->assertForbidden();
});

it('files a listing under Others with the seller\'s description when no category fits', function () {
    $this->actingAs($this->seller->user)->postJson('/api/v1/seller/products', productPayload($this->category->id, [
        'category_id' => null,
        'suggested_category' => '  Handmade soap ',
    ]))->assertCreated()
        ->assertJsonPath('data.suggested_category', 'Handmade soap')
        ->assertJsonPath('data.category.slug', 'others');

    expect(Category::where('slug', 'others')->count())->toBe(1);
});

it('needs a category or a description of the product', function () {
    $this->actingAs($this->seller->user)->postJson('/api/v1/seller/products', productPayload($this->category->id, ['category_id' => null]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['category_id', 'suggested_category']);
});

it('drops the suggestion when a real category is chosen', function () {
    $this->actingAs($this->seller->user)->postJson('/api/v1/seller/products', productPayload($this->category->id, [
        'suggested_category' => 'Handmade soap',
    ]))->assertCreated()->assertJsonPath('data.suggested_category', null);
});
