<?php

namespace App\Notifications;

use App\Domain\Catalog\ProductStatus;
use App\Models\Product;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class ProductModerated extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly Product $product,
        public readonly ProductStatus $to,
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
        $mail = (new MailMessage)->subject($this->title())->line($this->body());

        if ($this->reason) {
            $mail->line('Reason: '.$this->reason);
        }

        return $mail->action('Open your listings', rtrim(config('app.frontend_url'), '/').'/seller/products/'.$this->product->id);
    }

    /** @return array<string, mixed> */
    public function toArray(object $notifiable): array
    {
        return [
            'kind' => 'product_moderated',
            'product_id' => $this->product->id,
            'to' => $this->to->value,
            'title' => $this->title(),
            'body' => $this->body(),
            'reason' => $this->reason,
            'url' => '/seller/products/'.$this->product->id,
        ];
    }

    private function title(): string
    {
        return $this->to === ProductStatus::Published
            ? 'Your listing is live on FDB'
            : 'Your listing needs changes';
    }

    private function body(): string
    {
        return $this->to === ProductStatus::Published
            ? "{$this->product->name} is now visible to customers."
            : "{$this->product->name} is not visible to customers. Update it and submit it again.";
    }
}
