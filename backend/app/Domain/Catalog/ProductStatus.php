<?php

namespace App\Domain\Catalog;

enum ProductStatus: string
{
    case Draft = 'draft';
    case PendingReview = 'pending_review';
    case Published = 'published';
    case Rejected = 'rejected';
    case Archived = 'archived';

    public function canTransitionTo(self $next): bool
    {
        return in_array($next, match ($this) {
            self::Draft => [self::PendingReview, self::Published, self::Archived],
            self::PendingReview => [self::Published, self::Rejected, self::Draft],
            self::Published => [self::PendingReview, self::Rejected, self::Archived],
            self::Rejected => [self::PendingReview, self::Published, self::Archived],
            self::Archived => [self::Draft],
        }, true);
    }
}
