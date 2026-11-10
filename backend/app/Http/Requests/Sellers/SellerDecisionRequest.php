<?php

namespace App\Http\Requests\Sellers;

use Illuminate\Foundation\Http\FormRequest;

class SellerDecisionRequest extends FormRequest
{
    public function rules(): array
    {
        $needsReason = in_array($this->route()->getName(), ['admin.sellers.reject', 'admin.sellers.suspend'], true);

        return [
            'reason' => [$needsReason ? 'required' : 'nullable', 'string', 'min:5', 'max:1000'],
        ];
    }

    public function reason(): ?string
    {
        $reason = $this->validated('reason');

        return $reason === null ? null : trim($reason);
    }
}
