<?php

namespace App\Http\Controllers;

use App\Domain\Orders\CartService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CartController extends Controller
{
    public function __construct(private readonly CartService $cart) {}

    public function show(Request $request): JsonResponse
    {
        return $this->summary($request);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'variant_id' => ['required', 'integer'],
            'quantity' => ['required', 'integer', 'min:1', 'max:'.config('fdb.orders.max_quantity_per_item')],
        ]);

        $this->cart->add($request->user(), $data['variant_id'], $data['quantity']);

        return $this->summary($request, 201);
    }

    public function update(Request $request, int $itemId): JsonResponse
    {
        $data = $request->validate([
            'quantity' => ['required', 'integer', 'min:1', 'max:'.config('fdb.orders.max_quantity_per_item')],
        ]);

        $this->cart->update($request->user(), $request->user()->cartItems()->findOrFail($itemId), $data['quantity']);

        return $this->summary($request);
    }

    public function destroy(Request $request, int $itemId): JsonResponse
    {
        $request->user()->cartItems()->findOrFail($itemId)->delete();

        return $this->summary($request);
    }

    private function summary(Request $request, int $status = 200): JsonResponse
    {
        $enabled = config('fdb.orders.payment_methods');
        $methods = collect(config('fdb.orders.payment_method_labels'))
            ->map(fn (string $label, string $value) => ['value' => $value, 'label' => $label, 'available' => in_array($value, $enabled, true)])
            ->values();

        return response()->json([
            'data' => $this->cart->summary($request->user()),
            'meta' => ['payment_methods' => $methods],
        ], $status);
    }
}
