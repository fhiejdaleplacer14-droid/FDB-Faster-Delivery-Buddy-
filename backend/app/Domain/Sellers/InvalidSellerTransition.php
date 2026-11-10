<?php

namespace App\Domain\Sellers;

use Illuminate\Http\JsonResponse;
use RuntimeException;

class InvalidSellerTransition extends RuntimeException
{
    public static function between(SellerStatus $from, SellerStatus $to): self
    {
        return new self("This seller is {$from->value}, so it cannot be changed to {$to->value}. Reload the page to see the latest status.");
    }

    public function render(): JsonResponse
    {
        return response()->json(['message' => $this->getMessage()], 409);
    }
}
