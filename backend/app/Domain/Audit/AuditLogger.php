<?php

namespace App\Domain\Audit;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;

class AuditLogger
{
    public function __construct(private readonly Request $request) {}

    /** @param array<string, mixed> $context Never include passwords, tokens, or document contents. */
    public function record(string $action, ?User $actor, ?Model $subject = null, array $context = [], string $outcome = 'success'): AuditLog
    {
        return AuditLog::create([
            'actor_id' => $actor?->id,
            'action' => $action,
            'subject_type' => $subject?->getMorphClass(),
            'subject_id' => $subject?->getKey(),
            'outcome' => $outcome,
            'context' => $context,
            'ip_address' => $this->request->ip(),
        ]);
    }
}
