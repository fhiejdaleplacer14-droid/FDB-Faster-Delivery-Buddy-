<?php

namespace App\Notifications;

use App\Models\Order;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class OrderPlaced extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public readonly Order $order)
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
            ->subject("FDB order {$this->order->number} received")
            ->line("We sent your order {$this->order->number} to the seller. Each seller confirms and delivers their part of the order.")
            ->line('Pay the seller using the method you chose. FDB does not collect payment.')
            ->action('View your order', rtrim(config('app.frontend_url'), '/').'/orders/'.$this->order->number);
    }

    /** @return array<string, mixed> */
    public function toArray(object $notifiable): array
    {
        return [
            'kind' => 'order_placed',
            'order_number' => $this->order->number,
            'title' => "Order {$this->order->number} received",
            'body' => 'The sellers will confirm your order soon.',
            'url' => '/orders/'.$this->order->number,
        ];
    }
}
