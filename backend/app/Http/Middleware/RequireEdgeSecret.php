<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

// Only the website's Worker knows the secret, so the API cannot be called around it (or with a faked IP).
class RequireEdgeSecret
{
    private const OPEN_PATHS = ['api/v1/health', 'up'];

    public function handle(Request $request, Closure $next): Response
    {
        $secret = (string) config('fdb.edge_secret');

        if ($secret === '' || $request->is(...self::OPEN_PATHS) || hash_equals($secret, (string) $request->header('X-FDB-Edge'))) {
            return $next($request);
        }

        return response()->json(['message' => 'Use the FDB website.'], 403);
    }
}
