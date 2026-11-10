<?php

namespace App\Domain\Identity;

enum RoleSlug: string
{
    case Customer = 'customer';
    case Seller = 'seller';
    case Admin = 'admin';

    public function label(): string
    {
        return match ($this) {
            self::Customer => 'Customer',
            self::Seller => 'Seller',
            self::Admin => 'Administrator',
        };
    }

    /** @return list<PermissionSlug> */
    public function defaultPermissions(): array
    {
        return match ($this) {
            self::Admin => PermissionSlug::cases(),
            self::Customer, self::Seller => [],
        };
    }
}
