<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_reviews', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained()->restrictOnDelete();
            $table->foreignId('seller_id')->constrained()->restrictOnDelete();
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            // One review per purchased line: only buyers can review, and only once per purchase.
            $table->foreignId('order_item_id')->unique()->constrained()->restrictOnDelete();
            $table->unsignedSmallInteger('rating');
            $table->text('comment')->nullable();
            $table->string('status', 20)->default('published');
            $table->text('hidden_reason')->nullable();
            $table->text('seller_reply')->nullable();
            $table->timestamp('seller_replied_at')->nullable();
            $table->timestamps();

            $table->index(['product_id', 'status', 'created_at']);
            $table->index(['seller_id', 'created_at']);
        });

        DB::statement('ALTER TABLE product_reviews ADD CONSTRAINT product_reviews_rating_check CHECK (rating BETWEEN 1 AND 5)');
        DB::statement("ALTER TABLE product_reviews ADD CONSTRAINT product_reviews_status_check CHECK (status IN ('published', 'hidden'))");

        Schema::table('products', function (Blueprint $table) {
            $table->decimal('rating_average', 3, 2)->nullable();
            $table->unsignedInteger('rating_count')->default(0);
        });

        Schema::create('support_tickets', function (Blueprint $table) {
            $table->id();
            $table->string('number', 20)->unique();
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->string('category', 30);
            $table->string('subject', 150);
            $table->string('status', 30)->default('open');
            $table->foreignId('seller_order_id')->nullable()->constrained()->restrictOnDelete();
            $table->foreignId('seller_id')->nullable()->constrained()->restrictOnDelete();
            $table->text('resolution')->nullable();
            $table->foreignId('resolved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamp('last_activity_at');
            $table->timestamps();

            $table->index(['user_id', 'last_activity_at']);
            $table->index(['seller_id', 'last_activity_at']);
            $table->index(['status', 'last_activity_at']);
        });

        DB::statement("ALTER TABLE support_tickets ADD CONSTRAINT support_tickets_category_check CHECK (category IN ('order_problem', 'dispute', 'delivery', 'payment', 'account', 'selling', 'other'))");
        DB::statement("ALTER TABLE support_tickets ADD CONSTRAINT support_tickets_status_check CHECK (status IN ('open', 'waiting_on_user', 'resolved', 'closed'))");
        DB::statement("ALTER TABLE support_tickets ADD CONSTRAINT support_tickets_dispute_order_check CHECK (category <> 'dispute' OR seller_order_id IS NOT NULL)");
        // At most one dispute that is still being handled per seller order.
        DB::statement("CREATE UNIQUE INDEX support_tickets_one_open_dispute ON support_tickets (seller_order_id) WHERE category = 'dispute' AND status IN ('open', 'waiting_on_user')");

        Schema::create('support_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('support_ticket_id')->constrained()->cascadeOnDelete();
            $table->foreignId('author_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('author_role', 20);
            $table->text('body');
            $table->timestamp('created_at')->useCurrent();

            $table->index(['support_ticket_id', 'created_at']);
        });

        DB::statement("ALTER TABLE support_messages ADD CONSTRAINT support_messages_role_check CHECK (author_role IN ('customer', 'seller', 'staff'))");
    }

    public function down(): void
    {
        Schema::dropIfExists('support_messages');
        Schema::dropIfExists('support_tickets');
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn(['rating_average', 'rating_count']);
        });
        Schema::dropIfExists('product_reviews');
    }
};
