<?php

namespace App\Domain\Catalog;

enum ReviewStatus: string
{
    case Published = 'published';
    case Hidden = 'hidden';
}
