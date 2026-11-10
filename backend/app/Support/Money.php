<?php

namespace App\Support;

// Exact peso arithmetic on decimal strings (bcmath). Never use floats for money.
final class Money
{
    public static function add(string ...$amounts): string
    {
        return array_reduce($amounts, fn (string $sum, string $amount) => bcadd($sum, $amount, 2), '0.00');
    }

    public static function times(string $amount, int $quantity): string
    {
        return bcmul($amount, (string) $quantity, 2);
    }

    // Rate is a fraction such as "0.0750". Rounds half up to the centavo (amounts are never negative here).
    public static function percentOf(string $amount, string $rate): string
    {
        return bcadd(bcmul($amount, $rate, 6), '0.005', 2);
    }

    public static function subtract(string $a, string $b): string
    {
        return bcsub($a, $b, 2);
    }

    public static function equals(string $a, string $b): bool
    {
        return bccomp($a, $b, 2) === 0;
    }
}
