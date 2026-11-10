<?php

namespace App\Notifications;

use App\Models\SellerOrder;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class NewOrderReceived extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public readonly SellerOrder $sellerOrder)
    {
        $this->afterCommit();
    }

    /** @return list<string> */
    public function via(object $notifiable): array
    {
        return ['database', 'mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject("New FDB order {$this->sellerOrder->number}")
            ->line("You have a new order worth ₱{$this->sellerOrder->total}. Confirm it or decline it as soon as you can.")
            ->action('Open the order', rtrim(config('app.frontend_url'), '/').'/seller/orders/'.$this->sellerOrder->id);
    }

    /** @return array<string, mixed> */
    public function toArray(object $notifiable): array
    {
        return [
            'kind' => 'new_order',
            'seller_order_id' => $this->sellerOrder->id,
            'number' => $this->sellerOrder->number,
            'title' => "New order {$this->sellerOrder->number}",
            'body' => "Order total ₱{$this->sellerOrder->total}. Confirm or decline it.",
            'url' => '/seller/orders/'.$this->sellerOrder->id,
        ];
    }
}
