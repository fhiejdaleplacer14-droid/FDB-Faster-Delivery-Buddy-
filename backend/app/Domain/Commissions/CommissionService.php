<?php

namespace App\Domain\Commissions;

use App\Domain\Audit\AuditLogger;
use App\Models\CommissionAdjustment;
use App\Models\CommissionCollection;
use App\Models\CommissionPolicy;
use App\Models\CommissionRecord;
use App\Models\Seller;
use App\Models\SellerOrder;
use App\Models\User;
use App\Support\Money;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use RuntimeException;

class CommissionService
{
    public function __construct(private readonly AuditLogger $audit) {}

    // A seller's own policy wins over the marketplace default.
    public function policyFor(int $sellerId, ?Carbon $at = null): ?CommissionPolicy
    {
        $at ??= now();

        return CommissionPolicy::query()->activeAt($at)->where('seller_id', $sellerId)->latest('effective_from')->first()
            ?? CommissionPolicy::query()->activeAt($at)->whereNull('seller_id')->latest('effective_from')->first();
    }

    /**
     * Starts a new rate now and ends the current one for the same scope. Past orders keep their snapshot.
     *
     * @param  string  $ratePercent  e.g. "7.5"
     */
    public function setPolicy(?Seller $seller, string $ratePercent, ?string $notes, User $actor): CommissionPolicy
    {
        return DB::transaction(function () use ($seller, $ratePercent, $notes, $actor) {
            $now = now();
            $rate = bcdiv($ratePercent, '100', 4);

            $current = CommissionPolicy::query()
                ->where('seller_id', $seller?->id)
                ->whereNull('effective_until')
                ->lockForUpdate()
                ->get();
            $current->each(fn (CommissionPolicy $p) => $p->forceFill(['effective_until' => $now])->save());

            $policy = new CommissionPolicy;
            $policy->forceFill([
                'seller_id' => $seller?->id,
                'rate' => $rate,
                'effective_from' => $now,
                'notes' => $notes,
                'created_by' => $actor->id,
            ])->save();

            $this->audit->record('commission_policy.set', $actor, $policy, array_filter([
                'seller_id' => $seller?->id,
                'rate' => $rate,
                'previous_rate' => $current->first()?->rate,
            ], fn ($v) => $v !== null));

            return $policy;
        });
    }

    // Called inside the checkout transaction. Snapshots the rate so later policy changes never rewrite history.
    public function snapshot(SellerOrder $sellerOrder): CommissionRecord
    {
        $policy = $this->policyFor($sellerOrder->seller_id);
        $rate = $policy?->rate ?? '0.0000';
        $amount = Money::percentOf($sellerOrder->items_total, $rate);

        $sellerOrder->forceFill([
            'commission_policy_id' => $policy?->id,
            'commission_rate' => $rate,
            'commission_amount' => $amount,
        ])->save();

        $record = new CommissionRecord;
        $record->forceFill([
            'seller_order_id' => $sellerOrder->id,
            'seller_id' => $sellerOrder->seller_id,
            'commission_policy_id' => $policy?->id,
            'rate' => $rate,
            'base_amount' => $sellerOrder->items_total,
            'amount' => $amount,
            'status' => CommissionStatus::Pending,
        ])->save();

        return $record;
    }

    // Commission is earned when the seller order is delivered.
    public function markDue(SellerOrder $sellerOrder): void
    {
        $this->transition($sellerOrder, CommissionStatus::Pending, CommissionStatus::Due, ['due_at' => now()]);
    }

    public function void(SellerOrder $sellerOrder): void
    {
        $this->transition($sellerOrder, CommissionStatus::Pending, CommissionStatus::Voided, ['voided_at' => now()]);
    }

    public function adjust(CommissionRecord $record, string $amount, string $reason, User $actor): CommissionRecord
    {
        return DB::transaction(function () use ($record, $amount, $reason, $actor) {
            $record = CommissionRecord::query()->lockForUpdate()->findOrFail($record->id);

            if (bccomp($amount, '0', 2) === 0) {
                throw ValidationException::withMessages(['amount' => 'Enter an amount other than zero.']);
            }
            if (! in_array($record->status, [CommissionStatus::Pending, CommissionStatus::Due], true)) {
                throw ValidationException::withMessages(['amount' => 'Only pending or due commissions can be adjusted.']);
            }

            $newTotal = Money::add($record->adjustment_total, $amount);
            if (bccomp(Money::add($record->amount, $newTotal), '0', 2) < 0) {
                throw ValidationException::withMessages(['amount' => 'The adjustment would make the commission negative.']);
            }

            $adjustment = new CommissionAdjustment;
            $adjustment->forceFill([
                'commission_record_id' => $record->id,
                'amount' => $amount,
                'reason' => $reason,
                'created_by' => $actor->id,
            ])->save();

            $record->adjustment_total = $newTotal;
            $record->save();

            $this->audit->record('commission.adjusted', $actor, $record, ['amount' => $amount, 'reason' => $reason]);

            return $record;
        });
    }

    /** @param list<int> $recordIds */
    public function collect(Seller $seller, array $recordIds, string $method, ?string $reference, ?string $notes, Carbon $collectedAt, User $actor): CommissionCollection
    {
        return DB::transaction(function () use ($seller, $recordIds, $method, $reference, $notes, $collectedAt, $actor) {
            $records = CommissionRecord::query()->whereKey($recordIds)->orderBy('id')->lockForUpdate()->get();

            $invalid = $records->count() !== count(array_unique($recordIds))
                || $records->contains(fn (CommissionRecord $r) => $r->seller_id !== $seller->id || $r->status !== CommissionStatus::Due);
            if ($invalid) {
                throw ValidationException::withMessages(['record_ids' => 'Choose only due commissions from this seller. Reload the page; some may already be collected.']);
            }

            $collection = new CommissionCollection;
            $collection->forceFill([
                'seller_id' => $seller->id,
                'amount' => Money::add(...$records->map->netAmount()->all()),
                'method' => $method,
                'reference' => $reference,
                'notes' => $notes,
                'collected_at' => $collectedAt,
                'recorded_by' => $actor->id,
            ])->save();

            CommissionRecord::query()->whereKey($records->pluck('id'))->update([
                'status' => CommissionStatus::Collected,
                'commission_collection_id' => $collection->id,
                'updated_at' => now(),
            ]);

            $this->audit->record('commission.collected', $actor, $collection, [
                'seller_id' => $seller->id,
                'amount' => $collection->amount,
                'records' => $records->count(),
                'method' => $method,
            ]);

            return $collection;
        });
    }

    /** @param array<string, mixed> $changes */
    private function transition(SellerOrder $sellerOrder, CommissionStatus $from, CommissionStatus $to, array $changes): void
    {
        $record = CommissionRecord::query()->where('seller_order_id', $sellerOrder->id)->lockForUpdate()->first();

        // Orders placed before commissions were recorded have no record; nothing to update.
        if (! $record) {
            return;
        }
        if ($record->status !== $from) {
            throw new RuntimeException("Commission {$record->id} is {$record->status->value}, expected {$from->value}.");
        }

        $record->forceFill(['status' => $to, ...$changes])->save();
    }
}
