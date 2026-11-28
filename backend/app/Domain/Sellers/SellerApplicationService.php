<?php

namespace App\Domain\Sellers;

use App\Domain\Audit\AuditLogger;
use App\Domain\Identity\RoleSlug;
use App\Models\Seller;
use App\Models\User;
use App\Notifications\SellerStatusChanged;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Throwable;

class SellerApplicationService
{
    public function __construct(private readonly AuditLogger $audit) {}

    /**
     * @param  array<string, mixed>  $details
     * @param  list<array{type: SellerDocumentType, file: UploadedFile}>  $documents
     */
    public function submit(User $user, array $details, array $documents): Seller
    {
        return $this->withStoredDocuments($documents, $user, function (array $stored) use ($user, $details) {
            $seller = new Seller($details);
            $seller->user_id = $user->id;
            $seller->slug = $this->uniqueSlug($details['store_name']);
            $seller->status = SellerStatus::Pending;
            $seller->submitted_at = now();
            $seller->save();

            $seller->documents()->createMany($stored);
            $this->recordHistory($seller, null, SellerStatus::Pending, $user, null);

            return $seller;
        });
    }

    /**
     * @param  array<string, mixed>  $details
     * @param  list<array{type: SellerDocumentType, file: UploadedFile}>  $documents
     */
    public function resubmit(Seller $seller, User $user, array $details, array $documents): Seller
    {
        return $this->withStoredDocuments($documents, $user, function (array $stored) use ($seller, $user, $details) {
            $seller = Seller::query()->lockForUpdate()->findOrFail($seller->id);

            if (! $seller->status->canTransitionTo(SellerStatus::Pending)) {
                throw InvalidSellerTransition::between($seller->status, SellerStatus::Pending);
            }

            $from = $seller->status;
            $seller->fill($details);
            if ($seller->isDirty('store_name')) {
                $seller->slug = $this->uniqueSlug($details['store_name'], $seller->id);
            }
            $seller->status = SellerStatus::Pending;
            $seller->submitted_at = now();
            $seller->reviewed_by = null;
            $seller->reviewed_at = null;
            $seller->decision_reason = null;
            $seller->save();

            $seller->documents()->createMany($stored);
            $this->recordHistory($seller, $from, SellerStatus::Pending, $user, null);

            return $seller;
        });
    }

    // $expectedFrom guards against acting on a stale view, e.g. a double-clicked approve.
    public function transition(Seller $seller, SellerStatus $expectedFrom, SellerStatus $to, User $actor, ?string $reason = null): Seller
    {
        return DB::transaction(function () use ($seller, $expectedFrom, $to, $actor, $reason) {
            $seller = Seller::query()->lockForUpdate()->findOrFail($seller->id);
            $from = $seller->status;

            if ($from !== $expectedFrom || ! $from->canTransitionTo($to)) {
                throw InvalidSellerTransition::between($from, $to);
            }

            $seller->status = $to;
            $seller->decision_reason = $reason;

            if ($from === SellerStatus::Pending) {
                $seller->reviewed_by = $actor->id;
                $seller->reviewed_at = now();
            }
            if ($to === SellerStatus::Approved) {
                $seller->approved_at ??= now();
                $seller->suspended_at = null;
            }
            if ($to === SellerStatus::Suspended) {
                $seller->suspended_at = now();
            }
            $seller->save();

            $owner = User::query()->findOrFail($seller->user_id);
            if ($to === SellerStatus::Approved) {
                $owner->assignRole(RoleSlug::Seller);
            }

            $this->recordHistory($seller, $from, $to, $actor, $reason);
            $this->audit->record('seller.'.$this->actionName($from, $to), $actor, $seller, array_filter([
                'from' => $from->value,
                'to' => $to->value,
                'reason' => $reason,
            ]));

            $owner->notify(new SellerStatusChanged($seller, $from, $to, $reason));

            return $seller;
        });
    }

    /**
     * Stores files first; deletes them if the transaction fails.
     *
     * @param  list<array{type: SellerDocumentType, file: UploadedFile}>  $documents
     * @param  callable(list<array<string, mixed>>): Seller  $callback
     */
    private function withStoredDocuments(array $documents, User $uploader, callable $callback): Seller
    {
        $disk = config('fdb.sellers.documents_disk');
        $stored = array_map(fn (array $doc) => $this->storeDocument($disk, $doc['type'], $doc['file'], $uploader), $documents);

        try {
            return DB::transaction(fn () => $callback($stored));
        } catch (Throwable $e) {
            Storage::disk($disk)->delete(array_column($stored, 'path'));

            throw $e;
        }
    }

    /** @return array<string, mixed> */
    private function storeDocument(string $disk, SellerDocumentType $type, UploadedFile $file, User $uploader): array
    {
        $extension = $file->guessExtension() ?? 'bin';
        $path = $file->storeAs('documents/'.now()->format('Y/m'), Str::uuid7().'.'.$extension, $disk);

        return [
            'type' => $type,
            'disk' => $disk,
            'path' => $path,
            'original_name' => $this->safeName($file->getClientOriginalName(), $extension),
            'mime_type' => $file->getMimeType(),
            'size_bytes' => $file->getSize(),
            'sha256' => hash_file('sha256', $file->getRealPath()),
            'uploaded_by' => $uploader->id,
        ];
    }

    private function safeName(string $name, string $extension): string
    {
        $base = Str::of(pathinfo($name, PATHINFO_FILENAME))
            ->ascii()
            ->replaceMatches('/[^A-Za-z0-9 ._-]/', '')
            ->trim()
            ->limit(120, '');

        return ($base->isEmpty() ? 'document' : (string) $base).'.'.$extension;
    }

    private function uniqueSlug(string $storeName, ?int $ignoreId = null): string
    {
        $base = Str::slug($storeName) ?: 'store';
        $slug = $base;

        while (Seller::query()->where('slug', $slug)->when($ignoreId, fn ($q) => $q->whereKeyNot($ignoreId))->exists()) {
            $slug = $base.'-'.Str::lower(Str::random(4));
        }

        return $slug;
    }

    private function recordHistory(Seller $seller, ?SellerStatus $from, SellerStatus $to, User $actor, ?string $reason): void
    {
        $seller->statusHistory()->create([
            'from_status' => $from,
            'to_status' => $to,
            'actor_id' => $actor->id,
            'reason' => $reason,
        ]);
    }

    private function actionName(SellerStatus $from, SellerStatus $to): string
    {
        return match ($to) {
            SellerStatus::Approved => $from === SellerStatus::Suspended ? 'reactivated' : 'approved',
            SellerStatus::Rejected => 'rejected',
            SellerStatus::Suspended => 'suspended',
            SellerStatus::Pending => 'resubmitted',
        };
    }
}
