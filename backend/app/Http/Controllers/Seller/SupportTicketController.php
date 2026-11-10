<?php

namespace App\Http\Controllers\Seller;

use App\Domain\Support\TicketCategory;
use App\Domain\Support\TicketStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\TicketResource;
use App\Models\SupportTicket;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

// Threads open through the shared /support/tickets/{number} endpoints.
class SupportTicketController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $filters = $request->validate(['status' => ['nullable', Rule::enum(TicketStatus::class)]]);

        $involving = array_filter(TicketCategory::cases(), fn (TicketCategory $c) => $c->involvesSeller());

        $tickets = SupportTicket::query()
            ->where('seller_id', $request->attributes->get('seller')->id)
            ->whereIn('category', $involving)
            ->with(['sellerOrder', 'user'])
            ->when($filters['status'] ?? null, fn ($q, $status) => $q->where('status', $status))
            ->orderByDesc('last_activity_at')
            ->orderByDesc('id')
            ->paginate(20)
            ->withQueryString();

        return TicketResource::collection($tickets);
    }
}
