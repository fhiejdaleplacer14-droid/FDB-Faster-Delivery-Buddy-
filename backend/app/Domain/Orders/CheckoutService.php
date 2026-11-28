<?php

namespace App\Domain\Orders;

use App\Domain\Commissions\CommissionService;
use App\Models\Address;
use App\Models\CartItem;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\SellerOrder;
use App\Models\User;
use App\Notifications\NewOrderReceived;
use App\Notifications\OrderPlaced;
use App\Support\Money;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class CheckoutService
{
    public function __construct(
        private readonly StockService $stock,
        private readonly CommissionService $commissions,
    ) {}

    /**
     * Returns [order, created]; a repeated idempotency key returns the first order.
     *
     * @return array{0: Order, 1: bool}
     */
    public function place(User $user, Address $address, string $paymentMethod, string $idempotencyKey, string $expectedTotal, ?string $note): array
    {
        if ($existing = $this->existing($user, $idempotencyKey)) {
            return [$existing, false];
        }

        try {
            return DB::transaction(function () use ($user, $address, $paymentMethod, $idempotencyKey, $expectedTotal, $note) {
                // One checkout at a time per customer; a duplicate that waited here then finds the first order.
                User::query()->whereKey($user->id)->lockForUpdate()->first();
                if ($existing = $this->existing($user, $idempotencyKey)) {
                    return [$existing, false];
                }

                return [$this->create($user, $address, $paymentMethod, $idempotencyKey, $expectedTotal, $note), true];
            });
        } catch (UniqueConstraintViolationException $e) {
            if ($existing = $this->existing($user, $idempotencyKey)) {
                return [$existing, false];
            }
            throw $e;
        }
    }

    private function create(User $user, Address $address, string $paymentMethod, string $idempotencyKey, string $expectedTotal, ?string $note): Order
    {
        $cart = CartItem::query()->where('user_id', $user->id)->orderBy('id')->lockForUpdate()->get();
        if ($cart->isEmpty()) {
            throw CheckoutProblem::emptyCart();
        }

        // Lock variants in id order so concurrent checkouts can't deadlock.
        $variants = ProductVariant::query()
            ->whereIn('id', $cart->pluck('product_variant_id'))
            ->orderBy('id')
            ->lockForUpdate()
            ->get()
            ->keyBy('id');

        $products = Product::query()
            ->visibleToPublic()
            ->whereIn('products.id', $variants->pluck('product_id'))
            ->with('seller.user')
            ->get()
            ->keyBy('id');

        $lines = $cart->map(function (CartItem $item) use ($variants, $products, $user) {
            $variant = $variants->get($item->product_variant_id);
            $product = $variant ? $products->get($variant->product_id) : null;

            if (! $variant || ! $product || $product->seller->user_id === $user->id || $variant->stock < $item->quantity) {
                throw CheckoutProblem::cartChanged();
            }

            return [
                'variant' => $variant,
                'product' => $product,
                'quantity' => $item->quantity,
                'line_total' => Money::times($variant->price, $item->quantity),
            ];
        });

        $itemsTotal = Money::add(...$lines->pluck('line_total')->all());
        if (! Money::equals($itemsTotal, $expectedTotal)) {
            throw CheckoutProblem::priceChanged($expectedTotal, $itemsTotal);
        }

        $order = new Order;
        $order->forceFill([
            'number' => $this->orderNumber(),
            'user_id' => $user->id,
            'idempotency_key' => $idempotencyKey,
            'status' => OrderStatus::InProgress,
            'payment_method' => $paymentMethod,
            'items_total' => $itemsTotal,
            'delivery_fee_total' => '0.00',
            'grand_total' => $itemsTotal,
            'recipient_name' => $address->recipient_name,
            'recipient_phone' => $address->phone,
            'municipality' => $address->municipality,
            'barangay' => $address->barangay,
            'street' => $address->street,
            'landmark' => $address->landmark,
            'customer_note' => $note,
            'placed_at' => now(),
        ])->save();

        $sellerOrders = $lines
            ->groupBy(fn (array $line) => $line['product']->seller_id)
            ->values()
            ->map(fn (Collection $sellerLines, int $index) => $this->createSellerOrder($order, $sellerLines, $index + 1, $user));

        $this->stock->take($lines->map(fn (array $l) => ['variant_id' => $l['variant']->id, 'quantity' => $l['quantity']])->all());
        $this->stock->refreshProducts($lines->pluck('product.id')->unique()->all());

        CartItem::query()->whereKey($cart->pluck('id'))->delete();

        $user->notify(new OrderPlaced($order));
        $sellerOrders->each(fn (SellerOrder $so) => $so->seller->user->notify(new NewOrderReceived($so)));

        return $order;
    }

    /** @param Collection<int, array{variant: ProductVariant, product: Product, quantity: int, line_total: string}> $lines */
    private function createSellerOrder(Order $order, Collection $lines, int $sequence, User $customer): SellerOrder
    {
        $itemsTotal = Money::add(...$lines->pluck('line_total')->all());

        $sellerOrder = new SellerOrder;
        $sellerOrder->forceFill([
            'order_id' => $order->id,
            'seller_id' => $lines->first()['product']->seller_id,
            'number' => $order->number.'-'.$sequence,
            'status' => SellerOrderStatus::PendingConfirmation,
            'payment_status' => PaymentStatus::Unpaid,
            'items_total' => $itemsTotal,
            'delivery_fee' => '0.00',
            'total' => $itemsTotal,
        ])->save();

        // Snapshot: later edits to the product or price must not change this order.
        $sellerOrder->items()->createMany($lines->map(fn (array $l) => [
            'product_id' => $l['product']->id,
            'product_variant_id' => $l['variant']->id,
            'product_name' => $l['product']->name,
            'variant_name' => $l['variant']->name,
            'unit_price' => $l['variant']->price,
            'quantity' => $l['quantity'],
            'line_total' => $l['line_total'],
        ])->all());

        $sellerOrder->history()->create([
            'from_status' => null,
            'to_status' => SellerOrderStatus::PendingConfirmation,
            'actor_id' => $customer->id,
        ]);

        $this->commissions->snapshot($sellerOrder);

        return $sellerOrder->setRelation('seller', $lines->first()['product']->seller);
    }

    private function existing(User $user, string $idempotencyKey): ?Order
    {
        return Order::query()->where('user_id', $user->id)->where('idempotency_key', $idempotencyKey)->first();
    }

    private function orderNumber(): string
    {
        $alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

        do {
            $suffix = collect(range(1, 6))->map(fn () => $alphabet[random_int(0, strlen($alphabet) - 1)])->implode('');
            $number = 'FDB-'.now(config('app.display_timezone'))->format('ymd').'-'.$suffix;
        } while (Order::query()->where('number', $number)->exists());

        return $number;
    }
}
