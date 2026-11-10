<?php

namespace App\Http\Resources;

use App\Models\Seller;
use App\Models\SellerDocument;
use App\Models\SellerStatusHistory;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Seller */
class SellerApplicationResource extends JsonResource
{
    private bool $forAdmin = false;

    public function forAdmin(): static
    {
        $this->forAdmin = true;

        return $this;
    }

    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'store_name' => $this->store_name,
            'slug' => $this->slug,
            'description' => $this->description,
            'contact_phone' => $this->contact_phone,
            'municipality' => ['value' => $this->municipality->value, 'label' => $this->municipality->label()],
            'barangay' => $this->barangay,
            'address_line' => $this->address_line,
            'business_type' => $this->business_type->value,
            'business_name' => $this->business_name,
            'business_registration_number' => $this->business_registration_number,
            'status' => $this->status->value,
            'decision_reason' => $this->decision_reason,
            'submitted_at' => $this->submitted_at?->toIso8601ZuluString(),
            'reviewed_at' => $this->reviewed_at?->toIso8601ZuluString(),
            'approved_at' => $this->approved_at?->toIso8601ZuluString(),
            'suspended_at' => $this->suspended_at?->toIso8601ZuluString(),
            'applicant' => $this->when($this->forAdmin, fn () => [
                'id' => $this->user->id,
                'name' => $this->user->name,
                'email' => $this->user->email,
                'email_verified' => $this->user->hasVerifiedEmail(),
            ]),
            'reviewer' => $this->when($this->forAdmin, fn () => $this->reviewer?->only('id', 'name')),
            'documents' => $this->whenLoaded('documents', fn () => $this->documents->map(fn (SellerDocument $doc) => [
                'id' => $doc->id,
                'type' => $doc->type->value,
                'type_label' => $doc->type->label(),
                'original_name' => $doc->original_name,
                'mime_type' => $doc->mime_type,
                'size_bytes' => $doc->size_bytes,
                'uploaded_at' => $doc->created_at->toIso8601ZuluString(),
                'download_url' => $this->when($this->forAdmin, fn () => route('admin.sellers.documents.show', [$this->id, $doc->id], absolute: false)),
            ])->all()),
            'history' => $this->whenLoaded('statusHistory', fn () => $this->statusHistory->map(fn (SellerStatusHistory $entry) => [
                'from' => $entry->from_status?->value,
                'to' => $entry->to_status->value,
                'reason' => $entry->reason,
                'actor' => $this->when($this->forAdmin, fn () => $entry->actor?->only('id', 'name')),
                'at' => $entry->created_at->toIso8601ZuluString(),
            ])->all()),
        ];
    }
}
