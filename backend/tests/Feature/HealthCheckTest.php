<?php

use Illuminate\Support\Facades\Redis;

it('reports healthy when the database and redis respond', function () {
    $this->getJson('/api/v1/health')
        ->assertOk()
        ->assertExactJson([
            'status' => 'ok',
            'checks' => ['database' => 'ok', 'redis' => 'ok'],
        ]);
});

it('reports degraded without leaking error details when a dependency fails', function () {
    Redis::shouldReceive('connection')->andThrow(new RuntimeException('Connection refused [tcp://redis:6379]'));

    $this->getJson('/api/v1/health')
        ->assertStatus(503)
        ->assertExactJson([
            'status' => 'degraded',
            'checks' => ['database' => 'ok', 'redis' => 'fail'],
        ]);
});

it('returns JSON errors for unknown API routes', function () {
    $this->get('/api/v1/does-not-exist')
        ->assertNotFound()
        ->assertHeader('Content-Type', 'application/json')
        ->assertJsonStructure(['message']);
});

it('issues the CSRF cookie needed for SPA authentication', function () {
    $this->get('/sanctum/csrf-cookie')
        ->assertNoContent()
        ->assertCookie('XSRF-TOKEN');
});
