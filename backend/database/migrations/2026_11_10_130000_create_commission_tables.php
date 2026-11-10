<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('commission_policies', function (Blueprint $table) {
            $table->id();
            // Null seller_id is the marketplace default; a seller row overrides it.
            $table->foreignId('seller_id')->nullable()->constrained()->restrictOnDelete();
            $table->decimal('rate', 5, 4);
            $table->timestamp('effective_from');
            $table->timestamp('effective_until')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['seller_id', 'effective_from']);
        });

        DB::statement('ALTER TABLE commission_policies ADD CONSTRAINT commission_policies_rate_check CHECK (rate >= 0 AND rate <= 0.5)');
        DB::statement('ALTER TABLE commission_policies ADD CONSTRAINT commission_policies_period_check CHECK (effective_until IS NULL OR effective_until > effective_from)');

        Schema::table('seller_orders', function (Blueprint $table) {
            $table->foreignId('commission_policy_id')->nullable()->constrained()->nullOnDelete();
            $table->decimal('commission_rate', 5, 4)->nullable();
            $table->decimal('commission_amount', 12, 2)->nullable();
        });

        Schema::create('commission_collections', function (Blueprint $table) {
            $table->id();
            $table->foreignId('seller_id')->constrained()->restrictOnDelete();
            $table->decimal('amount', 12, 2);
            $table->string('method', 30);
            $table->string('reference', 100)->nullable();
            $table->text('notes')->nullable();
            $table->timestamp('collected_at');
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['seller_id', 'collected_at']);
        });

        DB::statement('ALTER TABLE commission_collections ADD CONSTRAINT commission_collections_amount_check CHECK (amount >= 0)');

        Schema::create('commission_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('seller_order_id')->unique()->constrained()->restrictOnDelete();
            $table->foreignId('seller_id')->constrained()->restrictOnDelete();
            $table->foreignId('commission_policy_id')->nullable()->constrained()->nullOnDelete();
            $table->decimal('rate', 5, 4);
            $table->decimal('base_amount', 12, 2);
            $table->decimal('amount', 12, 2);
            $table->decimal('adjustment_total', 12, 2)->default(0);
            $table->string('status', 20)->default('pending');
            $table->timestamp('due_at')->nullable();
            $table->timestamp('voided_at')->nullable();
            $table->foreignId('commission_collection_id')->nullable()->constrained()->restrictOnDelete();
            $table->timestamps();

            $table->index(['seller_id', 'status']);
            $table->index(['status', 'due_at']);
        });

        DB::statement("ALTER TABLE commission_records ADD CONSTRAINT commission_records_status_check CHECK (status IN ('pending', 'due', 'collected', 'voided'))");
        DB::statement('ALTER TABLE commission_records ADD CONSTRAINT commission_records_amounts_check CHECK (base_amount >= 0 AND amount >= 0 AND amount + adjustment_total >= 0)');
        DB::statement("ALTER TABLE commission_records ADD CONSTRAINT commission_records_collection_check CHECK ((status = 'collected') = (commission_collection_id IS NOT NULL))");

        Schema::create('commission_adjustments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('commission_record_id')->constrained()->restrictOnDelete();
            $table->decimal('amount', 12, 2);
            $table->text('reason');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('created_at')->useCurrent();

            $table->index('commission_record_id');
        });

        DB::statement('ALTER TABLE commission_adjustments ADD CONSTRAINT commission_adjustments_amount_check CHECK (amount <> 0)');
    }

    public function down(): void
    {
        Schema::dropIfExists('commission_adjustments');
        Schema::dropIfExists('commission_records');
        Schema::dropIfExists('commission_collections');
        Schema::table('seller_orders', function (Blueprint $table) {
            $table->dropConstrainedForeignId('commission_policy_id');
            $table->dropColumn(['commission_rate', 'commission_amount']);
        });
        Schema::dropIfExists('commission_policies');
    }
};
