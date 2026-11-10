<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Catalog\ProductService;
use App\Domain\Catalog\ProductStatus;
use App\Domain\Identity\PermissionSlug;
use App\Http\Controllers\Controller;
use App\Http\Resources\ManagedProductResource;
use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class ProductModerationController extends Controller
{
    public function __construct(private readonly ProductService $products) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        Gate::authorize('permission', PermissionSlug::ProductsModerate);

        $filters = $request->validate([
            'status' => ['nullable', Rule::enum(ProductStatus::class)],
            'search' => ['nullable', 'string', 'max:100'],
        ]);

        $products = Product::query()
            ->with(['coverImage', 'category', 'seller'])
            ->when($filters['status'] ?? null, fn ($q, $status) => $q->where('status', $status))
            ->when($filters['search'] ?? null, fn ($q, $s) => $q->where('name', 'ilike', '%'.addcslashes($s, '%_\\').'%'))
            ->orderBy('submitted_at')
            ->orderBy('id')
            ->paginate(25)
            ->withQueryString();

        return ManagedProductResource::collection($products);
    }

    public function show(Product $product): ManagedProductResource
    {
        Gate::authorize('permission', PermissionSlug::ProductsModerate);

        return $this->resource($product);
    }

    public function approve(Request $request, Product $product): ManagedProductResource
    {
        Gate::authorize('permission', PermissionSlug::ProductsModerate);

        return $this->resource($this->products->approve($product, $request->user()));
    }

    public function reject(Request $request, Product $product): ManagedProductResource
    {
        Gate::authorize('permission', PermissionSlug::ProductsModerate);

        $validated = $request->validate(['reason' => ['required', 'string', 'min:5', 'max:1000']]);

        return $this->resource($this->products->reject($product, $request->user(), trim($validated['reason'])));
    }

    private function resource(Product $product): ManagedProductResource
    {
        return new ManagedProductResource($product->fresh()->load(['variants', 'images', 'category', 'seller']));
    }
}
