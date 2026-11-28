<?php

use Illuminate\Support\Facades\DB;

it('skips databases without the Supabase API roles', function () {
    DB::statement('DROP ROLE IF EXISTS anon');

    $this->artisan('fdb:enforce-rls')->expectsOutputToContain('skipped')->assertSuccessful();
    expect(DB::table('pg_tables')->where('schemaname', 'public')->where('rowsecurity', true)->exists())->toBeFalse();
});

it('turns on RLS for every table and removes API role grants', function () {
    // Role creation is transactional in PostgreSQL, so RefreshDatabase rolls it back.
    DB::statement('CREATE ROLE anon NOLOGIN');
    DB::statement('GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon');

    $this->artisan('fdb:enforce-rls --check')->assertFailed();
    $this->artisan('fdb:enforce-rls')->assertSuccessful();

    expect(DB::table('pg_tables')->where('schemaname', 'public')->where('rowsecurity', false)->pluck('tablename')->all())->toBe([])
        ->and(DB::selectOne("select has_table_privilege('anon', 'public.products', 'SELECT') as ok")->ok)->toBeFalse()
        ->and(DB::selectOne("select has_function_privilege('anon', 'public.audit_logs_block_changes()', 'EXECUTE') as ok")->ok)->toBeFalse();
    $this->artisan('fdb:enforce-rls --check')->assertSuccessful();
});

it('gives the app login row access only, with an append-only audit log', function () {
    DB::statement('CREATE ROLE anon NOLOGIN');
    DB::statement('CREATE ROLE fdb_app NOLOGIN BYPASSRLS');

    $this->artisan('fdb:enforce-rls')->assertSuccessful();

    $can = fn (string $check) => DB::selectOne("select {$check} as ok")->ok;
    expect($can("has_table_privilege('fdb_app', 'public.products', 'SELECT, INSERT, UPDATE, DELETE')"))->toBeTrue()
        ->and($can("has_table_privilege('fdb_app', 'public.audit_logs', 'INSERT')"))->toBeTrue()
        ->and($can("has_table_privilege('fdb_app', 'public.audit_logs', 'UPDATE')"))->toBeFalse()
        ->and($can("has_table_privilege('fdb_app', 'public.audit_logs', 'DELETE')"))->toBeFalse()
        ->and($can("has_table_privilege('fdb_app', 'public.products', 'TRUNCATE')"))->toBeFalse()
        ->and($can("has_schema_privilege('fdb_app', 'public', 'CREATE')"))->toBeFalse();
});
