<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Identity\PermissionSlug;
use App\Domain\Orders\RefundService;
use App\Http\Controllers\Controller;
use App\Http\Requests\Orders\RecordRefundRequest;
use App\Http\Resources\RefundResource;
use App\Http\Resources\SellerOrderResource;
use App\Models\Refund;
use App\Models\SellerOrder;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class RefundController extends Controller
{
    private const DETAIL = ['sellerOrder.order', 'seller', 'recorder', 'ticket'];

    public function __construct(private readonly RefundService $refunds) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        Gate::authorize('permission', PermissionSlug::RefundsManage);

        $filters = $request->validate([
            'credit' => ['nullable', Rule::in(['owed', 'settled'])],
            'seller_id' => ['nullable', 'integer'],
        ]);

        $query = Refund::query()
            ->when($filters['seller_id'] ?? null, fn ($q, $id) => $q->where('seller_id', $id))
            ->when(($filters['credit'] ?? null) === 'owed', fn ($q) => $q->where('commission_credit', '>', 0)->whereNull('credit_settled_at'))
            ->when(($filters['credit'] ?? null) === 'settled', fn ($q) => $q->whereNotNull('credit_settled_at'));

        $owed = bcadd((string) Refund::query()->where('commission_credit', '>', 0)->whereNull('credit_settled_at')->sum('commission_credit'), '0', 2);

        return RefundResource::collection($query->clone()->with(self::DETAIL)->orderByDesc('refunded_at')->orderByDesc('id')->paginate(25)->withQueryString())
            ->additional(['summary' => ['credit_owed' => $owed, 'total' => bcadd((string) $query->clone()->sum('amount'), '0', 2)]]);
    }

    public function store(RecordRefundRequest $request, int $sellerOrderId): SellerOrderResource
    {
        Gate::authorize('permission', PermissionSlug::RefundsManage);

        $sellerOrder = SellerOrder::query()->findOrFail($sellerOrderId);
        $request->record($this->refunds, $sellerOrder, $request->user(), 'admin');

        return new SellerOrderResource($sellerOrder->fresh()->load(['seller', 'items', 'history.actor', 'refunds.recorder', 'refunds.ticket']));
    }

    public function settleCredit(Request $request, int $refundId): RefundResource
    {
        Gate::authorize('permission', PermissionSlug::RefundsManage);

        $refund = $this->refunds->settleCredit(Refund::query()->findOrFail($refundId), $request->user());

        return new RefundResource($refund->load(self::DETAIL));
    }
}
