<?php

namespace App\Models;

use Database\Factories\CategoryFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Cache;

#[Fillable(['parent_id', 'name', 'position', 'is_active'])]
class Category extends Model
{
    /** @use HasFactory<CategoryFactory> */
    use HasFactory;

    public const TREE_CACHE_KEY = 'catalog:categories:tree';

    public const OTHERS_SLUG = 'others';

    protected $attributes = [
        'position' => 0,
        'is_active' => true,
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'position' => 'integer',
        ];
    }

    // Catch-all for listings that fit no category yet; created on first use.
    public static function others(): self
    {
        $others = self::unguarded(fn () => self::query()->firstOrCreate(
            ['slug' => self::OTHERS_SLUG],
            ['name' => 'Others', 'position' => 999, 'is_active' => true],
        ));
        if ($others->wasRecentlyCreated) {
            Cache::forget(self::TREE_CACHE_KEY);
        }

        return $others;
    }

    public function isOthers(): bool
    {
        return $this->slug === self::OTHERS_SLUG;
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(self::class, 'parent_id')->orderBy('position')->orderBy('name');
    }

    public function products(): HasMany
    {
        return $this->hasMany(Product::class);
    }
}
