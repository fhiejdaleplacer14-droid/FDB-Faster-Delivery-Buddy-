<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // Seller-recorded refunds wait for an admin before they lower FDB's commission.
    public function up(): void
    {
        Schema::table('refunds', function (Blueprint $table) {
            $table->string('commission_status', 10)->default('applied')->after('recorded_as');
            $table->decimal('commission_items_value', 12, 2)->default(0)->after('commission_status');
            $table->foreignId('commission_reviewed_by')->nullable()->after('commission_items_value')->constrained('users')->nullOnDelete();
            $table->timestamp('commission_reviewed_at')->nullable()->after('commission_reviewed_by');
            $table->index('commission_status');
        });

        DB::statement("ALTER TABLE refunds ADD CONSTRAINT refunds_commission_status_check CHECK (commission_status IN ('pending', 'applied', 'declined'))");
        DB::statement('ALTER TABLE refunds ADD CONSTRAINT refunds_commission_items_value_check CHECK (commission_items_value >= 0)');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE refunds DROP CONSTRAINT IF EXISTS refunds_commission_status_check');
        DB::statement('ALTER TABLE refunds DROP CONSTRAINT IF EXISTS refunds_commission_items_value_check');
        Schema::table('refunds', function (Blueprint $table) {
            $table->dropConstrainedForeignId('commission_reviewed_by');
            $table->dropIndex(['commission_status']);
            $table->dropColumn(['commission_status', 'commission_items_value', 'commission_reviewed_at']);
        });
    }
};
