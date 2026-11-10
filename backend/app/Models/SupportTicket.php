<?php

namespace App\Models;

use App\Domain\Support\TicketCategory;
use App\Domain\Support\TicketStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

// Written only by SupportService.
class SupportTicket extends Model
{
    protected function casts(): array
    {
        return [
            'category' => TicketCategory::class,
            'status' => TicketStatus::class,
            'resolved_at' => 'datetime',
            'last_activity_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function sellerOrder(): BelongsTo
    {
        return $this->belongsTo(SellerOrder::class);
    }

    public function seller(): BelongsTo
    {
        return $this->belongsTo(Seller::class);
    }

    public function messages(): HasMany
    {
        return $this->hasMany(SupportMessage::class)->orderBy('created_at')->orderBy('id');
    }

    public function resolver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'resolved_by');
    }
}
