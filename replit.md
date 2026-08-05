# Sistema EBD SIBO

Sistema de gestão da Escola Bíblica Dominical da Segunda Igreja Batista de Osasco (SIBO). Permite que professores registrem chamadas e que a superintendência gerencie classes, alunos, professores, encerre sessões e visualize relatórios comparativos de frequência.

## Run & Operate

- `pnpm --filter @workspace/gestao-ebd-sibo run dev` — run the frontend (port via PORT env)
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 19 + Vite 8 + TanStack Router v1 (SPA)
- Database/Auth: Supabase (external — `owvzzvovlkrgclkrmcpv.supabase.co`)
- UI: Tailwind CSS v4 + shadcn/ui components + Recharts
- API: Express 5 (shared api-server, not used by the EBD frontend directly)

## Where things live

- `artifacts/gestao-ebd-sibo/` — Sistema EBD frontend (main app)
- `artifacts/gestao-ebd-sibo/src/routes/` — TanStack Router file-based routes
- `artifacts/gestao-ebd-sibo/src/lib/ebd.ts` — core data fetching functions and types
- `artifacts/gestao-ebd-sibo/src/integrations/supabase/` — Supabase client + DB types
- `artifacts/gestao-ebd-sibo/src/routeTree.gen.ts` — TanStack Router route tree (manually maintained)

## Routes

| Path | Purpose |
|------|---------|
| `/` | Home — professor selects class to register attendance |
| `/auth` | Login/signup for superintendência |
| `/chamada?classe=<id>` | Attendance registration for a class |
| `/painel` | Superintendência panel (classes, teachers, students, users) |
| `/encerramento` | EBD closing bulletin + WhatsApp summary |
| `/relatorios` | Comparative attendance charts by year |

## Architecture decisions

- Migrated from Lovable (TanStack Start SSR) to pure Vite SPA — all data is fetched from Supabase on the client side, so SSR provides no benefit.
- `createServerFn` (TanStack Start) removed; `users.functions.ts` now calls Supabase client directly.
- `routeTree.gen.ts` is manually maintained (no TanStack Router Vite plugin); update it if routes change.
- Logo URL uses local `/favicon.png` (original was on Lovable's CDN).
- Supabase publishable key is a public key (safe to embed in client bundle).

## Product

- **Professores** access the home page, pick their class, and register Sunday attendance (students + teachers + visitors).
- **Superintendência** logs in with username/password, manages classes/teachers/students, closes EBD sessions, generates the closing bulletin (copiable to WhatsApp), and views monthly/yearly attendance comparison charts.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- If routes change, manually update `src/routeTree.gen.ts` to match.
- The Supabase URL and publishable key are set as `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` env vars (shared environment).
- `deleteAppUser` in `users.functions.ts` only deletes from the `profiles` table (client-side limitation — full auth user deletion requires service role key via an Edge Function).

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
