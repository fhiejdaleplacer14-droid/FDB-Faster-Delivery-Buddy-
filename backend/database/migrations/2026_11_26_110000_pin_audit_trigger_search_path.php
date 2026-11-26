<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    // A fixed search_path stops a caller's schema from changing what the trigger resolves.
    public function up(): void
    {
        DB::statement("ALTER FUNCTION audit_logs_block_changes() SET search_path = ''");
    }

    public function down(): void
    {
        DB::statement('ALTER FUNCTION audit_logs_block_changes() RESET search_path');
    }
};
