<?php

namespace App\Http\Controllers\Seller;

use App\Domain\Commissions\CommissionStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\CommissionRecordResource;
use App\Models\CommissionRecord;
use App\Models\Seller;
use App\Support\Money;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class CommissionController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $filters = $request->validate(['status' => ['nullable', Rule::enum(CommissionStatus::class)]]);

        /** @var Seller $seller */
        $seller = $request->attributes->get('seller');

        $totals = CommissionRecord::query()
            ->where('seller_id', $seller->id)
            ->groupBy('status')
            ->toBase()
            ->selectRaw('status, SUM(amount + adjustment_total) AS total')
            ->pluck('total', 'status');

        $records = CommissionRecord::query()
            ->where('seller_id', $seller->id)
            ->with(['sellerOrder', 'collection', 'adjustments'])
            ->when($filters['status'] ?? null, fn ($q, $s) => $q->where('status', $s))
            ->orderByDesc('id')
            ->paginate(25)
            ->withQueryString();

        return CommissionRecordResource::collection($records)->additional([
            'summary' => [
                'pending' => Money::add((string) ($totals['pending'] ?? '0')),
                'due' => Money::add((string) ($totals['due'] ?? '0')),
                'collected' => Money::add((string) ($totals['collected'] ?? '0')),
            ],
        ])->response();
    }
}
