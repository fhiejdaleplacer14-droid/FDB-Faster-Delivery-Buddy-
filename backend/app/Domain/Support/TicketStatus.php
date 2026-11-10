<?php

namespace App\Domain\Support;

enum TicketStatus: string
{
    // FDB needs to act.
    case Open = 'open';
    // FDB replied and is waiting for the customer or seller.
    case WaitingOnUser = 'waiting_on_user';
    // Settled; a new reply reopens it.
    case Resolved = 'resolved';
    // Final; no more replies.
    case Closed = 'closed';
}
