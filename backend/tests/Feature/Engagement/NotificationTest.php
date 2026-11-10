<?php

use App\Models\User;
use Illuminate\Support\Str;

function addNotification(User $user, array $data, bool $read = false): string
{
    $id = (string) Str::uuid();
    $user->notifications()->create([
        'id' => $id,
        'type' => 'test',
        'data' => $data,
        'read_at' => $read ? now() : null,
    ]);

    return $id;
}

it('lists only the user\'s own notifications with an unread count', function () {
    $user = User::factory()->customer()->create();
    addNotification($user, ['title' => 'Order placed', 'url' => '/orders/FDB-1']);
    addNotification($user, ['title' => 'Old news'], read: true);
    addNotification(User::factory()->customer()->create(), ['title' => 'Not yours']);

    $this->actingAs($user)->getJson('/api/v1/notifications')
        ->assertOk()
        ->assertJsonCount(2, 'data')
        ->assertJsonPath('meta.unread', 1)
        ->assertJsonMissing(['title' => 'Not yours']);
});

it('only passes through links inside the app', function () {
    $user = User::factory()->customer()->create();
    addNotification($user, ['title' => 'Bad', 'url' => 'https://evil.example/phish']);
    addNotification($user, ['title' => 'Also bad', 'url' => '//evil.example']);

    $this->actingAs($user)->getJson('/api/v1/notifications')
        ->assertJsonPath('data.0.url', null)
        ->assertJsonPath('data.1.url', null);
});

it('marks one or all notifications as read, never someone else\'s', function () {
    $user = User::factory()->customer()->create();
    $mine = addNotification($user, ['title' => 'A']);
    addNotification($user, ['title' => 'B']);
    $theirs = addNotification(User::factory()->customer()->create(), ['title' => 'C']);

    $this->actingAs($user)->postJson("/api/v1/notifications/{$theirs}/read")->assertNotFound();
    $this->actingAs($user)->postJson("/api/v1/notifications/{$mine}/read")->assertNoContent();
    expect($user->unreadNotifications()->count())->toBe(1);

    $this->actingAs($user)->postJson('/api/v1/notifications/read-all')->assertNoContent();
    expect($user->unreadNotifications()->count())->toBe(0)
        ->and(User::where('id', '!=', $user->id)->sole()->unreadNotifications()->count())->toBe(1);
});
