<?php

use App\Models\User;
use App\Notifications\ResetPasswordNotification;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;

beforeEach(fn () => Notification::fake());

it('sends a reset link that points to the web app', function () {
    $user = User::factory()->create(['email' => 'juan@example.com']);

    $this->postJson('/api/v1/auth/forgot-password', ['email' => 'juan@example.com'])->assertOk();

    Notification::assertSentTo($user, ResetPasswordNotification::class, function ($notification) use ($user) {
        $url = $notification->toMail($user)->actionUrl;

        return str_starts_with($url, config('app.frontend_url').'/reset-password?token=');
    });
});

it('responds the same way for unknown emails', function () {
    $known = User::factory()->create(['email' => 'juan@example.com']);

    $forKnown = $this->postJson('/api/v1/auth/forgot-password', ['email' => 'juan@example.com'])->json();
    $forUnknown = $this->postJson('/api/v1/auth/forgot-password', ['email' => 'ghost@example.com'])->json();

    expect($forUnknown)->toBe($forKnown);
    Notification::assertSentTimes(ResetPasswordNotification::class, 1);
});

it('resets the password with a valid token', function () {
    $user = User::factory()->create(['email' => 'juan@example.com']);
    $this->postJson('/api/v1/auth/forgot-password', ['email' => 'juan@example.com']);

    $token = null;
    Notification::assertSentTo($user, ResetPasswordNotification::class, function ($n) use (&$token) {
        $token = $n->token;

        return true;
    });

    $this->postJson('/api/v1/auth/reset-password', [
        'token' => $token,
        'email' => 'juan@example.com',
        'password' => 'bagongpass2026',
        'password_confirmation' => 'bagongpass2026',
    ])->assertOk();

    expect(Hash::check('bagongpass2026', $user->fresh()->password))->toBeTrue();
});

it('rejects an invalid token', function () {
    $user = User::factory()->create(['email' => 'juan@example.com']);

    $this->postJson('/api/v1/auth/reset-password', [
        'token' => 'not-a-real-token',
        'email' => 'juan@example.com',
        'password' => 'bagongpass2026',
        'password_confirmation' => 'bagongpass2026',
    ])->assertUnprocessable()->assertJsonValidationErrors('email');

    expect(Hash::check('password', $user->fresh()->password))->toBeTrue();
});
