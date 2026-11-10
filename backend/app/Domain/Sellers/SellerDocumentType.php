<?php

namespace App\Domain\Sellers;

enum SellerDocumentType: string
{
    case GovernmentId = 'government_id';
    case BusinessPermit = 'business_permit';
    case DtiRegistration = 'dti_registration';
    case SecRegistration = 'sec_registration';
    case BirRegistration = 'bir_registration';
    case Other = 'other';

    public function label(): string
    {
        return match ($this) {
            self::GovernmentId => 'Government-issued ID',
            self::BusinessPermit => "Mayor's or business permit",
            self::DtiRegistration => 'DTI business name registration',
            self::SecRegistration => 'SEC registration',
            self::BirRegistration => 'BIR certificate of registration',
            self::Other => 'Other supporting document',
        };
    }
}
