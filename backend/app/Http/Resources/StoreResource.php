<?php

namespace App\Http\Resources;

use App\Models\Seller;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

// Public store profile. Never include the owner's contact details or full address.
/** @mixin Seller */
class StoreResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'name' => $this->store_name,
            'slug' => $this->slug,
            'description' => $this->description,
            'municipality' => $this->municipality->label(),
            'barangay' => $this->barangay,
            'selling_since' => $this->approved_at?->toIso8601ZuluString(),
        ];
    }
}
