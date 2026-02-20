# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Palace Drum Clinic (PDC) Admin Portal** — a React + TypeScript admin dashboard for managing a drum lesson platform. Core features include a push notification system with analytics, content management (videos/series/artists), user management, Drum Zone bookings, practice goals, and feature requests.

## Commands

```bash
npm run dev          # Start Vite dev server
npm run build        # Type-check + production build (tsc -b && vite build)
npm run lint         # ESLint
npm run preview      # Preview production build
npm run test:triggers  # Test notification triggers (node test-triggers.js)
```

## Environment

Requires `.env` or `.env.local` with:
```
VITE_SUPABASE_URL=
VPABASE_ANON_KEY=
```

See `.env.example` for reference.

## Architecture

### Stack
- **React 19** + TypeScript (strict mode), built with Vite
- **Routing**: React Router v7 — all routes defined in `src/App.tsx`
- **State**: Zustand v5 stores in `src/stores/` (with persist middleware for auth/settings)
- **Backend**: Supabase (Postgres, Auth, Edge Functions)
- **Forms**: React Hook Form + Zod validation (`src/types/schemas.ts`)
- **UI**: Radix UI primitives + Tailwind CSS v4 + Lucide icons
- **Tables**: TanStack React Table; **Charts**: Recharts

### Path Alias
`@/*` maps to `./src/*` (configured in `vite.config.ts` and `tsconfig.app.json`).

### State Management Pattern
All Zustand stores follow the same pattern: async actions with loading/error state, Supabase as the data source. Stores are exported from `src/stores/index.ts`. Auth state uses persist middleware.

### Route Protection
`src/components/guards/AdminGuard.tsx` wraps all authenticated routes. It checks `authStore` for a valid session with admin role; non-admins are redirected to `/unauthorized`.

### Supabase Edge Functions
Located in `supabase/functions/`. Key functions:
- `process-notifications` — processes scheduled notifications queue
- `process-triggers` — evaluates automated notification triggers
- `track-notification-event` — records delivery/open/click/dismiss analytics
- `test-notifications` — testing endpoint

Shared types between frontend and edge functions live in `supabase/functions/_shared/database.ts`.

### Notification System
The most complex feature. Key concepts:
- **Scheduled notifications**: queued in `scheduled_notifications` table with delivery times
- **Templates**: reusable with variable interpolation (`notification_templates`)
- **Triggers**: 5 automated types — inactivity, incomplete signup, abandoned video, streak break, milestone reached (`notification_triggers`)
- **Audience targeting**: all users, registered-only, anonymous-only, admins, segments, or specific users
- **Throttling**: prevents notification fatigue via `trigger_executions` tracking
- **Analytics**: tracks delivered/opened/clicked/dismissed per notification

See `NOTIFICATION_TRACKING_INTEGRATION.md` for detailed integration docs.

### Type Safety
- Database types: `src/types/database.ts` (generated from Supabase schema, ~1000 lines)
- Zod schemas: `src/types/schemas.ts` (form/API validation)
- Discriminated unions used for trigger types and audience targeting
