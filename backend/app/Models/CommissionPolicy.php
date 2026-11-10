<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

// Written only by CommissionService.
class CommissionPolicy extends Model
{
    protected function casts(): array
    {
        return [
            'rate' => 'decimal:4',
            'effective_from' => 'datetime',
            'effective_until' => 'datetime',
        ];
    }

    public function seller(): BelongsTo
    {
        return $this->belongsTo(Seller::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function scopeActiveAt(Builder $query, Carbon $at): void
    {
        $query->where('effective_from', '<=', $at)
            ->where(fn (Builder $q) => $q->whereNull('effective_until')->orWhere('effective_until', '>', $at));
    }
}
