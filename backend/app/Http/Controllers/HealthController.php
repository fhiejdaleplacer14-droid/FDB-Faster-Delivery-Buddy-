<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Redis;
use Throwable;

class HealthController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $checks = ['database' => $this->check('database', fn () => DB::select('select 1'))];

        // Hosts without Redis keep sessions, cache, and queue in the database.
        if ($this->usesRedis()) {
            $checks['redis'] = $this->check('redis', fn () => Redis::connection()->ping());
        }

        $healthy = ! in_array('fail', $checks, true);

        return response()->json(
            ['status' => $healthy ? 'ok' : 'degraded', 'checks' => $checks],
            $healthy ? 200 : 503,
        );
    }

    private function usesRedis(): bool
    {
        return in_array('redis', [config('cache.default'), config('session.driver'), config('queue.default')], true);
    }

    private function check(string $name, callable $probe): string
    {
        try {
            $probe();

            return 'ok';
        } catch (Throwable $e) {
            Log::warning('Health check failed', ['check' => $name, 'exception' => $e::class]);

            return 'fail';
        }
    }
}
