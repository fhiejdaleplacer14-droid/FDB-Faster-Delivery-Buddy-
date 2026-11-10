<?php

namespace App\Console\Commands;

use App\Domain\Audit\AuditLogger;
use App\Domain\Identity\RoleSlug;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

use function Laravel\Prompts\password;
use function Laravel\Prompts\text;

class CreateAdmin extends Command
{
    // The password is read from FDB_ADMIN_PASSWORD when set, so it never appears in shell history or process lists.
    protected $signature = 'fdb:create-admin {--name= : Full name} {--email= : Email address}';

    protected $description = 'Create an FDB administrator account';

    public function handle(AuditLogger $audit): int
    {
        $envPassword = getenv('FDB_ADMIN_PASSWORD') ?: null;

        $data = [
            'name' => $this->option('name') ?? text('Full name', required: true),
            'email' => mb_strtolower(trim($this->option('email') ?? text('Email', required: true))),
            'password' => $envPassword ?? password('Password (min. 10 characters, letters and numbers)', required: true),
        ];
        $data['password_confirmation'] = $envPassword ?? password('Confirm password', required: true);

        $validator = Validator::make($data, [
            'name' => ['required', 'string', 'max:100'],
            'email' => ['required', 'email:rfc,strict', 'max:255', Rule::unique('users', 'email')],
            'password' => ['required', 'confirmed', Password::defaults()],
        ]);

        if ($validator->fails()) {
            foreach ($validator->errors()->all() as $error) {
                $this->error($error);
            }

            return self::FAILURE;
        }

        $user = DB::transaction(function () use ($validator, $audit) {
            $user = User::create($validator->safe()->only('name', 'email', 'password'));
            $user->forceFill(['email_verified_at' => now()])->save();
            $user->assignRole(RoleSlug::Admin);
            $audit->record('admin.created', null, $user, ['via' => 'console']);

            return $user;
        });

        $this->info("Administrator {$user->email} created.");

        return self::SUCCESS;
    }
}
