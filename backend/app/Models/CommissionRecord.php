<?php

namespace App\Models;

use App\Domain\Commissions\CommissionStatus;
use App\Support\Money;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

// Written only by CommissionService.
class CommissionRecord extends Model
{
    protected function casts(): array
    {
        return [
            'status' => CommissionStatus::class,
            'rate' => 'decimal:4',
            'base_amount' => 'decimal:2',
            'amount' => 'decimal:2',
            'adjustment_total' => 'decimal:2',
            'due_at' => 'datetime',
            'voided_at' => 'datetime',
        ];
    }

    public function netAmount(): string
    {
        return Money::add($this->amount, $this->adjustment_total);
    }

    public function sellerOrder(): BelongsTo
    {
        return $this->belongsTo(SellerOrder::class);
    }

    public function seller(): BelongsTo
    {
        return $this->belongsTo(Seller::class);
    }

    public function collection(): BelongsTo
    {
        return $this->belongsTo(CommissionCollection::class, 'commission_collection_id');
    }

    public function adjustments(): HasMany
    {
        return $this->hasMany(CommissionAdjustment::class)->orderBy('id');
    }
}
