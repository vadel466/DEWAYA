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
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Mobile**: Expo + Expo Router (file-based routing)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   └── pharma-finder/      # Expo mobile pharmacy finder app
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Applications

### أدواي | DEWAYA — Pharmacy Finder (Expo Mobile App)

A bilingual **Arabic/French** (RTL-aware) mobile app for finding pharmacies in Mauritania.

**App Name**: "أدْواَيَ" (Arabic) / "DEWAYA" (French)

**Features:**
- Search for medicine by name or box photo (camera + gallery via expo-image-picker)
- Submit request → notification flow (5s polling)
- Locked notifications requiring 10 MRU payment to unlock
- Payment methods: مصرفي (20479725), بنكيلي (46576659), بيم بنك (46576659)
- Reference codes: `DW-XXXXXX` format
- **Nearest pharmacy** — GPS location + haversine distance sort + Linking directions
- **Duty pharmacies** — Date-selectable list for on-duty pharmacies by region
- **Pharmacy portal** — PIN-protected screen for pharmacy staff to mark drugs available
- **Admin panel** — PIN-gated (default: DEWAYA26, set via EXPO_PUBLIC_ADMIN_PIN)
  - Manage drug requests (pending/responded)
  - Confirm payments and unlock notifications
  - View pharmacy portal responses and forward to users
  - Manage pharmacy directory (add/edit/delete with GPS coordinates + portal PIN)
  - Manage duty pharmacy schedule (add/edit/delete per region + date)
- Language switcher (Arabic/French, RTL support)
- Custom bilingual header logo (stethoscope + pill + hospital-box icons)
- Region selector with GPS detection

**Screens (tabs):**
- `app/(tabs)/index.tsx` — Home screen with search, camera, region, 4-card grid
- `app/(tabs)/notifications.tsx` — User notifications with lock/unlock + payment flow
- `app/(tabs)/admin.tsx` — PIN-gated admin panel with 5 sub-tabs

**Full-page Screens (Stack):**
- `app/nearest-pharmacy.tsx` — GPS nearest pharmacy list with call + directions
- `app/duty-pharmacies.tsx` — 7-day date picker + duty pharmacy cards by region
- `app/pharmacy-portal.tsx` — PIN login for pharmacies to respond to drug requests

**Context:** `context/AppContext.tsx` — Language, userId, translations (ar/fr), locked notification count, region

### API Server

Express 5 API server with the following endpoints:

- `GET /api/healthz` — Health check
- `GET /api/requests` — List all drug requests (admin)
- `POST /api/requests` — Submit drug search request
- `POST /api/requests/:id/respond` — Admin responds with pharmacy info (creates locked notification)
- `GET /api/notifications/admin/pending-payments` — Pending payment notifications (admin)
- `GET /api/notifications/:userId` — Get user notifications
- `POST /api/notifications/:id/request-unlock` — Initiate payment + get DW-XXXXXX reference code
- `POST /api/notifications/:id/confirm-payment` — Admin confirms payment → unlocks notification
- `GET /api/pharmacies` — List all pharmacies
- `GET /api/pharmacies/nearest?lat&lon&region` — Nearest pharmacies sorted by haversine distance
- `POST /api/pharmacies` — Add pharmacy (admin)
- `PUT /api/pharmacies/:id` — Update pharmacy (admin)
- `DELETE /api/pharmacies/:id` — Delete pharmacy (admin)
- `GET /api/duty-pharmacies?region&date` — List active duty pharmacies by region/date
- `GET /api/duty-pharmacies/all` — All duty pharmacies (admin)
- `POST /api/duty-pharmacies` — Add duty pharmacy entry (admin)
- `PUT /api/duty-pharmacies/:id` — Update duty pharmacy (admin)
- `DELETE /api/duty-pharmacies/:id` — Delete duty pharmacy (admin)
- `POST /api/pharmacy-portal/auth` — Authenticate pharmacy by PIN
- `GET /api/pharmacy-portal/requests` — Get pending drug requests (for pharmacy portal)
- `POST /api/pharmacy-portal/respond` — Pharmacy marks drug available
- `GET /api/pharmacy-portal/responses` — Admin: view all pharmacy responses
- `POST /api/pharmacy-portal/responses/:id/select` — Admin: mark response as selected

## Database Schema

- `drug_requests` — Drug search requests with status (pending/responded) and pharmacy response
- `notifications` — Locked notifications sent to users after admin responds
- `pharmacies` — Pharmacy directory with GPS coordinates, portal PIN, region
- `duty_pharmacies` — Duty pharmacy schedule by region + date
- `pharmacy_responses` — Pharmacy portal responses to drug requests

## Admin Security

- Admin tab protected by PIN gate (default: `DEWAYA26`)
- Override PIN via env var: `EXPO_PUBLIC_ADMIN_PIN`
- Admin PIN is NOT persisted (cleared on app restart for security)

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Codegen

Run: `pnpm --filter @workspace/api-spec run codegen`

After any OpenAPI spec change, re-run codegen before using generated types.

## Database Migrations

Development: `pnpm --filter @workspace/db run push`
