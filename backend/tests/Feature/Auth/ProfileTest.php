<?php

use App\Models\User;
use App\Notifications\VerifyEmailNotification;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;

it('returns the signed-in user', function () {
    $user = User::factory()->customer()->create();

    $this->actingAs($user)->getJson('/api/v1/user')
        ->assertOk()
        ->assertJsonPath('data.id', $user->id)
        ->assertJsonPath('data.seller', null);
});

it('updates the name without touching verification', function () {
    $user = User::factory()->customer()->create();

    $this->actingAs($user)->patchJson('/api/v1/user', ['name' => 'New Name', 'email' => $user->email])
        ->assertOk()
        ->assertJsonPath('data.name', 'New Name')
        ->assertJsonPath('data.email_verified', true);
});

it('requires re-verification after an email change', function () {
    Notification::fake();
    $user = User::factory()->customer()->create();

    $this->actingAs($user)->patchJson('/api/v1/user', ['name' => $user->name, 'email' => 'fresh@example.com'])
        ->assertJsonValidationErrors(['current_password' => 'Enter your current password to change your email.']);
    $this->actingAs($user)->patchJson('/api/v1/user', ['name' => $user->name, 'email' => 'fresh@example.com', 'current_password' => 'wrong'])
        ->assertJsonValidationErrors(['current_password' => 'That password is incorrect.']);
    expect($user->fresh()->email)->not->toBe('fresh@example.com');

    $this->actingAs($user)->patchJson('/api/v1/user', ['name' => $user->name, 'email' => 'fresh@example.com', 'current_password' => 'password'])
        ->assertOk()
        ->assertJsonPath('data.email', 'fresh@example.com')
        ->assertJsonPath('data.email_verified', false);

    Notification::assertSentTo($user, VerifyEmailNotification::class);
});

it('changes the password only with the current password', function () {
    $user = User::factory()->customer()->create();

    $this->actingAs($user)->putJson('/api/v1/user/password', [
        'current_password' => 'wrong-password',
        'password' => 'bagongpass2026',
        'password_confirmation' => 'bagongpass2026',
    ])->assertUnprocessable()->assertJsonValidationErrors('current_password');

    $this->actingAs($user)->putJson('/api/v1/user/password', [
        'current_password' => 'password',
        'password' => 'bagongpass2026',
        'password_confirmation' => 'bagongpass2026',
    ])->assertNoContent();

    expect(Hash::check('bagongpass2026', $user->fresh()->password))->toBeTrue();
});
