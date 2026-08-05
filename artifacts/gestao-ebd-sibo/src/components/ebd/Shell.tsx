import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { CHURCH_NAME, LOGO_URL } from "@/lib/ebd";

export function Shell({
  subtitle,
  actions,
  children,
}: {
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-muted/40">
      <header className="bg-primary text-primary-foreground print:hidden">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-4">
          <Link to="/" className="flex items-center gap-3">
            <img src={LOGO_URL} alt="Logo da Segunda Igreja Batista de Osasco" className="h-11 w-11 object-contain" />
            <span className="leading-tight">
              <span className="block text-base font-bold">Sistema EBD</span>
              <span className="block text-xs opacity-80">{CHURCH_NAME}</span>
            </span>
          </Link>
          <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        {subtitle ? (
          <h1 className="mb-4 text-xl font-bold text-foreground print:hidden">{subtitle}</h1>
        ) : null}
        {children}
      </main>
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-border bg-card p-5 shadow-sm ${className}`}>
      {children}
    </section>
  );
}

export const btn =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";
export const btnPrimary = `${btn} bg-primary text-primary-foreground hover:bg-primary/90`;
export const btnGhost = `${btn} border border-border bg-background text-foreground hover:bg-accent`;
export const btnDanger = `${btn} bg-destructive text-destructive-foreground hover:bg-destructive/90`;
export const inputCls =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";
export const labelCls = "mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground";