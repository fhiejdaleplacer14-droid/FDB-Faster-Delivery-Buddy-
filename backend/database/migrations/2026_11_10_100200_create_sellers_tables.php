<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sellers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->restrictOnDelete();
            $table->string('store_name', 80);
            $table->string('slug', 100)->unique();
            $table->text('description')->nullable();
            $table->string('contact_phone', 20);
            $table->string('municipality', 30)->index();
            $table->string('barangay', 100);
            $table->string('address_line', 255);
            $table->string('business_type', 30);
            $table->string('business_name', 150)->nullable();
            $table->string('business_registration_number', 50)->nullable();
            $table->string('status', 20)->default('pending');
            $table->timestamp('submitted_at');
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('suspended_at')->nullable();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->text('decision_reason')->nullable();
            $table->timestamps();

            $table->index(['status', 'submitted_at']);
        });

        DB::statement("ALTER TABLE sellers ADD CONSTRAINT sellers_status_check CHECK (status IN ('pending', 'approved', 'rejected', 'suspended'))");
        DB::statement("ALTER TABLE sellers ADD CONSTRAINT sellers_municipality_check CHECK (municipality IN ('vallehermoso', 'guihulngan', 'san_carlos_city'))");
        DB::statement("ALTER TABLE sellers ADD CONSTRAINT sellers_business_type_check CHECK (business_type IN ('individual', 'registered_business'))");
        DB::statement('CREATE UNIQUE INDEX sellers_store_name_lower_unique ON sellers (lower(store_name))');

        Schema::create('seller_status_histories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('seller_id')->constrained()->cascadeOnDelete();
            $table->string('from_status', 20)->nullable();
            $table->string('to_status', 20);
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('reason')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['seller_id', 'created_at']);
        });

        Schema::create('seller_documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('seller_id')->constrained()->restrictOnDelete();
            $table->string('type', 40);
            $table->string('disk', 40);
            $table->string('path', 255)->unique();
            $table->string('original_name', 255);
            $table->string('mime_type', 100);
            $table->unsignedInteger('size_bytes');
            $table->char('sha256', 64);
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['seller_id', 'type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('seller_documents');
        Schema::dropIfExists('seller_status_histories');
        Schema::dropIfExists('sellers');
    }
};
