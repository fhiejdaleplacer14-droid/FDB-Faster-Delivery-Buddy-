<?php

namespace App\Policies;

use App\Domain\Identity\PermissionSlug;
use App\Models\Seller;
use App\Models\User;

class SellerPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermission(PermissionSlug::SellersReview);
    }

    public function view(User $user, Seller $seller): bool
    {
        return $seller->user_id === $user->id || $user->hasPermission(PermissionSlug::SellersReview);
    }

    public function resubmit(User $user, Seller $seller): bool
    {
        return $seller->user_id === $user->id;
    }

    public function review(User $user, Seller $seller): bool
    {
        return $user->hasPermission(PermissionSlug::SellersReview) && $seller->user_id !== $user->id;
    }

    public function manage(User $user, Seller $seller): bool
    {
        return $user->hasPermission(PermissionSlug::SellersManage) && $seller->user_id !== $user->id;
    }

    public function viewDocuments(User $user, Seller $seller): bool
    {
        return $user->hasPermission(PermissionSlug::SellerDocumentsView);
    }
}
