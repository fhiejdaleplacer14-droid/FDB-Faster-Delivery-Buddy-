<?php

namespace App\Http\Resources;

use App\Models\CommissionAdjustment;
use App\Models\CommissionRecord;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin CommissionRecord */
class CommissionRecordResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'status' => $this->status->value,
            'rate' => $this->rate,
            'base_amount' => $this->base_amount,
            'amount' => $this->amount,
            'adjustment_total' => $this->adjustment_total,
            'net_amount' => $this->netAmount(),
            'due_at' => $this->due_at?->toIso8601ZuluString(),
            'voided_at' => $this->voided_at?->toIso8601ZuluString(),
            'created_at' => $this->created_at->toIso8601ZuluString(),
            'seller_order' => $this->whenLoaded('sellerOrder', fn () => [
                'id' => $this->sellerOrder->id,
                'number' => $this->sellerOrder->number,
                'status' => $this->sellerOrder->status->value,
            ]),
            'store' => $this->whenLoaded('seller', fn () => ['id' => $this->seller->id, 'name' => $this->seller->store_name]),
            'collection' => $this->whenLoaded('collection', fn () => $this->collection ? [
                'id' => $this->collection->id,
                'method' => $this->collection->method,
                'reference' => $this->collection->reference,
                'collected_at' => $this->collection->collected_at->toIso8601ZuluString(),
            ] : null),
            'adjustments' => $this->whenLoaded('adjustments', fn () => $this->adjustments->map(fn (CommissionAdjustment $a) => [
                'amount' => $a->amount,
                'reason' => $a->reason,
                'at' => $a->created_at->toIso8601ZuluString(),
            ])->all()),
        ];
    }
}
