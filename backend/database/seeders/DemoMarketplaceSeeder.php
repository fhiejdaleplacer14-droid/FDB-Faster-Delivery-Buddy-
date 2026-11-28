<?php

namespace Database\Seeders;

use App\Domain\Catalog\ProductService;
use App\Domain\Catalog\ProductStatus;
use App\Domain\Identity\RoleSlug;
use App\Domain\Sellers\BusinessType;
use App\Domain\Sellers\SellerStatus;
use App\Models\Category;
use App\Models\Product;
use App\Models\Seller;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;

// Demo stores and listings (photos: demo-images/CREDITS.md). php artisan db:seed --class=DemoMarketplaceSeeder
class DemoMarketplaceSeeder extends Seeder
{
    private const CATEGORIES = [
        'Pasalubong & Snacks' => [],
        'Fresh Produce' => ['Fruits', 'Vegetables'],
        'Fish, Meat & Eggs' => [],
        'Bakery & Kakanin' => [],
        'Pantry' => ['Rice', 'Coffee & Cacao', 'Sugar & Honey'],
        'Home & School' => [],
    ];

    private const STORES = [
        'nenas' => ['Aling Nena\'s Pasalubong', 'guihulngan', 'Poblacion', 'Homemade snacks and pasalubong from Guihulngan.'],
        'tabuk' => ['Tabuk Farm Produce', 'vallehermoso', 'Tagbino', 'Fruit, vegetables, and eggs picked and packed the same day.'],
        'panaderya' => ['Panaderya sa Plaza', 'san_carlos_city', 'Barangay I', 'Fresh bread every morning, kakanin on weekends.'],
        'bayside' => ['Bayside Fresh Catch', 'san_carlos_city', 'Palampas', 'Fish landed at San Carlos port, cleaned on request.'],
        'kape' => ['Kape ug Tablea Negros', 'guihulngan', 'Linantuyan', 'Mountain coffee, tablea, muscovado, and wild honey.'],
        'jun' => ['Tindahan ni Jun', 'vallehermoso', 'Poblacion', 'Everyday goods for home and school.'],
    ];

    // [store, category, name, description, image, [[option, price, stock], ...]]
    private const PRODUCTS = [
        ['nenas', 'Pasalubong & Snacks', 'Dried Mangoes', 'Sweet, chewy dried mango slices. No preservatives.', 'dried-mangoes', [['100 g', '85.00', 40], ['250 g', '199.00', 25]]],
        ['nenas', 'Pasalubong & Snacks', 'Banana Chips', 'Crispy saba banana chips, lightly sweetened.', 'banana-chips', [['150 g', '55.00', 60]]],
        ['nenas', 'Pasalubong & Snacks', 'Roasted Peanuts', 'Garlic-roasted peanuts with skin. Good with merienda.', 'roasted-peanuts', [['200 g', '60.00', 50], ['500 g', '140.00', 20]]],
        ['tabuk', 'Fruits', 'Calamansi', 'Fresh calamansi for juice, sawsawan, and cooking.', 'calamansi', [['1/2 kg', '45.00', 30], ['1 kg', '85.00', 20]]],
        ['tabuk', 'Fruits', 'Saba Bananas', 'Saba bananas for turon, maruya, or boiling.', 'saba-banana', [['1 kg', '50.00', 35]]],
        ['tabuk', 'Fruits', 'Carabao Mangoes', 'Ripe carabao mangoes. Ask us about unripe ones for ensalada.', 'carabao-mango', [['1 kg', '140.00', 25]]],
        ['tabuk', 'Fruits', 'Buko (Young Coconut)', 'Young coconut, opened on request. Juice and soft meat.', 'young-coconut', [['Per piece', '35.00', 40]]],
        ['tabuk', 'Vegetables', 'Talong (Eggplant)', 'Fresh eggplant for tortang talong, pinakbet, or ensalada.', 'eggplant', [['1/2 kg', '40.00', 30]]],
        ['tabuk', 'Vegetables', 'Tomatoes', 'Red tomatoes for sawsawan and sinigang.', 'tomatoes', [['1/2 kg', '35.00', 40]]],
        ['tabuk', 'Fish, Meat & Eggs', 'Native Eggs', 'Brown eggs from free-range hens.', 'eggs', [['Half dozen', '60.00', 30], ['1 tray (30 pcs)', '280.00', 10]]],
        ['panaderya', 'Bakery & Kakanin', 'Pandesal', 'Soft pandesal baked at 5 AM. Order by 8 PM for next-day delivery.', 'pandesal', [['10 pcs', '40.00', 80], ['25 pcs', '95.00', 40]]],
        ['panaderya', 'Bakery & Kakanin', 'Ensaymada', 'Buttery ensaymada topped with sugar and cheese.', 'ensaymada', [['Per piece', '35.00', 30], ['Box of 6', '195.00', 10]]],
        ['panaderya', 'Bakery & Kakanin', 'Suman', 'Suman wrapped in banana leaves. Glutinous rice and cassava.', 'suman', [['Bundle of 5', '75.00', 20]]],
        ['bayside', 'Fish, Meat & Eggs', 'Bangus (Milkfish)', 'Fresh bangus. We can clean and debone it for you.', 'milkfish', [['1 kg', '220.00', 15], ['1 kg, deboned', '280.00', 8]]],
        ['bayside', 'Fish, Meat & Eggs', 'Tuyo (Dried Fish)', 'Sun-dried tuyo, salted just right. Perfect with garlic rice.', 'dried-fish', [['250 g', '90.00', 25]]],
        ['bayside', 'Fish, Meat & Eggs', 'Longganisa', 'Homemade sweet-garlic longganisa.', 'longganisa', [['1/2 kg', '160.00', 20]]],
        ['kape', 'Coffee & Cacao', 'Roasted Coffee Beans', 'Medium-roast coffee from the mountains of Guihulngan. Whole beans.', 'coffee-beans', [['250 g', '220.00', 20], ['500 g', '420.00', 10]]],
        ['kape', 'Coffee & Cacao', 'Tablea', 'Pure cacao tablea for sikwate and champorado.', 'tablea', [['10 tablets', '120.00', 30]]],
        ['kape', 'Sugar & Honey', 'Muscovado Sugar', 'Unrefined Negros muscovado.', 'muscovado-sugar', [['1/2 kg', '75.00', 40], ['1 kg', '140.00', 25]]],
        ['kape', 'Sugar & Honey', 'Wild Honey', 'Raw wild honey from local beekeepers.', 'wild-honey', [['350 ml jar', '350.00', 12]]],
        ['jun', 'Rice', 'Well-Milled Rice', 'Locally milled rice. Delivered in sealed bags.', 'rice', [['5 kg', '275.00', 20], ['25 kg', '1350.00', 6]]],
        ['jun', 'Home & School', 'Spiral Notebooks', 'College-ruled spiral notebooks, 80 leaves.', 'notebooks', [['Per piece', '38.00', 100], ['Pack of 5', '180.00', 20]]],
        ['jun', 'Home & School', 'Rubber Slippers', 'Everyday rubber slippers. Tell us your size in the order note.', 'slippers', [['Adult', '120.00', 30], ['Kids', '90.00', 20]]],
        ['jun', 'Home & School', 'Banig (Woven Mat)', 'Hand-woven pandan banig, about 4 x 6 ft.', 'banig', [['Single', '650.00', 5]]],
    ];

