<?php

namespace Database\Factories;

use App\Domain\Identity\RoleSlug;
use App\Domain\Sellers\BusinessType;
use App\Domain\Sellers\SellerStatus;
use App\Domain\Sellers\ServiceArea;
use App\Models\Seller;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Seller>
 */
class SellerFactory extends Factory
{
    public function definition(): array
    {
        $name = fake()->unique()->company();

        return [
            'user_id' => User::factory()->customer(),
            'store_name' => Str::limit($name, 80, ''),
            'slug' => Str::slug($name).'-'.Str::lower(Str::random(4)),
            'description' => fake()->sentence(),
            'contact_phone' => '0917'.fake()->numerify('#######'),
            'municipality' => fake()->randomElement(ServiceArea::cases()),
            'barangay' => 'Poblacion',
            'address_line' => fake()->streetAddress(),
            'business_type' => BusinessType::Individual,
            'status' => SellerStatus::Pending,
            'submitted_at' => now(),
        ];
    }

    public function pending(): static
    {
        return $this->state(fn () => ['status' => SellerStatus::Pending]);
    }

    public function approved(): static
    {
        return $this->state(fn () => [
            'status' => SellerStatus::Approved,
            'approved_at' => now(),
            'reviewed_at' => now(),
        ])->afterCreating(fn (Seller $seller) => User::findOrFail($seller->user_id)->assignRole(RoleSlug::Seller));
    }

    public function rejected(): static
    {
        return $this->state(fn () => [
            'status' => SellerStatus::Rejected,
            'reviewed_at' => now(),
            'decision_reason' => 'Government ID was unreadable.',
        ]);
    }

    public function suspended(): static
    {
        return $this->approved()->state(fn () => [
            'status' => SellerStatus::Suspended,
            'suspended_at' => now(),
        ]);
    }
}
