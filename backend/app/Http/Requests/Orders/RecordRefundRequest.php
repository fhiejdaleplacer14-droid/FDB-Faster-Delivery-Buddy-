<?php

namespace App\Http\Requests\Orders;

use App\Domain\Orders\RefundService;
use App\Models\Refund;
use App\Models\SellerOrder;
use App\Models\SupportTicket;
use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class RecordRefundRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'amount' => ['required', 'decimal:0,2', 'gt:0', 'lte:1000000'],
            'method' => ['required', Rule::in(config('fdb.refunds.methods'))],
            'reference' => ['nullable', 'string', 'max:100'],
            'reason' => ['required', 'string', 'min:5', 'max:500'],
            'refunded_at' => ['nullable', 'date', 'before_or_equal:now'],
            'support_ticket_number' => ['nullable', 'string', 'max:20'],
        ];
    }

    /** @param 'seller'|'admin' $recordedAs */
    public function record(RefundService $refunds, SellerOrder $sellerOrder, User $actor, string $recordedAs): Refund
    {
        $data = $this->validated();
        $ticket = null;
        if (! empty($data['support_ticket_number'])) {
            // Looked up within this order only, so other orders' requests stay invisible.
            $ticket = SupportTicket::query()->where('number', $data['support_ticket_number'])->where('seller_order_id', $sellerOrder->id)->first()
                ?? throw ValidationException::withMessages(['support_ticket_number' => 'We could not find that request for this order.']);
        }

        return $refunds->record(
            $sellerOrder,
            bcadd((string) $data['amount'], '0', 2),
            $data['method'],
            isset($data['reference']) ? trim($data['reference']) ?: null : null,
            trim($data['reason']),
            isset($data['refunded_at']) ? Carbon::parse($data['refunded_at']) : null,
            $ticket,
            $actor,
            $recordedAs,
        );
    }
}
