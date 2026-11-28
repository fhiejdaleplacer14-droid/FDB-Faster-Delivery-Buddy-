<?php

use App\Http\Controllers\AddressController;
use App\Http\Controllers\Admin\CategoryController as AdminCategoryController;
use App\Http\Controllers\Admin\CommissionController as AdminCommissionController;
use App\Http\Controllers\Admin\DashboardController as AdminDashboardController;
use App\Http\Controllers\Admin\FinancialReportController;
use App\Http\Controllers\Admin\OrderController as AdminOrderController;
use App\Http\Controllers\Admin\ProductModerationController;
use App\Http\Controllers\Admin\RefundController as AdminRefundController;
use App\Http\Controllers\Admin\ReviewController as AdminReviewController;
use App\Http\Controllers\Admin\SellerController as AdminSellerController;
use App\Http\Controllers\Admin\SellerDocumentController;
use App\Http\Controllers\Admin\SettingsController as AdminSettingsController;
use App\Http\Controllers\Admin\SupportTicketController as AdminSupportTicketController;
use App\Http\Controllers\Auth\CurrentUserController;
use App\Http\Controllers\Auth\EmailVerificationController;
use App\Http\Controllers\Auth\PasswordResetController;
use App\Http\Controllers\Auth\RegisterController;
use App\Http\Controllers\Auth\SessionController;
use App\Http\Controllers\CartController;
use App\Http\Controllers\CatalogController;
use App\Http\Controllers\CheckoutController;
use App\Http\Controllers\HealthController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\OrderController;
use App\Http\Controllers\ReviewController;
use App\Http\Controllers\Seller\CommissionController as SellerCommissionController;
use App\Http\Controllers\Seller\OrderController as SellerOrderController;
use App\Http\Controllers\Seller\ProductController as SellerProductController;
use App\Http\Controllers\Seller\ProductImageController;
use App\Http\Controllers\Seller\ReviewController as SellerReviewController;
use App\Http\Controllers\Seller\SupportTicketController as SellerSupportTicketController;
use App\Http\Controllers\SellerApplicationController;
use App\Http\Controllers\SupportTicketController;
use Illuminate\Support\Facades\Route;

Route::get('/health', HealthController::class)->name('health');

Route::get('/categories', [CatalogController::class, 'categories'])->name('catalog.categories');
Route::get('/products', [CatalogController::class, 'products'])->name('catalog.products');
Route::get('/products/{slug}', [CatalogController::class, 'product'])->name('catalog.product');
Route::get('/stores/{slug}', [CatalogController::class, 'store'])->name('catalog.store');
Route::get('/products/{slug}/reviews', [ReviewController::class, 'index'])->name('catalog.reviews');
Route::get('/support/categories', [SupportTicketController::class, 'categories'])->name('support.categories');

Route::prefix('auth')->middleware('spa.session')->group(function () {
    Route::post('/register', RegisterController::class)->middleware('throttle:register')->name('auth.register');
    Route::post('/login', [SessionController::class, 'store'])->name('auth.login');
    Route::post('/forgot-password', [PasswordResetController::class, 'sendLink'])->middleware('throttle:password-reset')->name('auth.forgot-password');
    Route::post('/reset-password', [PasswordResetController::class, 'reset'])->middleware('throttle:password-reset')->name('auth.reset-password');

    Route::get('/verify-email/{id}/{hash}', [EmailVerificationController::class, 'verify'])
        ->middleware(['signed:relative', 'throttle:6,1'])
        ->name('verification.verify');

    Route::middleware(['auth:sanctum', 'active'])->group(function () {
        Route::post('/logout', [SessionController::class, 'destroy'])->name('auth.logout');
        Route::post('/verify-email/resend', [EmailVerificationController::class, 'resend'])
            ->middleware('throttle:6,1')
            ->name('verification.send');
    });
});

