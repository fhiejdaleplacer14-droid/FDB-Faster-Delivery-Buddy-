<?php

namespace App\Models;

use App\Domain\Orders\OrderStatus;
use App\Domain\Sellers\ServiceArea;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

// Written only by CheckoutService, never mass-assigned from requests.
class Order extends Model
{
    protected function casts(): array
    {
        return [
            'status' => OrderStatus::class,
            'municipality' => ServiceArea::class,
            'items_total' => 'decimal:2',
            'delivery_fee_total' => 'decimal:2',
            'grand_total' => 'decimal:2',
            'placed_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function sellerOrders(): HasMany
    {
        return $this->hasMany(SellerOrder::class)->orderBy('id');
    }
}
