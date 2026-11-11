<?php

namespace App\Domain\Commissions;

use App\Domain\Catalog\ProductStatus;
use App\Domain\Orders\SellerOrderStatus;
use App\Domain\Sellers\SellerStatus;
use App\Domain\Support\TicketStatus;
use App\Models\Order;
use App\Models\Product;
use App\Models\Seller;
use App\Models\SupportTicket;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

// The admin home: this period vs the one before, daily trends, and what needs attention.
// Money totals come from FinancialReport so both pages always agree.
class AdminDashboard
{
    public function __construct(private readonly FinancialReport $report) {}

    /** @return array<string, mixed> */
    public function build(int $days): array
    {
        $zone = config('app.display_timezone');
        $start = now($zone)->startOfDay()->subDays($days - 1);
        $end = now($zone)->endOfDay();
        $from = $start->copy()->utc();
        $to = $end->copy()->utc();
        $prevFrom = $start->copy()->subDays($days)->utc();
        $prevTo = $start->copy()->subSecond()->utc();

        $now = $this->report->summary($from, $to);
        $before = $this->report->summary($prevFrom, $prevTo);
        [$orders, $ordersBefore] = [$this->orderTotals($from, $to), $this->orderTotals($prevFrom, $prevTo)];
        [$customers, $customersBefore] = [$this->newAccounts($from, $to), $this->newAccounts($prevFrom, $prevTo)];

        return [
            'period' => ['days' => $days, 'from' => $start->toDateString(), 'to' => $end->toDateString()],
            'kpis' => [
                'gmv_delivered' => $this->kpi($now['gmv_delivered'], $before['gmv_delivered']),
                'commission_earned' => $this->kpi($now['commission_earned'], $before['commission_earned']),
                'orders' => $this->kpi((string) $orders['count'], (string) $ordersBefore['count']),
                'average_order' => $this->kpi($orders['average'], $ordersBefore['average']),
                'new_customers' => $this->kpi((string) $customers, (string) $customersBefore),
                'refunds' => $this->kpi($now['refunds_recorded'], $before['refunds_recorded']),
            ],
            'daily' => $this->daily($start, $days, $from, $to, $zone),
            'order_status' => $this->orderStatus($from, $to),
            'top_stores' => array_map(fn (array $s) => [
                'name' => $s['store_name'],
                'gmv' => $s['gmv_delivered'],
                'orders' => $s['orders_delivered'],
            ], array_slice($now['sellers'], 0, 5)),
            'categories' => $this->categories($from, $to),
            'attention' => [
                'seller_applications' => Seller::query()->where('status', SellerStatus::Pending)->count(),
                'listings_to_review' => Product::query()->where('status', ProductStatus::PendingReview)->count(),
                'open_support' => SupportTicket::query()->where('status', TicketStatus::Open)->count(),
                'commission_due' => $now['commission_outstanding'],
                'credits_owed' => $now['commission_credits_owed'],
            ],
            'recent_orders' => Order::query()->with('user')->latest('placed_at')->latest('id')->limit(6)->get()->map(fn (Order $o) => [
                'number' => $o->number,
                'customer' => $o->user?->name,
                'total' => $o->grand_total,
                'status' => $o->status->value,
                'placed_at' => $o->placed_at->toIso8601ZuluString(),
            ])->all(),
        ];
    }

    /** @return array{value: string, previous: string, change_pct: ?string} */
    private function kpi(string $value, string $previous): array
    {
        // Percent change to one decimal, rounded half up; none when there is nothing to compare with.
        $change = null;
        if (bccomp($previous, '0', 2) !== 0) {
            $raw = bcdiv(bcmul(bcsub($value, $previous, 4), '100', 4), $previous, 4);
            $change = bcadd($raw, bccomp($raw, '0', 4) >= 0 ? '0.05' : '-0.05', 1);
        }

        return ['value' => $value, 'previous' => $previous, 'change_pct' => $change];
    }

