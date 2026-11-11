<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Commissions\AdminDashboard;
use App\Domain\Identity\PermissionSlug;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class DashboardController extends Controller
{
    public function __invoke(Request $request, AdminDashboard $dashboard): JsonResponse
    {
        Gate::authorize('permission', PermissionSlug::ReportsView);

        $data = $request->validate(['days' => ['nullable', 'integer', Rule::in([7, 30, 90])]]);

        return response()->json(['data' => $dashboard->build((int) ($data['days'] ?? 30))]);
    }
}
