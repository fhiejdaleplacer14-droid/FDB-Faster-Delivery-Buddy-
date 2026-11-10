<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Commissions\FinancialReport;
use App\Domain\Identity\PermissionSlug;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Gate;

class FinancialReportController extends Controller
{
    public function __invoke(Request $request, FinancialReport $report): JsonResponse
    {
        Gate::authorize('permission', PermissionSlug::ReportsView);

        $data = $request->validate([
            'from' => ['required', 'date_format:Y-m-d'],
            'to' => ['required', 'date_format:Y-m-d', 'after_or_equal:from'],
        ]);

        // Dates are calendar days in the display timezone; storage is UTC.
        $zone = config('app.display_timezone');
        $from = Carbon::parse($data['from'], $zone)->startOfDay()->utc();
        $to = Carbon::parse($data['to'], $zone)->endOfDay()->utc();

        if ($from->diffInDays($to) > 366) {
            return response()->json(['message' => 'Choose a period of one year or less.'], 422);
        }

        return response()->json(['data' => $report->summary($from, $to)]);
    }
}
