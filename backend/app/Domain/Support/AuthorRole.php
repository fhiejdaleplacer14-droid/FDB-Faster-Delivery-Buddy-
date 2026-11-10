<?php

namespace App\Domain\Support;

enum AuthorRole: string
{
    case Customer = 'customer';
    case Seller = 'seller';
    case Staff = 'staff';
}
