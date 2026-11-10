<?php

namespace App\Http\Controllers\Seller;

use App\Domain\Catalog\ReviewService;
use App\Http\Controllers\Controller;
use App\Http\Resources\ReviewResource;
use App\Models\ProductReview;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class ReviewController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $filters = $request->validate(['unanswered' => ['nullable', 'boolean']]);

        $reviews = ProductReview::query()
            ->where('seller_id', $request->attributes->get('seller')->id)
            ->with(['user', 'orderItem', 'product'])
            ->when($filters['unanswered'] ?? false, fn ($q) => $q->whereNull('seller_reply'))
            ->latest()
            ->latest('id')
            ->paginate(20)
            ->withQueryString();

        return ReviewResource::collection($reviews);
    }

    public function reply(Request $request, int $reviewId, ReviewService $reviews): ReviewResource
    {
        $data = $request->validate(['reply' => ['required', 'string', 'min:2', 'max:1000']]);

        $review = ProductReview::query()->where('seller_id', $request->attributes->get('seller')->id)->findOrFail($reviewId);

        return new ReviewResource($reviews->reply($review, trim($data['reply']))->load(['user', 'orderItem', 'product']));
    }
}
