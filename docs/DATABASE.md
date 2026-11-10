# Database

PostgreSQL 18. The schema is managed only through migrations in `backend/database/migrations`. Timestamps are stored in UTC.

## Conventions

- Status columns are `varchar` with a `CHECK` constraint, mirrored by PHP enums in `app/Domain/*`.
- Case-insensitive uniqueness uses an index on `lower(column)` (user emails, store names).
- Append-only history tables have `created_at` only.
- Money will use `numeric` columns once orders and commissions exist. Never `float`.

## Tables

### Identity

| Table | Purpose | Notes |
| --- | --- | --- |
| `users` | Accounts | `status` is `active` or `suspended`. Email is unique ignoring case |
| `roles`, `permissions` | Access control definitions | Seeded by `RolesAndPermissionsSeeder`, which is safe to rerun |
| `role_user`, `permission_role` | Assignments | Composite primary keys |
| `sessions`, `password_reset_tokens` | Laravel defaults | Sessions are stored in Redis; the table is unused unless `SESSION_DRIVER=database` |

### Sellers

| Table | Purpose | Notes |
| --- | --- | --- |
| `sellers` | One application or store per user (`user_id` is unique) | `status`: pending, approved, rejected, suspended. Store names are unique ignoring case |
| `seller_status_histories` | Every status change, with the person who made it and the reason | Append-only |
| `seller_documents` | Metadata for verification files | Files live on the private `seller_documents` disk under random UUID names. The table stores the SHA-256 hash, the MIME type detected from the file content, and a cleaned version of the original name |

Allowed seller status changes:

```
pending ──approve──► approved ──suspend──► suspended
   │                    ▲                      │
 reject                 └──────reactivate──────┘
   ▼
rejected ──resubmit──► pending
```

Each change is made inside a transaction that locks the seller row. The caller must state the status it expects to change from, so stale or repeated requests fail with 409.

### Audit and notifications

| Table | Purpose | Notes |
| --- | --- | --- |
| `audit_logs` | Administrative and sensitive actions | A database trigger blocks `UPDATE` and `DELETE`. The `context` column (jsonb) must never contain secrets |
| `notifications` | In-app notifications | Laravel database channel |

## Seeding

```sh
docker compose exec app php artisan db:seed      # roles and permissions only; no demo users
```

Run the seeder on every deploy after migrations.
