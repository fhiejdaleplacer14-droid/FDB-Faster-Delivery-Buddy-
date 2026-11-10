<?php

namespace App\Http\Resources;

use App\Models\Order;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Order */
class OrderResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'number' => $this->number,
            'status' => $this->status->value,
            'payment_method' => $this->payment_method,
            'payment_method_label' => config('fdb.orders.payment_method_labels.'.$this->payment_method, $this->payment_method),
            'items_total' => $this->items_total,
            'delivery_fee_total' => $this->delivery_fee_total,
            'grand_total' => $this->grand_total,
            'placed_at' => $this->placed_at->toIso8601ZuluString(),
            'customer_note' => $this->customer_note,
            'customer' => $this->whenLoaded('user', fn () => ['id' => $this->user->id, 'name' => $this->user->name, 'email' => $this->user->email]),
            'delivery' => [
                'recipient_name' => $this->recipient_name,
                'phone' => $this->recipient_phone,
                'municipality' => $this->municipality->label(),
                'barangay' => $this->barangay,
                'street' => $this->street,
                'landmark' => $this->landmark,
            ],
            'seller_orders' => SellerOrderResource::collection($this->whenLoaded('sellerOrders')),
        ];
    }
}
