<?php

use App\Http\Middleware\EnsureAccountIsActive;
use App\Http\Middleware\EnsureEmailIsVerifiedWhenRequired;
use App\Http\Middleware\EnsureNotAdmin;
use App\Http\Middleware\EnsureSellerAccount;
use App\Http\Middleware\RequireEdgeSecret;
use App\Http\Middleware\RequireSpaSession;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        apiPrefix: 'api/v1',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->prepend(RequireEdgeSecret::class);
        $middleware->statefulApi();
        $middleware->alias([
            'active' => EnsureAccountIsActive::class,
            'seller' => EnsureSellerAccount::class,
            'shopper' => EnsureNotAdmin::class,
            'spa.session' => RequireSpaSession::class,
            'verified' => EnsureEmailIsVerifiedWhenRequired::class,
        ]);
        $middleware->trustProxies(at: env('TRUSTED_PROXIES', '127.0.0.1'));
        $middleware->throttleApi();
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
    })->create();
