<?php

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

pest()->extend(TestCase::class)
    ->use(RefreshDatabase::class)
    ->in('Feature');

pest()->extend(TestCase::class)->in('Unit');

// UploadedFile::fake() reports a MIME type from the extension; this one is sniffed from content like a real upload.
function realUpload(string $name, string $content): UploadedFile
{
    $path = tempnam(sys_get_temp_dir(), 'upload');
    file_put_contents($path, $content);

    return new UploadedFile($path, $name, null, null, true);
}

/** @return array<string, mixed> */
function sellerApplicationPayload(array $overrides = []): array
{
    return array_replace([
        'store_name' => 'Aling Rosa Sari-Sari',
        'description' => 'Snacks, drinks, and household goods.',
        'contact_phone' => '09171234567',
        'municipality' => 'guihulngan',
        'barangay' => 'Poblacion',
        'address_line' => '12 Rizal Street',
        'business_type' => 'individual',
        'documents' => [
            ['type' => 'government_id', 'file' => UploadedFile::fake()->image('my id.jpg', 600, 400)],
        ],
    ], $overrides);
}
