<?php

return [

    'accounts' => [
        // A verified email is needed to check out and to apply as a seller. Turn off only on test
        // sites that cannot send email yet; seller applications still need admin approval either way.
        'require_email_verification' => (bool) env('FDB_REQUIRE_EMAIL_VERIFICATION', true),
    ],

    'sellers' => [
        // Placeholder policy until the founders confirm the verification requirements.
        'required_documents' => array_filter(explode(',', env('FDB_SELLER_REQUIRED_DOCUMENTS', 'government_id'))),
        'documents_disk' => env('FDB_SELLER_DOCUMENTS_DISK', 'seller_documents'),
        'document_max_kb' => 5120,
        'document_mimes' => ['jpg', 'jpeg', 'png', 'webp', 'pdf'],
        'max_documents_per_submission' => 6,
    ],

    'catalog' => [
        // Placeholder policy: listings are reviewed by FDB before customers can see them.
        'requires_review' => (bool) env('FDB_LISTING_REQUIRES_REVIEW', true),
        'media_disk' => env('FDB_MEDIA_DISK', 'media'),
        'max_images' => 8,
        'image_max_kb' => 8192,
        'image_max_dimension' => 1600,
        'image_max_pixels' => 40_000_000,
        'max_variants' => 20,
    ],

    'orders' => [
        // Sellers collect payment directly; FDB only records the method chosen. Only these can be selected.
        'payment_methods' => array_values(array_filter(explode(',', env('FDB_PAYMENT_METHODS', 'cash_on_delivery')))),
        // Shown at checkout in this order. Methods not enabled above appear as "coming soon" placeholders.
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
        // Placeholder policy: how long after delivery a customer may open a dispute.
        'dispute_window_days' => (int) env('FDB_DISPUTE_WINDOW_DAYS', 7),
    ],

    'commission' => [
        // Placeholder: used only to create the first default policy. Admins change rates in the app.
        'initial_default_rate' => env('FDB_INITIAL_COMMISSION_RATE', '0.0750'),
        'max_rate_percent' => 50,
        'collection_methods' => ['cash', 'gcash', 'maya', 'bank_transfer', 'other'],
    ],

    'refunds' => [
        // Placeholder until the founders decide: 'proportional' cuts FDB's commission by the rate times
        // the refunded item value; 'none' leaves the commission unchanged.
        'commission_treatment' => env('FDB_REFUND_COMMISSION', 'proportional'),
        'methods' => ['cash', 'gcash', 'maya', 'bank_transfer', 'other'],
    ],

];
