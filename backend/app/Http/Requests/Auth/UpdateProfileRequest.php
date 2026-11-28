<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateProfileRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:100'],
            'email' => [
                'required', 'string', 'lowercase', 'email:rfc,strict', 'max:255',
                Rule::unique('users', 'email')->ignore($this->user()->id),
            ],
            // A borrowed signed-in device must not be able to move the account to another email.
            'current_password' => [Rule::requiredIf($this->emailChanged()), 'nullable', 'string', 'current_password:web'],
        ];
    }

    public function messages(): array
    {
        return [
            'current_password.required' => 'Enter your current password to change your email.',
            'current_password.current_password' => 'That password is incorrect.',
        ];
    }

    private function emailChanged(): bool
    {
        return $this->input('email') !== $this->user()->email;
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'name' => trim((string) $this->input('name')),
            'email' => mb_strtolower(trim((string) $this->input('email'))),
        ]);
    }
}
