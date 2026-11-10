<?php

use App\Http\Controllers\Admin\CategoryController as AdminCategoryController;
use App\Http\Controllers\Admin\ProductModerationController;
use App\Http\Controllers\Admin\SellerController as AdminSellerController;
use App\Http\Controllers\CatalogController;
use App\Http\Controllers\Seller\ProductController as SellerProductController;
use App\Http\Controllers\Seller\ProductImageController;
use App\Http\Controllers\Admin\SellerDocumentController;
use App\Http\Controllers\Auth\CurrentUserController;
use App\Http\Controllers\Auth\EmailVerificationController;
use App\Http\Controllers\Auth\PasswordResetController;
use App\Http\Controllers\Auth\RegisterController;
use App\Http\Controllers\Auth\SessionController;
use App\Http\Controllers\HealthController;
use App\Http\Controllers\SellerApplicationController;
use Illuminate\Support\Facades\Route;

Route::get('/health', HealthController::class)->name('health');

Route::get('/categories', [CatalogController::class, 'categories'])->name('catalog.categories');
Route::get('/products', [CatalogController::class, 'products'])->name('catalog.products');
Route::get('/products/{slug}', [CatalogController::class, 'product'])->name('catalog.product');
Route::get('/stores/{slug}', [CatalogController::class, 'store'])->name('catalog.store');

Route::prefix('auth')->group(function () {
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

    Route::get('/seller-application', [SellerApplicationController::class, 'show'])->name('seller-application.show');
    Route::middleware(['verified', 'throttle:uploads'])->group(function () {
        Route::post('/seller-application', [SellerApplicationController::class, 'store'])->name('seller-application.store');
        Route::post('/seller-application/resubmit', [SellerApplicationController::class, 'resubmit'])->name('seller-application.resubmit');
    });

    Route::prefix('seller')->name('seller.')->whereNumber(['productId', 'imageId'])->group(function () {
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
