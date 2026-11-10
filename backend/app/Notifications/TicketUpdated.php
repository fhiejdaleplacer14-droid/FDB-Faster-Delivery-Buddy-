<?php

namespace App\Notifications;

use App\Models\SupportTicket;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class TicketUpdated extends Notification implements ShouldQueue
{
    use Queueable;

    /** @param 'customer'|'seller' $audience */
    public function __construct(public readonly SupportTicket $ticket, public readonly string $audience, public readonly string $title)
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
            ->subject("{$this->title} ({$this->ticket->number})")
            ->line("{$this->title}: {$this->ticket->subject}")
            ->action('Open the conversation', rtrim(config('app.frontend_url'), '/').$this->url());
    }

    /** @return array<string, mixed> */
    public function toArray(object $notifiable): array
    {
        return [
            'kind' => 'ticket_updated',
            'ticket_number' => $this->ticket->number,
            'title' => $this->title,
            'body' => $this->ticket->subject,
            'url' => $this->url(),
        ];
    }

    private function url(): string
    {
        return ($this->audience === 'seller' ? '/seller/support/' : '/support/').$this->ticket->number;
    }
}
