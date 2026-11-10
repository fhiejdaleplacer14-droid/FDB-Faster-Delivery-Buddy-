<?php

namespace App\Http\Resources;

use App\Models\Product;
use App\Models\ProductImage;
use App\Models\ProductVariant;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Product */
class ProductDetailResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'slug' => $this->slug,
            'name' => $this->name,
            'description' => $this->description,
            'price_from' => $this->price_from,
            'in_stock' => $this->stock_total > 0,
            'published_at' => $this->published_at?->toIso8601ZuluString(),
            'images' => $this->images->map(fn (ProductImage $image) => [
                'id' => $image->id,
                'url' => $image->url(),
                'width' => $image->width,
                'height' => $image->height,
            ])->all(),
            'variants' => $this->variants->map(fn (ProductVariant $variant) => [
                'id' => $variant->id,
                'name' => $variant->name,
                'price' => $variant->price,
                'stock' => $variant->stock,
            ])->all(),
            'store' => new StoreResource($this->seller),
            'category' => [
                'name' => $this->category->name,
                'slug' => $this->category->slug,
            ],
        ];
    }
}