    public function run(ProductService $products): void
    {
        if (app()->isProduction()) {
            throw new RuntimeException('Demo data must never be seeded into production.');
        }

        $credits = json_decode((string) file_get_contents(__DIR__.'/demo-images/credits.json'), true, flags: JSON_THROW_ON_ERROR);
        $categories = $this->categories();
        $sellers = $this->sellers();

        foreach (self::PRODUCTS as [$store, $category, $name, $description, $image, $options]) {
            $seller = $sellers[$store];
            if ($seller->products()->where('name', $name)->exists()) {
                continue;
            }

            $credit = $credits[$image];
            $product = $products->create($seller, [
                'category_id' => $categories[$category]->id,
                'name' => $name,
                // CC BY and BY-SA require visible attribution wherever the photo is shown.
                'description' => $description."\n\nPhoto: {$credit['author']}, {$credit['license']}, via Wikimedia Commons.",
            ], array_map(fn (array $o) => ['name' => $o[0], 'price' => $o[1], 'stock' => $o[2]], $options));

            $path = __DIR__."/demo-images/{$image}.jpg";
            $products->addImage($product, new UploadedFile($path, "{$image}.jpg", 'image/jpeg', null, true));

            Product::query()->whereKey($product->id)->update([
                'status' => ProductStatus::Published,
                'submitted_at' => now(),
                'published_at' => now(),
            ]);
        }

        $this->command?->info('Demo marketplace ready: '.count(self::STORES).' stores, '.count(self::PRODUCTS).' listings.');
    }

    /** @return array<string, Category> */
    private function categories(): array
    {
        $byName = [];
        $position = 0;

        foreach (self::CATEGORIES as $parentName => $children) {
            $parent = Category::query()->firstOrCreate(['slug' => Str::slug($parentName)], ['name' => $parentName, 'position' => $position++]);
            $byName[$parentName] = $parent;

            foreach ($children as $i => $childName) {
                $byName[$childName] = Category::query()->firstOrCreate(
                    ['slug' => Str::slug($childName)],
                    ['name' => $childName, 'parent_id' => $parent->id, 'position' => $i],
                );
            }
        }

        return $byName;
    }

    /** @return array<string, Seller> */
    private function sellers(): array
    {
        $sellers = [];

        foreach (self::STORES as $key => [$name, $municipality, $barangay, $description]) {
            $sellers[$key] = DB::transaction(function () use ($key, $name, $municipality, $barangay, $description) {
                $user = User::query()->firstOrCreate(
                    ['email' => "demo-{$key}@fdb.test"],
                    // Set DEMO_SELLER_PASSWORD to sign in as a demo seller; otherwise the password is random.
                    ['name' => $name, 'password' => env('DEMO_SELLER_PASSWORD') ?: Str::password(32)],
                );
                $user->forceFill(['email_verified_at' => $user->email_verified_at ?? now()])->save();
                $user->assignRole(RoleSlug::Customer);
                $user->assignRole(RoleSlug::Seller);

                $seller = Seller::query()->where('user_id', $user->id)->first() ?? new Seller;
                if (! $seller->exists) {
                    $seller->fill([
                        'store_name' => $name,
                        'description' => $description,
                        'contact_phone' => '0917'.str_pad((string) (crc32($key) % 10_000_000), 7, '0', STR_PAD_LEFT),
                        'municipality' => $municipality,
                        'barangay' => $barangay,
                        'address_line' => 'Demo address, not a real store',
                        'business_type' => BusinessType::Individual,
                    ]);
                    $seller->user_id = $user->id;
                    $seller->slug = Str::slug($name);
                    $seller->status = SellerStatus::Approved;
                    $seller->submitted_at = now();
                    $seller->approved_at = now();
                    $seller->reviewed_at = now();
                    $seller->save();
                }

                return $seller;
            });
        }

        return $sellers;
    }
}
