<?php

namespace App\Domain\Orders;

use App\Domain\Audit\AuditLogger;
use App\Domain\Commissions\CommissionService;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Seller;
use App\Models\SellerOrder;
use App\Models\User;
use App\Notifications\SellerOrderUpdated;
use Illuminate\Support\Facades\DB;

class OrderWorkflow
{
    public function __construct(
        private readonly StockService $stock,
        private readonly AuditLogger $audit,
        private readonly CommissionService $commissions,
    ) {}

    public function advance(SellerOrder $sellerOrder, SellerOrderStatus $to, User $seller, ?string $note): SellerOrder
    {
        return DB::transaction(function () use ($sellerOrder, $to, $seller, $note) {
            $sellerOrder = $this->lock($sellerOrder);
            $from = $sellerOrder->status;

            if (! $from->canAdvanceTo($to)) {
                throw new InvalidOrderTransition($this->statusMessage($from, $to));
            }

            $sellerOrder->status = $to;
            // Any move out of pending counts as confirming, even if the seller skips straight ahead.
            if ($from === SellerOrderStatus::PendingConfirmation) {
                $sellerOrder->confirmed_at = now();
            }
            if ($to === SellerOrderStatus::Delivered) {
                $sellerOrder->delivered_at = now();
            }
            $sellerOrder->save();

            if ($to === SellerOrderStatus::Delivered) {
                $this->commissions->markDue($sellerOrder);
            }

            $this->record($sellerOrder, $from, $to, $seller, $note);
            $this->notifyCustomer($sellerOrder, $note);

            return $sellerOrder;
        });
    }

    /** @param 'customer'|'seller'|'admin' $by */
    public function cancel(SellerOrder $sellerOrder, User $actor, string $by, ?string $reason): SellerOrder
    {
        return DB::transaction(function () use ($sellerOrder, $actor, $by, $reason) {
            $sellerOrder = $this->lock($sellerOrder);
            $from = $sellerOrder->status;

            $allowed = match ($by) {
                'customer' => $from->customerCanCancel(),
                'seller', 'admin' => $from->sellerCanCancel(),
            };
            if (! $allowed) {
                throw new InvalidOrderTransition(match (true) {
                    $from === SellerOrderStatus::Cancelled => 'This order is already cancelled.',
                    $by === 'customer' => 'The seller has already confirmed this order, so it can no longer be cancelled here. Contact FDB support for help.',
                    default => 'This order has already left the store and can no longer be cancelled.',
                });
            }

            $items = OrderItem::query()->where('seller_order_id', $sellerOrder->id)->get();
            $this->stock->giveBack($items->map(fn (OrderItem $i) => ['variant_id' => $i->product_variant_id, 'quantity' => $i->quantity])->all());
            $this->stock->refreshProducts($items->pluck('product_id')->unique()->values()->all());

            $sellerOrder->status = SellerOrderStatus::Cancelled;
            $sellerOrder->cancelled_at = now();
            $sellerOrder->cancelled_by = $by;
            $sellerOrder->cancel_reason = $reason;
            $sellerOrder->save();

            $this->commissions->void($sellerOrder);

            $this->record($sellerOrder, $from, SellerOrderStatus::Cancelled, $actor, $reason);

            if ($by === 'customer') {
                $sellerUser = Seller::query()->with('user')->findOrFail($sellerOrder->seller_id)->user;
                $sellerUser->notify(new SellerOrderUpdated($sellerOrder, 'seller', $reason));
            } else {
                $this->notifyCustomer($sellerOrder, $reason);
            }

            return $sellerOrder;
        });
    }

    public function markPaid(SellerOrder $sellerOrder, User $seller): SellerOrder
    {
        return DB::transaction(function () use ($sellerOrder, $seller) {
            $sellerOrder = $this->lock($sellerOrder);

            if ($sellerOrder->status === SellerOrderStatus::Cancelled) {
                throw new InvalidOrderTransition('A cancelled order cannot be marked as paid.');
            }
            if ($sellerOrder->payment_status === PaymentStatus::Paid) {
                throw new InvalidOrderTransition('This order is already marked as paid.');
            }

            $sellerOrder->payment_status = PaymentStatus::Paid;
            $sellerOrder->paid_at = now();
            $sellerOrder->payment_confirmed_by = $seller->id;
            $sellerOrder->save();

            $this->audit->record('seller_order.payment_received', $seller, $sellerOrder, [
                'number' => $sellerOrder->number,
                'total' => $sellerOrder->total,
            ]);

            return $sellerOrder;
        });
    }

    public function updateDeliveryNote(SellerOrder $sellerOrder, ?string $note): SellerOrder
    {
        return DB::transaction(function () use ($sellerOrder, $note) {
            $sellerOrder = $this->lock($sellerOrder);

            if (! $sellerOrder->status->isOpen()) {
                throw new InvalidOrderTransition('Delivery details can only be changed while the order is open.');
            }

            $sellerOrder->delivery_note = $note;
            $sellerOrder->save();

            return $sellerOrder;
        });
    }

    private function lock(SellerOrder $sellerOrder): SellerOrder
    {
        return SellerOrder::query()->lockForUpdate()->findOrFail($sellerOrder->id);
    }

    private function record(SellerOrder $sellerOrder, SellerOrderStatus $from, SellerOrderStatus $to, User $actor, ?string $note): void
    {
        $sellerOrder->history()->create([
            'from_status' => $from,
            'to_status' => $to,
            'actor_id' => $actor->id,
            'note' => $note,
        ]);

        // The parent order's status follows its seller orders.
        $order = Order::query()->lockForUpdate()->findOrFail($sellerOrder->order_id);
        $order->status = OrderStatus::fromSellerOrders(
            SellerOrder::query()->where('order_id', $order->id)->get()->pluck('status'),
        );
        $order->save();
    }

    private function notifyCustomer(SellerOrder $sellerOrder, ?string $note): void
    {
        $customer = Order::query()->with('user')->findOrFail($sellerOrder->order_id)->user;
        $customer->notify(new SellerOrderUpdated($sellerOrder, 'customer', $note));
    }

    private function statusMessage(SellerOrderStatus $from, SellerOrderStatus $to): string
    {
        return match (true) {
            $from === SellerOrderStatus::Cancelled => 'This order is cancelled.',
            $from === SellerOrderStatus::Delivered => 'This order is already delivered.',
            $from === $to => 'The order already has this status. Reload the page to see the latest.',
            default => 'Orders can only move forward. Reload the page to see the latest status.',
        };
    }
}
