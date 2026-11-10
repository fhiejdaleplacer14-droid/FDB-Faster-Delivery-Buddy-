<?php

namespace App\Domain\Sellers;

enum BusinessType: string
{
    case Individual = 'individual';
    case RegisteredBusiness = 'registered_business';
}
