<?php

use App\Models\User;

it('signs in with valid credentials', function () {
    $user = User::factory()->customer()->create(['email' => 'juan@example.com']);

    $this->postJson('/api/v1/auth/login', ['email' => 'Juan@Example.com', 'password' => 'password'])
        ->assertOk()
        ->assertJsonPath('data.id', $user->id)
        ->assertJsonPath('data.roles', ['customer']);

    $this->assertAuthenticatedAs($user);
});

it('gives the same error for a wrong password and an unknown email', function () {
    User::factory()->create(['email' => 'juan@example.com']);

    $wrongPassword = $this->postJson('/api/v1/auth/login', ['email' => 'juan@example.com', 'password' => 'nope'])
        ->assertUnprocessable()->json('errors.email');
    $unknownEmail = $this->postJson('/api/v1/auth/login', ['email' => 'ghost@example.com', 'password' => 'nope'])
        ->assertUnprocessable()->json('errors.email');

    expect($wrongPassword)->toBe($unknownEmail);
    $this->assertGuest();
});

it('locks sign-in after five failed attempts', function () {
    User::factory()->create(['email' => 'juan@example.com']);

    foreach (range(1, 5) as $attempt) {
        $this->postJson('/api/v1/auth/login', ['email' => 'juan@example.com', 'password' => 'wrong'])->assertUnprocessable();
    }

    $this->postJson('/api/v1/auth/login', ['email' => 'juan@example.com', 'password' => 'password'])
        ->assertTooManyRequests();
    $this->assertGuest();
});

it('locks one account after repeated failures from many addresses', function () {
    User::factory()->create(['email' => 'juan@example.com']);

    foreach (range(1, 20) as $attempt) {
        $this->withServerVariables(['REMOTE_ADDR' => "10.0.0.{$attempt}"])
            ->postJson('/api/v1/auth/login', ['email' => 'juan@example.com', 'password' => 'wrong'])->assertUnprocessable();
    }

    $this->withServerVariables(['REMOTE_ADDR' => '10.0.1.1'])
        ->postJson('/api/v1/auth/login', ['email' => 'juan@example.com', 'password' => 'password'])
        ->assertTooManyRequests();
    $this->assertGuest();
});

it('refuses to sign in a suspended account', function () {
    User::factory()->suspended()->create(['email' => 'banned@example.com']);

    $this->postJson('/api/v1/auth/login', ['email' => 'banned@example.com', 'password' => 'password'])
        ->assertForbidden()
        ->assertJsonPath('message', 'This account has been suspended. Contact FDB support for help.');

    $this->assertGuest('web');
});

it('ends the session of an account suspended while signed in', function () {
    $user = User::factory()->customer()->create();
    $this->actingAs($user);
    $user->forceFill(['status' => 'suspended'])->save();

    $this->getJson('/api/v1/user')->assertForbidden();
    $this->assertGuest('web');
});

it('signs in from any local development port', function () {
    $user = User::factory()->customer()->create(['email' => 'juan@example.com']);

    $this->withHeader('Referer', 'http://localhost:5174/login')
        ->postJson('/api/v1/auth/login', ['email' => 'juan@example.com', 'password' => 'password'])
        ->assertOk();

    $this->assertAuthenticatedAs($user);
});

it('explains instead of crashing when the web address is not allowed, and creates nothing', function () {
    $this->withHeader('Referer', 'https://not-fdb.example/register')
        ->postJson('/api/v1/auth/register', [
            'name' => 'Someone', 'email' => 'someone@example.com',
            'password' => 'mangga2026', 'password_confirmation' => 'mangga2026',
        ])
        ->assertStatus(419)
        ->assertJsonPath('message', 'Sign-in is not available from this web address. Open FDB from its usual address and try again.');

    expect(User::where('email', 'someone@example.com')->exists())->toBeFalse();
});

it('signs out', function () {
    $this->actingAs(User::factory()->customer()->create());

    $this->postJson('/api/v1/auth/logout')->assertNoContent();

    $this->assertGuest('web');
});

it('returns 401 for protected routes when signed out', function (string $method, string $uri) {
    $this->json($method, $uri)->assertUnauthorized();
})->with([
    ['GET', '/api/v1/user'],
    ['PATCH', '/api/v1/user'],
    ['PUT', '/api/v1/user/password'],
    ['GET', '/api/v1/seller-application'],
    ['POST', '/api/v1/seller-application'],
    ['GET', '/api/v1/admin/sellers'],
    ['POST', '/api/v1/auth/logout'],
]);
