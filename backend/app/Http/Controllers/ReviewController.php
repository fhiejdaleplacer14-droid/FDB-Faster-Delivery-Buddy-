<?php

namespace App\Http\Controllers;

use App\Domain\Catalog\ReviewService;
use App\Domain\Catalog\ReviewStatus;
use App\Http\Resources\ReviewResource;
use App\Models\OrderItem;
use App\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class ReviewController extends Controller
{
    public function index(string $slug): AnonymousResourceCollection
    {
        $product = Product::query()->visibleToPublic()->where('slug', $slug)->firstOrFail();

        $reviews = $product->reviews()
            ->where('status', ReviewStatus::Published)
            ->with(['user', 'orderItem'])
            ->latest()
            ->latest('id')
            ->paginate(10);

        return ReviewResource::collection($reviews)->additional([
            'summary' => ['average' => $product->rating_average, 'count' => $product->rating_count],
        ]);
    }

    public function store(Request $request, string $number, int $itemId, ReviewService $reviews): JsonResponse
    {
        $data = $request->validate([
            'rating' => ['required', 'integer', 'between:1,5'],
            'comment' => ['nullable', 'string', 'max:1000'],
        ]);

        // Scoped to the signed-in customer's own order; anything else is a 404.
        $item = OrderItem::query()
            ->whereKey($itemId)
            ->whereHas('sellerOrder.order', fn ($q) => $q->where('number', $number)->where('user_id', $request->user()->id))
            ->firstOrFail();

        $review = $reviews->create($request->user(), $item, $data['rating'], isset($data['comment']) ? trim($data['comment']) ?: null : null);

        return (new ReviewResource($review->load(['user', 'orderItem'])))->response()->setStatusCode(201);
    }
}
