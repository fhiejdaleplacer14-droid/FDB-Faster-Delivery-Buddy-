<?php

namespace App\Domain\Orders;

enum SellerOrderStatus: string
{
    case PendingConfirmation = 'pending_confirmation';
    case Confirmed = 'confirmed';
    case Preparing = 'preparing';
    case ReadyForDelivery = 'ready_for_delivery';
    case OutForDelivery = 'out_for_delivery';
    case Delivered = 'delivered';
    case Cancelled = 'cancelled';

    // The forward path a seller moves an order along. Steps may be skipped, never reversed.
    private const PATH = [
        self::PendingConfirmation,
        self::Confirmed,
        self::Preparing,
        self::ReadyForDelivery,
        self::OutForDelivery,
        self::Delivered,
    ];

    public function canAdvanceTo(self $next): bool
    {
        $from = array_search($this, self::PATH, true);
        $to = array_search($next, self::PATH, true);

        return $from !== false && $to !== false && $to > $from;
    }

    // Placeholder policy: cancelling stops once the order has left the store.
    public function sellerCanCancel(): bool
    {
        return in_array($this, [self::PendingConfirmation, self::Confirmed, self::Preparing, self::ReadyForDelivery], true);
    }

    // Placeholder policy: customers may cancel only before the seller confirms.
    public function customerCanCancel(): bool
    {
        return $this === self::PendingConfirmation;
    }

    public function isOpen(): bool
    {
        return ! in_array($this, [self::Delivered, self::Cancelled], true);
    }
}
