<?php

namespace App\Domain\Catalog;

use App\Domain\Audit\AuditLogger;
use App\Models\Category;
use App\Models\Product;
use App\Models\ProductImage;
use App\Models\ProductVariant;
use App\Models\Seller;
use App\Models\User;
use App\Notifications\ProductModerated;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

class ProductService
{
    // Edits to these fields on a published listing need another review.
    private const REVIEWED_FIELDS = ['name', 'description', 'category_id'];

    public function __construct(
        private readonly ImageProcessor $images,
        private readonly AuditLogger $audit,
    ) {}

    /**
     * @param  array{category_id: int, name: string, description: string}  $details
     * @param  list<array{id?: int|null, name: string, sku?: string|null, price: string, stock: int}>  $variants
     */
    public function create(Seller $seller, array $details, array $variants): Product
    {
        return DB::transaction(function () use ($seller, $details, $variants) {
            $product = new Product($details);
            $product->seller_id = $seller->id;
            $product->slug = $this->uniqueSlug($details['name']);
            $product->status = ProductStatus::Draft;
            $product->price_from = $variants[0]['price'];
            $product->save();

            $this->syncVariants($product, $variants);

            return $product;
        });
    }

    /**
     * @param  array{category_id: int, name: string, description: string}  $details
     * @param  list<array{id?: int|null, name: string, sku?: string|null, price: string, stock: int}>  $variants
     */
    public function update(Product $product, array $details, array $variants): Product
    {
        return DB::transaction(function () use ($product, $details, $variants) {
            $product = Product::query()->lockForUpdate()->findOrFail($product->id);
            $this->ensureEditable($product);

            $product->fill($details);
            $needsReview = $product->isDirty(self::REVIEWED_FIELDS);
            if ($product->isDirty('name')) {
                $product->slug = $this->uniqueSlug($details['name'], $product->id);
            }
            $product->save();

            $this->syncVariants($product, $variants);

            if ($needsReview) {
                $this->sendBackForReview($product);
            }

            return $product;
        });
    }

    // Seller asks for the listing to go live. Without required review it publishes immediately.
    public function submit(Product $product): Product
    {
        return DB::transaction(function () use ($product) {
            $product = Product::query()->lockForUpdate()->findOrFail($product->id);

            if (! in_array($product->status, [ProductStatus::Draft, ProductStatus::Rejected], true)) {
                throw InvalidProductTransition::between($product->status, ProductStatus::PendingReview);
            }
            if (! $product->images()->exists()) {
                throw ValidationException::withMessages(['images' => 'Add at least one photo before submitting.']);
            }
            if (! Category::query()->whereKey($product->category_id)->where('is_active', true)->exists()) {
                throw ValidationException::withMessages(['category_id' => 'Choose a category that is still open for listings.']);
            }

            $product->submitted_at = now();
            $product->moderation_reason = null;

            if (config('fdb.catalog.requires_review')) {
                $product->status = ProductStatus::PendingReview;
            } else {
                $product->status = ProductStatus::Published;
                $product->published_at ??= now();
            }
            $product->save();

            return $product;
        });
    }

    public function archive(Product $product): Product
    {
        return $this->sellerTransition($product, ProductStatus::Archived);
    }

    public function restore(Product $product): Product
    {
        return $this->sellerTransition($product, ProductStatus::Draft);
    }

    public function approve(Product $product, User $moderator): Product
    {
        return $this->moderate($product, ProductStatus::PendingReview, ProductStatus::Published, $moderator, null);
    }

    public function reject(Product $product, User $moderator, string $reason): Product
    {
        // Pending or published listings can be rejected; moderate() re-checks this under the row lock.
        $from = Product::query()->findOrFail($product->id)->status;

        return $this->moderate($product, $from, ProductStatus::Rejected, $moderator, $reason);
    }

    public function addImage(Product $product, UploadedFile $file): ProductImage
    {
        $processed = $this->images->toWebp($file);
        $disk = config('fdb.catalog.media_disk');
        $path = 'products/'.now()->format('Y/m').'/'.Str::uuid7().'.webp';

        // Public access comes from the disk itself (a public bucket, or a public local disk), not per-file ACLs.
        Storage::disk($disk)->put($path, $processed['binary']);

        try {
            return DB::transaction(function () use ($product, $disk, $path, $processed) {
                $product = Product::query()->lockForUpdate()->findOrFail($product->id);
                $this->ensureEditable($product);

                if ($product->images()->count() >= config('fdb.catalog.max_images')) {
                    throw ValidationException::withMessages(['image' => 'A listing can have up to '.config('fdb.catalog.max_images').' photos.']);
                }

                $image = $product->images()->create([
                    'disk' => $disk,
                    'path' => $path,
                    'width' => $processed['width'],
                    'height' => $processed['height'],
                    'size_bytes' => strlen($processed['binary']),
                    'position' => (int) $product->images()->max('position') + 1,
                ]);

                $this->sendBackForReview($product);

                return $image;
            });
        } catch (Throwable $e) {
            Storage::disk($disk)->delete($path);

            throw $e;
        }
    }

