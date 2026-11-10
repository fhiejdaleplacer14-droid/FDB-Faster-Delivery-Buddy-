<?php

namespace App\Models;

use App\Domain\Catalog\ReviewStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Written only by ReviewService.
class ProductReview extends Model
{
    protected function casts(): array
    {
        return [
            'status' => ReviewStatus::class,
            'rating' => 'integer',
            'seller_replied_at' => 'datetime',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class)->withTrashed();
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function seller(): BelongsTo
    {
        return $this->belongsTo(Seller::class);
    }

    public function orderItem(): BelongsTo
    {
        return $this->belongsTo(OrderItem::class);
    }
}
