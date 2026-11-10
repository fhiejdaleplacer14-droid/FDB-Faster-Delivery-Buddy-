<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Commissions\CommissionService;
use App\Domain\Commissions\CommissionStatus;
use App\Domain\Identity\PermissionSlug;
use App\Http\Controllers\Controller;
use App\Http\Resources\CommissionRecordResource;
use App\Models\CommissionCollection;
use App\Models\CommissionPolicy;
use App\Models\CommissionRecord;
use App\Models\Seller;
use App\Support\Money;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class CommissionController extends Controller
{
    public function __construct(private readonly CommissionService $commissions) {}

    public function policies(): JsonResponse
    {
        Gate::authorize('permission', PermissionSlug::CommissionsManage);

        $policies = CommissionPolicy::query()
            ->with(['seller', 'creator'])
            ->orderByRaw('seller_id IS NOT NULL')
            ->orderByDesc('effective_from')
            ->limit(200)
            ->get()
            ->map(fn (CommissionPolicy $p) => [
                'id' => $p->id,
                'store' => $p->seller ? ['id' => $p->seller->id, 'name' => $p->seller->store_name] : null,
                'rate' => $p->rate,
                'rate_percent' => rtrim(rtrim(bcmul($p->rate, '100', 2), '0'), '.'),
                'effective_from' => $p->effective_from->toIso8601ZuluString(),
                'effective_until' => $p->effective_until?->toIso8601ZuluString(),
                'active' => $p->effective_until === null,
                'notes' => $p->notes,
                'created_by' => $p->creator?->name,
            ]);

        return response()->json(['data' => $policies]);
    }

    public function setPolicy(Request $request): JsonResponse
    {
        Gate::authorize('permission', PermissionSlug::CommissionsManage);

        $data = $request->validate([
            'rate_percent' => ['required', 'decimal:0,2', 'gte:0', 'lte:'.config('fdb.commission.max_rate_percent')],
            'seller_id' => ['nullable', 'integer', Rule::exists('sellers', 'id')],
            'notes' => ['nullable', 'string', 'max:500'],
        ]);

        $seller = isset($data['seller_id']) ? Seller::query()->findOrFail($data['seller_id']) : null;
        $policy = $this->commissions->setPolicy($seller, bcadd((string) $data['rate_percent'], '0', 2), $data['notes'] ?? null, $request->user());

        return response()->json(['data' => ['id' => $policy->id, 'rate' => $policy->rate]], 201);
    }

    public function records(Request $request): AnonymousResourceCollection
    {
        Gate::authorize('permission', PermissionSlug::CommissionsManage);

        $filters = $request->validate([
            'status' => ['nullable', Rule::enum(CommissionStatus::class)],
            'seller_id' => ['nullable', 'integer'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $records = CommissionRecord::query()
            ->with(['sellerOrder', 'seller', 'collection', 'adjustments'])
            ->when($filters['status'] ?? null, fn ($q, $s) => $q->where('status', $s))
            ->when($filters['seller_id'] ?? null, fn ($q, $id) => $q->where('seller_id', $id))
            ->orderByRaw('due_at IS NULL')
            ->orderBy('due_at')
            ->orderByDesc('id')
            ->paginate($filters['per_page'] ?? 50)
            ->withQueryString();

        return CommissionRecordResource::collection($records);
    }

    public function adjust(Request $request, CommissionRecord $record): CommissionRecordResource
    {
        Gate::authorize('permission', PermissionSlug::CommissionsManage);

        $data = $request->validate([
            'amount' => ['required', 'decimal:0,2', 'not_in:0,0.0,0.00', 'gte:-1000000', 'lte:1000000'],
            'reason' => ['required', 'string', 'min:5', 'max:500'],
        ]);

        $record = $this->commissions->adjust($record, bcadd((string) $data['amount'], '0', 2), trim($data['reason']), $request->user());

        return new CommissionRecordResource($record->load(['sellerOrder', 'seller', 'collection', 'adjustments']));
    }

    public function collections(): JsonResponse
    {
        Gate::authorize('permission', PermissionSlug::CommissionsManage);

        $collections = CommissionCollection::query()
            ->with(['seller', 'recorder'])
            ->withCount('records')
            ->orderByDesc('collected_at')
            ->limit(100)
            ->get()
            ->map(fn (CommissionCollection $c) => [
                'id' => $c->id,
                'store' => ['id' => $c->seller->id, 'name' => $c->seller->store_name],
                'amount' => $c->amount,
                'method' => $c->method,
                'reference' => $c->reference,
                'notes' => $c->notes,
                'records_count' => $c->records_count,
                'collected_at' => $c->collected_at->toIso8601ZuluString(),
                'recorded_by' => $c->recorder?->name,
            ]);

        return response()->json(['data' => $collections]);
    }

    public function collect(Request $request): JsonResponse
    {
        Gate::authorize('permission', PermissionSlug::CommissionsManage);

        $data = $request->validate([
            'seller_id' => ['required', 'integer', Rule::exists('sellers', 'id')],
            'record_ids' => ['required', 'array', 'min:1', 'max:500'],
            'record_ids.*' => ['integer', 'distinct'],
            'method' => ['required', Rule::in(config('fdb.commission.collection_methods'))],
            'reference' => ['nullable', 'string', 'max:100'],
            'notes' => ['nullable', 'string', 'max:500'],
            'collected_at' => ['nullable', 'date', 'before_or_equal:now'],
        ]);

        $collection = $this->commissions->collect(
            Seller::query()->findOrFail($data['seller_id']),
            $data['record_ids'],
            $data['method'],
            $data['reference'] ?? null,
            $data['notes'] ?? null,
            isset($data['collected_at']) ? Carbon::parse($data['collected_at']) : now(),
            $request->user(),
        );

        return response()->json(['data' => ['id' => $collection->id, 'amount' => $collection->amount]], 201);
    }

    public function sellerBalances(): JsonResponse
    {
        Gate::authorize('permission', PermissionSlug::CommissionsManage);

        $rows = CommissionRecord::query()
            ->where('commission_records.status', CommissionStatus::Due)
            ->join('sellers', 'sellers.id', '=', 'commission_records.seller_id')
            ->groupBy('sellers.id', 'sellers.store_name')
            ->orderBy('sellers.store_name')
            ->toBase()
            ->get(['sellers.id', 'sellers.store_name', DB::raw('COUNT(*) AS records'), DB::raw('SUM(commission_records.amount + commission_records.adjustment_total) AS due')])
            ->map(fn ($r) => ['seller_id' => $r->id, 'store_name' => $r->store_name, 'records' => (int) $r->records, 'due' => Money::add((string) $r->due)]);

        return response()->json(['data' => $rows]);
    }
}
