<?php

namespace App\Http\Controllers\Seller;

use App\Domain\Catalog\ProductService;
use App\Domain\Catalog\ProductStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Catalog\ProductRequest;
use App\Http\Resources\ManagedProductResource;
use App\Models\Product;
use App\Models\Seller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

class ProductController extends Controller
{
    public function __construct(private readonly ProductService $products) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $filters = $request->validate([
            'status' => ['nullable', Rule::enum(ProductStatus::class)],
            'search' => ['nullable', 'string', 'max:100'],
        ]);

        $products = $this->seller($request)->products()
            ->with(['coverImage', 'category'])
            ->when($filters['status'] ?? null, fn ($q, $status) => $q->where('status', $status))
            ->when($filters['search'] ?? null, fn ($q, $s) => $q->where('name', 'ilike', '%'.addcslashes($s, '%_\\').'%'))
            ->orderByDesc('updated_at')
            ->orderByDesc('id')
            ->paginate(25)
            ->withQueryString();

        return ManagedProductResource::collection($products);
    }

    public function store(ProductRequest $request): JsonResponse
    {
        $product = $this->products->create($this->seller($request), $request->details(), $request->variants());

        return $this->resource($product)->response()->setStatusCode(201);
    }

    public function show(Request $request, int $productId): ManagedProductResource
    {
        return $this->resource($this->owned($request, $productId));
    }

    public function update(ProductRequest $request, int $productId): ManagedProductResource
    {
        $product = $this->products->update($this->owned($request, $productId), $request->details(), $request->variants());

        return $this->resource($product);
    }

    public function submit(Request $request, int $productId): ManagedProductResource
    {
        return $this->resource($this->products->submit($this->owned($request, $productId)));
    }

    public function archive(Request $request, int $productId): ManagedProductResource
    {
        return $this->resource($this->products->archive($this->owned($request, $productId)));
    }

    public function restore(Request $request, int $productId): ManagedProductResource
    {
        return $this->resource($this->products->restore($this->owned($request, $productId)));
    }

    private function seller(Request $request): Seller
    {
        return $request->attributes->get('seller');
    }

    // Scoped to the signed-in seller: another seller's product is a 404, not a 403, so IDs reveal nothing.
    private function owned(Request $request, int $productId): Product
    {
        return $this->seller($request)->products()->findOrFail($productId);
    }

    private function resource(Product $product): ManagedProductResource
    {
        return new ManagedProductResource($product->fresh()->load(['variants', 'images', 'category']));
    }
}
