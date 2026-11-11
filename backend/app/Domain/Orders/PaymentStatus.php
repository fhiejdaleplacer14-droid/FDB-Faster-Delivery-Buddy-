<?php

namespace App\Domain\Orders;

enum PaymentStatus: string
{
    case Unpaid = 'unpaid';
    case Paid = 'paid';
    case PartiallyRefunded = 'partially_refunded';
    case Refunded = 'refunded';

    // Money reached the seller at some point, so it can be refunded.
    public function wasPaid(): bool
    {
        return $this !== self::Unpaid;
    }
}
