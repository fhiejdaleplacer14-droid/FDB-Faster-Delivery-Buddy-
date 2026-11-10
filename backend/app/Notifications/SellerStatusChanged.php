<?php

namespace App\Notifications;

use App\Domain\Sellers\SellerStatus;
use App\Models\Seller;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class SellerStatusChanged extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly Seller $seller,
        public readonly SellerStatus $from,
        public readonly SellerStatus $to,
        public readonly ?string $reason,
    ) {
        $this->afterCommit();
    }

    /** @return list<string> */
    public function via(object $notifiable): array
    {
        return ['database', 'mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $mail = (new MailMessage)
            ->subject($this->headline())
            ->greeting('Hello '.$notifiable->name.',')
            ->line($this->summary());

        if ($this->reason) {
            $mail->line('Reason: '.$this->reason);
        }

        return $mail->action('Open FDB', rtrim(config('app.frontend_url'), '/').'/sell');
    }

    /** @return array<string, mixed> */
    public function toArray(object $notifiable): array
    {
        return [
            'kind' => 'seller_status_changed',
            'seller_id' => $this->seller->id,
            'from' => $this->from->value,
            'to' => $this->to->value,
            'title' => $this->headline(),
            'body' => $this->summary(),
            'reason' => $this->reason,
        ];
    }

    private function headline(): string
    {
        return match ($this->to) {
            SellerStatus::Approved => $this->from === SellerStatus::Suspended
                ? 'Your FDB store has been reactivated'
                : 'Your FDB seller application was approved',
            SellerStatus::Rejected => 'Your FDB seller application was not approved',
            SellerStatus::Suspended => 'Your FDB store has been suspended',
            SellerStatus::Pending => 'Your FDB seller application was received',
        };
    }

    private function summary(): string
    {
        $store = $this->seller->store_name;

        return match ($this->to) {
            SellerStatus::Approved => "{$store} can now use the FDB seller tools.",
            SellerStatus::Rejected => "We could not approve {$store} yet. You can update your application and send it again.",
            SellerStatus::Suspended => "{$store} is hidden from customers and cannot take new orders until it is reactivated.",
            SellerStatus::Pending => "{$store} is waiting for review.",
        };
    }
}
