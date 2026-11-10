<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

// Filled only by CheckoutService from server-side data.
#[Fillable(['product_id', 'product_variant_id', 'product_name', 'variant_name', 'unit_price', 'quantity', 'line_total'])]
class OrderItem extends Model
{
    protected function casts(): array
    {
        return [
            'unit_price' => 'decimal:2',
            'line_total' => 'decimal:2',
            'quantity' => 'integer',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class)->withTrashed();
    }

    public function sellerOrder(): BelongsTo
    {
        return $this->belongsTo(SellerOrder::class);
    }

    public function review(): HasOne
    {
        return $this->hasOne(ProductReview::class);
    }
}
