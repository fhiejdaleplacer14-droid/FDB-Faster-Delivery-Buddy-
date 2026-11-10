<?php

namespace App\Http\Controllers;

use App\Domain\Orders\CheckoutService;
use App\Http\Resources\OrderResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class CheckoutController extends Controller
{
    public function __construct(private readonly CheckoutService $checkout) {}

    public function __invoke(Request $request): JsonResponse
    {
        Validator::make(
            ['idempotency_key' => $request->header('Idempotency-Key')],
            ['idempotency_key' => ['required', 'uuid']],
            ['idempotency_key.*' => 'Send a unique Idempotency-Key header (a UUID) with each checkout.'],
        )->validate();

        $data = $request->validate([
            'address_id' => ['required', 'integer', Rule::exists('addresses', 'id')->where('user_id', $request->user()->id)],
            'payment_method' => ['required', 'string', Rule::in(config('fdb.orders.payment_methods'))],
            'expected_total' => ['required', 'decimal:0,2'],
            'note' => ['nullable', 'string', 'max:500'],
        ], [
            'address_id.*' => 'Choose a delivery address.',
            'payment_method.*' => 'Choose a payment method.',
        ]);

        [$order, $created] = $this->checkout->place(
            $request->user(),
            $request->user()->addresses()->findOrFail($data['address_id']),
            $data['payment_method'],
            strtolower($request->header('Idempotency-Key')),
            bcadd((string) $data['expected_total'], '0', 2),
            isset($data['note']) ? trim($data['note']) : null,
        );

        return (new OrderResource($order->load('sellerOrders.seller', 'sellerOrders.items')))
            ->response()
            ->setStatusCode($created ? 201 : 200);
    }
}
