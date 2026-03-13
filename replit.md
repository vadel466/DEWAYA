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

### صيدليتي - Pharmacy Finder (Expo Mobile App)

A bilingual (Arabic/English) mobile app for finding pharmacies that stock specific medicines.

**Features:**
- Search for medicine by name or pharmacy box photo
- Submit request → notification flow (5s polling)
- Locked notifications requiring 1 MRU payment to unlock
- Admin panel to view pending requests and respond with pharmacy info
- Language switcher (Arabic/English, RTL support)
- Traditional pharmacy caduceus symbol branding
- Calm, professional teal/green color scheme

**Screens:**
- `app/(tabs)/index.tsx` — Home screen with search form
- `app/(tabs)/notifications.tsx` — User notifications with lock/unlock
- `app/(tabs)/admin.tsx` — Admin panel for responding to requests

**Context:** `context/AppContext.tsx` — Language, userId, translations

### API Server

Express 5 API server with the following endpoints:

- `GET /api/healthz` — Health check
- `GET /api/requests` — List all drug requests (admin)
- `POST /api/requests` — Submit drug search request
- `POST /api/requests/:id/respond` — Admin responds with pharmacy info (creates locked notification)
- `GET /api/notifications/:userId` — Get user notifications
- `POST /api/notifications/:id/unlock` — Unlock notification after payment

## Database Schema

- `drug_requests` — Drug search requests with status (pending/responded) and pharmacy response
- `notifications` — Locked notifications sent to users after admin responds

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
