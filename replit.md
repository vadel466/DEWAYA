# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **Build**: esbuild (CJS bundle)
- **Mobile**: Expo + Expo Router (file-based routing)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   └── pharma-finder/      # Expo mobile pharmacy finder app
├── lib/                    # Shared libraries
│   └── db/                 # Drizzle ORM schema + DB connection
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Applications

### أدواي | DEWAYA — Pharmacy Finder (Expo Mobile App)

A bilingual **Arabic/French** (RTL-aware) mobile app for finding pharmacies in Mauritania. **Offline-capable** — drugs and pharmacies cached locally via AsyncStorage.

**App Name**: "أدْواَيَ" (Arabic) / "DEWAYA" (French)

**Auth & Security:**
- Admin panel: 5-second long-press on logo → PIN modal → `2026`
- Admin API secret header: `x-admin-secret: DEWAYA_ADMIN_2026`
- Pharmacy portal: **per-pharmacy** unique `portalPin` (set by admin). Sent as `x-pharmacy-pin` header on mutations. No shared/master code.
- Company portal: **per-company** unique `code` (set by admin). Sent as `x-company-code` header on mutations. No shared/master code.

**UI Design (Last Updated):**
- Home cards: 4 action cards with colored top-band design (`cardBand`), larger 48×48 icons, `justifyContent: "flex-start"`. Colors: blue (#1565C0) nearest, teal (#00796B) nursing, indigo (#283593) duty, burnt-orange (#BF360C) drug price.
- Drug-price screen layout order: topBar → offline banners → alertsBox → searchBar → results.
- All pharmacy coordinates validated (32 pharmacies, all within Mauritanian bounds).

**Features:**
- Search for medicine by name or box photo (camera + gallery)
- Submit request → notification flow with 10 MRU fee
- Locked notifications requiring payment to unlock
- Payment methods: مصرفي (20479725), بنكيلي (46576659), بيم بنك (46576659)
- Reference codes: `DW-XXXXXX` format
- **Nearest pharmacy** — GPS location + haversine distance sort
- **Duty pharmacies** — Date-selectable list by region with images
- **Pharmacy portal** (per-pharmacy PIN): 4 tabs:
  - Requests: incoming drug requests + bell alert polling
  - Répéteur: inventory/stock announcements
  - Partenaires: direct company orders (DIRECT — no admin mediation)
  - Annonces: company announcements/ads feed
- **Company portal** (per-company code): 3 tabs:
  - Orders: incoming pharmacy orders + respond
  - My Stock: manage inventory items
  - My Announcements: publish ads visible to pharmacies
- **Admin panel** (PIN `2026`): 8 sub-tabs:
  - Pending requests (with delete), Payments, Portal responses, Pharmacies (with delete), Duty schedule, Drug prices (Excel upload only + clear all + per-item delete), B2B (legacy), Companies (CRUD + subscription toggle + B2B monitoring)
  - Doctors section removed completely
  - "خدماتي" (Services) tab removed; replaced with "التمريض" tab showing all nursing requests with payment status, payment code, nurse count at request time, response status
- **Nursing care** (`find-doctor.tsx`): 50 MRU Bankily payment flow after form submission. Generates unique `DW-XXXXXX` code, shows payment modal with steps, user confirms payment ("لقد دفعت"). Delete button fixed for web (window.confirm pattern).
- Language switcher (Arabic/French, RTL support)

**Screens (tabs):**
- `app/(tabs)/index.tsx` — Home screen with search, camera, region, 4-card grid + dual portal links
- `app/(tabs)/admin.tsx` — PIN-gated admin panel (9 sub-tabs including companies)

**Full-page Screens (Stack):**
- `app/nearest-pharmacy.tsx` — GPS nearest pharmacy list
- `app/duty-pharmacies.tsx` — 7-day date picker + duty pharmacy cards
- `app/pharmacy-portal.tsx` — DV2026 portal (4 tabs: requests/repeater/partners/ads)
- `app/company-portal.tsx` — DAHA2024 portal (3 tabs: orders/inventory/announcements)
- `app/find-doctor.tsx` — Nursing/home care screen
- `app/duty-and-price.tsx` — Drug price lookup + duty pharmacies

**Context:** `context/AppContext.tsx` — Language, userId, translations (ar/fr), locked notification count, region

### API Server

Express 5 API server. All admin routes protected by `x-admin-secret: DEWAYA_ADMIN_2026`.

**Pharmacy Portal endpoints** (`/api/pharmacy-portal/*`):
- `POST /auth` — Authenticate with DV2026
- `GET /requests` — Pending drug requests
- `POST /respond` — Mark drug available
- `GET /responses` — Admin: all responses
- `GET /inventory/:pharmacyId` — Pharmacy inventory
- `POST /inventory` — Add inventory item
- `DELETE /inventory/:id` — Remove inventory item
- `GET /b2b` — Legacy B2B messages (admin)
- `PATCH /pharmacy/:id/b2b` — Toggle b2b flag (admin)
- `PATCH /pharmacy/:id/subscription` — Toggle subscription (admin)
- `POST /company-order` — Send order from pharmacy to company (DIRECT)
- `GET /company-orders/:pharmacyId` — Get pharmacy's orders history
- `GET /companies-list` — Active companies with subscription

**Company Portal endpoints** (`/api/company-portal/*`):
- `POST /auth` — Authenticate with DAHA2024 (or company-specific code)
- `GET /orders/:companyId` — Get incoming orders for company
- `GET /orders-all` — Admin: all orders
- `POST /orders/:id/respond` — Company responds to order
- `POST /inventory` — Add stock/announcement item
- `GET /inventory/:companyId` — Company's inventory
- `DELETE /inventory/:id` — Soft-delete inventory item
- `GET /inventory-search?q=` — Search all inventory
- `GET /announcements` — All ads (isAd=true) items
- `GET /companies` — Admin: all companies
- `POST /companies` — Admin: add company
- `PATCH /companies/:id` — Admin: update company/subscription
- `DELETE /companies/:id` — Admin: soft-delete company

## Database Schema

- `drug_requests` — Drug search requests
- `notifications` — Locked notifications
- `pharmacies` — Pharmacy directory (with `subscriptionActive`)
- `duty_pharmacies` — Duty schedule
- `pharmacy_responses` — Pharmacy portal responses
- `pharmacy_inventory` — Pharmacy repeater stock
- `b2b_messages` — Legacy B2B messages
- `drug_prices` — Drug price catalog
- `doctors` — Doctor directory (table kept in DB, admin UI removed)
- `companies` — Company profiles (code, subscriptionActive)
- `company_orders` — Direct pharmacy→company orders
- `company_inventory` — Company stock + announcements (isAd flag)
- `nurses` — Nurse profiles with login/auth
- `nursing_requests` — Home care requests (paymentCode DW-XXXXXX, paymentStatus, nurseCount at request time)

## Two-Portal Architecture

- **DIRECT communication**: Pharmacy ↔ Company — no admin mediation
- **Admin observes** B2B/company activity but does NOT intervene
- **Subscription model**: `subscriptionActive` on both pharmacies and companies
- Admin can toggle subscriptions per entity (future monetization gate)
- Companies with `subscriptionActive=false` hidden from pharmacy partners list

## Admin Security

- Admin PIN: `2026` (5-second long-press on logo)
- Admin API secret: `DEWAYA_ADMIN_2026` (header `x-admin-secret`)
- Admin PIN is NOT persisted (cleared on app restart)

## Colors

- Primary: `#0A7EA4`
- Accent: `#1BB580`
- Warning: `#F59E0B`
- Danger: `#E8404A`
- Company/Partner: `#7C3AED`

## Delete Architecture (completed)

- **Admin panel** (admin.tsx): trash icon per card in ALL tabs (nursing, b2b, portal, requests, pharmacies); "حذف الكل" button appears in ListHeaderComponent for b2b + portal tabs when list is non-empty
- **Pharmacy portal** (pharmacy-portal.tsx): per-card delete + "حذف الكل" for both company orders and patient requests sections
- **Company portal** (company-portal.tsx): per-card delete + "حذف الكل" for company orders
- **API DELETE endpoints**: `DELETE /requests/:id`, `DELETE /requests/bulk/all-pharmacy/:pharmacyId`, `DELETE /pharmacy-portal/company-orders/:id`, `DELETE /pharmacy-portal/company-orders-all/:pharmacyId`, `DELETE /pharmacy-portal/responses/:id`, `DELETE /pharmacy-portal/responses-all`, `DELETE /pharmacy-portal/b2b-messages/:id`, `DELETE /pharmacy-portal/b2b-messages-all`, `DELETE /company-portal/orders/:id`, `DELETE /company-portal/orders-all/:companyId`
- `requests.ts` DELETE handlers accept both admin (`x-admin-secret`) and pharmacy PIN (`x-pharmacy-pin`) auth; static imports used (no dynamic `await import()`)
- **queryKey fix**: `deleteB2bMutation` + `deleteAllB2bMutation` invalidate `["admin-b2b"]` (was mistakenly `["admin-b2b-messages"]`)

## EAS Build Configuration (Critical)

**Three root causes were fixed to make EAS builds work:**

### Fix 1: Root package.json confused EAS
- Root `package.json` had `"main": "node_modules/expo/AppEntry.js"` and expo deps → EAS treated the MONOREPO ROOT as the Expo app and failed because `expo-router` wasn't there
- **Fix**: Removed expo `main` + expo deps from root `package.json`. Added `"packageManager": "pnpm@10.26.1"` to root. Root is now a clean workspace manifest.

### Fix 2: workspace: and catalog: syntax fail on EAS
- `artifacts/pharma-finder/package.json` had `"workspace:*"` and `"catalog:"` — pnpm-specific syntax that fails when EAS installs packages without full monorepo context
- Removed: `@workspace/api-client-react` (workspace:* — never used in source), replaced `"@tanstack/react-query": "catalog:"` → `"^5.90.21"`, replaced `"zod": "catalog:"` → `"^3.25.76"`
- **Fix**: All deps in pharma-finder/package.json are now explicit npm-compatible versions

### Fix 3: React Compiler version conflict
- `babel-plugin-react-compiler@1.0.0` (embedded in `babel-preset-expo`) + `^19.0.0-beta-*` in devDependencies → EAS ran the compiler twice with conflicting versions
- **Fix**: Removed `reactCompiler: true` from `app.json` experiments, removed both beta packages from devDependencies

**Invariants (NEVER change):**
- `artifacts/pharma-finder/package.json`: NO `workspace:*`, NO `catalog:`, NO `babel-plugin-react-compiler`, NO `react-compiler-runtime`
- `app.json` experiments: only `typedRoutes: true` (NO `reactCompiler`)
- Root `package.json`: NO `"main"` field, NO expo deps, YES `"packageManager": "pnpm@10.26.1"`
- `babel.config.js`: `plugins: ["react-native-worklets/plugin"]` — Required for Reanimated v4. Keep.
- `newArchEnabled: true` in app.json — Required for Reanimated v4 and expo-av.

**Pre-EAS test**: `cd artifacts/pharma-finder && npx expo export:embed --eager --platform android --dev false` — Must succeed (≥1800 modules) before submitting EAS build.

## IntroScreen (Splash Screen)

- File: `artifacts/pharma-finder/components/IntroScreen.tsx`
- Shows app icon + "أدواية" / "DEWAYA" + tagline pill **"خدمة صحية متكاملة"** before app loads
- Reads language from `AppContext` directly (no `language` prop needed)
- Animation sequence: icon scale-in → title slide-up → tagline slide-up → 1.6s hold → fade out
- Total duration: ~2.6s with 5s safety fallback

## Drug Price Database

- API: `GET /api/drug-prices/search?q=...` — public search (no auth)
- API: `GET /api/drug-prices/stats` — public stats (returns `{total, categories}`)
- API: `POST /api/drug-prices/upload-and-save` — admin: upload Excel (.xlsx/.xls), CSV, **or PDF**, parse + save in one step, returns `{imported, source}`. PDF uses pdfjs-dist (coordinate-aware row grouping by Y position).
- API: `POST /api/drug-prices/parse-file` — admin: legacy parse-only (returns rows without saving)
- API: `DELETE /api/drug-prices/clear-all` — admin: delete all drugs from DB
- User screen: `artifacts/pharma-finder/app/drug-price.tsx` — search-only UI (no categories, no stats display)
  - Placeholder shows "اكتب اسم الدواء" or empty-DB warning if DB is empty
  - Results show: drug name (Arabic+French), price in MRU, unit
  - Debounced search (280ms), load-more pagination (20 per page)
- **DB starts empty** — admin uploads Excel/CSV file to populate; no seed data
- File format: columns A=name, B=price, C=nameAr(opt), D=unit(opt), E=category(opt)

## Database Migrations

Development: `pnpm --filter @workspace/db run push`
