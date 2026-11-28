<?php

namespace App\Http\Requests\Auth;

use Illuminate\Auth\Events\Lockout;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\ValidationException;

class LoginRequest extends FormRequest
{
    private const MAX_ATTEMPTS = 5;

    // Caps guessing on one account even when the attacker rotates IPs.
    private const MAX_ATTEMPTS_PER_ACCOUNT = 20;

    private const ACCOUNT_DECAY_SECONDS = 900;

    public function rules(): array
    {
        return [
            'email' => ['required', 'string', 'email', 'max:255'],
            'password' => ['required', 'string', 'max:255'],
            'remember' => ['sometimes', 'boolean'],
        ];
    }

    protected function prepareForValidation(): void
    {
        $this->merge(['email' => mb_strtolower(trim((string) $this->input('email')))]);
    }

    public function authenticate(): void
    {
        $key = $this->throttleKey();
        $accountKey = 'login-account:'.sha1((string) $this->input('email'));

        foreach ([[$key, self::MAX_ATTEMPTS], [$accountKey, self::MAX_ATTEMPTS_PER_ACCOUNT]] as [$k, $max]) {
            if (RateLimiter::tooManyAttempts($k, $max)) {
                event(new Lockout($this));

                throw ValidationException::withMessages([
                    'email' => 'Too many sign-in attempts. Try again in '.RateLimiter::availableIn($k).' seconds.',
                ])->status(429);
            }
        }

        if (! Auth::guard('web')->attempt($this->only('email', 'password'), $this->boolean('remember'))) {
            RateLimiter::hit($key, 60);
            RateLimiter::hit($accountKey, self::ACCOUNT_DECAY_SECONDS);

            throw ValidationException::withMessages([
                'email' => 'The email or password is incorrect.',
            ]);
        }

        RateLimiter::clear($key);
        RateLimiter::clear($accountKey);
    }

    private function throttleKey(): string
    {
        return 'login:'.sha1($this->input('email').'|'.$this->ip());
    }
}
