<?php

namespace App\Domain\Catalog;

use App\Models\Category;
use App\Models\Product;
use Illuminate\Database\Eloquent\Builder;

class ProductSearch
{
    /** @param array<string, mixed> $filters validated input */
    public function query(array $filters): Builder
    {
        $query = Product::query()
            ->visibleToPublic()
            ->with(['coverImage', 'seller', 'category']);

        $search = trim((string) ($filters['search'] ?? ''));
        if ($search !== '') {
            $term = '%'.addcslashes($search, '%_\\').'%';
            // Substring match, plus trigram similarity to tolerate typos ("bigas" vs "bigass").
            $query->where(fn (Builder $q) => $q
                ->where('products.name', 'ilike', $term)
                ->orWhereRaw('products.name % ?', [$search]));
        }

        if (! empty($filters['category'])) {
            $category = Category::query()->where('slug', $filters['category'])->where('is_active', true)->first();
            $ids = $category ? Category::query()->where('parent_id', $category->id)->pluck('id')->push($category->id) : collect([0]);
            $query->whereIn('products.category_id', $ids);
        }

        if (! empty($filters['store'])) {
            $query->whereHas('seller', fn (Builder $s) => $s->where('slug', $filters['store']));
        }

        if (! empty($filters['municipality'])) {
            $query->whereHas('seller', fn (Builder $s) => $s->where('municipality', $filters['municipality']));
        }

        if (isset($filters['min_price'])) {
            $query->where('products.price_from', '>=', $filters['min_price']);
        }
        if (isset($filters['max_price'])) {
            $query->where('products.price_from', '<=', $filters['max_price']);
        }
        if (! empty($filters['in_stock'])) {
            $query->where('products.stock_total', '>', 0);
        }

        match ($filters['sort'] ?? ($search !== '' ? 'relevance' : 'newest')) {
            'price_asc' => $query->orderBy('products.price_from'),
            'price_desc' => $query->orderByDesc('products.price_from'),
            'relevance' => $search !== ''
                ? $query->orderByRaw('similarity(products.name, ?) desc', [$search])
                : $query->orderByDesc('products.published_at'),
            default => $query->orderByDesc('products.published_at'),
        };

        return $query->orderByDesc('products.id');
    }
}
