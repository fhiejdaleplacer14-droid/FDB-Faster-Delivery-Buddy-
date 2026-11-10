<?php

namespace App\Models;

use App\Domain\Catalog\ProductStatus;
use App\Domain\Identity\UserStatus;
use App\Domain\Sellers\SellerStatus;
use Database\Factories\ProductFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

#[Fillable(['category_id', 'name', 'description'])]
class Product extends Model
{
    /** @use HasFactory<ProductFactory> */
    use HasFactory, SoftDeletes;

    protected function casts(): array
    {
        return [
            'status' => ProductStatus::class,
            'price_from' => 'decimal:2',
            'stock_total' => 'integer',
            'submitted_at' => 'datetime',
            'published_at' => 'datetime',
            'reviewed_at' => 'datetime',
        ];
    }

    public function seller(): BelongsTo
    {
        return $this->belongsTo(Seller::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function variants(): HasMany
    {
        return $this->hasMany(ProductVariant::class)->orderBy('position')->orderBy('id');
    }

    public function images(): HasMany
    {
        return $this->hasMany(ProductImage::class)->orderBy('position')->orderBy('id');
    }

    public function coverImage(): HasOne
    {
        return $this->hasOne(ProductImage::class)->ofMany(['position' => 'min', 'id' => 'min']);
    }

    // Published, from an approved seller whose account is active.
    public function scopeVisibleToPublic(Builder $query): void
    {
        $query->where('products.status', ProductStatus::Published)
            ->whereHas('seller', fn (Builder $s) => $s
                ->where('status', SellerStatus::Approved)
                ->whereHas('user', fn (Builder $u) => $u->where('status', UserStatus::Active)))
            ->whereHas('category', fn (Builder $c) => $c->where('is_active', true));
    }
}
