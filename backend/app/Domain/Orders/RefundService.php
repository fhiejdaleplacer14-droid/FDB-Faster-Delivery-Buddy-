<?php

namespace App\Domain\Orders;

use App\Domain\Audit\AuditLogger;
use App\Domain\Commissions\CommissionStatus;
use App\Models\CommissionAdjustment;
use App\Models\CommissionRecord;
use App\Models\Refund;
use App\Models\SellerOrder;
use App\Models\SupportTicket;
use App\Models\User;
use App\Notifications\RefundRecorded;
use App\Support\Money;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

// Sellers return the money themselves; FDB records it and corrects its own commission.
class RefundService
{
    public function __construct(private readonly AuditLogger $audit) {}

    /** @param 'seller'|'admin' $recordedAs */
    public function record(
        SellerOrder $sellerOrder,
        string $amount,
        string $method,
        ?string $reference,
        string $reason,
        ?Carbon $refundedAt,
        ?SupportTicket $ticket,
        User $actor,
        string $recordedAs,
    ): Refund {
        if (bccomp($amount, '0', 2) <= 0) {
            throw ValidationException::withMessages(['amount' => 'Enter an amount greater than zero.']);
        }
        if ($ticket && $ticket->seller_order_id !== $sellerOrder->id) {
            throw ValidationException::withMessages(['support_ticket_number' => 'That request is about a different order.']);
        }

        $refund = DB::transaction(function () use ($sellerOrder, $amount, $method, $reference, $reason, $refundedAt, $ticket, $actor, $recordedAs) {
            // The lock makes two people refunding at once add up correctly.
            $sellerOrder = SellerOrder::query()->lockForUpdate()->findOrFail($sellerOrder->id);

            if (! $sellerOrder->payment_status->wasPaid()) {
                throw ValidationException::withMessages(['amount' => 'Only paid orders can be refunded. Mark the payment as received first.']);
            }

            $before = $sellerOrder->refunded_total;
            $after = Money::add($before, $amount);
            if (bccomp($after, $sellerOrder->total, 2) > 0) {
                $left = Money::subtract($sellerOrder->total, $before);
                throw ValidationException::withMessages(['amount' => "At most ₱{$left} can still be refunded on this order."]);
            }

            $refund = new Refund;
            $refund->forceFill([
                'seller_order_id' => $sellerOrder->id,
                'seller_id' => $sellerOrder->seller_id,
                'support_ticket_id' => $ticket?->id,
                'amount' => $amount,
                'method' => $method,
                'reference' => $reference,
                'reason' => $reason,
                'recorded_by' => $actor->id,
                'recorded_as' => $recordedAs,
                'refunded_at' => $refundedAt ?? now(),
                'commission_items_value' => $this->itemsValue($sellerOrder, $before, $after),
            ])->save();

            // A seller's own refund could be used to dodge commission, so an admin approves it first.
            if ($recordedAs === 'seller' && $this->affectsCommission($refund)) {
                $refund->forceFill(['commission_status' => 'pending'])->save();
            } else {
                $this->applyCommission($refund, $sellerOrder, $actor);
            }

            $sellerOrder->refunded_total = $after;
            $sellerOrder->payment_status = bccomp($after, $sellerOrder->total, 2) === 0 ? PaymentStatus::Refunded : PaymentStatus::PartiallyRefunded;
            $sellerOrder->save();

            $this->audit->record('refund.recorded', $actor, $refund, array_filter([
                'seller_order' => $sellerOrder->number,
                'amount' => $amount,
                'method' => $method,
                'recorded_as' => $recordedAs,
                'commission_status' => $refund->commission_status,
                'commission_reduction' => $refund->commission_reduction,
                'commission_credit' => $refund->commission_credit,
                'ticket' => $ticket?->number,
            ]));

            return $refund;
        });

        $sellerOrder = $refund->sellerOrder()->with(['order.user', 'seller.user'])->firstOrFail();
        $sellerOrder->order->user->notify(new RefundRecorded($refund, 'customer'));
        if ($recordedAs === 'admin') {
            $sellerOrder->seller->user->notify(new RefundRecorded($refund, 'seller'));
        }

        return $refund;
    }

