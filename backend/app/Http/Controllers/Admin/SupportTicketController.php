<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Identity\PermissionSlug;
use App\Domain\Support\AuthorRole;
use App\Domain\Support\SupportService;
use App\Domain\Support\TicketCategory;
use App\Domain\Support\TicketStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\TicketResource;
use App\Models\SupportTicket;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class SupportTicketController extends Controller
{
    private const DETAIL = ['sellerOrder.order', 'seller', 'user', 'messages.author'];

    public function __construct(private readonly SupportService $support) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        Gate::authorize('permission', PermissionSlug::SupportManage);

        $filters = $request->validate([
            'status' => ['nullable', Rule::in([...array_column(TicketStatus::cases(), 'value'), 'active'])],
            'category' => ['nullable', Rule::enum(TicketCategory::class)],
            'search' => ['nullable', 'string', 'max:100'],
        ]);

        $tickets = SupportTicket::query()
            ->with(['sellerOrder', 'seller', 'user'])
            ->when($filters['status'] ?? null, fn ($q, $status) => $status === 'active'
                ? $q->whereIn('status', [TicketStatus::Open, TicketStatus::WaitingOnUser])
                : $q->where('status', $status))
            ->when($filters['category'] ?? null, fn ($q, $category) => $q->where('category', $category))
            ->when($filters['search'] ?? null, function ($q, $search) {
                $term = '%'.addcslashes($search, '%_\\').'%';
                $q->where(fn ($q) => $q->where('number', 'ilike', $term)
                    ->orWhere('subject', 'ilike', $term)
                    ->orWhereHas('user', fn ($u) => $u->where('email', 'ilike', $term)));
            })
            // Tickets waiting on FDB come first, oldest activity first.
            ->orderByRaw("CASE WHEN status = 'open' THEN 0 ELSE 1 END")
            ->orderBy('last_activity_at')
            ->orderBy('id')
            ->paginate(25)
            ->withQueryString();

        return TicketResource::collection($tickets);
    }

    public function show(string $number): TicketResource
    {
        Gate::authorize('permission', PermissionSlug::SupportManage);

        return new TicketResource($this->ticket($number)->load(self::DETAIL));
    }

    public function reply(Request $request, string $number): TicketResource
    {
        Gate::authorize('permission', PermissionSlug::SupportManage);

        $data = $request->validate(['body' => ['required', 'string', 'min:2', 'max:4000']]);
        $ticket = $this->support->reply($this->ticket($number), $request->user(), AuthorRole::Staff, trim($data['body']));

        return new TicketResource($ticket->load(self::DETAIL));
    }

    public function status(Request $request, string $number): TicketResource
    {
        Gate::authorize('permission', PermissionSlug::SupportManage);

        $data = $request->validate([
            'status' => ['required', Rule::enum(TicketStatus::class)],
            'resolution' => ['nullable', 'string', 'min:5', 'max:2000'],
        ]);

        $resolution = isset($data['resolution']) ? trim($data['resolution']) : null;
        $ticket = $this->support->setStatus($this->ticket($number), TicketStatus::from($data['status']), $resolution ?: null, $request->user());

        return new TicketResource($ticket->load(self::DETAIL));
    }

    private function ticket(string $number): SupportTicket
    {
        return SupportTicket::query()->where('number', $number)->firstOrFail();
    }
}
