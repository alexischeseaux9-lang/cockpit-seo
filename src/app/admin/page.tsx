"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Loader2,
  Activity,
  AlertTriangle,
  Clock,
  Link2,
  CheckCircle2,
  Lock,
  FileText,
  ChevronRight,
  RefreshCw,
  Globe,
  Sparkles,
} from "lucide-react";
import { ConnectModal } from "./connect-modal";
import { Sparkline } from "./_components/sparkline";
import { SiteHealthChip } from "./_components/site-health-chip";
import { Kpi } from "./_components/ui";
import { cn } from "@/lib/format";
import { VERSION, BRAND } from "@/lib/version";

type Health = {
  pending: number;
  errors_24h: number;
  published: number;
  last_published_at: string | null;
  sparkline: number[];
  level: string;
  cost_mtd_usd: number;
};

type Site = {
  id: string;
  name: string;
  url: string;
  platform: string;
  connection_status: string;
  voice_profile?: { content_language?: string };
  client_view_token?: string;
  health: Health;
};

const PW_KEY = "cockpit_admin_pw";

function healthColor(errors: number): string {
  if (errors > 10) return "text-red-400";
  if (errors >= 5) return "text-amber-400";
  return "text-emerald-400";
}

function staleness(last: string | null): string {
  if (!last) return "text-zinc-500";
  const days = (Date.now() - new Date(last).getTime()) / 86_400_000;
  if (days > 3) return "text-red-400";
  if (days > 1) return "text-amber-400";
  return "text-emerald-400";
}

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [connectFor, setConnectFor] = useState<Site | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [needsAttention, setNeedsAttention] = useState(false);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem(PW_KEY) : null;
    if (saved) {
      setPassword(saved);
      setAuthed(true);
    }
  }, []);

  const load = useCallback(async (pw: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/sites/list", {
        headers: { authorization: `Bearer ${pw}` },
      });
      if (res.status === 401) {
        setError("Mot de passe invalide");
        setAuthed(false);
        localStorage.removeItem(PW_KEY);
        return;
      }
      const json = await res.json();
      setSites(json.sites || []);
      setWarning(json.warning || null);
      setAuthed(true);
      localStorage.setItem(PW_KEY, pw);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur reseau");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authed && password) load(password);
  }, [authed, password, load]);

  async function addSite() {
    const res = await fetch("/api/admin/sites/create", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${password}` },
      body: JSON.stringify({ name: newName, url: newUrl, platform: "shopify" }),
    });
    if (res.ok) {
      setShowAdd(false);
      setNewName("");
      setNewUrl("");
      load(password);
    }
  }

  if (!authed) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="card-base w-full max-w-sm p-6">
          <div className="mb-4 flex items-center gap-2 text-zinc-100">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-300"><Lock size={17} /></span>
            <div>
              <h1 className="text-base font-semibold leading-tight">Cockpit SEO</h1>
              <p className="text-xs text-zinc-500">Acces admin</p>
            </div>
          </div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load(password)}
            placeholder="ADMIN_PASSWORD"
            className="input-base mb-3"
          />
          {error && <p className="mb-3 text-sm text-red-400">{error}</p>}
          <button onClick={() => load(password)} disabled={loading || !password} className="btn-primary w-full">
            {loading ? <Loader2 size={16} className="animate-spin" /> : null} Entrer
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-6 py-8 text-zinc-100">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-300"><Activity size={18} /></span>
            <h1 className="text-xl font-semibold tracking-tight">{BRAND}</h1>
            <span className="rounded-md border border-white/10 px-1.5 py-0.5 text-xs text-zinc-400">{VERSION}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/admin/onboarding-wizard" className="btn-ghost"><Sparkles size={15} /> Onboarding</Link>
            <button onClick={() => load(password)} className="btn-ghost"><RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Rafraichir</button>
            <button onClick={() => setNeedsAttention((v) => !v)} className={cn("btn-ghost", needsAttention && "border-amber-500/40 text-amber-300")}>Needs attention</button>
            <button onClick={() => setShowAdd(true)} className="btn-primary"><Plus size={15} /> Ajouter un site</button>
          </div>
        </div>

        {!loading && sites.length > 0 && (
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi label="Sites" value={sites.length} />
            <Kpi label="Connectes" value={sites.filter((s) => s.connection_status === "connected").length} tone="accent" />
            <Kpi label="Articles publies" value={sites.reduce((a, s) => a + (s.health.published || 0), 0)} />
            <Kpi label="Cout IA (mois)" value={"$" + sites.reduce((a, s) => a + (s.health.cost_mtd_usd || 0), 0).toFixed(2)} />
          </div>
        )}

        {warning === "supabase_not_configured" && (
          <p className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/[0.05] p-3 text-sm text-amber-200">
            Supabase pas encore configure. Renseigne NEXT_PUBLIC_SUPABASE_URL et
            SUPABASE_SERVICE_ROLE_KEY dans .env.local puis applique la migration 0001_init.sql.
          </p>
        )}

        {loading && <p className="text-zinc-400">Chargement...</p>}

        {!loading && sites.length === 0 && !warning && (
          <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.01] p-10 text-center text-sm text-zinc-500">
            Aucun site. Clique sur &quot;Ajouter un site&quot; pour commencer.
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {sites.filter((s) => !needsAttention || s.health.level !== "green").map((site) => (
            <div key={site.id} className="card-base card-hover">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/admin/sites/${site.id}`} className="font-medium text-zinc-100 hover:text-emerald-400">{site.name}</Link>
                  <p className="truncate text-xs text-zinc-500">{site.url}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <SiteHealthChip level={site.health.level} />
                  <span className="rounded-md border border-white/10 px-1.5 py-0.5 text-xs capitalize text-zinc-400">{site.platform}</span>
                  {site.voice_profile?.content_language && (
                    <span className="flex items-center gap-1 rounded-md border border-emerald-500/30 px-1.5 py-0.5 text-xs capitalize text-emerald-400">
                      <Globe size={11} /> {site.voice_profile.content_language}
                    </span>
                  )}
                </div>
              </div>

              <div className="mb-4 grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-1.5 text-zinc-300"><FileText size={14} className="text-zinc-500" /> {site.health.published} publies</div>
                <div className="flex items-center gap-1.5 text-zinc-300"><Clock size={14} className="text-zinc-500" /> {site.health.pending} en file</div>
                <div className={cn("flex items-center gap-1.5", healthColor(site.health.errors_24h))}><AlertTriangle size={14} /> {site.health.errors_24h} err/24h</div>
                <div className={cn("flex items-center gap-1.5", staleness(site.health.last_published_at))}><Activity size={14} /> {site.health.last_published_at ? new Date(site.health.last_published_at).toLocaleDateString() : "jamais"}</div>
              </div>

              <div className="mb-3 flex items-center justify-between text-emerald-400">
                <Sparkline data={site.health.sparkline || []} />
                <span className="text-xs text-zinc-500">14j · ${(site.health.cost_mtd_usd || 0).toFixed(2)}/mois</span>
              </div>

              <div className="flex items-center justify-between border-t border-white/[0.06] pt-3">
                {site.connection_status === "connected" ? (
                  <span className="flex items-center gap-1.5 text-sm text-emerald-400"><CheckCircle2 size={14} /> Connecte</span>
                ) : (
                  <button onClick={() => setConnectFor(site)} className="btn-ghost btn-sm"><Link2 size={14} /> Connecter</button>
                )}
                <div className="flex items-center gap-2">
                  {site.client_view_token && (
                    <a href={`/portail/${site.client_view_token}`} target="_blank" rel="noreferrer" className="text-xs text-zinc-500 hover:text-emerald-400">Portail</a>
                  )}
                  <Link href={`/admin/sites/${site.id}`} className="btn-primary btn-sm">Ouvrir <ChevronRight size={14} /></Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm" onClick={() => setShowAdd(false)}>
          <div className="w-full max-w-sm rounded-xl border border-white/10 bg-[var(--bg-elev)] p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-lg font-semibold">Nouveau site Shopify</h2>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nom du site" className="input-base mb-3" />
            <input value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="https://monshop.com" className="input-base mb-4" />
            <div className="flex gap-2">
              <button onClick={addSite} disabled={!newName || !newUrl} className="btn-primary flex-1">Creer</button>
              <button onClick={() => setShowAdd(false)} className="btn-ghost">Annuler</button>
            </div>
          </div>
        </div>
      )}

      {connectFor && (
        <ConnectModal
          siteId={connectFor.id}
          siteName={connectFor.name}
          platform={connectFor.platform}
          password={password}
          onClose={() => setConnectFor(null)}
          onConnected={() => {
            setConnectFor(null);
            load(password);
          }}
        />
      )}
    </main>
  );
}