    public function approveCommission(Refund $refund, User $actor): Refund
    {
        return $this->review($refund, $actor, 'applied', function (Refund $refund) use ($actor) {
            $this->applyCommission($refund, SellerOrder::query()->lockForUpdate()->findOrFail($refund->seller_order_id), $actor);
        });
    }

    // The refund still stands for the customer; only FDB's commission is left unchanged.
    public function declineCommission(Refund $refund, User $actor): Refund
    {
        return $this->review($refund, $actor, 'declined', fn () => null);
    }

    private function review(Refund $refund, User $actor, string $status, callable $apply): Refund
    {
        return DB::transaction(function () use ($refund, $actor, $status, $apply) {
            $refund = Refund::query()->lockForUpdate()->findOrFail($refund->id);
            if ($refund->commission_status !== 'pending') {
                throw ValidationException::withMessages(['refund' => 'This refund is not waiting for a commission decision.']);
            }

            $apply($refund);
            $refund->forceFill([
                'commission_status' => $status,
                'commission_reviewed_by' => $actor->id,
                'commission_reviewed_at' => now(),
            ])->save();

            $this->audit->record("refund.commission_{$status}", $actor, $refund, array_filter([
                'amount' => $refund->amount,
                'commission_reduction' => $refund->commission_reduction,
                'commission_credit' => $refund->commission_credit,
            ]));

            return $refund;
        });
    }

    public function settleCredit(Refund $refund, User $actor): Refund
    {
        return DB::transaction(function () use ($refund, $actor) {
            $refund = Refund::query()->lockForUpdate()->findOrFail($refund->id);

            if (bccomp($refund->commission_credit, '0', 2) === 0 || $refund->credit_settled_at) {
                throw ValidationException::withMessages(['refund' => 'There is no open commission credit on this refund.']);
            }

            $refund->forceFill(['credit_settled_at' => now(), 'credit_settled_by' => $actor->id])->save();
            $this->audit->record('refund.credit_settled', $actor, $refund, ['amount' => $refund->commission_credit]);

            return $refund;
        });
    }

    // Only the item value carries commission, so refunds count against items first.
    private function itemsValue(SellerOrder $sellerOrder, string $before, string $after): string
    {
        $base = $sellerOrder->items_total;

        return Money::subtract($this->min($after, $base), $this->min($before, $base));
    }

    private function affectsCommission(Refund $refund): bool
    {
        return config('fdb.refunds.commission_treatment') === 'proportional' && bccomp($refund->commission_items_value, '0', 2) > 0;
    }

    private function applyCommission(Refund $refund, SellerOrder $sellerOrder, User $actor): void
    {
        if (config('fdb.refunds.commission_treatment') !== 'proportional') {
            return;
        }

        $record = CommissionRecord::query()->where('seller_order_id', $sellerOrder->id)->lockForUpdate()->first();
        if (! $record || $record->status === CommissionStatus::Voided) {
            return;
        }

        $reduction = $this->min(Money::percentOf($refund->commission_items_value, $record->rate), $record->netAmount());
        if (bccomp($reduction, '0', 2) <= 0) {
            return;
        }

        if ($record->status === CommissionStatus::Collected) {
            $refund->commission_credit = $reduction;
        } else {
            $adjustment = new CommissionAdjustment;
            $adjustment->forceFill([
                'commission_record_id' => $record->id,
                'amount' => Money::subtract('0', $reduction),
                'reason' => "Refund of ₱{$refund->amount} on {$sellerOrder->number}",
                'created_by' => $actor->id,
            ])->save();

            $record->adjustment_total = Money::subtract($record->adjustment_total, $reduction);
            $record->save();
            $refund->commission_reduction = $reduction;
        }
        $refund->save();
    }

    private function min(string $a, string $b): string
    {
        return bccomp($a, $b, 2) <= 0 ? $a : $b;
    }
}
