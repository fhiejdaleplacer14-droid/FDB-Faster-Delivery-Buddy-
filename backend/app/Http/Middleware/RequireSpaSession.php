<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

// Sign-in needs a session, which Sanctum only starts for requests from a configured web-app address.
// Without this check a misconfigured address shows up as a confusing 500 (and registration half-succeeds).
class RequireSpaSession
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! $request->hasSession()) {
            Log::warning('Sign-in request from an address not in SANCTUM_STATEFUL_DOMAINS', [
                'origin' => $request->headers->get('origin') ?? $request->headers->get('referer'),
            ]);

            return response()->json([
                'message' => 'Sign-in is not available from this web address. Open FDB from its usual address and try again.',
            ], 419);
        }

        return $next($request);
    }
}
