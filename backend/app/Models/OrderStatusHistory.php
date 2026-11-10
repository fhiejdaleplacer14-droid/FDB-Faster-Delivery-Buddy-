<?php

namespace App\Models;

use App\Domain\Orders\SellerOrderStatus;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['from_status', 'to_status', 'actor_id', 'note'])]
class OrderStatusHistory extends Model
{
    public const UPDATED_AT = null;

    protected function casts(): array
    {
        return [
            'from_status' => SellerOrderStatus::class,
            'to_status' => SellerOrderStatus::class,
            'created_at' => 'datetime',
        ];
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }
}
