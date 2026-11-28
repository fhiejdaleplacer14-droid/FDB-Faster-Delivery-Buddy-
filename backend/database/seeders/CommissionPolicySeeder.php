<?php

namespace Database\Seeders;

use App\Models\CommissionPolicy;
use Illuminate\Database\Seeder;

// Seeds the default commission rate once; admins manage it after that.
class CommissionPolicySeeder extends Seeder
{
    public function run(): void
    {
        if (CommissionPolicy::query()->whereNull('seller_id')->exists()) {
            return;
        }

        $policy = new CommissionPolicy;
        $policy->forceFill([
            'seller_id' => null,
            'rate' => config('fdb.commission.initial_default_rate'),
            'effective_from' => now(),
            'notes' => 'Initial placeholder rate. Confirm with the founders before launch.',
        ])->save();
    }
}
