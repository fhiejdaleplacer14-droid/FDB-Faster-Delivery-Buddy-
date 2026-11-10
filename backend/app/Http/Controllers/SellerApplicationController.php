<?php

namespace App\Http\Controllers;

use App\Domain\Sellers\SellerApplicationService;
use App\Http\Requests\Sellers\ResubmitSellerApplicationRequest;
use App\Http\Requests\Sellers\SellerApplicationRequest;
use App\Http\Resources\SellerApplicationResource;
use App\Models\Seller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class SellerApplicationController extends Controller
{
    public function __construct(private readonly SellerApplicationService $applications) {}

    public function show(Request $request): SellerApplicationResource|JsonResponse
    {
        $seller = $this->ownSeller($request);

        if (! $seller) {
            return response()->json(['message' => 'You have not applied to sell on FDB yet.'], 404);
        }

        return new SellerApplicationResource($seller->load('documents', 'statusHistory'));
    }

    public function store(SellerApplicationRequest $request): JsonResponse
    {
        if ($this->ownSeller($request)) {
            return response()->json(['message' => 'You have already applied to sell on FDB.'], 409);
        }

        $seller = $this->applications->submit($request->user(), $request->details(), $request->documentUploads());

        return (new SellerApplicationResource($seller->load('documents', 'statusHistory')))
            ->response()
            ->setStatusCode(201);
    }

    public function resubmit(ResubmitSellerApplicationRequest $request): SellerApplicationResource|JsonResponse
    {
        $seller = $this->ownSeller($request);

        if (! $seller) {
            return response()->json(['message' => 'You have not applied to sell on FDB yet.'], 404);
        }

        Gate::authorize('resubmit', $seller);

        $seller = $this->applications->resubmit($seller, $request->user(), $request->details(), $request->documentUploads());

        return new SellerApplicationResource($seller->load('documents', 'statusHistory'));
    }

    private function ownSeller(Request $request): ?Seller
    {
        return Seller::query()->where('user_id', $request->user()->id)->first();
    }
}
