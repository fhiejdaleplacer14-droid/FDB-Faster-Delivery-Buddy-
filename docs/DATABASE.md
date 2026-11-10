# Database

PostgreSQL 18. The schema is managed only through migrations in `backend/database/migrations`. Timestamps are stored in UTC.

## Conventions

- Status columns are `varchar` with a `CHECK` constraint, mirrored by PHP enums in `app/Domain/*`.
- Case-insensitive uniqueness uses an index on `lower(column)` (user emails, store names).
- Append-only history tables have `created_at` only.
- Money uses `numeric(12,2)` columns and is passed around as decimal strings. Never `float`.

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

### Catalog

| Table | Purpose | Notes |
| --- | --- | --- |
| `categories` | Two-level category tree | `is_active=false` hides the category's listings. Deleting is blocked while it has listings or subcategories |
| `products` | A seller's listing | `status`: draft, pending_review, published, rejected, archived. `price_from` and `stock_total` are cached from the variants for browsing. Soft-deleted. Trigram index on `name` |
| `product_variants` | Price and stock options (every product has at least one) | `numeric(12,2)` price above 0, stock 0 or more (CHECK constraints). Soft-deleted so past orders can still refer to them. Option names are unique per product, ignoring case |
| `product_images` | Photo metadata | WEBP files on the `media` disk under UUID names. `position` 0 is the cover |

There is no separate shared product catalog: each listing belongs to exactly one seller, because sellers in this marketplace do not offer the same catalog item. This is a simplification of the suggested `products` plus `seller_listings` design.

Listing status changes:

```
draft ──submit──► pending_review ──approve──► published
  ▲                    │                          │
restore             reject            content edit (when review is required)
  │                    ▼                          ▼
archived ◄─archive── rejected ◄──take down── pending_review
```

### Cart and orders

| Table | Purpose | Notes |
| --- | --- | --- |
| `addresses` | Customer delivery addresses | At most one default per customer (partial unique index) |
| `cart_items` | Server-side cart | One line per variant per customer; quantity 1–99 |
| `orders` | One checkout | Unique `(user_id, idempotency_key)`. The delivery address is copied in. `grand_total = items_total + delivery_fee_total` (CHECK). `status` is derived from the seller orders: in_progress, completed, cancelled |
| `seller_orders` | One store's part of a checkout | Own status, payment status (unpaid or paid, confirmed by the seller), totals, delivery note, and cancellation details. `total = items_total + delivery_fee` (CHECK) |
| `order_items` | Snapshot of each purchased line | Product and option names, unit price, quantity, and `line_total = unit_price * quantity` (CHECK). Never changes when the product changes |
| `order_status_histories` | Every seller-order status change, with who made it and any note | Append-only |

Checkout runs in one transaction:

1. Lock the customer's user row, so their checkouts run one at a time, and return the existing order if this idempotency key was already used.
2. Lock the cart lines, then the variants in id order (a fixed order prevents deadlocks).
3. Re-check that each product is public, the store is approved, there is enough stock, and the item is not from the buyer's own store.
4. Calculate totals with bcmath and compare them with the client's `expected_total`.
5. Create the order, one seller order per store, and the item snapshots.
6. Reduce stock with `UPDATE … SET stock = stock - n WHERE stock >= n`, then empty the cart.

Seller order status:

```
pending_confirmation → confirmed → preparing → ready_for_delivery → out_for_delivery → delivered
        │                  │           │              │
        └──────────────────┴───────────┴──────────────┴──► cancelled (stock returned)
```

Sellers may skip steps forward but never go back. Customers may cancel only while the order is `pending_confirmation`.

### Commissions

| Table | Purpose | Notes |
| --- | --- | --- |
| `commission_policies` | Rate history | `seller_id` null is the default; a seller row overrides it. `rate` is a fraction such as `0.0750`, between 0 and 0.5 (CHECK). A new rate closes the previous one for the same scope by setting `effective_until` |
| `seller_orders.commission_*` | Snapshot at checkout | Policy, rate, and amount. Never changes when rates change |
| `commission_records` | One per seller order | `status`: pending, due, collected, voided. `amount + adjustment_total >= 0` (CHECK). The status is `collected` exactly when it is linked to a collection (CHECK) |
| `commission_adjustments` | Signed corrections with a reason | Non-zero (CHECK). Allowed only before collection |
| `commission_collections` | A payment a seller made to FDB | Covers one or more due records; amount is the sum of their net amounts |

How commission is worked out and tracked:

- **Base:** the seller order's product total. Delivery fees are excluded.
- **Amount:** base × rate, rounded half up to the centavo, using bcmath.
- **Status:**
  - pending at checkout
  - due when the seller order is delivered (`due_at`)
  - voided if it is cancelled before delivery
  - collected when an admin records the seller's payment
- **Report terms:**
  - **GMV** is product totals of seller orders.
  - **FDB revenue** is the net commission earned (due or collected) in the period.
  - **Seller earnings** are delivered GMV minus that commission.

Orders placed before commission recording existed have no snapshot or record, and reports treat them as zero commission.

### Reviews and support

| Table | Purpose | Notes |
| --- | --- | --- |
| `product_reviews` | One review per purchased order line | `order_item_id` is unique. `rating` CHECK 1–5. `status` is `published` or `hidden`; hidden reviews keep `hidden_reason`. Seller reply lives on the row |
| `products.rating_average`, `rating_count` | Cached rating shown on cards | Recalculated from published reviews only whenever a review is added, hidden, or restored |
| `support_tickets` | Customer requests | Number `SUP-XXXXXX`. `category` and `status` are CHECK-constrained. A dispute must link a seller order, and a partial unique index allows one open dispute per seller order |
| `support_messages` | The conversation | `author_role` is `customer`, `seller`, or `staff`. Messages are never edited |

### Audit and notifications

| Table | Purpose | Notes |
| --- | --- | --- |
| `audit_logs` | Administrative and sensitive actions | A database trigger blocks `UPDATE` and `DELETE`. The `context` column (jsonb) must never contain secrets |
| `notifications` | In-app notifications | Laravel database channel |

## Seeding

```sh
docker compose exec app php artisan db:seed                                   # roles, permissions, and the first default commission rate
docker compose exec app php artisan db:seed --class=DemoMarketplaceSeeder     # local and staging only: 6 demo stores, 24 listings
```

Run `db:seed` on every deploy after migrations. It is safe to rerun and only creates the default commission rate if none exists.

The demo seeder refuses to run in production. Its photos come from Wikimedia Commons under CC0, public domain, CC BY, or CC BY-SA licenses. Each listing's description carries the required attribution, and `database/seeders/demo-images/CREDITS.md` lists every source. To refresh the photos, run `node scripts/fetch-demo-images.mjs`. Set `DEMO_SELLER_PASSWORD` before seeding if you want to sign in as a demo seller.
