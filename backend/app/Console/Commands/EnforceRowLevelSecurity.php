<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

// Supabase exposes the public schema through its Data API (roles anon and authenticated).
// FDB never uses that API, so every table gets RLS with no policies and those roles lose all grants.
// The app connects as the table owner, which bypasses RLS, so Laravel keeps working.
class EnforceRowLevelSecurity extends Command
{
    protected $signature = 'fdb:enforce-rls {--check : Report tables without RLS and change nothing}';

    protected $description = 'Turn on row level security for every table (Supabase)';

    private const API_ROLES = ['anon', 'authenticated'];

    public function handle(): int
    {
        if (DB::connection()->getDriverName() !== 'pgsql') {
            $this->info('Not PostgreSQL; nothing to do.');

            return self::SUCCESS;
        }

        $apiRoles = DB::table('pg_roles')->whereIn('rolname', self::API_ROLES)->pluck('rolname')->all();
        if ($apiRoles === []) {
            $this->info('No Supabase API roles on this database; skipped.');

            return self::SUCCESS;
        }

        $tables = DB::table('pg_tables')->where('schemaname', 'public')->orderBy('tablename')->get(['tablename', 'tableowner', 'rowsecurity']);
        $missing = $tables->where('rowsecurity', false)->pluck('tablename');

        if ($this->option('check')) {
            $missing->each(fn ($t) => $this->warn("No RLS: {$t}"));

            return $missing->isEmpty() ? self::SUCCESS : self::FAILURE;
        }

        // With RLS and no policies, a role that neither owns a table nor bypasses RLS would see nothing.
        $me = DB::selectOne('select current_user as name, (select rolbypassrls from pg_roles where rolname = current_user) as bypass');
        $notOwned = $tables->where('tableowner', '!=', $me->name)->pluck('tablename');
        if (! $me->bypass && $notOwned->isNotEmpty()) {
            $this->error("{$me->name} does not own: {$notOwned->implode(', ')}. Enabling RLS would lock the app out; nothing changed.");

            return self::FAILURE;
        }

        DB::transaction(function () use ($missing, $apiRoles) {
            foreach ($missing as $table) {
                DB::statement('ALTER TABLE public.'.$this->quote($table).' ENABLE ROW LEVEL SECURITY');
            }

            $roles = implode(', ', array_map(fn ($r) => $this->quote($r), $apiRoles));
            foreach (['TABLES', 'SEQUENCES', 'FUNCTIONS'] as $kind) {
                DB::statement("REVOKE ALL ON ALL {$kind} IN SCHEMA public FROM {$roles}");
                DB::statement("ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON {$kind} FROM {$roles}");
            }

            // Functions are executable by PUBLIC by default, which includes the API roles.
            DB::statement('REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC');
            DB::statement('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC');
        });

        $this->info("RLS on for {$tables->count()} tables ({$missing->count()} newly). API roles have no access.");

        return self::SUCCESS;
    }

    private function quote(string $identifier): string
    {
        return '"'.str_replace('"', '""', $identifier).'"';
    }
}
