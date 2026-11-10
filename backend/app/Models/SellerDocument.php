<?php

namespace App\Models;

use App\Domain\Sellers\SellerDocumentType;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['type', 'disk', 'path', 'original_name', 'mime_type', 'size_bytes', 'sha256', 'uploaded_by'])]
#[Hidden(['disk', 'path'])]
class SellerDocument extends Model
{
    public const UPDATED_AT = null;

    protected function casts(): array
    {
        return [
            'type' => SellerDocumentType::class,
            'size_bytes' => 'integer',
            'created_at' => 'datetime',
        ];
    }

    public function seller(): BelongsTo
    {
        return $this->belongsTo(Seller::class);
    }
}
