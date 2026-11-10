<?php

namespace App\Domain\Orders;

use Illuminate\Http\JsonResponse;
use RuntimeException;

// The cart changed since the customer last saw it. Nothing was charged or reserved.
class CheckoutProblem extends RuntimeException
{
    /** @param array<string, mixed> $details */
    public function __construct(string $message, private readonly int $status, private readonly array $details = [])
    {
        parent::__construct($message);
    }

    public static function cartChanged(): self
    {
        return new self('Some items in your cart changed. Review your cart and try again.', 409, ['reason' => 'cart_changed']);
    }

    public static function priceChanged(string $expected, string $actual): self
    {
        return new self('Prices changed since you opened checkout. Review the new total before placing your order.', 409, [
            'reason' => 'price_changed',
            'expected_total' => $expected,
            'total' => $actual,
        ]);
    }

    public static function emptyCart(): self
    {
        return new self('Your cart is empty.', 422, ['reason' => 'empty_cart']);
    }

    public function render(): JsonResponse
    {
        return response()->json(['message' => $this->getMessage(), ...$this->details], $this->status);
    }
}
