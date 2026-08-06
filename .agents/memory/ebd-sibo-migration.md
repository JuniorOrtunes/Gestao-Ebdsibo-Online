---
name: EBD SIBO migration and feature decisions
description: Key decisions, gotchas, and architecture notes for the Sistema EBD SIBO project migrated from Lovable to Replit.
---

# EBD SIBO — Migration & Feature Decisions

## Architecture
- Migrated from Lovable (TanStack Start SSR) to Vite SPA. All data is client-side Supabase.
- `routeTree.gen.ts` is manually maintained — no TanStack Router Vite plugin. If routes change, update it manually.
- The `teachers` table still exists in DB and is used by `chamada.tsx` for `teacher_attendances`. The UI module was removed (replaced by `is_teacher` toggle on students), but the underlying data structure is preserved for attendance tracking.

## DB schema
- `students` table already has all address fields (cep, street, number, complement, neighborhood, city) and teacher fields (is_teacher: boolean, teacher_class_id: uuid). No migration needed.
- Supabase generated `types.ts` had a bug: `DefaultSchemaEnumNameOrOptions` used instead of `PublicCompositeTypeNameOrOptions` in `CompositeTypes` generic. Fixed in place.

## Environment variables
- `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` — set in shared environment (public keys).
- `SESSION_SECRET` — available but not used by the frontend artifact.

## Realtime
- `useRealtimeSync` hook (src/hooks/useRealtimeSync.ts) subscribes to all relevant tables and invalidates TanStack Query keys. Called from `Painel` component (authenticated layout).

## deleteAppUser limitation
- Administrative user CRUD now runs through the Express API server with the Supabase service-role secret; the frontend sends only the authenticated session token.

## Logo
- Local `/favicon.png` used (original was Lovable CDN).

**Why:** All decisions minimize breaking changes while enabling the app to run on Replit without Lovable infrastructure.
