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

];
