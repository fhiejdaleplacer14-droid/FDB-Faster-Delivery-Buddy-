<?php

namespace App\Notifications;

use App\Models\ProductReview;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

class ReviewReceived extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public readonly ProductReview $review)
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
        return [
            'kind' => 'review_received',
            'review_id' => $this->review->id,
            'title' => "New {$this->review->rating}-star review",
            'body' => $this->review->comment ? mb_strimwidth($this->review->comment, 0, 120, '…') : 'A customer rated your product.',
            'url' => '/seller/reviews',
        ];
    }
}
