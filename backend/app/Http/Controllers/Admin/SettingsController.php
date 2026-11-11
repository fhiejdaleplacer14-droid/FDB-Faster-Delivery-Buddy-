<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Identity\PermissionSlug;
use App\Domain\Settings\SiteSettings;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class SettingsController extends Controller
{
    public function __construct(private readonly SiteSettings $settings) {}

    public function show(): JsonResponse
    {
        Gate::authorize('permission', PermissionSlug::SellersManage);

        return response()->json(['data' => $this->payload()]);
    }

    public function update(Request $request): JsonResponse
    {
        Gate::authorize('permission', PermissionSlug::SellersManage);

        $data = $request->validate(['seller_documents_required' => ['required', 'boolean']]);
        $this->settings->set(SiteSettings::SELLER_DOCUMENTS_REQUIRED, (bool) $data['seller_documents_required'], $request->user());

        return response()->json(['data' => $this->payload()]);
    }

    /** @return array<string, bool> */
    private function payload(): array
    {
        return ['seller_documents_required' => $this->settings->sellerDocumentsRequired()];
    }
}
