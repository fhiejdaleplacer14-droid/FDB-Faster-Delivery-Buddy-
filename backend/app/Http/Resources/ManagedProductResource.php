<?php

namespace App\Http\Resources;

use App\Models\Product;
use App\Models\ProductImage;
use App\Models\ProductVariant;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

// Full listing for its seller and for moderators.
/** @mixin Product */
class ManagedProductResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'slug' => $this->slug,
            'name' => $this->name,
            'description' => $this->description,
            'status' => $this->status->value,
            'moderation_reason' => $this->moderation_reason,
            'category_id' => $this->category_id,
            'category' => $this->whenLoaded('category', fn () => ['id' => $this->category->id, 'name' => $this->category->name]),
            'price_from' => $this->price_from,
            'stock_total' => $this->stock_total,
            'submitted_at' => $this->submitted_at?->toIso8601ZuluString(),
            'published_at' => $this->published_at?->toIso8601ZuluString(),
            'reviewed_at' => $this->reviewed_at?->toIso8601ZuluString(),
            'updated_at' => $this->updated_at->toIso8601ZuluString(),
            'cover_image_url' => $this->whenLoaded('coverImage', fn () => $this->coverImage?->url()),
            'variants' => $this->whenLoaded('variants', fn () => $this->variants->map(fn (ProductVariant $v) => [
                'id' => $v->id,
                'name' => $v->name,
                'sku' => $v->sku,
                'price' => $v->price,
                'stock' => $v->stock,
            ])->all()),
            'images' => $this->whenLoaded('images', fn () => $this->images->map(fn (ProductImage $image) => [
                'id' => $image->id,
                'url' => $image->url(),
                'width' => $image->width,
                'height' => $image->height,
            ])->all()),
            'store' => $this->whenLoaded('seller', fn () => [
                'id' => $this->seller->id,
                'name' => $this->seller->store_name,
                'slug' => $this->seller->slug,
                'status' => $this->seller->status->value,
            ]),
        ];
    }
}
