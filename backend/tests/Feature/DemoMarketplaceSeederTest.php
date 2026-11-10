<?php

use App\Models\Product;
use App\Models\Seller;
use Database\Seeders\DemoMarketplaceSeeder;
use Illuminate\Support\Facades\Storage;

it('builds a browsable demo catalog with credited photos, and is safe to rerun', function () {
    Storage::fake('media');

    $this->seed(DemoMarketplaceSeeder::class);
    $this->seed(DemoMarketplaceSeeder::class);

    expect(Seller::count())->toBe(6)
        ->and(Product::count())->toBe(24);

    $this->getJson('/api/v1/products?per_page=48')->assertOk()->assertJsonCount(24, 'data');
    $this->getJson('/api/v1/products?search=bangus&municipality=san_carlos_city')->assertJsonPath('data.0.name', 'Bangus (Milkfish)');

    $mangoes = Product::where('name', 'Dried Mangoes')->sole();
    expect($mangoes->description)->toContain('via Wikimedia Commons')
        ->and($mangoes->images()->sole()->path)->toEndWith('.webp');
    Storage::disk('media')->assertExists($mangoes->images()->sole()->path);
});

it('refuses to run in production', function () {
    app()->detectEnvironment(fn () => 'production');

    // Called directly: db:seed itself also asks for confirmation in production, which would hide this guard.
    expect(fn () => app()->call([app(DemoMarketplaceSeeder::class), 'run']))->toThrow(RuntimeException::class, 'never be seeded into production');
    expect(Product::count())->toBe(0);
});