    /** @return array{count: int, average: string} */
    private function orderTotals(Carbon $from, Carbon $to): array
    {
        $row = Order::query()->whereBetween('placed_at', [$from, $to])->where('status', '!=', 'cancelled')
            ->toBase()->selectRaw('COUNT(*) AS n, COALESCE(SUM(grand_total), 0) AS total')->first();
        $n = (int) $row->n;
        // Average rounded half up to the centavo.
        $average = $n ? bcadd(bcdiv((string) $row->total, (string) $n, 3), '0.005', 2) : '0.00';

        return ['count' => $n, 'average' => $average];
    }

    private function newAccounts(Carbon $from, Carbon $to): int
    {
        return User::query()->whereBetween('created_at', [$from, $to])->count();
    }

    /** @return list<array{date: string, gmv: string, orders: int}> */
    private function daily(Carbon $start, int $days, Carbon $from, Carbon $to, string $zone): array
    {
        $local = fn (string $column) => "(({$column} AT TIME ZONE 'UTC') AT TIME ZONE ?)::date";

        $gmv = DB::table('seller_orders')
            ->selectRaw("{$local('delivered_at')} AS day, SUM(items_total) AS total", [$zone])
            ->whereBetween('delivered_at', [$from, $to])
            ->groupByRaw('1')->pluck('total', 'day');

        $orders = DB::table('orders')
            ->selectRaw("{$local('placed_at')} AS day, COUNT(*) AS n", [$zone])
            ->whereBetween('placed_at', [$from, $to])->where('status', '!=', 'cancelled')
            ->groupByRaw('1')->pluck('n', 'day');

        $series = [];
        for ($i = 0; $i < $days; $i++) {
            $day = $start->copy()->addDays($i)->toDateString();
            $series[] = ['date' => $day, 'gmv' => bcadd((string) ($gmv[$day] ?? '0'), '0', 2), 'orders' => (int) ($orders[$day] ?? 0)];
        }

        return $series;
    }

    /** @return list<array{key: string, label: string, count: int}> */
    private function orderStatus(Carbon $from, Carbon $to): array
    {
        $counts = DB::table('seller_orders')->whereBetween('created_at', [$from, $to])
            ->groupBy('status')->selectRaw('status, COUNT(*) AS n')->pluck('n', 'status');

        $groups = [
            'waiting' => ['Waiting for seller', [SellerOrderStatus::PendingConfirmation]],
            'in_progress' => ['Being prepared', [SellerOrderStatus::Confirmed, SellerOrderStatus::Preparing, SellerOrderStatus::ReadyForDelivery]],
            'on_the_way' => ['On the way', [SellerOrderStatus::OutForDelivery]],
            'delivered' => ['Delivered', [SellerOrderStatus::Delivered]],
            'cancelled' => ['Cancelled', [SellerOrderStatus::Cancelled]],
        ];

        return array_map(fn (string $key, array $g) => [
            'key' => $key,
            'label' => $g[0],
            'count' => array_sum(array_map(fn (SellerOrderStatus $s) => (int) ($counts[$s->value] ?? 0), $g[1])),
        ], array_keys($groups), $groups);
    }

    /** @return list<array{name: string, gmv: string}> */
    private function categories(Carbon $from, Carbon $to): array
    {
        // Delivered sales by top-level category; past five, the rest folds into "Other".
        $rows = DB::table('order_items')
            ->join('seller_orders', 'seller_orders.id', '=', 'order_items.seller_order_id')
            ->join('products', 'products.id', '=', 'order_items.product_id')
            ->join('categories', 'categories.id', '=', 'products.category_id')
            ->leftJoin('categories as parents', 'parents.id', '=', 'categories.parent_id')
            ->whereBetween('seller_orders.delivered_at', [$from, $to])
            ->groupByRaw('1')
            ->orderByDesc('total')
            ->get([DB::raw('COALESCE(parents.name, categories.name) AS name'), DB::raw('SUM(order_items.line_total) AS total')]);

        $top = $rows->take(5)->map(fn ($r) => ['name' => $r->name, 'gmv' => bcadd((string) $r->total, '0', 2)])->all();
        $rest = $rows->slice(5)->reduce(fn (string $sum, $r) => bcadd($sum, (string) $r->total, 2), '0.00');
        if (bccomp($rest, '0', 2) > 0) {
            $top[] = ['name' => 'Other', 'gmv' => $rest];
        }

        return $top;
    }
}
