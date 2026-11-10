<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Audit\AuditLogger;
use App\Http\Controllers\Controller;
use App\Models\Seller;
use App\Models\SellerDocument;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class SellerDocumentController extends Controller
{
    public function show(Request $request, Seller $seller, SellerDocument $document, AuditLogger $audit): StreamedResponse
    {
        Gate::authorize('viewDocuments', $seller);

        $audit->record('seller_document.viewed', $request->user(), $document, [
            'seller_id' => $seller->id,
            'type' => $document->type->value,
        ]);

        return Storage::disk($document->disk)->download($document->path, $document->original_name, [
            'Content-Type' => $document->mime_type,
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'private, no-store',
        ]);
    }
}
