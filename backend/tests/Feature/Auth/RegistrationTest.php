<?php

use App\Domain\Identity\RoleSlug;
use App\Models\User;
use App\Notifications\VerifyEmailNotification;
use Illuminate\Support\Facades\Notification;

beforeEach(fn () => Notification::fake());

it('registers a customer, signs them in, and sends a verification email', function () {
    $this->postJson('/api/v1/auth/register', [
        'name' => 'Maria Santos',
        'email' => '  Maria@Example.com ',
        'password' => 'mangga2026',
        'password_confirmation' => 'mangga2026',
    ])
        ->assertCreated()
        ->assertJsonPath('data.email', 'maria@example.com')
        ->assertJsonPath('data.email_verified', false)
        ->assertJsonPath('data.roles', ['customer'])
        ->assertJsonPath('data.permissions', [])
        ->assertJsonMissingPath('data.password');

    $user = User::where('email', 'maria@example.com')->sole();
    $this->assertAuthenticatedAs($user);
    expect($user->hasRole(RoleSlug::Customer))->toBeTrue();
    Notification::assertSentTo($user, VerifyEmailNotification::class);
});

it('ignores role and status fields sent by the client', function () {
    $this->postJson('/api/v1/auth/register', [
        'name' => 'Sneaky',
        'email' => 'sneaky@example.com',
        'password' => 'mangga2026',
        'password_confirmation' => 'mangga2026',
        'role' => 'admin',
        'roles' => ['admin'],
        'status' => 'active',
        'email_verified_at' => now()->toIso8601String(),
    ])->assertCreated()->assertJsonPath('data.roles', ['customer']);

    $user = User::where('email', 'sneaky@example.com')->sole();
    expect($user->hasRole(RoleSlug::Admin))->toBeFalse()
        ->and($user->hasVerifiedEmail())->toBeFalse();
});

it('rejects an email that is already registered, ignoring case', function () {
    User::factory()->create(['email' => 'taken@example.com']);

    $this->postJson('/api/v1/auth/register', [
        'name' => 'Someone',
        'email' => 'TAKEN@example.com',
        'password' => 'mangga2026',
        'password_confirmation' => 'mangga2026',
    ])->assertUnprocessable()->assertJsonValidationErrors('email');
});

it('requires a strong, confirmed password', function (string $password, string $confirmation) {
    $this->postJson('/api/v1/auth/register', [
        'name' => 'Someone',
        'email' => 'someone@example.com',
        'password' => $password,
        'password_confirmation' => $confirmation,
    ])->assertUnprocessable()->assertJsonValidationErrors('password');
})->with([
    'too short' => ['abc123', 'abc123'],
    'letters only' => ['onlyletters', 'onlyletters'],
    'mismatch' => ['mangga2026', 'mangga2027'],
]);
