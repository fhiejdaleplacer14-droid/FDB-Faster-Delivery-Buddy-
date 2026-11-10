<?php

use App\Models\AuditLog;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

it('blocks changes through the model', function () {
    $log = AuditLog::create(['action' => 'test.created', 'context' => []]);

    expect(fn () => $log->update(['action' => 'tampered']))->toThrow(LogicException::class)
        ->and(fn () => $log->delete())->toThrow(LogicException::class);
});

it('blocks changes made directly in the database', function () {
    $log = AuditLog::create(['action' => 'test.created', 'context' => []]);

    expect(fn () => DB::table('audit_logs')->where('id', $log->id)->update(['action' => 'tampered']))
        ->toThrow(QueryException::class, 'append-only');
});
