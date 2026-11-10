<?php

namespace App\Models;

use App\Domain\Support\AuthorRole;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['author_id', 'author_role', 'body'])]
class SupportMessage extends Model
{
    public const UPDATED_AT = null;

    protected function casts(): array
    {
        return [
            'author_role' => AuthorRole::class,
            'created_at' => 'datetime',
        ];
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_id');
    }
}
