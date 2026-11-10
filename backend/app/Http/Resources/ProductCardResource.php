<?php

namespace App\Http\Resources;

use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Product */
class ProductCardResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'slug' => $this->slug,
            'name' => $this->name,
            'price_from' => $this->price_from,
            'in_stock' => $this->stock_total > 0,
            'image' => $this->coverImage ? [
                'url' => $this->coverImage->url(),
                'width' => $this->coverImage->width,
                'height' => $this->coverImage->height,
            ] : null,
            'store' => [
                'name' => $this->seller->store_name,
                'slug' => $this->seller->slug,
                'municipality' => $this->seller->municipality->label(),
            ],
            'category' => ['name' => $this->category->name, 'slug' => $this->category->slug],
        ];
    }
}
