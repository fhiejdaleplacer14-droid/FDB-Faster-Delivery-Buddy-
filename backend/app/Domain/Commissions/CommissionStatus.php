<?php

namespace App\Domain\Commissions;

enum CommissionStatus: string
{
    // Order placed; not earned until the seller order is delivered.
    case Pending = 'pending';
    // Earned and owed to FDB.
    case Due = 'due';
    // The seller has paid it to FDB.
    case Collected = 'collected';
    // The seller order was cancelled before delivery.
    case Voided = 'voided';
}
