"use client";

import { X, Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/format";

export type Tone = "default" | "success" | "warn" | "danger" | "info" | "accent";

const VALUE_TONE: Record<Tone, string> = {
  default: "text-zinc-100",
  success: "text-emerald-300",
  warn: "text-amber-300",
  danger: "text-red-300",
  info: "text-sky-300",
  accent: "text-emerald-300",
};

const RING_TONE: Record<Tone, string> = {
  default: "border-white/[0.07]",
  success: "border-emerald-500/30",
  warn: "border-amber-500/30",
  danger: "border-red-500/40 bg-red-500/[0.03]",
  info: "border-sky-500/30",
  accent: "border-emerald-500/30",
};

// Grande carte KPI (overview, blog, roadmap).
export function Kpi({
  label,
  value,
  hint,
  tone = "default",
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
  icon?: ReactNode;
}) {
  return (
    <div className={cn("rounded-xl border bg-white/[0.02] p-4", RING_TONE[tone])}>
      <div className="flex items-center justify-between">
        <span className="eyebrow">{label}</span>
        {icon ? <span className="text-zinc-600">{icon}</span> : null}
      </div>
      <div className={cn("mt-1.5 text-2xl font-semibold tracking-tight", VALUE_TONE[tone])}>{value}</div>
      {hint ? <div className="mt-0.5 text-xs text-zinc-500">{hint}</div> : null}
    </div>
  );
}

// Petite carte stat (archive, categories) : valeur centree, tone sur la bordure.
export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
}) {
  return (
    <div className={cn("rounded-xl border bg-white/[0.02] p-3", RING_TONE[tone])}>
      <div className={cn("text-2xl font-semibold tracking-tight", VALUE_TONE[tone])}>{value}</div>
      <div className="eyebrow mt-1">{label}</div>
      {hint ? <div className="mt-0.5 text-[11px] text-zinc-500">{hint}</div> : null}
    </div>
  );
}

const DOT_TONE: Record<string, string> = {
  pending: "bg-zinc-400",
  in_progress: "bg-amber-400",
  running: "bg-amber-400",
  done: "bg-emerald-400",
  applied: "bg-emerald-400",
  proposed: "bg-amber-400",
  error: "bg-red-400",
  failed: "bg-red-400",
  paused: "bg-amber-400",
  cancelled: "bg-zinc-600",
};

export function StatusDot({ status, pulse }: { status: string; pulse?: boolean }) {
  const cls = DOT_TONE[status] ?? "bg-zinc-500";
  return <span className={cn("inline-block h-2 w-2 shrink-0 rounded-full", cls, pulse && "animate-pulse")} />;
}

// Toggle ON / OFF style screenshots (pill vert ON, gris OFF).
export function Toggle({
  on,
  onClick,
  labelOn = "ON",
  labelOff = "OFF",
  disabled,
}: {
  on: boolean;
  onClick: () => void;
  labelOn?: string;
  labelOff?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide transition disabled:opacity-40",
        on
          ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/40"
          : "bg-white/[0.04] text-zinc-500 ring-1 ring-inset ring-white/10",
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", on ? "bg-emerald-400" : "bg-zinc-600")} />
      {on ? labelOn : labelOff}
    </button>
  );
}

// Drawer lateral droite reutilisable (produit, historique categorie).
export function Drawer({
  title,
  subtitle,
  onClose,
  children,
  headerRight,
  maxWidth = "max-w-2xl",
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  headerRight?: ReactNode;
  maxWidth?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className={cn("flex h-full w-full flex-col border-l border-white/10 bg-[var(--bg-elev)]", maxWidth)}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-white/10 bg-[var(--bg-elev)]/95 px-5 py-4 backdrop-blur">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-zinc-100">{title}</h2>
            {subtitle ? <div className="mt-0.5 text-xs text-zinc-500">{subtitle}</div> : null}
          </div>
          <div className="flex items-center gap-2">
            {headerRight}
            <button onClick={onClose} className="btn-icon h-8 w-8" aria-label="Fermer">
              <X size={16} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
      </div>
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <p className="flex items-center gap-2 text-sm text-zinc-400">
      <Loader2 size={15} className="animate-spin" /> {label ?? "Chargement..."}
    </p>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.01] px-6 py-10 text-center text-sm text-zinc-500">
      {children}
    </div>
  );
}
