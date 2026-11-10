<?php

namespace App\Domain\Catalog;

use Illuminate\Http\JsonResponse;
use RuntimeException;

class InvalidProductTransition extends RuntimeException
{
    public static function between(ProductStatus $from, ProductStatus $to): self
    {
        return new self("This listing is {$from->value}, so it cannot be changed to {$to->value}. Reload the page to see the latest status.");
    }

    public static function because(string $reason): self
    {
        return new self($reason);
    }

    public function render(): JsonResponse
    {
        return response()->json(['message' => $this->getMessage()], 409);
    }
}
