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
    case OrdersView = 'orders.view';
    case CommissionsManage = 'commissions.manage';
    case ReportsView = 'reports.view';
    case ReviewsModerate = 'reviews.moderate';
    case SupportManage = 'support.manage';

    public function label(): string
    {
        return match ($this) {
            self::SellersReview => 'Review seller applications',
            self::SellersManage => 'Suspend and reactivate sellers',
            self::SellerDocumentsView => 'View seller verification documents',
            self::AuditLogsView => 'View audit logs',
            self::ProductsModerate => 'Approve and remove product listings',
            self::CategoriesManage => 'Manage product categories',
            self::OrdersView => 'View all orders',
            self::CommissionsManage => 'Set commission rates and record collections',
            self::ReportsView => 'View financial reports',
            self::ReviewsModerate => 'Hide and restore product reviews',
            self::SupportManage => 'Answer support tickets and settle disputes',
        };
    }
}
