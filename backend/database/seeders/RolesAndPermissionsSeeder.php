<?php

namespace Database\Seeders;

use App\Domain\Identity\PermissionSlug;
use App\Domain\Identity\RoleSlug;
use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Seeder;

// Idempotent: safe to run on every deploy.
class RolesAndPermissionsSeeder extends Seeder
{
    public function run(): void
    {
        foreach (PermissionSlug::cases() as $permission) {
            Permission::updateOrCreate(['slug' => $permission->value], ['name' => $permission->label()]);
        }

        foreach (RoleSlug::cases() as $slug) {
            $role = Role::updateOrCreate(['slug' => $slug->value], ['name' => $slug->label()]);

            $ids = Permission::query()
                ->whereIn('slug', array_map(fn (PermissionSlug $p) => $p->value, $slug->defaultPermissions()))
                ->pluck('id');

            $role->permissions()->syncWithoutDetaching($ids);
        }
    }
}
