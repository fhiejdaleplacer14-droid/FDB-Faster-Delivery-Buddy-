<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Sellers\SellerApplicationService;
use App\Domain\Sellers\SellerStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Sellers\SellerDecisionRequest;
use App\Http\Resources\SellerApplicationResource;
use App\Models\Seller;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class SellerController extends Controller
{
    public function __construct(private readonly SellerApplicationService $applications) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        Gate::authorize('viewAny', Seller::class);

        $filters = $request->validate([
            'status' => ['nullable', Rule::enum(SellerStatus::class)],
            'search' => ['nullable', 'string', 'max:100'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:50'],
        ]);

        $sellers = Seller::query()
            ->with(['user', 'reviewer'])
            ->when($filters['status'] ?? null, fn (Builder $q, string $status) => $q->where('status', $status))
            ->when($filters['search'] ?? null, function (Builder $q, string $search) {
                $term = '%'.addcslashes($search, '%_\\').'%';
                $q->where(fn (Builder $q) => $q
                    ->where('store_name', 'ilike', $term)
                    ->orWhereHas('user', fn (Builder $u) => $u->where('email', 'ilike', $term)->orWhere('name', 'ilike', $term)));
            })
            ->orderByDesc('submitted_at')
            ->orderByDesc('id')
            ->paginate($filters['per_page'] ?? 20)
            ->withQueryString();

        $collection = SellerApplicationResource::collection($sellers);
        $collection->collection->each->forAdmin();

        return $collection;
    }

    public function show(Seller $seller): SellerApplicationResource
    {
        Gate::authorize('view', $seller);

        return $this->adminResource($seller);
    }

    public function approve(SellerDecisionRequest $request, Seller $seller): SellerApplicationResource
    {
        Gate::authorize('review', $seller);

        return $this->decide($request, $seller, SellerStatus::Pending, SellerStatus::Approved);
    }

    public function reject(SellerDecisionRequest $request, Seller $seller): SellerApplicationResource
    {
        Gate::authorize('review', $seller);

        return $this->decide($request, $seller, SellerStatus::Pending, SellerStatus::Rejected);
    }

    public function suspend(SellerDecisionRequest $request, Seller $seller): SellerApplicationResource
    {
        Gate::authorize('manage', $seller);

        return $this->decide($request, $seller, SellerStatus::Approved, SellerStatus::Suspended);
    }

    public function reactivate(SellerDecisionRequest $request, Seller $seller): SellerApplicationResource
    {
        Gate::authorize('manage', $seller);

        return $this->decide($request, $seller, SellerStatus::Suspended, SellerStatus::Approved);
    }

    private function decide(SellerDecisionRequest $request, Seller $seller, SellerStatus $from, SellerStatus $to): SellerApplicationResource
    {
        $seller = $this->applications->transition($seller, $from, $to, $request->user(), $request->reason());

        return $this->adminResource($seller);
    }

    private function adminResource(Seller $seller): SellerApplicationResource
    {
        return (new SellerApplicationResource($seller->load(['user', 'reviewer', 'documents', 'statusHistory.actor'])))->forAdmin();
    }
}
