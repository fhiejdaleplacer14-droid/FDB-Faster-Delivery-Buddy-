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

## Product photos

- Every photo is decoded and re-encoded to WEBP. This removes EXIF and GPS data (phone photos often contain the seller's home location) and anything embedded in the file.
- The pixel count is checked before decoding (40 megapixels at most) to stop decompression bombs. The long side is reduced to 1600 px.
- Photos are stored under UUID names and served with `nosniff`.

## Seller isolation in the catalog

- Seller listing endpoints look products up through the signed-in seller's own listings, so another seller's ID returns 404, not 403.
- `seller_id`, `status`, and `price_from` are never accepted from input.
- Suspended sellers cannot change listings, and their listings disappear from public results immediately.

## Orders and checkout

- Prices, totals, sellers, and statuses are never taken from the client. The server recalculates everything with exact decimal arithmetic.
- Duplicate checkouts are prevented by a required `Idempotency-Key`, a unique database constraint, and a per-customer row lock. Concurrent duplicates all receive the same order; this was verified on the live stack.
- Overselling is prevented by locking variant rows during checkout, a conditional stock update, and a CHECK constraint (`stock >= 0`). A live race of two buyers for the last unit produced one order and one 409.
- Customers see only their own orders; sellers see only their own seller orders. Other IDs or numbers return 404.
- A delivery address is visible only to the customer and the sellers in that order. Store profiles never show seller contact details.
- Only the seller can mark payment as received, and that action is written to the audit log.

## Commissions

- Commission figures are visible only to the seller concerned and to admins with `commissions.manage` or `reports.view`. Customers never see them.
- Rates cannot be backdated, and every order keeps the rate it was placed with.
- Recording a collection locks the records it covers and refuses any that are not due or belong to another seller, so the same commission cannot be collected twice.
- Rate changes, adjustments, and collections are written to the audit log.

## Refunds

- Only the seller of that order or an admin with `refunds.manage` can record a refund; another seller's order is a 404.
- Refunds need a paid order. The seller order row is locked while recording, and a CHECK keeps `refunded_total` at or below the total. A live race of two simultaneous refunds produced one refund and one refusal.
- A support ticket can be linked only if it belongs to the same order, so ticket numbers from other orders are never confirmed.
- Customers see refunds but never their commission effect. Every refund and credit settlement is written to the audit log.

## Reviews, support, and notifications

- Only the buyer can review, only after delivery, and only once per order line; the database enforces the last rule.
- Public reviews show a first name and last initial only. Reviewer emails are visible to moderators only.
- A support ticket is visible to the customer who opened it, the seller of the linked order (order topics only), and staff with `support.manage`. Everyone else gets 404. Sellers never see the customer's email.
- A message's author role is worked out on the server from the user's relation to the ticket.
- Notification links are filtered to in-app paths, so a stored notification can never send someone to another site.
- Ticket, message, and review creation are rate limited per user.

## Audit log

- Review hiding and restoring, support ticket status changes, seller decisions, listing moderation, category changes, document views, payment confirmations, commission rate changes, adjustments, collections, and admin creation are recorded.
- The `audit_logs` table is append-only, enforced both by the model and by a PostgreSQL trigger.

## Secrets

- `.env` files are ignored by git. Frontend `VITE_*` variables are public, so never put secrets there.
- No default or seeded admin accounts exist. Create admins with `php artisan fdb:create-admin`; for automated setup, read the password from the `FDB_ADMIN_PASSWORD` environment variable.

## Browser protections

- The built SPA carries a strict content security policy (`frontend/vite.config.ts`): scripts, styles, fonts, and API calls from its own origin only, no plugins, and forms may post only to itself. The dev server skips it because hot reload needs inline scripts. Every page was checked in headless Chrome against a production build with no violations.
- A meta tag cannot set `frame-ancestors`, so the production web server must also send `Content-Security-Policy: frame-ancestors 'none'` and `Strict-Transport-Security` for the SPA. This is part of Phase 9 deployment.
- API responses get `default-src 'none'; frame-ancestors 'none'`, `X-Frame-Options: DENY`, `nosniff`, a `Permissions-Policy` that turns off camera, microphone, location, and payment, and `Cross-Origin-Opener-Policy: same-origin`. Product photos are additionally sandboxed.

## Production guard

- The app refuses to start in production with `APP_DEBUG=true`, and always marks session cookies `Secure` and `HttpOnly` and generates `https` links there.

## Dependencies

- `composer audit` and `npm audit` report no known vulnerabilities. The frontend pins `minimatch` to `^11.0.1` through `overrides` because ESLint's own version had a denial-of-service advisory; remove the override once ESLint ships the fix.

## Known gaps

- No virus scanning of uploads.
- Error monitoring (Sentry) is not connected.
- No account deletion or data export workflow yet (Data Privacy Act review is pending).
