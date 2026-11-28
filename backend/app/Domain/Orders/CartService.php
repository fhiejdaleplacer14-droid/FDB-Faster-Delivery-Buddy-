<?php

namespace App\Domain\Orders;

use App\Models\CartItem;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Seller;
use App\Models\User;
use App\Support\Money;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

class CartService
{
    public function add(User $user, int $variantId, int $quantity): void
    {
        $variant = $this->purchasableVariant($user, $variantId);
        $max = config('fdb.orders.max_quantity_per_item');

        $item = $user->cartItems()->where('product_variant_id', $variant->id)->first();
        $total = min($max, ($item?->quantity ?? 0) + $quantity);

        if (! $item && $user->cartItems()->count() >= config('fdb.orders.max_cart_lines')) {
            throw ValidationException::withMessages(['variant_id' => 'Your cart is full. Check out or remove some items first.']);
        }
        $this->ensureStock($variant, $total);

        $user->cartItems()->updateOrCreate(['product_variant_id' => $variant->id], ['quantity' => $total]);
    }

    public function update(User $user, CartItem $item, int $quantity): void
    {
        $variant = $this->purchasableVariant($user, $item->product_variant_id);
        $this->ensureStock($variant, $quantity);

        $item->update(['quantity' => $quantity]);
    }

    /**
     * Cart with current prices and stock.
     *
     * @return array{groups: list<array<string, mixed>>, total: string, item_count: int, can_checkout: bool}
     */
    public function summary(User $user): array
    {
        $items = $user->cartItems()
            ->with(['variant.product' => fn ($q) => $q->withTrashed()->with(['coverImage', 'seller'])])
            ->get();

        $visibleIds = Product::query()
            ->visibleToPublic()
            ->whereIn('products.id', $items->map(fn (CartItem $i) => $i->variant->product_id))
            ->pluck('products.id')
            ->flip();

        $lines = $items->map(fn (CartItem $item) => $this->line($item, $visibleIds->has($item->variant->product_id), $user));

        $groups = $lines
            ->groupBy(fn (array $line) => $line['seller']->id)
            ->map(function (Collection $sellerLines) {
                $seller = $sellerLines->first()['seller'];

                return [
                    'store' => ['id' => $seller->id, 'name' => $seller->store_name, 'slug' => $seller->slug],
                    'items' => $sellerLines->map(fn (array $l) => collect($l)->except('seller')->all())->values()->all(),
                    'subtotal' => Money::add(...$sellerLines->where('problem', null)->pluck('line_total')->all()),
                ];
            })
            ->values()
            ->all();

        return [
            'groups' => $groups,
            'total' => Money::add(...$lines->where('problem', null)->pluck('line_total')->all()),
            'item_count' => (int) $lines->sum('quantity'),
            'can_checkout' => $lines->isNotEmpty() && $lines->every(fn (array $l) => $l['problem'] === null),
        ];
    }

    /** @return array<string, mixed> */
    private function line(CartItem $item, bool $visible, User $user): array
    {
        $variant = $item->variant;
        $product = $variant->product;

        $problem = match (true) {
            ! $visible || $variant->trashed() => 'unavailable',
            $product->seller->user_id === $user->id => 'own_store',
            $variant->stock === 0 => 'out_of_stock',
            $variant->stock < $item->quantity => 'not_enough_stock',
            default => null,
        };

        return [
            'id' => $item->id,
            'variant_id' => $variant->id,
            'product' => ['id' => $product->id, 'name' => $product->name, 'slug' => $product->slug],
            'variant_name' => $variant->name,
            'image_url' => $product->coverImage?->url(),
            'unit_price' => $variant->price,
            'quantity' => $item->quantity,
            'stock' => $problem === 'unavailable' ? 0 : $variant->stock,
            'line_total' => Money::times($variant->price, $item->quantity),
            'problem' => $problem,
            'seller' => $product->seller,
        ];
    }

    private function purchasableVariant(User $user, int $variantId): ProductVariant
    {
        $variant = ProductVariant::query()
            ->whereKey($variantId)
            ->whereHas('product', fn ($q) => $q->visibleToPublic())
            ->first();

        if (! $variant) {
            throw ValidationException::withMessages(['variant_id' => 'This product is no longer available.']);
        }

        $sellerUserId = Seller::query()->whereKey(Product::query()->whereKey($variant->product_id)->value('seller_id'))->value('user_id');
        if ($sellerUserId === $user->id) {
            throw ValidationException::withMessages(['variant_id' => 'You cannot buy from your own store.']);
        }

        return $variant;
    }

    private function ensureStock(ProductVariant $variant, int $quantity): void
    {
        if ($variant->stock < $quantity) {
            throw ValidationException::withMessages([
                'quantity' => $variant->stock === 0 ? 'This item is out of stock.' : "Only {$variant->stock} left.",
            ]);
        }
    }
}
