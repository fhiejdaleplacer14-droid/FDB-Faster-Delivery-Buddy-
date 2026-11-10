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

## Addresses, cart, and checkout

All require a session. Another customer's address or cart line returns 404.

| Method | Path | Notes |
| --- | --- | --- |
| GET · POST | `/addresses` | `recipient_name, phone, municipality, barangay, street, landmark?, label?, is_default?`. Up to 10 per customer. The first address becomes the default |
| PUT · DELETE | `/addresses/{id}` | Deleting the default promotes another address |
| GET | `/cart` | Lines grouped by store, with current prices, `problem` (unavailable, own_store, out_of_stock, not_enough_stock), `total`, and `can_checkout`. `meta.payment_methods` lists the methods customers may choose |
| POST | `/cart/items` | `variant_id, quantity`. Merges with an existing line. Refuses unavailable products, more than the stock, or the customer's own store |
| PATCH · DELETE | `/cart/items/{id}` | |
| POST | `/checkout` | Header `Idempotency-Key: <uuid>` (required). Body `address_id, payment_method, expected_total, note?`. Requires a verified email; 10 per minute |

Checkout responses:

| Status | Meaning |
| --- | --- |
| 201 | Order created. The cart is emptied and stock is reduced |
| 200 | This key was already used: the original order is returned and nothing new happens |
| 409 `reason: cart_changed` | An item sold out, was removed, or its store closed. Nothing was created |
| 409 `reason: price_changed` | `expected_total` no longer matches; the response includes the new `total`. Nothing was created |
| 422 `reason: empty_cart` | |

The client sends `expected_total` only as a safeguard. The server always calculates every amount itself.

## Orders (customer)

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/orders` | The customer's own orders, newest first |
| GET | `/orders/{number}` | Another customer's order number returns 404 |
| POST | `/orders/{number}/seller-orders/{sellerOrderNumber}/cancel` | `reason?`. Only while the seller has not confirmed. Stock is returned |

## Seller orders

Require an approved or suspended store (suspended stores can still complete orders already placed). Another seller's order returns 404.

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/seller/orders?status&search&page` | `status` may be `open`. Orders waiting for a decision come first |
| GET | `/seller/orders/{id}` | Includes the delivery address and the customer's name |
| POST | `/seller/orders/{id}/status` | `status, note?`. Forward only; steps may be skipped |
| POST | `/seller/orders/{id}/cancel` | `reason` required. Allowed until the order is out for delivery. Stock is returned |
| POST | `/seller/orders/{id}/payment-received` | Records that the seller collected payment. Once only; written to the audit log |
| PUT | `/seller/orders/{id}/delivery` | `delivery_note`, shown to the customer |
| GET | `/seller/commissions?status&page` | The seller's own commission records, plus `summary` totals for pending, due, and collected |

Seller order responses include `commission { rate, amount, seller_amount }` on seller and admin routes only. Customers never see commission.

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/seller/reviews?unanswered&page` | Reviews of the seller's products, including hidden ones |
| POST | `/seller/reviews/{id}/reply` | `reply` (2–1000). Replaces any earlier reply |
| GET | `/seller/support-tickets?status&page` | Requests linked to the seller's orders (order problems, delivery, disputes). Threads open through `/support/tickets/{number}` |

## Reviews, notifications, and support

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/products/{slug}/reviews?page` | Public. Published reviews only, 10 per page, plus `summary { average, count }`. Reviewers appear as first name and last initial |
| POST | `/orders/{number}/items/{itemId}/review` | `rating` (1–5), `comment?` (≤1000). Only the buyer, only after that seller order is delivered, once per order line. 30 per hour |
| GET | `/notifications?page&per_page` | The user's own notifications, newest first, with `meta.unread`. `url` is always an in-app path or null |
| POST | `/notifications/{id}/read` | Marks one notification read. Someone else's ID is a 404 |
| POST | `/notifications/read-all` | Marks every notification read |
| GET | `/support/categories` | Public. Topics with `needs_order` and `can_link_order`, plus `dispute_window_days` |
| GET | `/support/tickets?page` | The customer's own requests |
| POST | `/support/tickets` | `category, subject, body, seller_order_number?`. The order must be the customer's own. Disputes need a delivered order inside the dispute window, and only one open dispute per order. 10 per hour |
| GET | `/support/tickets/{number}` | For the customer who opened it, or the seller of the linked order (order topics only). Anyone else gets 404 |
| POST | `/support/tickets/{number}/messages` | `body` (2–4000). The author's role comes from how they relate to the ticket, never from the request. Closed tickets refuse replies. 60 per hour |

Staff replies are shown to customers and sellers as "FDB Support".

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
| GET | `/admin/orders?status&search&page` | `orders.view` | Read-only. Search by order number or customer email |
| GET | `/admin/orders/{number}` | `orders.view` | Includes status history with the people who made each change |
| GET | `/admin/commission-policies` | `commissions.manage` | Rate history: the default and any per-seller rates |
| POST | `/admin/commission-policies` | `commissions.manage` | `rate_percent` (0–50, up to 2 decimals), `seller_id?`, `notes?`. Starts now and ends the current rate for the same scope. Never backdated |
| GET | `/admin/commissions?status&seller_id&page&per_page` | `commissions.manage` | Commission records with adjustments and collection |
| GET | `/admin/commissions/balances` | `commissions.manage` | Due amount per seller |
| POST | `/admin/commissions/{id}/adjustments` | `commissions.manage` | `amount` (signed, non-zero), `reason`. Pending or due records only; the net can never go below zero |
| GET · POST | `/admin/commission-collections` | `commissions.manage` | POST `seller_id, record_ids[], method, reference?, notes?, collected_at?`. Every record must be due and belong to that seller; recording the same records twice is refused |
| GET | `/admin/reviews?status&rating&search&page` | `reviews.moderate` | Includes the reviewer's email and the store |
| POST | `/admin/reviews/{id}/hide` | `reviews.moderate` | `reason` required. Removes it from the product page and the rating; written to the audit log |
| POST | `/admin/reviews/{id}/restore` | `reviews.moderate` | Publishes it again |
| GET | `/admin/support-tickets?status&category&search&page` | `support.manage` | `status=active` means open or waiting on the user. Open requests come first, oldest activity first |
| GET | `/admin/support-tickets/{number}` | `support.manage` | Staff see which team member wrote each reply |
| POST | `/admin/support-tickets/{number}/messages` | `support.manage` | Replies as staff and sets the status to waiting on the user |
| POST | `/admin/support-tickets/{number}/status` | `support.manage` | `status, resolution?`. Resolving a dispute requires a resolution. Written to the audit log. No money is moved automatically |
| GET | `/admin/reports/financial?from&to` | `reports.view` | Calendar dates in Philippine time, up to one year. GMV, FDB revenue (commission earned), seller earnings, collections, adjustments, balances, and a per-seller breakdown |
| GET | `/admin/products?status&search&page` | `products.moderate` | Oldest submission first |
| GET | `/admin/products/{id}` | `products.moderate` | |
| POST | `/admin/products/{id}/approve` | `products.moderate` | Pending → published |
| POST | `/admin/products/{id}/reject` | `products.moderate` | Pending or published → rejected. Requires `reason` |
| GET · POST | `/admin/categories` | `categories.manage` | `name, parent_id?, position?, is_active?`. Two levels only |
| PATCH · DELETE | `/admin/categories/{id}` | `categories.manage` | Delete returns 409 if the category has subcategories or listings; turn it off instead |

Admins cannot review or manage their own seller application.
