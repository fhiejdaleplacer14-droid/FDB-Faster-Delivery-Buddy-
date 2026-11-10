<?php

namespace App\Models;

use App\Domain\Identity\PermissionSlug;
use App\Domain\Identity\RoleSlug;
use App\Domain\Identity\UserStatus;
use App\Notifications\ResetPasswordNotification;
use App\Notifications\VerifyEmailNotification;
use Database\Factories\UserFactory;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

#[Fillable(['name', 'email', 'password'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable implements MustVerifyEmail
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    protected $attributes = [
        'status' => 'active',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'suspended_at' => 'datetime',
            'password' => 'hashed',
            'status' => UserStatus::class,
        ];
    }

    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(Role::class)->withPivot('created_at');
    }

    public function seller(): HasOne
    {
        return $this->hasOne(Seller::class);
    }

    public function isActive(): bool
    {
        return $this->status === UserStatus::Active;
    }

    public function hasRole(RoleSlug $role): bool
    {
        return $this->roleSlugs()->contains($role->value);
    }

    public function hasPermission(PermissionSlug $permission): bool
    {
        return $this->permissionSlugs()->contains($permission->value);
    }

    public function assignRole(RoleSlug $role): void
    {
        $this->roles()->syncWithoutDetaching([Role::idFor($role)]);
        $this->unsetRelation('roles');
    }

    public function removeRole(RoleSlug $role): void
    {
        $this->roles()->detach(Role::idFor($role));
        $this->unsetRelation('roles');
    }

    /** @return \Illuminate\Support\Collection<int, string> */
    public function roleSlugs()
    {
        return $this->loadMissing('roles.permissions')->roles->pluck('slug');
    }

    /** @return \Illuminate\Support\Collection<int, string> */
    public function permissionSlugs()
    {
        return $this->loadMissing('roles.permissions')->roles
            ->flatMap(fn (Role $role) => $role->permissions->pluck('slug'))
            ->unique()
            ->values();
    }

    public function sendEmailVerificationNotification(): void
    {
        $this->notify(new VerifyEmailNotification);
    }

    public function sendPasswordResetNotification(#[\SensitiveParameter] $token): void
    {
        $this->notify(new ResetPasswordNotification($token));
    }
}
