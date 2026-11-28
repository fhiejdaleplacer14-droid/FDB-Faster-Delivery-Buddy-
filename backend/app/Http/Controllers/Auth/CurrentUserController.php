<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\UpdateProfileRequest;
use App\Http\Resources\UserResource;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\Rules\Password;

class CurrentUserController extends Controller
{
    public function show(Request $request): UserResource
    {
        return new UserResource($request->user()->load('seller'));
    }

    public function update(UpdateProfileRequest $request): UserResource
    {
        $user = $request->user();
        $user->fill($request->safe()->only(['name', 'email']));

        $emailChanged = $user->isDirty('email');
        if ($emailChanged) {
            $user->email_verified_at = null;
        }
        $user->save();

        if ($emailChanged) {
            $user->sendEmailVerificationNotification();
        }

        return new UserResource($user->load('seller'));
    }

    public function updatePassword(Request $request): Response
    {
        $validated = $request->validate([
            'current_password' => ['required', 'string', 'current_password:web'],
            'password' => ['required', 'string', 'confirmed', 'max:255', Password::defaults()],
        ]);

        // AuthenticateSession signs out other sessions once the password hash changes.
        $request->user()->update(['password' => $validated['password']]);

        return response()->noContent();
    }
}
