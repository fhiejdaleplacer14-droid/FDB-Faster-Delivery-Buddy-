<?php

namespace App\Domain\Support;

use App\Domain\Audit\AuditLogger;
use App\Domain\Identity\PermissionSlug;
use App\Domain\Orders\SellerOrderStatus;
use App\Models\Seller;
use App\Models\SellerOrder;
use App\Models\SupportTicket;
use App\Models\User;
use App\Notifications\TicketUpdated;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class SupportService
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function open(User $customer, TicketCategory $category, string $subject, string $body, ?SellerOrder $sellerOrder): SupportTicket
    {
        if ($category === TicketCategory::Dispute) {
            $this->ensureDisputable($sellerOrder);
        }

        try {
            $ticket = DB::transaction(function () use ($customer, $category, $subject, $body, $sellerOrder) {
                $ticket = new SupportTicket;
                $ticket->forceFill([
                    'number' => $this->number(),
                    'user_id' => $customer->id,
                    'category' => $category,
                    'subject' => $subject,
                    'status' => TicketStatus::Open,
                    'seller_order_id' => $sellerOrder?->id,
                    'seller_id' => $sellerOrder?->seller_id,
                    'last_activity_at' => now(),
                ])->save();

                $ticket->messages()->create(['author_id' => $customer->id, 'author_role' => AuthorRole::Customer, 'body' => $body]);

                return $ticket;
            });
        } catch (UniqueConstraintViolationException) {
            throw ValidationException::withMessages(['seller_order_number' => 'There is already an open dispute for this order.']);
        }

        $this->notifySeller($ticket, $customer);

        return $ticket;
    }

    // The role is decided by how this user relates to the ticket, never by what the client claims.
    public function roleFor(SupportTicket $ticket, User $user): ?AuthorRole
    {
        if ($ticket->user_id === $user->id) {
            return AuthorRole::Customer;
        }
        if ($ticket->seller_id && $ticket->category->involvesSeller()
            && Seller::query()->whereKey($ticket->seller_id)->where('user_id', $user->id)->exists()) {
            return AuthorRole::Seller;
        }
        if ($user->hasPermission(PermissionSlug::SupportManage)) {
            return AuthorRole::Staff;
        }

        return null;
    }

    public function reply(SupportTicket $ticket, User $author, AuthorRole $role, string $body): SupportTicket
    {
        $ticket = DB::transaction(function () use ($ticket, $author, $role, $body) {
            $ticket = SupportTicket::query()->lockForUpdate()->findOrFail($ticket->id);

            if ($ticket->status === TicketStatus::Closed) {
                throw ValidationException::withMessages(['body' => 'This ticket is closed. Open a new one if you still need help.']);
            }

            $ticket->messages()->create(['author_id' => $author->id, 'author_role' => $role, 'body' => $body]);
            // Staff replies wait for the user; anyone else's reply puts the ticket back in FDB's queue.
            $ticket->status = $role === AuthorRole::Staff ? TicketStatus::WaitingOnUser : TicketStatus::Open;
            $ticket->last_activity_at = now();
            $ticket->save();

            return $ticket;
        });

        if ($role !== AuthorRole::Customer) {
            $ticket->user()->firstOrFail()->notify(new TicketUpdated($ticket, 'customer', $role === AuthorRole::Staff ? 'FDB support replied' : 'The seller replied'));
        }
        if ($role !== AuthorRole::Seller) {
            $this->notifySeller($ticket, $author);
        }

        return $ticket;
    }

    public function setStatus(SupportTicket $ticket, TicketStatus $status, ?string $resolution, User $staff): SupportTicket
    {
        if ($status === TicketStatus::Resolved && $ticket->category === TicketCategory::Dispute && ! $resolution) {
            throw ValidationException::withMessages(['resolution' => 'Explain how the dispute was settled.']);
        }

        $ticket = DB::transaction(function () use ($ticket, $status, $resolution, $staff) {
            $ticket = SupportTicket::query()->lockForUpdate()->findOrFail($ticket->id);
            $ticket->status = $status;
            $ticket->last_activity_at = now();

            if (in_array($status, [TicketStatus::Resolved, TicketStatus::Closed], true)) {
                $ticket->resolution = $resolution ?? $ticket->resolution;
                $ticket->resolved_by = $staff->id;
                $ticket->resolved_at = now();
            }
            $ticket->save();

            if ($resolution) {
                $ticket->messages()->create(['author_id' => $staff->id, 'author_role' => AuthorRole::Staff, 'body' => $resolution]);
            }

            $this->audit->record('support_ticket.'.$status->value, $staff, $ticket, array_filter([
                'category' => $ticket->category->value,
                'resolution' => $resolution,
            ]));

            return $ticket;
        });

        $title = match ($status) {
            TicketStatus::Resolved => 'Your request was resolved',
            TicketStatus::Closed => 'Your request was closed',
            default => 'Your request was updated',
        };
        $ticket->user()->firstOrFail()->notify(new TicketUpdated($ticket, 'customer', $title));
        $this->notifySeller($ticket, $staff);

        return $ticket;
    }

    private function ensureDisputable(?SellerOrder $sellerOrder): void
    {
        if (! $sellerOrder) {
            throw ValidationException::withMessages(['seller_order_number' => 'Choose the order this dispute is about.']);
        }
        if ($sellerOrder->status !== SellerOrderStatus::Delivered || ! $sellerOrder->delivered_at) {
            throw ValidationException::withMessages(['seller_order_number' => 'Disputes can be opened only for delivered orders. For other problems, choose "Problem with an order".']);
        }

        $days = config('fdb.support.dispute_window_days');
        if ($sellerOrder->delivered_at->lt(now()->subDays($days))) {
            throw ValidationException::withMessages(['seller_order_number' => "Disputes must be opened within {$days} days of delivery. Choose \"Problem with an order\" instead."]);
        }
    }

    private function notifySeller(SupportTicket $ticket, User $actor): void
    {
        if (! $ticket->seller_id || ! $ticket->category->involvesSeller()) {
            return;
        }

        $sellerUser = Seller::query()->with('user')->findOrFail($ticket->seller_id)->user;
        if ($sellerUser->id !== $actor->id) {
            $sellerUser->notify(new TicketUpdated($ticket, 'seller', $ticket->category === TicketCategory::Dispute ? 'Dispute about one of your orders' : 'A customer needs help with an order'));
        }
    }

    private function number(): string
    {
        $alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

        do {
            $number = 'SUP-'.collect(range(1, 6))->map(fn () => $alphabet[random_int(0, strlen($alphabet) - 1)])->implode('');
        } while (SupportTicket::query()->where('number', $number)->exists());

        return $number;
    }
}
