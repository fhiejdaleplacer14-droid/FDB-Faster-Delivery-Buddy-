<?php

namespace App\Http\Controllers;

use App\Domain\Catalog\ProductSearch;
use App\Domain\Identity\UserStatus;
use App\Domain\Sellers\SellerStatus;
use App\Domain\Sellers\ServiceArea;
use App\Http\Resources\CategoryResource;
use App\Http\Resources\ProductCardResource;
use App\Http\Resources\ProductDetailResource;
use App\Http\Resources\StoreResource;
use App\Models\Category;
use App\Models\Product;
use App\Models\Seller;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Validation\Rule;

class CatalogController extends Controller
{
    public function categories(): JsonResponse
    {
        $tree = Cache::remember(Category::TREE_CACHE_KEY, now()->addMinutes(10), fn () => CategoryResource::collection(
            Category::query()
                ->whereNull('parent_id')
                ->where('is_active', true)
                ->with(['children' => fn ($q) => $q->where('is_active', true)])
                ->orderBy('position')
                ->orderBy('name')
                ->get(),
        )->resolve());

        return response()->json(['data' => $tree]);
    }

    public function products(Request $request, ProductSearch $search): AnonymousResourceCollection
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'category' => ['nullable', 'string', 'max:80'],
            'store' => ['nullable', 'string', 'max:100'],
            'municipality' => ['nullable', Rule::enum(ServiceArea::class)],
            'min_price' => ['nullable', 'decimal:0,2', 'gte:0'],
            'max_price' => ['nullable', 'decimal:0,2', 'gte:0'],
            'in_stock' => ['nullable', 'boolean'],
            'sort' => ['nullable', Rule::in(['relevance', 'newest', 'price_asc', 'price_desc'])],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:48'],
        ]);

        return ProductCardResource::collection(
            $search->query($filters)->paginate($filters['per_page'] ?? 24)->withQueryString(),
        );
    }

    public function product(string $slug): ProductDetailResource
    {
        $product = Product::query()
            ->visibleToPublic()
            ->where('slug', $slug)
            ->with(['images', 'variants', 'seller', 'category'])
            ->firstOrFail();

        return new ProductDetailResource($product);
    }

    public function store(string $slug): StoreResource
    {
        $seller = Seller::query()
            ->where('slug', $slug)
            ->where('status', SellerStatus::Approved)
            ->whereHas('user', fn (Builder $u) => $u->where('status', UserStatus::Active))
            ->firstOrFail();

        return new StoreResource($seller);
    }
}
