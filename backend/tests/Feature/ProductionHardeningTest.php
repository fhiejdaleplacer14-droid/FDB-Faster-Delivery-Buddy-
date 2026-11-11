<?php

use App\Providers\AppServiceProvider;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

function bootAsProduction(): void
{
    app()->detectEnvironment(fn () => 'production');
    try {
        (new AppServiceProvider(app()))->boot();
    } finally {
        // Undo the global switches so later tests run normally.
        app()->detectEnvironment(fn () => 'testing');
        DB::prohibitDestructiveCommands(false);
        Model::shouldBeStrict();
    }
}

it('refuses to start in production with debug pages on', function () {
    config(['app.debug' => true]);

    expect(fn () => bootAsProduction())->toThrow(RuntimeException::class, 'APP_DEBUG must be false in production.');
});

it('forces secure session cookies and https links in production', function () {
    config(['app.debug' => false, 'session.secure' => false]);

    bootAsProduction();

    expect(config('session.secure'))->toBeTrue()
        ->and(config('session.http_only'))->toBeTrue()
        ->and(url('/orders'))->toStartWith('https://');
});
