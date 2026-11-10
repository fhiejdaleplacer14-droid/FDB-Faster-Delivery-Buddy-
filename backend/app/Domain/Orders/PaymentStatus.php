<?php

namespace App\Domain\Orders;

enum PaymentStatus: string
{
    case Unpaid = 'unpaid';
    case Paid = 'paid';
}
