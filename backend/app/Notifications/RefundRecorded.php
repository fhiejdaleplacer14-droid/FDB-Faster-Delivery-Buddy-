<?php

namespace App\Notifications;

use App\Models\Refund;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

// In-app only for now; email follows once the mail provider is set up.
class RefundRecorded extends Notification implements ShouldQueue
{
    use Queueable;

    /** @param 'customer'|'seller' $audience */
    public function __construct(public readonly Refund $refund, public readonly string $audience)
    {
        $this->afterCommit();
    }

    /** @return list<string> */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /** @return array<string, mixed> */
    public function toArray(object $notifiable): array
    {
        $sellerOrder = $this->refund->sellerOrder()->with('order')->firstOrFail();

        return [
            'kind' => 'refund_recorded',
            'refund_id' => $this->refund->id,
            'title' => $this->audience === 'customer' ? 'A refund was recorded' : 'FDB recorded a refund on your order',
            'body' => "₱{$this->refund->amount} on {$sellerOrder->number}. {$this->refund->reason}",
            'url' => $this->audience === 'customer' ? '/orders/'.$sellerOrder->order->number : '/seller/orders/'.$sellerOrder->id,
        ];
    }
}
