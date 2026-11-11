<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Auth\Middleware\EnsureEmailIsVerified;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

// Laravel's email check, skipped while FDB_REQUIRE_EMAIL_VERIFICATION is off (test sites without email).
class EnsureEmailIsVerifiedWhenRequired
{
    public function handle(Request $request, Closure $next, ?string $redirectToRoute = null): Response
    {
        if (! config('fdb.accounts.require_email_verification')) {
            return $next($request);
        }

        return app(EnsureEmailIsVerified::class)->handle($request, $next, $redirectToRoute);
    }
}
