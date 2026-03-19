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

A bilingual **Arabic/French** (RTL-aware) mobile app for finding pharmacies in Mauritania.

**App Name**: "أدْواَيَ" (Arabic) / "DEWAYA" (French)

**Auth & Security:**
- Admin panel: 5-second long-press on logo → PIN modal → `2026`
- Admin API secret header: `x-admin-secret: DEWAYA_ADMIN_2026`
- Pharmacy portal: **per-pharmacy** unique `portalPin` (set by admin). Sent as `x-pharmacy-pin` header on mutations. No shared/master code.
- Company portal: **per-company** unique `code` (set by admin). Sent as `x-company-code` header on mutations. No shared/master code.

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
- **Admin panel** (PIN `2026`): 9 sub-tabs:
  - Pending requests, Payments, Portal responses, Pharmacies, Duty schedule, Drug prices, Doctors, B2B (legacy), Companies (CRUD + subscription toggle + B2B monitoring)
- Language switcher (Arabic/French, RTL support)

**Screens (tabs):**
- `app/(tabs)/index.tsx` — Home screen with search, camera, region, 4-card grid + dual portal links
- `app/(tabs)/admin.tsx` — PIN-gated admin panel (9 sub-tabs including companies)

**Full-page Screens (Stack):**
- `app/nearest-pharmacy.tsx` — GPS nearest pharmacy list
- `app/duty-pharmacies.tsx` — 7-day date picker + duty pharmacy cards
- `app/pharmacy-portal.tsx` — DV2026 portal (4 tabs: requests/repeater/partners/ads)
- `app/company-portal.tsx` — DAHA2024 portal (3 tabs: orders/inventory/announcements)
- `app/find-doctor.tsx` — Doctor finder
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
- `doctors` — Doctor directory
- `companies` — Company profiles (code, subscriptionActive)
- `company_orders` — Direct pharmacy→company orders
- `company_inventory` — Company stock + announcements (isAd flag)

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

## Database Migrations

Development: `pnpm --filter @workspace/db run push`
