<?php

namespace App\Http\Controllers\Seller;

use App\Domain\Orders\OrderWorkflow;
use App\Domain\Orders\RefundService;
use App\Http\Requests\Orders\RecordRefundRequest;
use App\Domain\Orders\SellerOrderStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\SellerOrderResource;
use App\Models\Seller;
use App\Models\SellerOrder;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

// Suspended sellers keep access here so customers already waiting still get their orders.
class OrderController extends Controller
{
    private const DETAIL = ['items.product', 'history', 'order.user', 'refunds.ticket'];

    public function __construct(private readonly OrderWorkflow $workflow) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $filters = $request->validate([
            'status' => ['nullable', Rule::in([...array_column(SellerOrderStatus::cases(), 'value'), 'open'])],
            'search' => ['nullable', 'string', 'max:40'],
        ]);

        $orders = $this->seller($request)->sellerOrders()
            ->with(['items', 'order'])
            ->when($filters['status'] ?? null, fn ($q, $status) => $status === 'open'
                ? $q->whereNotIn('status', [SellerOrderStatus::Delivered, SellerOrderStatus::Cancelled])
                : $q->where('status', $status))
            ->when($filters['search'] ?? null, fn ($q, $s) => $q->where('number', 'ilike', '%'.addcslashes($s, '%_\\').'%'))
            // Orders waiting for a decision come first.
            ->orderByRaw("CASE WHEN status = 'pending_confirmation' THEN 0 ELSE 1 END")
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate(25)
            ->withQueryString();

        return SellerOrderResource::collection($orders);
    }

    public function show(Request $request, int $sellerOrderId): SellerOrderResource
    {
        return $this->resource($this->owned($request, $sellerOrderId));
    }

    public function updateStatus(Request $request, int $sellerOrderId): SellerOrderResource
    {
        $data = $request->validate([
            'status' => ['required', Rule::enum(SellerOrderStatus::class)->except([SellerOrderStatus::PendingConfirmation, SellerOrderStatus::Cancelled])],
            'note' => ['nullable', 'string', 'max:500'],
        ]);

        $order = $this->workflow->advance($this->owned($request, $sellerOrderId), SellerOrderStatus::from($data['status']), $request->user(), $data['note'] ?? null);

        return $this->resource($order);
    }

    public function cancel(Request $request, int $sellerOrderId): SellerOrderResource
    {
        $data = $request->validate(['reason' => ['required', 'string', 'min:5', 'max:500']]);

        $order = $this->workflow->cancel($this->owned($request, $sellerOrderId), $request->user(), 'seller', trim($data['reason']));

        return $this->resource($order);
    }

    public function paymentReceived(Request $request, int $sellerOrderId): SellerOrderResource
    {
        return $this->resource($this->workflow->markPaid($this->owned($request, $sellerOrderId), $request->user()));
    }

    public function delivery(Request $request, int $sellerOrderId): SellerOrderResource
    {
        $data = $request->validate(['delivery_note' => ['nullable', 'string', 'max:500']]);

        return $this->resource($this->workflow->updateDeliveryNote($this->owned($request, $sellerOrderId), $data['delivery_note'] ?? null));
    }

    public function refund(RecordRefundRequest $request, int $sellerOrderId, RefundService $refunds): SellerOrderResource
    {
        $order = $this->owned($request, $sellerOrderId);
        $request->record($refunds, $order, $request->user(), 'seller');

        return $this->resource($order);
    }

    private function seller(Request $request): Seller
    {
        return $request->attributes->get('seller');
    }

    // Another seller's order is a 404.
    private function owned(Request $request, int $id): SellerOrder
    {
        return SellerOrder::query()->where('seller_id', $this->seller($request)->id)->findOrFail($id);
    }

    private function resource(SellerOrder $sellerOrder): SellerOrderResource
    {
        return new SellerOrderResource($sellerOrder->fresh()->load(self::DETAIL));
    }
}
