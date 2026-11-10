<?php

return [

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

];
