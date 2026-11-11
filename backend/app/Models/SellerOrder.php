<?php

namespace App\Models;

use App\Domain\Orders\PaymentStatus;
use App\Domain\Orders\SellerOrderStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class SellerOrder extends Model
{
    protected function casts(): array
    {
        return [
            'status' => SellerOrderStatus::class,
            'payment_status' => PaymentStatus::class,
            'items_total' => 'decimal:2',
            'delivery_fee' => 'decimal:2',
            'total' => 'decimal:2',
            'refunded_total' => 'decimal:2',
            'confirmed_at' => 'datetime',
            'delivered_at' => 'datetime',
            'cancelled_at' => 'datetime',
            'paid_at' => 'datetime',
        ];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function seller(): BelongsTo
    {
        return $this->belongsTo(Seller::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class)->orderBy('id');
    }

    public function commissionRecord(): HasOne
    {
        return $this->hasOne(CommissionRecord::class);
    }

    public function refunds(): HasMany
    {
        return $this->hasMany(Refund::class)->orderBy('refunded_at')->orderBy('id');
    }

    public function history(): HasMany
    {
        return $this->hasMany(OrderStatusHistory::class)->orderBy('created_at')->orderBy('id');
    }
}
