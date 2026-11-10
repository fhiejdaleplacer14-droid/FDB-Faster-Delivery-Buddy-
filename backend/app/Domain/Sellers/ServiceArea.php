<?php

namespace App\Domain\Sellers;

enum ServiceArea: string
{
    case Vallehermoso = 'vallehermoso';
    case Guihulngan = 'guihulngan';
    case SanCarlosCity = 'san_carlos_city';

    public function label(): string
    {
        return match ($this) {
            self::Vallehermoso => 'Vallehermoso',
            self::Guihulngan => 'Guihulngan',
            self::SanCarlosCity => 'San Carlos City',
        };
    }
}
