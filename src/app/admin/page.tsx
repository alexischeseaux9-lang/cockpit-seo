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
} from "lucide-react";
import { ConnectModal } from "./connect-modal";
import { VERSION } from "@/lib/version";

type Health = {
  pending: number;
  errors_24h: number;
  published: number;
  last_published_at: string | null;
};

type Site = {
  id: string;
  name: string;
  url: string;
  platform: string;
  connection_status: string;
  voice_profile?: { content_language?: string };
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
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
        <div className="w-full max-w-sm rounded-lg border border-zinc-800 bg-zinc-900/40 p-6">
          <div className="mb-4 flex items-center gap-2 text-zinc-100">
            <Lock size={18} />
            <h1 className="text-lg font-semibold">Cockpit SEO</h1>
          </div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load(password)}
            placeholder="ADMIN_PASSWORD"
            className="mb-3 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-100 outline-none focus:border-emerald-500"
          />
          {error && <p className="mb-3 text-sm text-red-400">{error}</p>}
          <button
            onClick={() => load(password)}
            disabled={loading || !password}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : null}
            Entrer
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-8 text-zinc-100">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity size={22} className="text-emerald-400" />
            <h1 className="text-xl font-semibold">Cockpit SEO</h1>
            <span className="rounded border border-zinc-700 px-1.5 py-0.5 text-xs text-zinc-400">
              {VERSION}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => load(password)}
              className="flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:border-zinc-500"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Rafraichir
            </button>
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium hover:bg-emerald-500"
            >
              <Plus size={16} /> Ajouter un site
            </button>
          </div>
        </div>

        {warning === "supabase_not_configured" && (
          <p className="mb-6 rounded-lg border border-amber-900 bg-amber-950/40 p-3 text-sm text-amber-300">
            Supabase pas encore configure. Renseigne NEXT_PUBLIC_SUPABASE_URL et
            SUPABASE_SERVICE_ROLE_KEY dans .env.local puis applique la migration 0001_init.sql.
          </p>
        )}

        {loading && <p className="text-zinc-400">Chargement...</p>}

        {!loading && sites.length === 0 && !warning && (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-8 text-center text-zinc-400">
            Aucun site. Clique sur Ajouter un site pour commencer.
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {sites.map((site) => (
            <div
              key={site.id}
              className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4"
            >
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <Link
                    href={`/admin/sites/${site.id}`}
                    className="font-medium text-zinc-100 hover:text-emerald-400"
                  >
                    {site.name}
                  </Link>
                  <p className="text-xs text-zinc-500">{site.url}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="rounded border border-zinc-700 px-1.5 py-0.5 text-xs text-zinc-400">
                    {site.platform}
                  </span>
                  {site.voice_profile?.content_language && (
                    <span className="flex items-center gap-1 rounded border border-emerald-800 px-1.5 py-0.5 text-xs capitalize text-emerald-400">
                      <Globe size={11} /> {site.voice_profile.content_language}
                    </span>
                  )}
                </div>
              </div>

              <div className="mb-4 grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-1.5 text-zinc-300">
                  <FileText size={14} className="text-zinc-500" />
                  {site.health.published} publies
                </div>
                <div className="flex items-center gap-1.5 text-zinc-300">
                  <Clock size={14} className="text-zinc-500" />
                  {site.health.pending} en file
                </div>
                <div className={`flex items-center gap-1.5 ${healthColor(site.health.errors_24h)}`}>
                  <AlertTriangle size={14} />
                  {site.health.errors_24h} err/24h
                </div>
                <div className={`flex items-center gap-1.5 ${staleness(site.health.last_published_at)}`}>
                  <Activity size={14} />
                  {site.health.last_published_at
                    ? new Date(site.health.last_published_at).toLocaleDateString()
                    : "jamais"}
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-zinc-800 pt-3">
                {site.connection_status === "connected" ? (
                  <span className="flex items-center gap-1.5 text-sm text-emerald-400">
                    <CheckCircle2 size={14} /> Connecte
                  </span>
                ) : (
                  <button
                    onClick={() => setConnectFor(site)}
                    className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:border-emerald-500"
                  >
                    <Link2 size={14} /> Connecter Shopify
                  </button>
                )}
                <Link
                  href={`/admin/sites/${site.id}`}
                  className="flex items-center gap-1 rounded-lg bg-zinc-800 px-3 py-1.5 text-sm font-medium text-zinc-100 hover:bg-zinc-700"
                >
                  Ouvrir <ChevronRight size={14} />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm rounded-lg border border-zinc-800 bg-zinc-950 p-6">
            <h2 className="mb-4 text-lg font-semibold">Nouveau site Shopify</h2>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nom du site"
              className="mb-3 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 outline-none focus:border-emerald-500"
            />
            <input
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="https://monshop.com"
              className="mb-4 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 outline-none focus:border-emerald-500"
            />
            <div className="flex gap-2">
              <button
                onClick={addSite}
                disabled={!newName || !newUrl}
                className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 font-medium hover:bg-emerald-500 disabled:opacity-40"
              >
                Creer
              </button>
              <button
                onClick={() => setShowAdd(false)}
                className="rounded-lg border border-zinc-700 px-4 py-2 text-zinc-300"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {connectFor && (
        <ConnectModal
          siteId={connectFor.id}
          siteName={connectFor.name}
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
