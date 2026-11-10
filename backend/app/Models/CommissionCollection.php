<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CommissionCollection extends Model
{
    public const UPDATED_AT = null;

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'collected_at' => 'datetime',
            'created_at' => 'datetime',
        ];
    }

    public function seller(): BelongsTo
    {
        return $this->belongsTo(Seller::class);
    }

    public function records(): HasMany
    {
        return $this->hasMany(CommissionRecord::class);
    }

    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }
}
