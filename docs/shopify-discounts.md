# Shopify Discount Integration

How the Dreame Membership system issues Shopify discount codes to members
and tracks redemption.

## Architecture

```
ADMIN  Admin clicks "Shopify batch" → POST /api/admin/coupons/shopify
            │
            ├─►  POST <ecom-platform>/api/shopify/discounts/generate
            │      ← codes[] + price_rule_id
            │
            └─►  INSERT N rows into `coupons` table
                   (1 row per code, linked to user_id, with apply_url)

USER   Opens /coupons → sees card with "ใช้" button → opens apply_url
            │
            └─►  Shopify checkout pre-applies the code

CRON   Every 5–15 min → POST /api/cron/sync-shopify-discounts
            │
            ├─►  Find distinct (shop_id, price_rule_id) where used_at IS NULL
            │
            └─►  For each pair: POST <ecom-platform>/api/shopify/discounts/notify
                   ↓
                   ecom-platform refreshes from Shopify + POSTs to OUR webhook

WEBHOOK  POST /api/webhooks/shopify-discount?secret=$CRON_SECRET
            │
            ├─►  Mark matching coupons.used_at = now()
            ├─►  Log COUPON_SHOPIFY_REDEEMED audit per row
            └─►  Revalidate /admin/coupons, /coupons, /admin/members/[id]
```

## Setup checklist

### 1. Database

Run migration `supabase/migrations/0012_shopify_discount_link.sql`
in Supabase SQL editor — adds these columns to `coupons`:
- `shopify_shop_id`, `shopify_price_rule_id`, `shopify_code_id`
- `apply_url`, `shopify_synced_at`

### 2. Env vars

Add to `.env.local` and Render/Vercel:

```
SHOPIFY_DISCOUNT_API_URL=https://api-center.shd-technology.co.th
SHOPIFY_DISCOUNT_API_KEY=ecom_live_...        # get at ecom-dashboard.fly.dev
SHOPIFY_DEFAULT_SHOP_ID=dreame-thailand.myshopify.com
CRON_SECRET=...                               # already used for /api/cron/*
```

### 3. Register API key at ecom-dashboard

Settings → API Keys → Create new key
- **Name:** `Dreame Membership Production`
- **Allowed shops:** `dreame-thailand.myshopify.com`
- **Webhook URL:** `https://dreame-membership.onrender.com/api/webhooks/shopify-discount?secret=YOUR_CRON_SECRET`

Copy the `ecom_live_...` key into `SHOPIFY_DISCOUNT_API_KEY`.

### 4. Schedule cron (Render)

Render Dashboard → Cron Job → New:
- **Command:** `curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://dreame-membership.onrender.com/api/cron/sync-shopify-discounts`
- **Schedule:** `*/10 * * * *`  (every 10 min)

Or use any external cron (cron-job.org, GitHub Actions, etc.).

## Admin usage

1. Go to `/admin/coupons`
2. Click **"Shopify batch"** in the header
3. Fill the form:
   - Title (visible in Shopify admin)
   - Discount type + value (e.g. 10% off)
   - Min purchase
   - Expiry date (default +90 days)
   - Code prefix (default `DREAME`)
   - **Audience:** pick tier OR segment (not both)
4. Click **"สร้าง batch"** → wait ~3–10s
5. N coupon rows created, 1 per user in audience, each with unique code + apply URL
6. Users see the new coupon at `/coupons` immediately (cache revalidated)

## User experience

The user sees a normal coupon card at `/coupons`. When the coupon is
backed by Shopify, an extra green **"ใช้"** button appears. Clicking
opens `https://<shop>/discount/<code>` — Shopify's discount-apply URL.
The code lands pre-applied at checkout.

After the user completes checkout, the cron picks up the redemption
on the next run (≤10 min) and the coupon disappears from the active
list and moves to "ใช้แล้ว".

## Operational notes

- **Idempotent webhook:** the handler only updates rows where `used_at IS NULL`,
  so re-delivery is safe.
- **Rate limit:** cron has a 200ms delay between price-rule notifications
  to avoid hammering Shopify. 50 rules × 200ms ≈ 10s.
- **Failure mode (DB insert fails after Shopify created):** the response
  surfaces `recovery.price_rule_id + codes` so admin can either re-insert
  manually or `DELETE /api/shopify/discounts/price-rules/{id}` to roll back.
- **No auto cleanup:** when a coupon row is deleted in our DB, the Shopify
  code is not removed automatically. Use `lib/shopify-discounts.ts` →
  `deletePriceRule()` if you need to wipe the whole campaign.
- **Audit trail:** every batch creation and every redemption is in
  `admin_audit_log` (`COUPON_SHOPIFY_BATCH_CREATED`, `COUPON_SHOPIFY_REDEEMED`).

## API reference (this repo)

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/admin/coupons/shopify` | session + admin | Create Shopify batch + insert coupon rows |
| `POST` | `/api/webhooks/shopify-discount` | `?secret=$CRON_SECRET` | Receive used-code notification |
| `POST` | `/api/cron/sync-shopify-discounts` | `?secret=$CRON_SECRET` | Trigger notify for all open campaigns |
