<?php

namespace App\Http\Resources;

use App\Models\Address;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Address */
class AddressResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'label' => $this->label,
            'recipient_name' => $this->recipient_name,
            'phone' => $this->phone,
            'municipality' => ['value' => $this->municipality->value, 'label' => $this->municipality->label()],
            'barangay' => $this->barangay,
            'street' => $this->street,
            'landmark' => $this->landmark,
            'is_default' => $this->is_default,
        ];
    }
}
