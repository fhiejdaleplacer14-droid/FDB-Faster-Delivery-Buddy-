<?php

namespace App\Domain\Identity;

enum PermissionSlug: string
{
    case SellersReview = 'sellers.review';
    case SellersManage = 'sellers.manage';
    case SellerDocumentsView = 'sellers.documents.view';
    case AuditLogsView = 'audit_logs.view';
    case ProductsModerate = 'products.moderate';
    case CategoriesManage = 'categories.manage';

    public function label(): string
    {
        return match ($this) {
            self::SellersReview => 'Review seller applications',
            self::SellersManage => 'Suspend and reactivate sellers',
            self::SellerDocumentsView => 'View seller verification documents',
            self::AuditLogsView => 'View audit logs',
            self::ProductsModerate => 'Approve and remove product listings',
            self::CategoriesManage => 'Manage product categories',
        };
    }
}
