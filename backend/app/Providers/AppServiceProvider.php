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
use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;
use RuntimeException;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    // Debug pages leak secrets, and session cookies must never travel over plain HTTP.
    private function hardenProduction(): void
    {
        if (config('app.debug')) {
            throw new RuntimeException('APP_DEBUG must be false in production.');
        }

        config(['session.secure' => true, 'session.http_only' => true]);
        URL::forceScheme('https');
    }

    public function boot(): void
    {
        $production = $this->app->isProduction();

        Model::shouldBeStrict(! $production);
        DB::prohibitDestructiveCommands($production);

        if ($production) {
            $this->hardenProduction();
        }

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
        RateLimiter::for('checkout', fn (Request $request) => Limit::perMinute(10)->by($request->user()?->id ?: $request->ip()));
        RateLimiter::for('uploads', fn (Request $request) => Limit::perHour(20)->by($request->user()?->id ?: $request->ip()));
        RateLimiter::for('support-tickets', fn (Request $request) => Limit::perHour(10)->by($request->user()?->id ?: $request->ip()));
        RateLimiter::for('messages', fn (Request $request) => Limit::perHour(60)->by($request->user()?->id ?: $request->ip()));
        RateLimiter::for('refunds', fn (Request $request) => Limit::perHour(30)->by($request->user()?->id ?: $request->ip()));
        RateLimiter::for('reviews', fn (Request $request) => Limit::perHour(30)->by($request->user()?->id ?: $request->ip()));
    }
}
