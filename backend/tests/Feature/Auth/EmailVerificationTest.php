<?php

use App\Models\User;
use App\Notifications\VerifyEmailNotification;
use Illuminate\Support\Facades\Notification;

function apiPathFromVerificationEmail(User $user): string
{
    $url = (new VerifyEmailNotification)->toMail($user)->actionUrl;
    $prefix = config('app.frontend_url').'/verify-email/';

    expect($url)->toStartWith($prefix);

    return '/api/v1/auth/verify-email/'.substr($url, strlen($prefix));
}

it('verifies an email from the emailed link without needing a session', function () {
    $user = User::factory()->unverified()->create();

    $this->getJson(apiPathFromVerificationEmail($user))->assertOk();

    expect($user->fresh()->hasVerifiedEmail())->toBeTrue();
});

it('rejects a link with a tampered signature', function () {
    $user = User::factory()->unverified()->create();
    $path = apiPathFromVerificationEmail($user);

    $this->getJson(preg_replace('/signature=[a-f0-9]+/', 'signature='.str_repeat('0', 64), $path))->assertForbidden();

    expect($user->fresh()->hasVerifiedEmail())->toBeFalse();
});

it('rejects a link signed for a different email address', function () {
    $user = User::factory()->unverified()->create(['email' => 'old@example.com']);
    $path = apiPathFromVerificationEmail($user);
    $user->forceFill(['email' => 'new@example.com'])->save();

    $this->getJson($path)->assertForbidden();

    expect($user->fresh()->hasVerifiedEmail())->toBeFalse();
});

it('rejects an expired link', function () {
    $user = User::factory()->unverified()->create();
    $path = apiPathFromVerificationEmail($user);

    $this->travel(61)->minutes();

    $this->getJson($path)->assertForbidden();
});

it('resends the verification email on request', function () {
    Notification::fake();
    $user = User::factory()->unverified()->customer()->create();

    $this->actingAs($user)->postJson('/api/v1/auth/verify-email/resend')->assertAccepted();

    Notification::assertSentTo($user, VerifyEmailNotification::class);
});
