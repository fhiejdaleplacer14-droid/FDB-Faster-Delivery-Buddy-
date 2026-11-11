<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Default Filesystem Disk
    |--------------------------------------------------------------------------
    |
    | Here you may specify the default filesystem disk that should be used
    | by the framework. The "local" disk, as well as a variety of cloud
    | based disks are available to your application for file storage.
    |
    */

    'default' => env('FILESYSTEM_DISK', 'local'),

    /*
    |--------------------------------------------------------------------------
    | Filesystem Disks
    |--------------------------------------------------------------------------
    |
    | Below you may configure as many filesystem disks as necessary, and you
    | may even configure multiple disks for the same driver. Examples for
    | most supported storage drivers are configured here for reference.
    |
    | Supported drivers: "local", "ftp", "sftp", "s3"
    |
    */

    'disks' => [

        'local' => [
            'driver' => 'local',
            'root' => storage_path('app/private'),
            'serve' => true,
            'throw' => false,
            'report' => false,
        ],

        // Rows remember their disk by name, so these names stay. FDB_STORAGE_DRIVER=s3 moves them to
        // Neon (or any S3-compatible) buckets for hosts whose disks do not last, like Render's free plan.
        // Neon rejects ACL calls, so no per-file visibility is set; the bucket's access level decides.
        'seller_documents' => env('FDB_STORAGE_DRIVER', 'local') === 's3' ? [
            'driver' => 's3',
            'key' => env('AWS_ACCESS_KEY_ID'),
            'secret' => env('AWS_SECRET_ACCESS_KEY'),
            'region' => env('AWS_REGION', env('AWS_DEFAULT_REGION')),
            'bucket' => env('FDB_DOCUMENTS_BUCKET', 'fdb-documents'),
            'endpoint' => env('AWS_ENDPOINT_URL_S3', env('AWS_ENDPOINT')),
            'use_path_style_endpoint' => true,
            'throw' => true,
            'report' => false,
        ] : [
            'driver' => 'local',
            'root' => storage_path('app/seller-documents'),
            'visibility' => 'private',
            'serve' => false,
            'throw' => true,
            'report' => false,
        ],

        'media' => env('FDB_STORAGE_DRIVER', 'local') === 's3' ? [
            'driver' => 's3',
            'key' => env('AWS_ACCESS_KEY_ID'),
            'secret' => env('AWS_SECRET_ACCESS_KEY'),
            'region' => env('AWS_REGION', env('AWS_DEFAULT_REGION')),
            'bucket' => env('FDB_MEDIA_BUCKET', 'fdb-media'),
            'endpoint' => env('AWS_ENDPOINT_URL_S3', env('AWS_ENDPOINT')),
            'use_path_style_endpoint' => true,
            // Photos are served as /storage/... on the website's own address (the Worker fetches them from the bucket).
            'url' => rtrim(env('MEDIA_URL', '/storage'), '/'),
            'throw' => true,
            'report' => false,
        ] : [
            'driver' => 'local',
            'root' => storage_path('app/public'),
            'url' => rtrim(env('MEDIA_URL', '/storage'), '/'),
            'visibility' => 'public',
            'throw' => true,
            'report' => false,
        ],

        'public' => [
            'driver' => 'local',
            'root' => storage_path('app/public'),
            'url' => rtrim(env('APP_URL', 'http://localhost'), '/').'/storage',
            'visibility' => 'public',
            'throw' => false,
            'report' => false,
        ],

        's3' => [
            'driver' => 's3',
            'key' => env('AWS_ACCESS_KEY_ID'),
            'secret' => env('AWS_SECRET_ACCESS_KEY'),
            'region' => env('AWS_DEFAULT_REGION'),
            'bucket' => env('AWS_BUCKET'),
            'url' => env('AWS_URL'),
            'endpoint' => env('AWS_ENDPOINT'),
            'use_path_style_endpoint' => env('AWS_USE_PATH_STYLE_ENDPOINT', false),
            'throw' => false,
            'report' => false,
        ],

    ],

    /*
    |--------------------------------------------------------------------------
    | Symbolic Links
    |--------------------------------------------------------------------------
    |
    | Here you may configure the symbolic links that will be created when the
    | `storage:link` Artisan command is executed. The array keys should be
    | the locations of the links and the values should be their targets.
    |
    */

    'links' => [
        public_path('storage') => storage_path('app/public'),
    ],

];
