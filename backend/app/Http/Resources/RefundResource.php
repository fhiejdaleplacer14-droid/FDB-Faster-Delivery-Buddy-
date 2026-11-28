<?php

namespace App\Http\Resources;

use App\Models\Refund;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Refund */
class RefundResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $staff = $request->routeIs('admin.*');
        // Commission is between FDB and the seller; customers never see it.
        $business = $staff || $request->routeIs('seller.*');

        return [
            'id' => $this->id,
            'amount' => $this->amount,
            'method' => $this->method,
            'method_label' => self::methodLabel($this->method),
            'reference' => $this->reference,
            'reason' => $this->reason,
            'recorded_as' => $this->recorded_as,
            'refunded_at' => $this->refunded_at->toIso8601ZuluString(),
            'recorded_by' => $this->when($staff && $this->relationLoaded('recorder'), fn () => $this->recorder?->name),
            'commission_status' => $this->when($business, fn () => $this->commission_status),
            'commission_reduction' => $this->when($business, fn () => $this->commission_reduction),
            'commission_credit' => $this->when($business, fn () => $this->commission_credit),
            'credit_settled_at' => $this->when($business, fn () => $this->credit_settled_at?->toIso8601ZuluString()),
            'ticket_number' => $this->when($this->relationLoaded('ticket'), fn () => $this->ticket?->number),
            'seller_order' => $this->when($staff && $this->relationLoaded('sellerOrder'), fn () => [
                'id' => $this->sellerOrder->id,
                'number' => $this->sellerOrder->number,
                'order_number' => $this->sellerOrder->relationLoaded('order') ? $this->sellerOrder->order->number : null,
            ]),
            'store' => $this->when($staff && $this->relationLoaded('seller'), fn () => ['id' => $this->seller->id, 'name' => $this->seller->store_name]),
        ];
    }

    public static function methodLabel(string $method): string
    {
        return match ($method) {
            'cash' => 'Cash',
            'gcash' => 'GCash',
            'maya' => 'Maya',
            'bank_transfer' => 'Bank transfer',
            default => 'Other',
        };
    }
}
