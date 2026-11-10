<?php

namespace Database\Factories;

use App\Domain\Catalog\ProductStatus;
use App\Models\Category;
use App\Models\Product;
use App\Models\Seller;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Product>
 */
class ProductFactory extends Factory
{
    public function definition(): array
    {
        $name = Str::title(fake()->unique()->words(3, true));

        return [
            'seller_id' => Seller::factory()->approved(),
            'category_id' => Category::factory(),
            'name' => $name,
            'slug' => Str::slug($name).'-'.Str::lower(Str::random(5)),
            'description' => fake()->paragraph(),
            'status' => ProductStatus::Draft,
            'price_from' => '100.00',
            'stock_total' => 10,
        ];
    }

    /** One variant matching price_from and stock_total, as ProductService would create. */
    public function configure(): static
    {
        return $this->afterCreating(function (Product $product) {
            $product->variants()->create([
                'name' => 'Regular',
                'price' => $product->price_from,
                'stock' => $product->stock_total,
                'position' => 0,
            ]);
        });
    }

    public function published(): static
    {
        return $this->state(fn () => [
            'status' => ProductStatus::Published,
            'submitted_at' => now()->subDay(),
            'published_at' => now()->subDay(),
        ]);
    }

    public function pendingReview(): static
    {
        return $this->state(fn () => ['status' => ProductStatus::PendingReview, 'submitted_at' => now()]);
    }

    public function priced(string $price, int $stock = 10): static
    {
        return $this->state(fn () => ['price_from' => $price, 'stock_total' => $stock]);
    }

    public function withImage(): static
    {
        return $this->afterCreating(fn (Product $product) => $product->images()->create([
            'disk' => 'media',
            'path' => 'products/test/'.Str::uuid7().'.webp',
            'width' => 800,
            'height' => 600,
            'size_bytes' => 1000,
            'position' => 0,
        ]));
    }
}
