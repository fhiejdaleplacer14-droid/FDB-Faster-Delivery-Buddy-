<?php

namespace App\Domain\Commissions;

use App\Domain\Orders\SellerOrderStatus;
use App\Models\CommissionAdjustment;
use App\Models\CommissionCollection;
use App\Models\CommissionRecord;
use App\Models\Refund;
use App\Models\SellerOrder;
use App\Support\Money;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

// GMV is what customers bought through FDB; FDB revenue is only the commission earned. Never mix them.
class FinancialReport
{
    /** @return array<string, mixed> */
    public function summary(Carbon $from, Carbon $to): array
    {
        $net = 'commission_records.amount + commission_records.adjustment_total';

        $placed = SellerOrder::query()
            ->whereBetween('created_at', [$from, $to])
            ->where('status', '!=', SellerOrderStatus::Cancelled);

        $delivered = SellerOrder::query()->whereBetween('delivered_at', [$from, $to]);

        $earned = CommissionRecord::query()
            ->whereIn('status', [CommissionStatus::Due, CommissionStatus::Collected])
            ->whereBetween('due_at', [$from, $to]);

        $gmvDelivered = $this->sum($delivered->clone(), 'items_total');
        $commissionEarned = $this->sum($earned->clone(), DB::raw($net));

        $outstandingBySeller = CommissionRecord::query()
            ->where('status', CommissionStatus::Due)
            ->groupBy('seller_id')
            ->toBase()
            ->selectRaw("seller_id, SUM({$net}) AS total")
            ->pluck('total', 'seller_id');

        $perSeller = SellerOrder::query()
            ->join('sellers', 'sellers.id', '=', 'seller_orders.seller_id')
            ->leftJoin('commission_records', 'commission_records.seller_order_id', '=', 'seller_orders.id')
            ->whereBetween('seller_orders.delivered_at', [$from, $to])
            ->groupBy('sellers.id', 'sellers.store_name')
            ->orderByDesc(DB::raw('SUM(seller_orders.items_total)'))
            ->get([
                'sellers.id',
                'sellers.store_name',
                DB::raw('COUNT(seller_orders.id) AS orders_delivered'),
                DB::raw('SUM(seller_orders.items_total) AS gmv_delivered'),
                DB::raw("COALESCE(SUM({$net}), 0) AS commission_earned"),
            ])
            ->map(fn ($row) => [
                'seller_id' => $row->id,
                'store_name' => $row->store_name,
                'orders_delivered' => (int) $row->orders_delivered,
                'gmv_delivered' => $this->money($row->gmv_delivered),
                'commission_earned' => $this->money($row->commission_earned),
                'seller_earnings' => Money::subtract($this->money($row->gmv_delivered), $this->money($row->commission_earned)),
                'commission_outstanding' => $this->money($outstandingBySeller[$row->id] ?? '0'),
            ])
            ->all();

        return [
            'period' => ['from' => $from->toIso8601ZuluString(), 'to' => $to->toIso8601ZuluString()],
            'orders_placed' => $placed->clone()->count(),
            'gmv_placed' => $this->sum($placed->clone(), 'items_total'),
            'orders_delivered' => $delivered->clone()->count(),
            'gmv_delivered' => $gmvDelivered,
            'commission_earned' => $commissionEarned,
            'seller_earnings' => Money::subtract($gmvDelivered, $commissionEarned),
            'commission_collected' => $this->sum(CommissionCollection::query()->whereBetween('collected_at', [$from, $to]), 'amount'),
            'commission_adjustments' => $this->sum(CommissionAdjustment::query()->whereBetween('created_at', [$from, $to]), 'amount'),
            // Balances as of now, not limited to the period.
            'commission_outstanding' => $this->sum(CommissionRecord::query()->where('status', CommissionStatus::Due), DB::raw($net)),
            'commission_credits_owed' => $this->sum(Refund::query()->where('commission_credit', '>', 0)->whereNull('credit_settled_at'), 'commission_credit'),
            // Sellers return refunds outside FDB; GMV and seller earnings above are before refunds.
            'refunds_recorded' => $this->sum(Refund::query()->whereBetween('refunded_at', [$from, $to]), 'amount'),
            'commission_pending' => $this->sum(CommissionRecord::query()->where('status', CommissionStatus::Pending), DB::raw($net)),
            'sellers' => $perSeller,
        ];
    }

    private function sum($query, $column): string
    {
        return $this->money($query->toBase()->sum($column));
    }

    private function money(mixed $value): string
    {
        return bcadd((string) ($value ?? '0'), '0', 2);
    }
}