    public function deleteImage(Product $product, ProductImage $image): void
    {
        DB::transaction(function () use ($product, $image) {
            $product = Product::query()->lockForUpdate()->findOrFail($product->id);
            $this->ensureEditable($product);

            if ($product->status === ProductStatus::Published && $product->images()->count() <= 1) {
                throw ValidationException::withMessages(['image' => 'A published listing needs at least one photo.']);
            }

            $image->delete();
        });

        Storage::disk($image->disk)->delete($image->path);
    }

    /** @param list<int> $imageIds in the new order */
    public function reorderImages(Product $product, array $imageIds): void
    {
        DB::transaction(function () use ($product, $imageIds) {
            $product = Product::query()->lockForUpdate()->findOrFail($product->id);
            $this->ensureEditable($product);

            $existing = $product->images()->pluck('id')->sort()->values()->all();
            $given = collect($imageIds)->map(fn ($id) => (int) $id)->sort()->values()->all();
            if ($existing !== $given) {
                throw ValidationException::withMessages(['image_ids' => 'Send every photo of this listing exactly once.']);
            }

            foreach (array_values($imageIds) as $position => $id) {
                ProductImage::query()->whereKey($id)->update(['position' => $position]);
            }
        });
    }

    /** @param list<array{id?: int|null, name: string, sku?: string|null, price: string, stock: int}> $variants */
    private function syncVariants(Product $product, array $variants): void
    {
        $incomingIds = collect($variants)->pluck('id')->filter()->map(fn ($id) => (int) $id)->all();

        // Removed first (soft delete keeps them for past orders) so a re-added name doesn't clash.
        $product->variants()->whereKeyNot($incomingIds)->get()->each(fn (ProductVariant $v) => $v->delete());

        try {
            $this->writeVariants($product, $variants);
        } catch (UniqueConstraintViolationException) {
            throw ValidationException::withMessages(['variants' => 'Each option needs a different name.']);
        }

        $this->refreshAggregates($product);
    }

    /** @param list<array{id?: int|null, name: string, sku?: string|null, price: string, stock: int}> $variants */
    private function writeVariants(Product $product, array $variants): void
    {
        foreach (array_values($variants) as $position => $data) {
            $attributes = [
                'name' => $data['name'],
                'sku' => $data['sku'] ?? null,
                'price' => $data['price'],
                'stock' => $data['stock'],
                'position' => $position,
            ];

            if (! empty($data['id'])) {
                $variant = $product->variants()->whereKey($data['id'])->first();
                if (! $variant) {
                    throw ValidationException::withMessages(["variants.{$position}.id" => 'This option no longer exists. Reload the page.']);
                }
                $variant->update($attributes);
            } else {
                $product->variants()->create($attributes);
            }
        }
    }

    private function refreshAggregates(Product $product): void
    {
        $totals = $product->variants()->reorder()->toBase()->selectRaw('min(price) as price_from, coalesce(sum(stock), 0) as stock_total')->first();

        $product->price_from = $totals->price_from;
        $product->stock_total = (int) $totals->stock_total;
        $product->save();
    }

    private function sendBackForReview(Product $product): void
    {
        if ($product->status === ProductStatus::Published && config('fdb.catalog.requires_review')) {
            $product->status = ProductStatus::PendingReview;
            $product->submitted_at = now();
            $product->save();
        }
    }

    private function ensureEditable(Product $product): void
    {
        if ($product->status === ProductStatus::Archived) {
            throw InvalidProductTransition::because('Restore this listing before editing it.');
        }
    }

    private function sellerTransition(Product $product, ProductStatus $to): Product
    {
        return DB::transaction(function () use ($product, $to) {
            $product = Product::query()->lockForUpdate()->findOrFail($product->id);

            if (! $product->status->canTransitionTo($to)) {
                throw InvalidProductTransition::between($product->status, $to);
            }

            $product->status = $to;
            $product->save();

            return $product;
        });
    }

    private function moderate(Product $product, ProductStatus $from, ProductStatus $to, User $moderator, ?string $reason): Product
    {
        return DB::transaction(function () use ($product, $from, $to, $moderator, $reason) {
            $product = Product::query()->lockForUpdate()->findOrFail($product->id);

            if ($product->status !== $from || ! in_array($from, [ProductStatus::PendingReview, ProductStatus::Published], true) || ! $from->canTransitionTo($to)) {
                throw InvalidProductTransition::between($product->status, $to);
            }

            $product->status = $to;
            $product->moderation_reason = $reason;
            $product->reviewed_by = $moderator->id;
            $product->reviewed_at = now();
            if ($to === ProductStatus::Published) {
                $product->published_at ??= now();
            }
            $product->save();

            $this->audit->record('product.'.($to === ProductStatus::Published ? 'approved' : 'rejected'), $moderator, $product, array_filter([
                'from' => $from->value,
                'reason' => $reason,
            ]));

            $owner = Seller::query()->with('user')->findOrFail($product->seller_id)->user;
            $owner->notify(new ProductModerated($product, $to, $reason));

            return $product;
        });
    }

    private function uniqueSlug(string $name, ?int $ignoreId = null): string
    {
        $base = Str::limit(Str::slug($name) ?: 'product', 120, '');

        do {
            $slug = $base.'-'.Str::lower(Str::random(5));
        } while (Product::withTrashed()->where('slug', $slug)->when($ignoreId, fn ($q) => $q->whereKeyNot($ignoreId))->exists());

        return $slug;
    }
}
