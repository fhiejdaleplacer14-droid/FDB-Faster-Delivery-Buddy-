<?php

namespace App\Http\Controllers\Seller;

use App\Domain\Catalog\ProductService;
use App\Http\Controllers\Controller;
use App\Http\Resources\ManagedProductResource;
use App\Models\Product;
use App\Models\Seller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProductImageController extends Controller
{
    public function __construct(private readonly ProductService $products) {}

    public function store(Request $request, int $productId): JsonResponse
    {
        $request->validate([
            'image' => ['required', 'file', 'mimes:jpg,jpeg,png,webp', 'max:'.config('fdb.catalog.image_max_kb')],
        ], [
            'image.mimes' => 'Upload a JPG, PNG, or WEBP photo.',
            'image.max' => 'Each photo must be 8 MB or smaller.',
        ]);

        $product = $this->owned($request, $productId);
        $this->products->addImage($product, $request->file('image'));

        return $this->resource($product)->response()->setStatusCode(201);
    }

    public function destroy(Request $request, int $productId, int $imageId): ManagedProductResource
    {
        $product = $this->owned($request, $productId);
        $this->products->deleteImage($product, $product->images()->findOrFail($imageId));

        return $this->resource($product);
    }

    public function reorder(Request $request, int $productId): ManagedProductResource
    {
        $validated = $request->validate([
            'image_ids' => ['required', 'array', 'max:'.config('fdb.catalog.max_images')],
            'image_ids.*' => ['integer', 'distinct'],
        ]);

        $product = $this->owned($request, $productId);
        $this->products->reorderImages($product, $validated['image_ids']);

        return $this->resource($product);
    }

    private function owned(Request $request, int $productId): Product
    {
        /** @var Seller $seller */
        $seller = $request->attributes->get('seller');

        return $seller->products()->findOrFail($productId);
    }

    private function resource(Product $product): ManagedProductResource
    {
        return new ManagedProductResource($product->fresh()->load(['variants', 'images', 'category']));
    }
}
