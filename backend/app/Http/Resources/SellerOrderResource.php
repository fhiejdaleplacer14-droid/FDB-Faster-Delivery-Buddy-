<?php

namespace App\Http\Resources;

use App\Models\OrderItem;
use App\Models\OrderStatusHistory;
use App\Models\SellerOrder;
use App\Support\Money;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin SellerOrder */
class SellerOrderResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'number' => $this->number,
            'status' => $this->status->value,
            'payment_status' => $this->payment_status->value,
            'items_total' => $this->items_total,
            'delivery_fee' => $this->delivery_fee,
            'total' => $this->total,
            'refunded_total' => $this->refunded_total,
            'refunds' => $this->whenLoaded('refunds', fn () => RefundResource::collection($this->refunds)->resolve($request)),
            // Commission is between FDB and the seller; customers never see it.
            'commission' => $this->when($request->routeIs('seller.*', 'admin.*') && $this->commission_rate !== null, fn () => $this->commissionSummary()),
            'delivery_note' => $this->delivery_note,
            'cancel_reason' => $this->cancel_reason,
            'cancelled_by' => $this->cancelled_by,
            'confirmed_at' => $this->confirmed_at?->toIso8601ZuluString(),
            'delivered_at' => $this->delivered_at?->toIso8601ZuluString(),
            'cancelled_at' => $this->cancelled_at?->toIso8601ZuluString(),
            'paid_at' => $this->paid_at?->toIso8601ZuluString(),
            'created_at' => $this->created_at->toIso8601ZuluString(),
            'store' => $this->whenLoaded('seller', fn () => ['id' => $this->seller->id, 'name' => $this->seller->store_name, 'slug' => $this->seller->slug]),
            'items' => $this->whenLoaded('items', fn () => $this->items->map(fn (OrderItem $item) => [
                'id' => $item->id,
                'product_id' => $item->product_id,
                'product_slug' => $item->relationLoaded('product') ? $item->product?->slug : null,
                'product_name' => $item->product_name,
                'variant_name' => $item->variant_name,
                'unit_price' => $item->unit_price,
                'quantity' => $item->quantity,
                'line_total' => $item->line_total,
                'review' => $item->relationLoaded('review') && $item->review
                    ? ['rating' => $item->review->rating, 'comment' => $item->review->comment, 'status' => $item->review->status->value]
                    : null,
            ])->all()),
            'history' => $this->whenLoaded('history', fn () => $this->history->map(fn (OrderStatusHistory $h) => [
                'from' => $h->from_status?->value,
                'to' => $h->to_status->value,
                'note' => $h->note,
                // Names are only loaded for admins; customers and sellers see the step, not the staff member.
                'actor' => $h->relationLoaded('actor') ? $h->actor?->only('id', 'name') : null,
                'at' => $h->created_at->toIso8601ZuluString(),
            ])->all()),
            'order' => $this->whenLoaded('order', fn () => [
                'number' => $this->order->number,
                'payment_method' => $this->order->payment_method,
                'payment_method_label' => config('fdb.orders.payment_method_labels.'.$this->order->payment_method, $this->order->payment_method),
                'placed_at' => $this->order->placed_at->toIso8601ZuluString(),
                'customer_note' => $this->order->customer_note,
                'customer_name' => $this->order->relationLoaded('user') ? $this->order->user->name : null,
                'delivery' => [
                    'recipient_name' => $this->order->recipient_name,
                    'phone' => $this->order->recipient_phone,
                    'municipality' => $this->order->municipality->label(),
                    'barangay' => $this->order->barangay,
                    'street' => $this->order->street,
                    'landmark' => $this->order->landmark,
                ],
            ]),
        ];
    }

    // After refunds, the seller keeps the item value not refunded, minus the commission that still applies.
    private function commissionSummary(): array
    {
        $commission = $this->commission_amount;
        $itemsKept = $this->items_total;

        if ($this->relationLoaded('refunds') && $this->refunds->isNotEmpty()) {
            foreach ($this->refunds as $refund) {
                $commission = Money::subtract($commission, Money::add($refund->commission_reduction, $refund->commission_credit));
            }
            $refundedItems = bccomp($this->refunded_total, $this->items_total, 2) < 0 ? $this->refunded_total : $this->items_total;
            $itemsKept = Money::subtract($this->items_total, $refundedItems);
        }

        return [
            'rate' => $this->commission_rate,
            'amount' => $commission,
            'seller_amount' => Money::subtract($itemsKept, $commission),
        ];
    }
}
