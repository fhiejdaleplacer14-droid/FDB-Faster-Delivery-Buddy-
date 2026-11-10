<?php

namespace App\Domain\Catalog;

use App\Domain\Audit\AuditLogger;
use App\Domain\Orders\SellerOrderStatus;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\ProductReview;
use App\Models\User;
use App\Notifications\ReviewReceived;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ReviewService
{
    public function __construct(private readonly AuditLogger $audit) {}

    // Only the buyer can review, only after delivery, and only once per purchased line.
    public function create(User $customer, OrderItem $item, int $rating, ?string $comment): ProductReview
    {
        $sellerOrder = $item->sellerOrder()->with('order')->firstOrFail();

        if ($sellerOrder->order->user_id !== $customer->id) {
            abort(404);
        }
        if ($sellerOrder->status !== SellerOrderStatus::Delivered) {
            throw ValidationException::withMessages(['rating' => 'You can review this item after it is delivered.']);
        }

        try {
            $review = DB::transaction(function () use ($customer, $item, $sellerOrder, $rating, $comment) {
                $review = new ProductReview;
                $review->forceFill([
                    'product_id' => $item->product_id,
                    'seller_id' => $sellerOrder->seller_id,
                    'user_id' => $customer->id,
                    'order_item_id' => $item->id,
                    'rating' => $rating,
                    'comment' => $comment,
                    'status' => ReviewStatus::Published,
                ])->save();

                $this->refreshRating($item->product_id);

                return $review;
            });
        } catch (UniqueConstraintViolationException) {
            throw ValidationException::withMessages(['rating' => 'You already reviewed this item.']);
        }

        $sellerOrder->seller()->with('user')->firstOrFail()->user->notify(new ReviewReceived($review));

        return $review;
    }

    public function reply(ProductReview $review, string $reply): ProductReview
    {
        $review->forceFill(['seller_reply' => $reply, 'seller_replied_at' => now()])->save();

        return $review;
    }

    public function hide(ProductReview $review, User $moderator, string $reason): ProductReview
    {
        return $this->setStatus($review, ReviewStatus::Hidden, $moderator, $reason);
    }

    public function restore(ProductReview $review, User $moderator): ProductReview
    {
        return $this->setStatus($review, ReviewStatus::Published, $moderator, null);
    }

    private function setStatus(ProductReview $review, ReviewStatus $status, User $moderator, ?string $reason): ProductReview
    {
        return DB::transaction(function () use ($review, $status, $moderator, $reason) {
            $review->forceFill(['status' => $status, 'hidden_reason' => $reason])->save();
            $this->refreshRating($review->product_id);
            $this->audit->record('review.'.($status === ReviewStatus::Hidden ? 'hidden' : 'restored'), $moderator, $review, array_filter(['reason' => $reason]));

            return $review;
        });
    }

    // Only published reviews count towards the shown average.
    private function refreshRating(int $productId): void
    {
        $stats = ProductReview::query()
            ->where('product_id', $productId)
            ->where('status', ReviewStatus::Published)
            ->toBase()
            ->selectRaw('COUNT(*) AS total, ROUND(AVG(rating)::numeric, 2) AS average')
            ->first();

        Product::withTrashed()->whereKey($productId)->update([
            'rating_count' => (int) $stats->total,
            'rating_average' => $stats->total ? $stats->average : null,
        ]);
    }
}
