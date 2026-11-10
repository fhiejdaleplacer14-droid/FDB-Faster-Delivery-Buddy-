<?php

use App\Domain\Identity\RoleSlug;
use App\Models\AuditLog;
use App\Models\User;

afterEach(fn () => putenv('FDB_ADMIN_PASSWORD'));

it('creates a verified administrator from prompts', function () {
    $this->artisan('fdb:create-admin')
        ->expectsQuestion('Full name', 'Ana Reyes')
        ->expectsQuestion('Email', 'Ana@FDB.test')
        ->expectsQuestion('Password (min. 10 characters, letters and numbers)', 'secure2026pass')
        ->expectsQuestion('Confirm password', 'secure2026pass')
        ->expectsOutputToContain('Administrator ana@fdb.test created.')
        ->assertSuccessful();

    $admin = User::where('email', 'ana@fdb.test')->sole();
    expect($admin->hasRole(RoleSlug::Admin))->toBeTrue()
        ->and($admin->hasRole(RoleSlug::Customer))->toBeFalse()
        ->and($admin->hasVerifiedEmail())->toBeTrue()
        ->and(AuditLog::where('action', 'admin.created')->where('subject_id', $admin->id)->exists())->toBeTrue();
});

it('accepts options and a password from the environment for automated setup', function () {
    putenv('FDB_ADMIN_PASSWORD=secure2026pass');

    $this->artisan('fdb:create-admin', ['--name' => 'Ana Reyes', '--email' => 'ana@fdb.test'])->assertSuccessful();

    expect(User::where('email', 'ana@fdb.test')->sole()->hasRole(RoleSlug::Admin))->toBeTrue();
});

it('refuses weak passwords and duplicate emails', function () {
    User::factory()->create(['email' => 'taken@fdb.test']);
    putenv('FDB_ADMIN_PASSWORD=short');

    $this->artisan('fdb:create-admin', ['--name' => 'X', '--email' => 'taken@fdb.test'])->assertFailed();

    expect(User::count())->toBe(1);
});
