<?php

namespace App\Domain\Orders;

use Illuminate\Http\JsonResponse;
use RuntimeException;

class InvalidOrderTransition extends RuntimeException
{
    public function render(): JsonResponse
    {
        return response()->json(['message' => $this->getMessage()], 409);
    }
}
