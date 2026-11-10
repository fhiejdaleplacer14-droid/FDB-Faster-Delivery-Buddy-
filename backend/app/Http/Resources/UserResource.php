<?php

namespace App\Http\Resources;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin User */
class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'email_verified' => $this->hasVerifiedEmail(),
            'status' => $this->status->value,
            'roles' => $this->roleSlugs(),
            'permissions' => $this->permissionSlugs(),
            'seller' => $this->whenLoaded('seller', fn () => $this->seller ? [
                'id' => $this->seller->id,
                'store_name' => $this->seller->store_name,
                'status' => $this->seller->status->value,
            ] : null),
        ];
    }
}