Route::middleware(['auth:sanctum', 'active'])->group(function () {
    Route::get('/user', [CurrentUserController::class, 'show'])->name('user.show');
    Route::patch('/user', [CurrentUserController::class, 'update'])->name('user.update');
    Route::put('/user/password', [CurrentUserController::class, 'updatePassword'])->name('user.password');

    Route::get('/seller-application/requirements', [SellerApplicationController::class, 'requirements'])->name('seller-application.requirements');

    // Shopping and selling: customer accounts only, never admin accounts.
    Route::middleware('shopper')->group(function () {
        Route::get('/seller-application', [SellerApplicationController::class, 'show'])->name('seller-application.show');
        Route::middleware(['verified', 'throttle:uploads'])->group(function () {
            Route::post('/seller-application', [SellerApplicationController::class, 'store'])->name('seller-application.store');
            Route::post('/seller-application/resubmit', [SellerApplicationController::class, 'resubmit'])->name('seller-application.resubmit');
        });

        Route::get('/addresses', [AddressController::class, 'index'])->name('addresses.index');
        Route::post('/addresses', [AddressController::class, 'store'])->name('addresses.store');
        Route::put('/addresses/{addressId}', [AddressController::class, 'update'])->whereNumber('addressId')->name('addresses.update');
        Route::delete('/addresses/{addressId}', [AddressController::class, 'destroy'])->whereNumber('addressId')->name('addresses.destroy');

        Route::get('/cart', [CartController::class, 'show'])->name('cart.show');
        Route::post('/cart/items', [CartController::class, 'store'])->name('cart.items.store');
        Route::patch('/cart/items/{itemId}', [CartController::class, 'update'])->whereNumber('itemId')->name('cart.items.update');
        Route::delete('/cart/items/{itemId}', [CartController::class, 'destroy'])->whereNumber('itemId')->name('cart.items.destroy');

        Route::post('/checkout', CheckoutController::class)->middleware(['verified', 'throttle:checkout'])->name('checkout');

        Route::get('/orders', [OrderController::class, 'index'])->name('orders.index');
        Route::get('/orders/{number}', [OrderController::class, 'show'])->name('orders.show');
        Route::post('/orders/{number}/seller-orders/{sellerOrderNumber}/cancel', [OrderController::class, 'cancel'])->name('orders.cancel');
        Route::post('/orders/{number}/items/{itemId}/review', [ReviewController::class, 'store'])->whereNumber('itemId')->middleware('throttle:reviews')->name('orders.items.review');
    });

    Route::get('/notifications', [NotificationController::class, 'index'])->name('notifications.index');
    Route::post('/notifications/read-all', [NotificationController::class, 'readAll'])->name('notifications.read-all');
    Route::post('/notifications/{id}/read', [NotificationController::class, 'read'])->whereUuid('id')->name('notifications.read');

    Route::middleware('shopper')->group(function () {
        Route::get('/support/tickets', [SupportTicketController::class, 'index'])->name('support.index');
        Route::post('/support/tickets', [SupportTicketController::class, 'store'])->middleware('throttle:support-tickets')->name('support.store');
        Route::get('/support/tickets/{number}', [SupportTicketController::class, 'show'])->name('support.show');
        Route::post('/support/tickets/{number}/messages', [SupportTicketController::class, 'reply'])->middleware('throttle:messages')->name('support.reply');
    });

    Route::prefix('seller')->name('seller.')->whereNumber(['productId', 'imageId', 'sellerOrderId', 'reviewId'])->group(function () {
        Route::middleware('seller')->group(function () {
            Route::get('/orders', [SellerOrderController::class, 'index'])->name('orders.index');
            Route::get('/orders/{sellerOrderId}', [SellerOrderController::class, 'show'])->name('orders.show');
            Route::post('/orders/{sellerOrderId}/status', [SellerOrderController::class, 'updateStatus'])->name('orders.status');
            Route::post('/orders/{sellerOrderId}/cancel', [SellerOrderController::class, 'cancel'])->name('orders.cancel');
            Route::post('/orders/{sellerOrderId}/payment-received', [SellerOrderController::class, 'paymentReceived'])->name('orders.payment');
            Route::put('/orders/{sellerOrderId}/delivery', [SellerOrderController::class, 'delivery'])->name('orders.delivery');
            Route::post('/orders/{sellerOrderId}/refunds', [SellerOrderController::class, 'refund'])->middleware('throttle:refunds')->name('orders.refunds.store');
            Route::get('/commissions', SellerCommissionController::class)->name('commissions.index');
            Route::get('/reviews', [SellerReviewController::class, 'index'])->name('reviews.index');
            Route::post('/reviews/{reviewId}/reply', [SellerReviewController::class, 'reply'])->middleware('throttle:messages')->name('reviews.reply');
            Route::get('/support-tickets', [SellerSupportTicketController::class, 'index'])->name('support.index');
        });

        Route::middleware('seller')->group(function () {
            Route::get('/products', [SellerProductController::class, 'index'])->name('products.index');
            Route::get('/products/{productId}', [SellerProductController::class, 'show'])->name('products.show');
        });

        Route::middleware('seller:write')->group(function () {
            Route::post('/products', [SellerProductController::class, 'store'])->name('products.store');
            Route::put('/products/{productId}', [SellerProductController::class, 'update'])->name('products.update');
            Route::post('/products/{productId}/submit', [SellerProductController::class, 'submit'])->name('products.submit');
            Route::post('/products/{productId}/archive', [SellerProductController::class, 'archive'])->name('products.archive');
            Route::post('/products/{productId}/restore', [SellerProductController::class, 'restore'])->name('products.restore');
            Route::post('/products/{productId}/images', [ProductImageController::class, 'store'])->middleware('throttle:product-images')->name('products.images.store');
            Route::put('/products/{productId}/images/order', [ProductImageController::class, 'reorder'])->name('products.images.reorder');
            Route::delete('/products/{productId}/images/{imageId}', [ProductImageController::class, 'destroy'])->name('products.images.destroy');
        });
    });

    Route::prefix('admin')->name('admin.')->scopeBindings()->group(function () {
        Route::get('/products', [ProductModerationController::class, 'index'])->name('products.index');
        Route::get('/products/{product}', [ProductModerationController::class, 'show'])->name('products.show');
        Route::post('/products/{product}/approve', [ProductModerationController::class, 'approve'])->name('products.approve');
        Route::post('/products/{product}/reject', [ProductModerationController::class, 'reject'])->name('products.reject');
        Route::post('/products/{product}/category', [ProductModerationController::class, 'recategorize'])->name('products.recategorize');

        Route::get('/commission-policies', [AdminCommissionController::class, 'policies'])->name('commission-policies.index');
        Route::post('/commission-policies', [AdminCommissionController::class, 'setPolicy'])->name('commission-policies.store');
        Route::get('/commissions', [AdminCommissionController::class, 'records'])->name('commissions.index');
        Route::get('/commissions/balances', [AdminCommissionController::class, 'sellerBalances'])->name('commissions.balances');
        Route::post('/commissions/{record}/adjustments', [AdminCommissionController::class, 'adjust'])->whereNumber('record')->name('commissions.adjust');
        Route::get('/commission-collections', [AdminCommissionController::class, 'collections'])->name('commission-collections.index');
        Route::post('/commission-collections', [AdminCommissionController::class, 'collect'])->name('commission-collections.store');
        Route::get('/reports/financial', FinancialReportController::class)->name('reports.financial');
        Route::get('/dashboard', AdminDashboardController::class)->name('dashboard');
        Route::get('/settings', [AdminSettingsController::class, 'show'])->name('settings.show');
        Route::put('/settings', [AdminSettingsController::class, 'update'])->name('settings.update');

        Route::get('/orders', [AdminOrderController::class, 'index'])->name('orders.index');
        Route::get('/orders/{number}', [AdminOrderController::class, 'show'])->name('orders.show');

        Route::get('/refunds', [AdminRefundController::class, 'index'])->name('refunds.index');
        Route::post('/seller-orders/{sellerOrderId}/refunds', [AdminRefundController::class, 'store'])->whereNumber('sellerOrderId')->middleware('throttle:refunds')->name('refunds.store');
        Route::post('/refunds/{refundId}/settle-credit', [AdminRefundController::class, 'settleCredit'])->whereNumber('refundId')->name('refunds.settle-credit');
        Route::post('/refunds/{refundId}/approve-commission', [AdminRefundController::class, 'approveCommission'])->whereNumber('refundId')->name('refunds.approve-commission');
        Route::post('/refunds/{refundId}/decline-commission', [AdminRefundController::class, 'declineCommission'])->whereNumber('refundId')->name('refunds.decline-commission');

        Route::get('/reviews', [AdminReviewController::class, 'index'])->name('reviews.index');
        Route::post('/reviews/{reviewId}/hide', [AdminReviewController::class, 'hide'])->whereNumber('reviewId')->name('reviews.hide');
        Route::post('/reviews/{reviewId}/restore', [AdminReviewController::class, 'restore'])->whereNumber('reviewId')->name('reviews.restore');

        Route::get('/support-tickets', [AdminSupportTicketController::class, 'index'])->name('support.index');
        Route::get('/support-tickets/{number}', [AdminSupportTicketController::class, 'show'])->name('support.show');
        Route::post('/support-tickets/{number}/messages', [AdminSupportTicketController::class, 'reply'])->middleware('throttle:messages')->name('support.reply');
        Route::post('/support-tickets/{number}/status', [AdminSupportTicketController::class, 'status'])->name('support.status');

        Route::get('/categories', [AdminCategoryController::class, 'index'])->name('categories.index');
        Route::post('/categories', [AdminCategoryController::class, 'store'])->name('categories.store');
        Route::patch('/categories/{category}', [AdminCategoryController::class, 'update'])->name('categories.update');
        Route::delete('/categories/{category}', [AdminCategoryController::class, 'destroy'])->name('categories.destroy');

        Route::get('/sellers', [AdminSellerController::class, 'index'])->name('sellers.index');
        Route::get('/sellers/{seller}', [AdminSellerController::class, 'show'])->name('sellers.show');
        Route::post('/sellers/{seller}/approve', [AdminSellerController::class, 'approve'])->name('sellers.approve');
        Route::post('/sellers/{seller}/reject', [AdminSellerController::class, 'reject'])->name('sellers.reject');
        Route::post('/sellers/{seller}/suspend', [AdminSellerController::class, 'suspend'])->name('sellers.suspend');
        Route::post('/sellers/{seller}/reactivate', [AdminSellerController::class, 'reactivate'])->name('sellers.reactivate');
        Route::get('/sellers/{seller}/documents/{document}', [SellerDocumentController::class, 'show'])->name('sellers.documents.show');
    });
});
