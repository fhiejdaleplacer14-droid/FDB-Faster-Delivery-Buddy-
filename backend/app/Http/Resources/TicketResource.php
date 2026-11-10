<?php

namespace App\Http\Resources;

use App\Domain\Support\AuthorRole;
use App\Models\SupportMessage;
use App\Models\SupportTicket;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin SupportTicket */
class TicketResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $forStaff = $request->routeIs('admin.*');

        return [
            'number' => $this->number,
            'category' => ['value' => $this->category->value, 'label' => $this->category->label()],
            'subject' => $this->subject,
            'status' => $this->status->value,
            'resolution' => $this->resolution,
            'resolved_at' => $this->resolved_at?->toIso8601ZuluString(),
            'created_at' => $this->created_at->toIso8601ZuluString(),
            'last_activity_at' => $this->last_activity_at->toIso8601ZuluString(),
            'seller_order' => $this->whenLoaded('sellerOrder', fn () => $this->sellerOrder ? [
                'id' => $this->sellerOrder->id,
                'number' => $this->sellerOrder->number,
                'status' => $this->sellerOrder->status->value,
                'total' => $this->sellerOrder->total,
                'order_number' => $this->sellerOrder->relationLoaded('order') ? $this->sellerOrder->order->number : null,
            ] : null),
            'store' => $this->whenLoaded('seller', fn () => $this->seller ? ['name' => $this->seller->store_name] : null),
            'customer' => $this->whenLoaded('user', fn () => ['name' => $this->user->name, 'email' => $this->when($forStaff, $this->user->email)]),
            'messages' => $this->whenLoaded('messages', fn () => $this->messages->map(fn (SupportMessage $m) => [
                'id' => $m->id,
                'role' => $m->author_role->value,
                // Staff speak as "FDB Support" to users; admins see who answered.
                'author' => match ($m->author_role) {
                    AuthorRole::Staff => $forStaff ? ($m->author?->name ?? 'FDB Support') : 'FDB Support',
                    AuthorRole::Seller => $this->relationLoaded('seller') && $this->seller ? $this->seller->store_name : 'Seller',
                    AuthorRole::Customer => $m->author?->name ?? 'Customer',
                },
                'body' => $m->body,
                'at' => $m->created_at->toIso8601ZuluString(),
            ])->all()),
        ];
    }
}
