<?php

namespace App\Domain\Orders;

enum OrderStatus: string
{
    case InProgress = 'in_progress';
    case Completed = 'completed';
    case Cancelled = 'cancelled';

    /** @param iterable<SellerOrderStatus> $sellerStatuses */
    public static function fromSellerOrders(iterable $sellerStatuses): self
    {
        $statuses = collect($sellerStatuses);

        if ($statuses->every(fn (SellerOrderStatus $s) => $s === SellerOrderStatus::Cancelled)) {
            return self::Cancelled;
        }
        if ($statuses->every(fn (SellerOrderStatus $s) => ! $s->isOpen())) {
            return self::Completed;
        }

        return self::InProgress;
    }
}
