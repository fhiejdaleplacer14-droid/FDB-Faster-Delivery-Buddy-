<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('seller_orders', function (Blueprint $table) {
            $table->decimal('refunded_total', 12, 2)->default(0);
        });

        DB::statement('ALTER TABLE seller_orders DROP CONSTRAINT seller_orders_payment_status_check');
        DB::statement("ALTER TABLE seller_orders ADD CONSTRAINT seller_orders_payment_status_check CHECK (payment_status IN ('unpaid', 'paid', 'partially_refunded', 'refunded'))");
        DB::statement('ALTER TABLE seller_orders ADD CONSTRAINT seller_orders_refunded_total_check CHECK (refunded_total >= 0 AND refunded_total <= total)');

        // Money returned to the customer by the seller, outside FDB. FDB only records it.
        Schema::create('refunds', function (Blueprint $table) {
            $table->id();
            $table->foreignId('seller_order_id')->constrained()->restrictOnDelete();
            $table->foreignId('seller_id')->constrained()->restrictOnDelete();
            $table->foreignId('support_ticket_id')->nullable()->constrained()->nullOnDelete();
            $table->decimal('amount', 12, 2);
            $table->string('method', 30);
            $table->string('reference', 100)->nullable();
            $table->text('reason');
            $table->foreignId('recorded_by')->constrained('users')->restrictOnDelete();
            $table->string('recorded_as', 10);
            $table->decimal('commission_reduction', 12, 2)->default(0);
            // Commission FDB already collected and now owes back to the seller.
            $table->decimal('commission_credit', 12, 2)->default(0);
            $table->timestamp('credit_settled_at')->nullable();
            $table->foreignId('credit_settled_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('refunded_at');
            $table->timestamps();

            $table->index(['seller_id', 'created_at']);
            $table->index('credit_settled_at');
        });

        DB::statement('ALTER TABLE refunds ADD CONSTRAINT refunds_amount_check CHECK (amount > 0)');
        DB::statement("ALTER TABLE refunds ADD CONSTRAINT refunds_recorded_as_check CHECK (recorded_as IN ('seller', 'admin'))");
        DB::statement('ALTER TABLE refunds ADD CONSTRAINT refunds_commission_check CHECK (commission_reduction >= 0 AND commission_credit >= 0)');
    }

    public function down(): void
    {
        Schema::dropIfExists('refunds');
        DB::statement('ALTER TABLE seller_orders DROP CONSTRAINT IF EXISTS seller_orders_refunded_total_check');
        DB::statement('ALTER TABLE seller_orders DROP CONSTRAINT seller_orders_payment_status_check');
        DB::statement("ALTER TABLE seller_orders ADD CONSTRAINT seller_orders_payment_status_check CHECK (payment_status IN ('unpaid', 'paid'))");
        Schema::table('seller_orders', function (Blueprint $table) {
            $table->dropColumn('refunded_total');
        });
    }
};
