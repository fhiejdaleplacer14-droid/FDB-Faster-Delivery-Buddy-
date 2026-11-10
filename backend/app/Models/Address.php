<?php

namespace App\Models;

use App\Domain\Sellers\ServiceArea;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['label', 'recipient_name', 'phone', 'municipality', 'barangay', 'street', 'landmark'])]
class Address extends Model
{
    protected function casts(): array
    {
        return [
            'municipality' => ServiceArea::class,
            'is_default' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
