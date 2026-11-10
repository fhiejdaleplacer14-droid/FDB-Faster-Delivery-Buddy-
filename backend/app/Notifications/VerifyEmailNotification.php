<?php

namespace App\Notifications;

use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Support\Facades\URL;

class VerifyEmailNotification extends VerifyEmail implements ShouldQueue
{
    use Queueable;

    public function __construct()
    {
        $this->afterCommit();
    }

    // Points at the SPA, which forwards the signed parameters to the API.
    protected function verificationUrl($notifiable): string
    {
        $signedPath = URL::temporarySignedRoute(
            'verification.verify',
            now()->addMinutes(config('auth.verification.expire', 60)),
            ['id' => $notifiable->getKey(), 'hash' => sha1($notifiable->getEmailForVerification())],
            absolute: false,
        );

        $query = parse_url($signedPath, PHP_URL_QUERY);

        return sprintf(
            '%s/verify-email/%s/%s?%s',
            rtrim(config('app.frontend_url'), '/'),
            $notifiable->getKey(),
            sha1($notifiable->getEmailForVerification()),
            $query,
        );
    }
}
