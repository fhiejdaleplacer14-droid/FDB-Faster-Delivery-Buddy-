<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('addresses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('label', 40)->nullable();
            $table->string('recipient_name', 100);
            $table->string('phone', 20);
            $table->string('municipality', 30);
            $table->string('barangay', 100);
            $table->string('street', 255);
            $table->string('landmark', 255)->nullable();
            $table->boolean('is_default')->default(false);
            $table->timestamps();

            $table->index('user_id');
        });

        DB::statement("ALTER TABLE addresses ADD CONSTRAINT addresses_municipality_check CHECK (municipality IN ('vallehermoso', 'guihulngan', 'san_carlos_city'))");
        DB::statement('CREATE UNIQUE INDEX addresses_one_default ON addresses (user_id) WHERE is_default');

        Schema::create('cart_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_variant_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('quantity');
            $table->timestamps();

            $table->unique(['user_id', 'product_variant_id']);
        });

        DB::statement('ALTER TABLE cart_items ADD CONSTRAINT cart_items_quantity_check CHECK (quantity BETWEEN 1 AND 99)');

        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            $table->string('number', 24)->unique();
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->uuid('idempotency_key');
            $table->string('status', 20)->default('in_progress');
            $table->string('payment_method', 30);
            $table->decimal('items_total', 12, 2);
            $table->decimal('delivery_fee_total', 12, 2)->default(0);
            $table->decimal('grand_total', 12, 2);
            // Delivery address copied at checkout so later edits don't rewrite history.
            $table->string('recipient_name', 100);
            $table->string('recipient_phone', 20);
            $table->string('municipality', 30);
            $table->string('barangay', 100);
            $table->string('street', 255);
            $table->string('landmark', 255)->nullable();
            $table->text('customer_note')->nullable();
            $table->timestamp('placed_at');
            $table->timestamps();

            $table->unique(['user_id', 'idempotency_key']);
            $table->index(['user_id', 'placed_at']);
            $table->index(['status', 'placed_at']);
        });

        DB::statement("ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK (status IN ('in_progress', 'completed', 'cancelled'))");
        DB::statement('ALTER TABLE orders ADD CONSTRAINT orders_totals_check CHECK (items_total > 0 AND delivery_fee_total >= 0 AND grand_total = items_total + delivery_fee_total)');

        Schema::create('seller_orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->restrictOnDelete();
            $table->foreignId('seller_id')->constrained()->restrictOnDelete();
            $table->string('number', 30)->unique();
            $table->string('status', 30)->default('pending_confirmation');
            $table->string('payment_status', 20)->default('unpaid');
            $table->decimal('items_total', 12, 2);
            $table->decimal('delivery_fee', 12, 2)->default(0);
            $table->decimal('total', 12, 2);
            $table->text('delivery_note')->nullable();
            $table->text('cancel_reason')->nullable();
            $table->string('cancelled_by', 20)->nullable();
            $table->timestamp('confirmed_at')->nullable();
            $table->timestamp('delivered_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->foreignId('payment_confirmed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['order_id', 'seller_id']);
            $table->index(['seller_id', 'status', 'created_at']);
        });

        DB::statement("ALTER TABLE seller_orders ADD CONSTRAINT seller_orders_status_check CHECK (status IN ('pending_confirmation', 'confirmed', 'preparing', 'ready_for_delivery', 'out_for_delivery', 'delivered', 'cancelled'))");
        DB::statement("ALTER TABLE seller_orders ADD CONSTRAINT seller_orders_payment_status_check CHECK (payment_status IN ('unpaid', 'paid'))");
        DB::statement("ALTER TABLE seller_orders ADD CONSTRAINT seller_orders_cancelled_by_check CHECK (cancelled_by IS NULL OR cancelled_by IN ('customer', 'seller', 'admin'))");
        DB::statement('ALTER TABLE seller_orders ADD CONSTRAINT seller_orders_totals_check CHECK (items_total > 0 AND delivery_fee >= 0 AND total = items_total + delivery_fee)');

        Schema::create('order_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('seller_order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->restrictOnDelete();
            $table->foreignId('product_variant_id')->constrained()->restrictOnDelete();
            $table->string('product_name', 120);
            $table->string('variant_name', 60);
            $table->decimal('unit_price', 12, 2);
            $table->unsignedSmallInteger('quantity');
            $table->decimal('line_total', 12, 2);
            $table->timestamps();
        });

        DB::statement('ALTER TABLE order_items ADD CONSTRAINT order_items_amounts_check CHECK (quantity > 0 AND unit_price > 0 AND line_total = unit_price * quantity)');

        Schema::create('order_status_histories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('seller_order_id')->constrained()->cascadeOnDelete();
            $table->string('from_status', 30)->nullable();
            $table->string('to_status', 30);
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('note')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['seller_order_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_status_histories');
        Schema::dropIfExists('order_items');
        Schema::dropIfExists('seller_orders');
        Schema::dropIfExists('orders');
        Schema::dropIfExists('cart_items');
        Schema::dropIfExists('addresses');
    }
};
