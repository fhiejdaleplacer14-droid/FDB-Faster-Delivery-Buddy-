<?php

namespace App\Models;

use App\Domain\Sellers\BusinessType;
use App\Domain\Sellers\SellerStatus;
use App\Domain\Sellers\ServiceArea;
use Database\Factories\SellerFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'store_name', 'description', 'contact_phone', 'municipality', 'barangay',
    'address_line', 'business_type', 'business_name', 'business_registration_number',
])]
class Seller extends Model
{
    /** @use HasFactory<SellerFactory> */
    use HasFactory;

    protected function casts(): array
    {
        return [
            'status' => SellerStatus::class,
            'municipality' => ServiceArea::class,
            'business_type' => BusinessType::class,
            'submitted_at' => 'datetime',
            'approved_at' => 'datetime',
            'suspended_at' => 'datetime',
            'reviewed_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function documents(): HasMany
    {
        return $this->hasMany(SellerDocument::class);
    }

    public function statusHistory(): HasMany
    {
        return $this->hasMany(SellerStatusHistory::class)->orderBy('created_at')->orderBy('id');
    }

    public function isApproved(): bool
    {
        return $this->status === SellerStatus::Approved;
    }
}
