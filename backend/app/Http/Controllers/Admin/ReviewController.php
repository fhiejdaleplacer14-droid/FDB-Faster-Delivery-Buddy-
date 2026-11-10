<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Catalog\ReviewService;
use App\Domain\Catalog\ReviewStatus;
use App\Domain\Identity\PermissionSlug;
use App\Http\Controllers\Controller;
use App\Http\Resources\ReviewResource;
use App\Models\ProductReview;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class ReviewController extends Controller
{
    private const DETAIL = ['user', 'orderItem', 'seller', 'product'];

    public function __construct(private readonly ReviewService $reviews) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        Gate::authorize('permission', PermissionSlug::ReviewsModerate);

        $filters = $request->validate([
            'status' => ['nullable', Rule::enum(ReviewStatus::class)],
            'rating' => ['nullable', 'integer', 'between:1,5'],
            'search' => ['nullable', 'string', 'max:100'],
        ]);

        $reviews = ProductReview::query()
            ->with(self::DETAIL)
            ->when($filters['status'] ?? null, fn ($q, $status) => $q->where('status', $status))
            ->when($filters['rating'] ?? null, fn ($q, $rating) => $q->where('rating', $rating))
            ->when($filters['search'] ?? null, function ($q, $search) {
                $term = '%'.addcslashes($search, '%_\\').'%';
                $q->where(fn ($q) => $q->where('comment', 'ilike', $term)->orWhereHas('product', fn ($p) => $p->where('name', 'ilike', $term)));
            })
            ->latest()
            ->latest('id')
            ->paginate(25)
            ->withQueryString();

        return ReviewResource::collection($reviews);
    }

    public function hide(Request $request, int $reviewId): ReviewResource
    {
        Gate::authorize('permission', PermissionSlug::ReviewsModerate);

        $data = $request->validate(['reason' => ['required', 'string', 'min:5', 'max:500']]);
        $review = $this->reviews->hide(ProductReview::query()->findOrFail($reviewId), $request->user(), trim($data['reason']));

        return new ReviewResource($review->load(self::DETAIL));
    }

    public function restore(Request $request, int $reviewId): ReviewResource
    {
        Gate::authorize('permission', PermissionSlug::ReviewsModerate);

        $review = $this->reviews->restore(ProductReview::query()->findOrFail($reviewId), $request->user());

        return new ReviewResource($review->load(self::DETAIL));
    }
}
