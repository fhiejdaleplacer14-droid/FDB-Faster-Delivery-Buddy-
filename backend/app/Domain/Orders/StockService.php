<?php

namespace App\Domain\Orders;

use Illuminate\Support\Facades\DB;
use RuntimeException;

class StockService
{
    /** @param list<array{variant_id: int, quantity: int}> $lines */
    public function take(array $lines): void
    {
        foreach ($lines as $line) {
            // Conditional update: never goes below zero even if a caller forgot to lock.
            $updated = DB::table('product_variants')
                ->where('id', $line['variant_id'])
                ->where('stock', '>=', $line['quantity'])
                ->update(['stock' => DB::raw('stock - '.(int) $line['quantity']), 'updated_at' => now()]);

            if ($updated !== 1) {
                throw CheckoutProblem::cartChanged();
            }
        }
    }

    /** @param list<array{variant_id: int, quantity: int}> $lines */
    public function giveBack(array $lines): void
    {
        foreach ($lines as $line) {
            // Includes removed options: the units still physically exist with the seller.
            $updated = DB::table('product_variants')
                ->where('id', $line['variant_id'])
                ->update(['stock' => DB::raw('stock + '.(int) $line['quantity']), 'updated_at' => now()]);

            if ($updated !== 1) {
                throw new RuntimeException("Variant {$line['variant_id']} is missing; stock was not returned.");
            }
        }
    }

    /** @param list<int> $productIds */
    public function refreshProducts(array $productIds): void
    {
        if ($productIds === []) {
            return;
        }

        DB::table('products')->whereIn('id', $productIds)->update([
            'stock_total' => DB::raw('(SELECT COALESCE(SUM(v.stock), 0) FROM product_variants v WHERE v.product_id = products.id AND v.deleted_at IS NULL)'),
        ]);
    }
}
