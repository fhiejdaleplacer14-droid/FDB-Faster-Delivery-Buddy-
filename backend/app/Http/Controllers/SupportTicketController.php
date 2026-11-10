<?php

namespace App\Http\Controllers;

use App\Domain\Support\AuthorRole;
use App\Domain\Support\SupportService;
use App\Domain\Support\TicketCategory;
use App\Http\Resources\TicketResource;
use App\Models\SellerOrder;
use App\Models\SupportTicket;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

// Shared by customers and the seller of a linked order; access is decided per ticket.
class SupportTicketController extends Controller
{
    private const DETAIL = ['sellerOrder', 'seller', 'user', 'messages.author'];

    public function __construct(private readonly SupportService $support) {}

    public function categories(): JsonResponse
    {
        return response()->json([
            'data' => collect(TicketCategory::cases())->map(fn (TicketCategory $c) => [
                'value' => $c->value,
                'label' => $c->label(),
                'needs_order' => $c === TicketCategory::Dispute,
                'can_link_order' => $c->involvesSeller(),
            ])->all(),
            'dispute_window_days' => (int) config('fdb.support.dispute_window_days'),
        ]);
    }

    public function index(Request $request): AnonymousResourceCollection
    {
        $tickets = SupportTicket::query()
            ->where('user_id', $request->user()->id)
            ->with(['sellerOrder', 'seller'])
            ->orderByDesc('last_activity_at')
            ->orderByDesc('id')
            ->paginate(20);

        return TicketResource::collection($tickets);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'category' => ['required', Rule::enum(TicketCategory::class)],
            'subject' => ['required', 'string', 'min:4', 'max:150'],
            'body' => ['required', 'string', 'min:10', 'max:4000'],
            'seller_order_number' => ['nullable', 'string', 'max:40'],
        ]);
        $category = TicketCategory::from($data['category']);

        $sellerOrder = null;
        if ($category->involvesSeller() && ! empty($data['seller_order_number'])) {
            // Only the customer's own orders can be linked.
            $sellerOrder = SellerOrder::query()
                ->where('number', $data['seller_order_number'])
                ->whereHas('order', fn ($q) => $q->where('user_id', $request->user()->id))
                ->first();

            if (! $sellerOrder) {
                throw ValidationException::withMessages(['seller_order_number' => 'We could not find that order on your account.']);
            }
        }

        $ticket = $this->support->open($request->user(), $category, trim($data['subject']), trim($data['body']), $sellerOrder);

        return (new TicketResource($ticket->load(self::DETAIL)))->response()->setStatusCode(201);
    }

    public function show(Request $request, string $number): TicketResource
    {
        return new TicketResource($this->accessible($request, $number)->load(self::DETAIL));
    }

    public function reply(Request $request, string $number): TicketResource
    {
        $data = $request->validate(['body' => ['required', 'string', 'min:2', 'max:4000']]);
        $ticket = $this->accessible($request, $number);

        $ticket = $this->support->reply($ticket, $request->user(), $this->support->roleFor($ticket, $request->user()), trim($data['body']));

        return new TicketResource($ticket->load(self::DETAIL));
    }

    // Staff use the admin routes; here only the customer and the linked seller get in.
    private function accessible(Request $request, string $number): SupportTicket
    {
        $ticket = SupportTicket::query()->where('number', $number)->firstOrFail();
        $role = $this->support->roleFor($ticket, $request->user());

        abort_if($role === null || $role === AuthorRole::Staff, 404);

        return $ticket;
    }
}
