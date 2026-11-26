<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Identity\PermissionSlug;
use App\Domain\Orders\OrderStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\OrderResource;
use App\Models\Order;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class OrderController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        Gate::authorize('permission', PermissionSlug::OrdersView);

        $filters = $request->validate([
            'status' => ['nullable', Rule::enum(OrderStatus::class)],
            'search' => ['nullable', 'string', 'max:100'],
        ]);

        $orders = Order::query()
            ->with(['user', 'sellerOrders.seller'])
            ->when($filters['status'] ?? null, fn ($q, $status) => $q->where('status', $status))
            ->when($filters['search'] ?? null, function ($q, $search) {
                $term = '%'.addcslashes($search, '%_\\').'%';
                $q->where(fn ($q) => $q->where('number', 'ilike', $term)->orWhereHas('user', fn ($u) => $u->where('email', 'ilike', $term)));
            })
            ->orderByDesc('placed_at')
            ->orderByDesc('id')
            ->paginate(25)
            ->withQueryString();

        return OrderResource::collection($orders);
    }

    public function show(string $number): OrderResource
    {
        Gate::authorize('permission', PermissionSlug::OrdersView);

        $order = Order::query()
            ->where('number', $number)
            ->with(['user', 'sellerOrders.seller', 'sellerOrders.items', 'sellerOrders.history.actor', 'sellerOrders.refunds.recorder', 'sellerOrders.refunds.ticket'])
            ->firstOrFail();

        return new OrderResource($order);
    }
}
