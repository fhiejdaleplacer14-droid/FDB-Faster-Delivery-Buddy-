<?php

return [

    'accounts' => [
        // Needed to check out or apply as a seller. Turn off only where email can't be sent.
        'require_email_verification' => (bool) env('FDB_REQUIRE_EMAIL_VERIFICATION', true),
    ],

    'sellers' => [
        // Default for Admin > Settings (placeholder policy).
        'documents_required' => (bool) env('FDB_SELLER_DOCUMENTS_REQUIRED', true),
        'required_documents' => array_filter(explode(',', env('FDB_SELLER_REQUIRED_DOCUMENTS', 'government_id'))),
        'documents_disk' => env('FDB_SELLER_DOCUMENTS_DISK', 'seller_documents'),
        'document_max_kb' => 5120,
        'document_mimes' => ['jpg', 'jpeg', 'png', 'webp', 'pdf'],
        'max_documents_per_submission' => 6,
    ],

    'catalog' => [
        // Admins approve listings before they go public (placeholder policy).
        'requires_review' => (bool) env('FDB_LISTING_REQUIRES_REVIEW', true),
        'media_disk' => env('FDB_MEDIA_DISK', 'media'),
        'max_images' => 8,
        'image_max_kb' => 8192,
        'image_max_dimension' => 1600,
        'image_max_pixels' => 40_000_000,
        'max_variants' => 20,
    ],

    'orders' => [
        // Sellers collect payment; FDB only records the method.
        'payment_methods' => array_values(array_filter(explode(',', env('FDB_PAYMENT_METHODS', 'cash_on_delivery')))),
        // Checkout order; disabled methods show as "coming soon".
        'payment_method_labels' => [
            'cash_on_delivery' => 'Cash on delivery',
            'gcash' => 'GCash',
            'maya' => 'Maya',
            'other' => 'Other e-wallets and bank transfer',
        ],
        'max_quantity_per_item' => 99,
        'max_cart_lines' => 50,
    ],

    'support' => [
        // Days after delivery to open a dispute (placeholder).
        'dispute_window_days' => (int) env('FDB_DISPUTE_WINDOW_DAYS', 7),
    ],

    'commission' => [
        // Seeds the first default rate only.
        'initial_default_rate' => env('FDB_INITIAL_COMMISSION_RATE', '0.0750'),
        'max_rate_percent' => 50,
        'collection_methods' => ['cash', 'gcash', 'maya', 'bank_transfer', 'other'],
    ],

    'refunds' => [
        // 'proportional' reduces commission by the refunded value; 'none' keeps it (placeholder).
        'commission_treatment' => env('FDB_REFUND_COMMISSION', 'proportional'),
        'methods' => ['cash', 'gcash', 'maya', 'bank_transfer', 'other'],
    ],

];
