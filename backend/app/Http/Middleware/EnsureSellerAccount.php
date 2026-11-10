<?php

namespace App\Http\Middleware;

use App\Domain\Sellers\SellerStatus;
use App\Models\Seller;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

// Usage: 'seller' for read access, 'seller:write' to also block suspended stores.
class EnsureSellerAccount
{
    public function handle(Request $request, Closure $next, string $mode = 'read'): Response
    {
        $seller = Seller::query()->where('user_id', $request->user()->id)->first();

        if (! $seller || ! in_array($seller->status, [SellerStatus::Approved, SellerStatus::Suspended], true)) {
            return response()->json(['message' => 'You need an approved seller account to manage listings.'], 403);
        }

        if ($mode === 'write' && $seller->status === SellerStatus::Suspended) {
            return response()->json(['message' => 'Your store is suspended, so listings cannot be changed. Contact FDB support for help.'], 403);
        }

        $request->attributes->set('seller', $seller);

        return $next($request);
    }
}
