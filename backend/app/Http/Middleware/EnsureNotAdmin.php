<?php

namespace App\Http\Middleware;

use App\Domain\Identity\RoleSlug;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

// Admin accounts only run FDB: no shopping, ordering, or selling from them.
class EnsureNotAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->user()?->hasRole(RoleSlug::Admin)) {
            return response()->json([
                'message' => 'Admin accounts are only for running FDB. Use a separate account to shop or sell.',
            ], 403);
        }

        return $next($request);
    }
}
