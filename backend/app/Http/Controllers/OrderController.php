<?php

namespace App\Http\Controllers;

use App\Domain\Orders\OrderWorkflow;
use App\Http\Resources\OrderResource;
use App\Models\Order;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class OrderController extends Controller
{
    private const DETAIL = ['sellerOrders.seller', 'sellerOrders.items.product', 'sellerOrders.items.review', 'sellerOrders.history'];

    public function index(Request $request): AnonymousResourceCollection
    {
        $orders = Order::query()
            ->where('user_id', $request->user()->id)
            ->with(['sellerOrders.seller', 'sellerOrders.items'])
            ->orderByDesc('placed_at')
            ->orderByDesc('id')
            ->paginate(10);

        return OrderResource::collection($orders);
    }

    public function show(Request $request, string $number): OrderResource
    {
        return new OrderResource($this->own($request, $number)->load(self::DETAIL));
    }

    public function cancel(Request $request, string $number, string $sellerOrderNumber, OrderWorkflow $workflow): OrderResource
    {
        $data = $request->validate(['reason' => ['nullable', 'string', 'max:500']]);
        $order = $this->own($request, $number);
        $sellerOrder = $order->sellerOrders()->where('number', $sellerOrderNumber)->firstOrFail();

        $workflow->cancel($sellerOrder, $request->user(), 'customer', $data['reason'] ?? null);

        return new OrderResource($order->fresh()->load(self::DETAIL));
    }

    // Another customer's order number is a 404, so numbers reveal nothing.
    private function own(Request $request, string $number): Order
    {
        return Order::query()->where('user_id', $request->user()->id)->where('number', $number)->firstOrFail();
    }
}
