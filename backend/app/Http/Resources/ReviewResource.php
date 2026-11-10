<?php

namespace App\Http\Resources;

use App\Models\ProductReview;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Str;

/** @mixin ProductReview */
class ReviewResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $forStaff = $request->routeIs('admin.*');

        return [
            'id' => $this->id,
            'rating' => $this->rating,
            'comment' => $this->comment,
            // Public pages show a first name and initial only.
            'author' => $this->whenLoaded('user', fn () => $forStaff ? $this->user->name : $this->shortName($this->user->name)),
            'author_email' => $this->when($forStaff, fn () => $this->user->email),
            'variant_name' => $this->whenLoaded('orderItem', fn () => $this->orderItem->variant_name),
            'product' => $this->whenLoaded('product', fn () => ['id' => $this->product->id, 'name' => $this->product->name, 'slug' => $this->product->slug]),
            'store' => $this->when($forStaff && $this->relationLoaded('seller'), fn () => ['id' => $this->seller->id, 'name' => $this->seller->store_name]),
            'status' => $this->when($forStaff || $request->routeIs('seller.*'), fn () => $this->status->value),
            'hidden_reason' => $this->when($forStaff, fn () => $this->hidden_reason),
            'seller_reply' => $this->seller_reply,
            'seller_replied_at' => $this->seller_replied_at?->toIso8601ZuluString(),
            'created_at' => $this->created_at->toIso8601ZuluString(),
        ];
    }

    private function shortName(string $name): string
    {
        $parts = preg_split('/\s+/', trim($name)) ?: [];
        $first = $parts[0] ?? 'Customer';
        $last = count($parts) > 1 ? ' '.Str::upper(mb_substr((string) end($parts), 0, 1)).'.' : '';

        return $first.$last;
    }
}
