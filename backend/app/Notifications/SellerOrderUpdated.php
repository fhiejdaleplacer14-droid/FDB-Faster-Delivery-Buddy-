<?php

namespace App\Notifications;

use App\Domain\Orders\SellerOrderStatus;
use App\Models\SellerOrder;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class SellerOrderUpdated extends Notification implements ShouldQueue
{
    use Queueable;

    public readonly SellerOrderStatus $status;

    /** @param 'customer'|'seller' $audience */
    public function __construct(public readonly SellerOrder $sellerOrder, public readonly string $audience, public readonly ?string $note)
    {
        $this->status = $sellerOrder->status;
        $this->afterCommit();
    }

    /** @return list<string> */
    public function via(object $notifiable): array
    {
        // Confirmation, delivery, and cancellation are emailed; other progress stays in-app.
        return in_array($this->status, [SellerOrderStatus::Cancelled, SellerOrderStatus::Delivered, SellerOrderStatus::Confirmed], true)
            ? ['database', 'mail']
            : ['database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $mail = (new MailMessage)->subject($this->title())->line($this->body());
        if ($this->note) {
            $mail->line(($this->status === SellerOrderStatus::Cancelled ? 'Reason: ' : 'Note: ').$this->note);
        }

        return $mail->action('View the order', $this->url());
    }

    /** @return array<string, mixed> */
    public function toArray(object $notifiable): array
    {
        return [
            'kind' => 'seller_order_updated',
            'seller_order_id' => $this->sellerOrder->id,
            'number' => $this->sellerOrder->number,
            'status' => $this->status->value,
            'title' => $this->title(),
            'body' => $this->body(),
            'note' => $this->note,
            'url' => parse_url($this->url(), PHP_URL_PATH),
        ];
    }

    private function title(): string
    {
        $number = $this->sellerOrder->number;

        return match ($this->status) {
            SellerOrderStatus::Confirmed => "Order {$number} confirmed",
            SellerOrderStatus::Preparing => "Order {$number} is being prepared",
            SellerOrderStatus::ReadyForDelivery => "Order {$number} is ready",
            SellerOrderStatus::OutForDelivery => "Order {$number} is on the way",
            SellerOrderStatus::Delivered => "Order {$number} delivered",
            SellerOrderStatus::Cancelled => "Order {$number} cancelled",
            SellerOrderStatus::PendingConfirmation => "Order {$number} updated",
        };
    }

    private function body(): string
    {
        if ($this->status === SellerOrderStatus::Cancelled) {
            return $this->audience === 'seller'
                ? 'The customer cancelled this order. The items were returned to your stock.'
                : 'The seller cancelled this part of your order.';
        }

        return 'The seller updated your order.';
    }

    private function url(): string
    {
        $base = rtrim(config('app.frontend_url'), '/');

        return $this->audience === 'seller'
            ? $base.'/seller/orders/'.$this->sellerOrder->id
            : $base.'/orders/'.$this->sellerOrder->order()->value('number');
    }
}
