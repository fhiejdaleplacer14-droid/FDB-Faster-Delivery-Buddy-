<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Http\Response;

class NotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $page = $request->user()->notifications()->latest()->paginate(min((int) $request->query('per_page', 20), 50));

        return response()->json([
            'data' => collect($page->items())->map(fn (DatabaseNotification $n) => [
                'id' => $n->id,
                'kind' => $n->data['kind'] ?? null,
                'title' => $n->data['title'] ?? 'Update',
                'body' => $n->data['body'] ?? null,
                'url' => $this->safeUrl($n->data['url'] ?? null),
                'read' => $n->read_at !== null,
                'created_at' => $n->created_at->toIso8601ZuluString(),
            ]),
            'meta' => [
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
                'unread' => $request->user()->unreadNotifications()->count(),
            ],
        ]);
    }

    public function read(Request $request, string $id): Response
    {
        $request->user()->notifications()->whereKey($id)->firstOrFail()->markAsRead();

        return response()->noContent();
    }

    public function readAll(Request $request): Response
    {
        $request->user()->unreadNotifications()->update(['read_at' => now()]);

        return response()->noContent();
    }

    // Links are always paths inside the app, never somewhere else.
    private function safeUrl(mixed $url): ?string
    {
        return is_string($url) && str_starts_with($url, '/') && ! str_starts_with($url, '//') ? $url : null;
    }
}
