<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('CREATE EXTENSION IF NOT EXISTS pg_trgm');

        Schema::create('categories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('parent_id')->nullable()->constrained('categories')->restrictOnDelete();
            $table->string('name', 60);
            $table->string('slug', 80)->unique();
            $table->unsignedSmallInteger('position')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['parent_id', 'position']);
        });

        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->foreignId('seller_id')->constrained()->restrictOnDelete();
            $table->foreignId('category_id')->constrained()->restrictOnDelete();
            $table->string('name', 120);
            $table->string('slug', 150)->unique();
            $table->text('description');
            $table->string('status', 20)->default('draft');
            $table->text('moderation_reason')->nullable();
            // Cached from variants so browsing can filter and sort without aggregating.
            $table->decimal('price_from', 12, 2);
            $table->integer('stock_total')->default(0);
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('published_at')->nullable();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['status', 'published_at']);
            $table->index(['seller_id', 'status']);
            $table->index(['category_id', 'status']);
            $table->index(['status', 'price_from']);
        });

        DB::statement("ALTER TABLE products ADD CONSTRAINT products_status_check CHECK (status IN ('draft', 'pending_review', 'published', 'rejected', 'archived'))");
        DB::statement('ALTER TABLE products ADD CONSTRAINT products_price_from_check CHECK (price_from > 0)');
        DB::statement('ALTER TABLE products ADD CONSTRAINT products_stock_total_check CHECK (stock_total >= 0)');
        DB::statement('CREATE INDEX products_name_trgm ON products USING gin (name gin_trgm_ops)');

        Schema::create('product_variants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->string('name', 60);
            $table->string('sku', 60)->nullable();
            $table->decimal('price', 12, 2);
            $table->integer('stock');
            $table->unsignedSmallInteger('position')->default(0);
            $table->timestamps();
            $table->softDeletes();
        });

        DB::statement('ALTER TABLE product_variants ADD CONSTRAINT product_variants_price_check CHECK (price > 0)');
        DB::statement('ALTER TABLE product_variants ADD CONSTRAINT product_variants_stock_check CHECK (stock >= 0)');
        DB::statement('CREATE UNIQUE INDEX product_variants_name_unique ON product_variants (product_id, lower(name)) WHERE deleted_at IS NULL');

        Schema::create('product_images', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->string('disk', 40);
            $table->string('path', 255)->unique();
            $table->unsignedSmallInteger('width');
            $table->unsignedSmallInteger('height');
            $table->unsignedInteger('size_bytes');
            $table->unsignedSmallInteger('position')->default(0);
            $table->timestamps();

            $table->index(['product_id', 'position']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_images');
        Schema::dropIfExists('product_variants');
        Schema::dropIfExists('products');
        Schema::dropIfExists('categories');
    }
};
