# API

Base path: `/api/v1`. All responses are JSON. The SPA authenticates with Sanctum session cookies: call `GET /sanctum/csrf-cookie` once, then send the `X-XSRF-TOKEN` header on every write request. Axios does this automatically (`frontend/src/lib/http.ts`).

## Errors

| Status | Meaning | Body |
| --- | --- | --- |
| 401 | Not signed in | `{ message }` |
| 403 | Signed in but not allowed: missing permission, unverified email, suspended account, or no approved store | `{ message }` |
| 404 | Not found, not public, or belonging to another seller | `{ message }` |
| 409 | The action does not fit the current state (for example, approving twice) | `{ message }` |
| 419 | CSRF token expired. Fetch the cookie again and retry | `{ message }` |
| 422 | Validation failed | `{ message, errors: { field: [..] } }` |
| 429 | Rate limit reached | `{ message }` |

## Health

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/health` | none | 200 `{status:"ok"}` or 503 `{status:"degraded"}` with a per-check result |

## Catalog (public)

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/categories` | Active category tree (two levels). Cached for 10 minutes and cleared when an admin changes a category |
| GET | `/products?search&category&store&municipality&min_price&max_price&in_stock&sort&page&per_page` | Only published listings from approved sellers with active accounts, in active categories. `sort`: relevance, newest, price_asc, price_desc. 24 per page by default (maximum 48). Search tolerates small typos |
| GET | `/products/{slug}` | 404 unless the listing is public |
| GET | `/stores/{slug}` | Public store profile: name, description, town, barangay. Never includes contact details or the street address |

Prices are decimal strings such as `"120.50"`. Never parse them as floats for calculations.

## Authentication

| Method | Path | Auth | Limits | Notes |
| --- | --- | --- | --- | --- |
| POST | `/auth/register` | none | 10 per hour per IP | `name, email, password, password_confirmation`. Creates a customer account, signs it in, and emails a verification link |
| POST | `/auth/login` | none | 5 failures per minute per email and IP | `email, password, remember?`. Suspended accounts get 403 |
| POST | `/auth/logout` | session | | Ends the session |
| POST | `/auth/forgot-password` | none | 5 per minute per IP, 10 per hour per email | Same response whether or not the account exists |
| POST | `/auth/reset-password` | none | same | `token, email, password, password_confirmation` |
| GET | `/auth/verify-email/{id}/{hash}?expires&signature` | signed link | 6 per minute | Works without a session. The emailed link opens the SPA, which calls this |
| POST | `/auth/verify-email/resend` | session | 6 per minute | |

## Current user

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/user` | Profile with `roles`, `permissions`, and a `seller` summary. Use for display only; the API enforces every permission |
| PATCH | `/user` | `name, email`. Changing the email clears verification and sends a new link |
| PUT | `/user/password` | `current_password, password, password_confirmation`. Signs out the user's other sessions |

## Seller application (applicant)

All require a session. Submitting also requires a verified email, and uploads are limited to 20 per hour.

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/seller-application` | The signed-in user's own application, or 404 |
| POST | `/seller-application` | Multipart form. Store details plus `documents[n][type]` and `documents[n][file]` (JPG, PNG, WEBP, or PDF; 5 MB maximum; checked by file content, not extension). 409 if the user has already applied |
| POST | `/seller-application/resubmit` | Only when the status is `rejected`. Earlier documents are kept |

## Seller listings

All require an approved seller account. Suspended sellers can use the read endpoints but get 403 on everything else. A product belonging to another seller returns 404.

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/seller/products?status&search&page` | The signed-in seller's own listings |
| POST | `/seller/products` | `category_id, name, description, variants[{name, sku?, price, stock}]`. Created as a draft |
| GET | `/seller/products/{id}` | |
| PUT | `/seller/products/{id}` | Full replacement of details and options. Send the `id` of each option you keep; options left out are soft-deleted. On a live listing, changing the name, description, or category sends it back for review |
| POST | `/seller/products/{id}/submit` | From draft or rejected. Needs at least one photo. Goes to review, or straight to published when review is turned off |
| POST | `/seller/products/{id}/archive` · `/restore` | Restore returns the listing to draft |
| POST | `/seller/products/{id}/images` | Multipart `image`. JPG, PNG, or WEBP, up to 8 MB and 40 megapixels. Re-encoded to WEBP (long side at most 1600 px), rotated upright, metadata removed. Up to 8 photos; 120 uploads per hour |
| PUT | `/seller/products/{id}/images/order` | `image_ids`: every photo, exactly once, in the new order |
| DELETE | `/seller/products/{id}/images/{imageId}` | A live listing must keep at least one photo |

## Administration

Each endpoint checks a permission, not a role name.

| Method | Path | Permission | Notes |
| --- | --- | --- | --- |
| GET | `/admin/sellers?status&search&per_page&page` | `sellers.review` | Paginated, 20 per page by default (maximum 50) |
| GET | `/admin/sellers/{id}` | `sellers.review` (or the owner) | Includes applicant, documents, and history with actors |
| POST | `/admin/sellers/{id}/approve` | `sellers.review` | Pending → approved. Grants the `seller` role |
| POST | `/admin/sellers/{id}/reject` | `sellers.review` | Requires `reason` |
| POST | `/admin/sellers/{id}/suspend` | `sellers.manage` | Approved → suspended. Requires `reason` |
| POST | `/admin/sellers/{id}/reactivate` | `sellers.manage` | Suspended → approved |
| GET | `/admin/sellers/{id}/documents/{doc}` | `sellers.documents.view` | Private download. Every access is written to the audit log |
| GET | `/admin/products?status&search&page` | `products.moderate` | Oldest submission first |
| GET | `/admin/products/{id}` | `products.moderate` | |
| POST | `/admin/products/{id}/approve` | `products.moderate` | Pending → published |
| POST | `/admin/products/{id}/reject` | `products.moderate` | Pending or published → rejected. Requires `reason` |
| GET · POST | `/admin/categories` | `categories.manage` | `name, parent_id?, position?, is_active?`. Two levels only |
| PATCH · DELETE | `/admin/categories/{id}` | `categories.manage` | Delete returns 409 if the category has subcategories or listings; turn it off instead |

Admins cannot review or manage their own seller application.
