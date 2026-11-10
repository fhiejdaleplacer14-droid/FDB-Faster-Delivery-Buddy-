<?php

namespace App\Domain\Support;

enum TicketCategory: string
{
    case OrderProblem = 'order_problem';
    case Dispute = 'dispute';
    case Delivery = 'delivery';
    case Payment = 'payment';
    case Account = 'account';
    case Selling = 'selling';
    case Other = 'other';

    public function label(): string
    {
        return match ($this) {
            self::OrderProblem => 'Problem with an order',
            self::Dispute => 'Dispute about a delivered order',
            self::Delivery => 'Delivery',
            self::Payment => 'Payment',
            self::Account => 'My account',
            self::Selling => 'Selling on FDB',
            self::Other => 'Something else',
        };
    }

    // The seller of the linked order takes part in these conversations.
    public function involvesSeller(): bool
    {
        return in_array($this, [self::OrderProblem, self::Dispute, self::Delivery], true);
    }
}
