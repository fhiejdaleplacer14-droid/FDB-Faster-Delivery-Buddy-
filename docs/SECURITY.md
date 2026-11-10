# Security

This file describes the controls that exist in the code today. It is not a compliance statement.

## Authentication

- Sanctum cookie sessions on a single origin. Sessions are encrypted and stored in Redis, and CSRF protection uses the `XSRF-TOKEN` cookie.
- The session is regenerated on sign-in and invalidated on sign-out.
- After 5 failed sign-ins per email and IP address, sign-in is locked for 60 seconds. A wrong password and an unknown email return the same error.
- Password reset gives the same response for known and unknown emails. It is rate limited per IP and per email, and the reset token expires after 60 minutes.
- Email verification links are signed relative URLs that expire after 60 minutes. A link stops working if the account's email changes.
- Passwords need at least 10 characters with letters and numbers. In production they are also checked against known breached passwords.
- Changing a password signs out the account's other sessions.
- Suspended accounts cannot sign in, and an existing session is ended on its next request.

## Authorisation

- Permissions are checked in Laravel policies on the server. The SPA only hides buttons.
- Roles are never accepted from client input. Registration always assigns `customer`, and the `seller` role is granted only when an admin approves an application.
- Admins cannot review their own seller application.
- Seller documents are reached only through their seller (scoped route binding), so a mismatched ID returns 404.
- Tests attempt cross-seller access, role escalation, and status tampering: `tests/Feature/Sellers/SellerIsolationTest.php`, `RegistrationTest.php`, and `SellerApplicationTest.php`.

## Uploads

- Accepted types are JPG, PNG, WEBP, and PDF, up to 5 MB each. The type is detected from the file's content (`finfo`), not its extension or the browser's claim.
- Files are stored under random UUID names on a private disk that is never served directly.
- Downloads are attachments with `nosniff` and `no-store`, require the `sellers.documents.view` permission, and are written to the audit log.

## Audit log

- Seller decisions, document views, and admin creation are recorded.
- The `audit_logs` table is append-only, enforced both by the model and by a PostgreSQL trigger.

## Secrets

- `.env` files are ignored by git. Frontend `VITE_*` variables are public, so never put secrets there.
- No default or seeded admin accounts exist. Create admins with `php artisan fdb:create-admin`; for automated setup, read the password from the `FDB_ADMIN_PASSWORD` environment variable.

## Known gaps, planned for Phase 8

- No content security policy yet.
- No virus scanning of uploads.
- Error monitoring (Sentry) is not connected.
- No account deletion or data export workflow yet (Data Privacy Act review is pending).
