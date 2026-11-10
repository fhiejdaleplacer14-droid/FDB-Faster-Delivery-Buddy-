<?php

namespace App\Http\Controllers;

use App\Domain\Sellers\ServiceArea;
use App\Http\Resources\AddressResource;
use App\Models\Address;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class AddressController extends Controller
{
    private const MAX_ADDRESSES = 10;

    public function index(Request $request): AnonymousResourceCollection
    {
        return AddressResource::collection($request->user()->addresses()->get());
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);

        if ($request->user()->addresses()->count() >= self::MAX_ADDRESSES) {
            return response()->json(['message' => 'You can save up to '.self::MAX_ADDRESSES.' addresses. Remove one first.'], 422);
        }

        $address = DB::transaction(function () use ($request, $data) {
            $user = $request->user();
            $address = $user->addresses()->make(collect($data)->except('is_default')->all());
            $address->is_default = false;
            $address->save();

            if (($data['is_default'] ?? false) || ! $user->addresses()->where('is_default', true)->exists()) {
                $this->makeDefault($address);
            }

            return $address->refresh();
        });

        return (new AddressResource($address))->response()->setStatusCode(201);
    }

    public function update(Request $request, int $addressId): AddressResource
    {
        $address = $request->user()->addresses()->findOrFail($addressId);
        $data = $this->validated($request);

        DB::transaction(function () use ($address, $data) {
            $address->update(collect($data)->except('is_default')->all());
            if ($data['is_default'] ?? false) {
                $this->makeDefault($address);
            }
        });

        return new AddressResource($address->refresh());
    }

    public function destroy(Request $request, int $addressId): Response
    {
        $address = $request->user()->addresses()->findOrFail($addressId);

        DB::transaction(function () use ($request, $address) {
            $address->delete();
            if ($address->is_default && $next = $request->user()->addresses()->first()) {
                $this->makeDefault($next);
            }
        });

        return response()->noContent();
    }

    private function makeDefault(Address $address): void
    {
        Address::query()->where('user_id', $address->user_id)->whereKeyNot($address->id)->update(['is_default' => false]);
        Address::query()->whereKey($address->id)->update(['is_default' => true]);
    }

    /** @return array<string, mixed> */
    private function validated(Request $request): array
    {
        return $request->validate([
            'label' => ['nullable', 'string', 'max:40'],
            'recipient_name' => ['required', 'string', 'max:100'],
            'phone' => ['required', 'string', 'regex:/^(09|\+639)\d{9}$/'],
            'municipality' => ['required', Rule::enum(ServiceArea::class)],
            'barangay' => ['required', 'string', 'max:100'],
            'street' => ['required', 'string', 'max:255'],
            'landmark' => ['nullable', 'string', 'max:255'],
            'is_default' => ['nullable', 'boolean'],
        ], ['phone.regex' => 'Enter a Philippine mobile number such as 09171234567.']);
    }
}
