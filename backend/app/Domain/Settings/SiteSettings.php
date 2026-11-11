<?php

namespace App\Domain\Settings;

use App\Domain\Audit\AuditLogger;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Cache;

// Switches admins can flip at runtime. Unknown keys are rejected; missing rows fall back to the config default.
class SiteSettings
{
    public const SELLER_DOCUMENTS_REQUIRED = 'sellers.documents_required';

    private const CACHE_KEY = 'site-settings';

    public function __construct(private readonly AuditLogger $audit) {}

    /** @return array<string, bool> */
    public function defaults(): array
    {
        return [
            self::SELLER_DOCUMENTS_REQUIRED => (bool) config('fdb.sellers.documents_required', true),
        ];
    }

    /** @return array<string, bool> */
    public function all(): array
    {
        return array_merge($this->defaults(), $this->stored());
    }

    public function sellerDocumentsRequired(): bool
    {
        return $this->all()[self::SELLER_DOCUMENTS_REQUIRED];
    }

    public function set(string $key, bool $value, User $actor): void
    {
        abort_unless(array_key_exists($key, $this->defaults()), 422, 'Unknown setting.');

        $before = $this->all()[$key];
        Setting::query()->updateOrCreate(['key' => $key], ['value' => $value, 'updated_by' => $actor->id]);
        Cache::forget(self::CACHE_KEY);

        if ($before !== $value) {
            $this->audit->record('settings.updated', $actor, null, ['key' => $key, 'from' => $before, 'to' => $value]);
        }
    }

    /** @return array<string, bool> */
    private function stored(): array
    {
        try {
            return Cache::rememberForever(self::CACHE_KEY, fn () => Setting::query()
                ->whereIn('key', array_keys($this->defaults()))
                ->pluck('value', 'key')
                ->map(fn ($v) => (bool) $v)
                ->all());
        } catch (QueryException) {
            // Table not migrated yet (code deployed before the migration ran): use the defaults.
            return [];
        }
    }
}
