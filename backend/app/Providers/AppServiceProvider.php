<?php

namespace App\Providers;

use App\Domain\Identity\PermissionSlug;
use App\Models\User;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Support\Facades\Gate;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        $production = $this->app->isProduction();

        Model::shouldBeStrict(! $production);
        DB::prohibitDestructiveCommands($production);

        Password::defaults(fn () => $production
            ? Password::min(10)->letters()->numbers()->uncompromised()
            : Password::min(10)->letters()->numbers());

        Gate::define('permission', fn (User $user, PermissionSlug $permission) => $user->hasPermission($permission));

        RateLimiter::for('api', fn (Request $request) => Limit::perMinute(120)
            ->by($request->user()?->id ?: $request->ip()));
        RateLimiter::for('register', fn (Request $request) => Limit::perHour(10)->by($request->ip()));
        RateLimiter::for('password-reset', fn (Request $request) => [
            Limit::perMinute(5)->by($request->ip()),
            Limit::perHour(10)->by('email:'.mb_strtolower((string) $request->input('email'))),
        ]);
        RateLimiter::for('product-images', fn (Request $request) => Limit::perHour(120)->by($request->user()?->id ?: $request->ip()));
        RateLimiter::for('uploads', fn (Request $request) => Limit::perHour(20)->by($request->user()?->id ?: $request->ip()));
    }
}
