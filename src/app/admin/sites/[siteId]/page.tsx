"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  Play,
  Plus,
  FileText,
  CheckCircle2,
  ExternalLink,
  Sparkles,
  Image as ImageIcon,
  Package,
  FolderTree,
  History,
  User,
  Wand2,
  UploadCloud,
  Undo2,
  BarChart3,
  Globe,
  Archive,
  ShoppingBag,
  Map,
  UserCircle,
  Tag,
  Zap,
  ZapOff,
  ListPlus,
  Check,
  Trash2,
} from "lucide-react";
import { parseKeywordInput, type ParseResult } from "@/lib/sites/csv-parser";

const LANGUAGES = ["francais", "anglais", "allemand", "italien", "espagnol", "neerlandais"];

const PW_KEY = "cockpit_admin_pw";

type Job = {
  id: string;
  kind: string;
  status: string;
  keyword: string | null;
  error: string | null;
  output: any;
};

type TabId = "blog" | "archive" | "image" | "scro" | "roadmap" | "profil" | "products" | "categories" | "optimizations";

// Ordre EXACT du master prompt V3.
const TABS: { id: TabId; label: string; icon: JSX.Element }[] = [
  { id: "blog", label: "Blog", icon: <FileText size={14} /> },
  { id: "archive", label: "Archive", icon: <Archive size={14} /> },
  { id: "image", label: "Image Lab", icon: <ImageIcon size={14} /> },
  { id: "scro", label: "SCRO", icon: <ShoppingBag size={14} /> },
  { id: "roadmap", label: "Roadmap", icon: <Map size={14} /> },
  { id: "profil", label: "Profil", icon: <UserCircle size={14} /> },
  { id: "products", label: "Produits", icon: <Package size={14} /> },
  { id: "categories", label: "Product Categories", icon: <Tag size={14} /> },
  { id: "optimizations", label: "Optimisations", icon: <Sparkles size={14} /> },
];

function Status({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "text-zinc-400",
    in_progress: "text-amber-400",
    done: "text-emerald-400",
    proposed: "text-amber-400",
    applied: "text-emerald-400",
    pushed: "text-emerald-400",
    error: "text-red-400",
    paused: "text-amber-400",
    not_audited: "text-zinc-500",
  };
  return <span className={`text-xs ${map[status] || "text-zinc-400"}`}>{status}</span>;
}

const inputCls =
  "w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500";
const cardCls = "rounded-lg border border-zinc-800 bg-zinc-900/40 p-4";
const primaryBtn =
  "flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-40";
const ghostBtn =
  "flex items-center gap-1.5 rounded-lg border border-zinc-700 px-2.5 py-1.5 text-xs hover:border-emerald-500 disabled:opacity-40";

export default function SiteDetail({ params }: { params: { siteId: string } }) {
  const siteId = params.siteId;
  const [password, setPassword] = useState("");
  const [tab, setTab] = useState<TabId>("blog");
  const [msg, setMsg] = useState<string | null>(null);
  const [site, setSite] = useState<any>(null);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem(PW_KEY) : null;
    if (saved) setPassword(saved);
  }, []);

  const loadSite = useCallback(async () => {
    if (!password) return;
    const res = await fetch(`/api/admin/sites/list`, { headers: { authorization: `Bearer ${password}` } });
    if (res.ok) {
      const j = await res.json();
      setSite((j.sites || []).find((s: any) => s.id === siteId) || null);
    }
  }, [password, siteId]);
  useEffect(() => { loadSite(); }, [loadSite]);

  const headers = useCallback(
    () => ({ "content-type": "application/json", authorization: `Bearer ${password}` }),
    [password]
  );
  const api = useCallback(
    async (path: string, init?: RequestInit) => {
      const res = await fetch(path, { ...init, headers: headers() });
      const json = await res.json().catch(() => ({}));
      return { ok: res.ok, json };
    },
    [headers]
  );

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-8 text-zinc-100">
      <div className="mx-auto max-w-4xl">
        <Link href="/admin" className="mb-4 flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-100">
          <ArrowLeft size={16} /> Retour
        </Link>

        {site && (
          <>
            <div className="mb-3 flex items-center gap-3">
              <h1 className="text-xl font-semibold">{site.name}</h1>
              {site.voice_profile?.content_language ? (
                <span className="flex items-center gap-1.5 rounded-full border border-emerald-700 bg-emerald-950/40 px-2.5 py-0.5 text-xs capitalize text-emerald-300">
                  <Globe size={12} /> {site.voice_profile.content_language}
                </span>
              ) : (
                <span className="flex items-center gap-1.5 rounded-full border border-amber-700 bg-amber-950/40 px-2.5 py-0.5 text-xs text-amber-300">
                  <Globe size={12} /> Langue non definie, va dans Profil
                </span>
              )}
            </div>
            <div className="mb-5 flex flex-wrap items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-2.5 text-sm">
              {site.connection_status === "connected" ? (
                <span className="flex items-center gap-1.5 text-emerald-400"><CheckCircle2 size={14} /> Connecte</span>
              ) : (
                <span className="flex items-center gap-1.5 text-red-400"><Globe size={14} /> {site.connection_status}{site.connection_error ? `: ${site.connection_error}` : ""}</span>
              )}
              <span className="text-zinc-500">·</span>
              <span className="text-zinc-400">{site.platform}</span>
              <a href={site.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-zinc-400 hover:text-emerald-400">{site.url} <ExternalLink size={12} /></a>
              <a href={`/portail/${site.client_view_token}`} target="_blank" rel="noreferrer" className="ml-auto text-xs text-emerald-400">Portail client</a>
            </div>
          </>
        )}

        <div className="sticky top-0 z-10 mb-6 flex flex-wrap gap-1 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setMsg(null); }}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm ${
                tab === t.id ? "border-b-2 border-emerald-400 text-zinc-100" : "text-zinc-400"
              }`}
            >
              {t.icon} {t.label}
              {t.id === "roadmap" && site && (
                <span className="rounded border border-zinc-700 px-1 text-[10px] text-zinc-400">{site.daily_post_quota ?? 0}/j</span>
              )}
              {t.id === "profil" && site?.voice_profile && Object.keys(site.voice_profile).length > 0 && (
                <Check size={11} className="text-emerald-400" />
              )}
            </button>
          ))}
        </div>

        {msg && <p className="mb-4 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 text-sm text-zinc-300">{msg}</p>}

        {password && tab === "blog" && <BlogTab siteId={siteId} site={site} api={api} setMsg={setMsg} />}
        {password && tab === "archive" && <ArchiveTab siteId={siteId} api={api} setMsg={setMsg} />}
        {password && tab === "products" && <ProductsTab siteId={siteId} api={api} setMsg={setMsg} />}
        {password && tab === "categories" && <CategoriesTab siteId={siteId} api={api} setMsg={setMsg} />}
        {password && tab === "scro" && <ScroTab siteId={siteId} api={api} setMsg={setMsg} />}
        {password && tab === "roadmap" && <RoadmapTab siteId={siteId} site={site} api={api} setMsg={setMsg} onSiteChanged={loadSite} />}
        {password && tab === "profil" && <ProfilTab siteId={siteId} api={api} setMsg={setMsg} onSaved={loadSite} />}
        {password && tab === "image" && <ImageTab siteId={siteId} site={site} api={api} setMsg={setMsg} />}
        {password && tab === "optimizations" && <HistoryTab siteId={siteId} api={api} />}
      </div>
    </main>
  );
}

type ApiFn = (path: string, init?: RequestInit) => Promise<{ ok: boolean; json: any }>;

function monthsSince(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / (30 * 86_400_000);
}

function BlogTab({ siteId, site, api, setMsg }: { siteId: string; site: any; api: ApiFn; setMsg: (s: string | null) => void }) {
  const [posts, setPosts] = useState<any[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "stale" | "draft">("all");

  const load = useCallback(async () => {
    setLoading(true);
    const { ok, json } = await api(`/api/admin/sites/${siteId}/posts`);
    setLoading(false);
    if (ok) setPosts(json.posts || []); else setMsg(json.error || "Erreur lecture articles");
  }, [siteId, api, setMsg]);
  useEffect(() => { load(); }, [load]);

  async function update(post: any) {
    setBusy(post.external_id); setMsg("Refresh de l'article en cours (1 a 2 min, images preservees)...");
    const { ok, json } = await api(`/api/admin/sites/${siteId}/blog-archive/refresh-one`, {
      method: "POST",
      body: JSON.stringify({ shopify_article_id: post.external_id, target_title: post.title }),
    });
    setBusy(null); setMsg(ok ? "Article rafraichi." : `Echec: ${json.error}`); load();
  }

  const staleCount = posts.filter((p) => p.date && monthsSince(p.updated_at) >= 6).length;
  const draftCount = posts.filter((p) => p.status !== "published").length;
  const shown = posts.filter((p) =>
    filter === "all" ? true : filter === "stale" ? monthsSince(p.updated_at) >= 6 : p.status !== "published"
  );

  const KPI = ({ label, value, hint }: { label: string; value: string; hint?: string }) => (
    <div className={cardCls}><div className="text-[11px] uppercase tracking-wider text-zinc-500">{label}</div><div className="mt-1 text-2xl font-semibold text-zinc-100">{value}</div>{hint && <div className="text-xs text-zinc-500">{hint}</div>}</div>
  );

  if (loading) return <p className="text-sm text-zinc-400"><Loader2 size={14} className="inline animate-spin" /> Lecture des articles depuis Shopify...</p>;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPI label="Articles total" value={String(posts.length)} hint={`${draftCount} brouillon(s)`} />
        <KPI label="A actualiser" value={String(staleCount)} hint="> 6 mois sans update" />
        <KPI label="Quota auto" value={`${site?.daily_post_quota ?? 0} / j`} hint={`${(site?.daily_post_quota ?? 0) * 30}/mois max`} />
        <KPI label="Quota refresh" value={`${site?.daily_update_quota ?? 0} / j`} hint="onglet Archive" />
      </div>

      <div className="flex items-center gap-2">
        {(["all", "stale", "draft"] as const).map((fl) => (
          <button key={fl} onClick={() => setFilter(fl)} className={`rounded-full border px-2.5 py-1 text-xs ${filter === fl ? "border-emerald-600 text-emerald-300" : "border-zinc-700 text-zinc-400"}`}>
            {fl === "all" ? `Tous (${posts.length})` : fl === "stale" ? `A actualiser (${staleCount})` : `Brouillons (${draftCount})`}
          </button>
        ))}
        <button onClick={load} className={`${ghostBtn} ml-auto`}><RefreshCwTab /> Rafraichir</button>
      </div>

      <div className="space-y-2">
        {shown.length === 0 && <p className="text-sm text-zinc-500">Aucun article dans ce filtre.</p>}
        {shown.map((p) => {
          const months = monthsSince(p.updated_at);
          return (
            <div key={p.external_id} className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
              <div className="min-w-0">
                <a href={p.url} target="_blank" rel="noreferrer" className="truncate text-sm text-zinc-200 hover:text-emerald-400">{p.title}</a>
                <p className="text-xs text-zinc-500">
                  {p.status === "published" ? "publie" : "brouillon"} · maj il y a {Math.round(months * 30)}j
                  {months >= 6 && <span className="text-amber-400"> · a actualiser</span>}
                </p>
              </div>
              <button onClick={() => update(p)} disabled={busy === p.external_id} className={ghostBtn}>
                {busy === p.external_id ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />} Mettre a jour
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RefreshCwTab() {
  return <Wand2 size={12} />;
}

function RoadmapTab({ siteId, site, api, setMsg, onSiteChanged }: { siteId: string; site: any; api: ApiFn; setMsg: (s: string | null) => void; onSiteChanged: () => void }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [keyword, setKeyword] = useState("");
  const [brief, setBrief] = useState("");
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParseResult | null>(null);

  const load = useCallback(async () => {
    const { ok, json } = await api(`/api/admin/sites/${siteId}/jobs`);
    if (ok) setJobs(json.jobs || []);
  }, [siteId, api]);
  useEffect(() => { load(); }, [load]);

  const quota = site?.daily_post_quota ?? 0;
  const autoOn = !!site?.auto_publish_enabled;
  const pending = jobs.filter((j) => j.status === "pending").length;
  const inProgress = jobs.filter((j) => j.status === "in_progress").length;
  const doneCount = jobs.filter((j) => j.status === "done").length;
  const queueSize = pending + inProgress;
  const blockedReason = site?.connection_status !== "connected" ? "Site non connecte" : quota === 0 ? "Quota daily a 0" : null;

  async function toggleAuto() {
    setBusy("auto");
    const { ok, json } = await api(`/api/admin/sites/update`, { method: "POST", body: JSON.stringify({ site_id: siteId, auto_publish_enabled: !autoOn }) });
    setBusy(null); setMsg(ok ? (autoOn ? "Auto-publish desactive." : "Auto-publish active.") : `Erreur: ${json.error}`);
    if (ok) onSiteChanged();
  }
  async function addSingle() {
    if (keyword.trim().length < 2) return;
    setBusy("single");
    const { ok, json } = await api(`/api/admin/sites/${siteId}/jobs`, { method: "POST", body: JSON.stringify({ items: [{ keyword: keyword.trim(), brief: brief.trim() || null }] }) });
    setBusy(null); setMsg(ok ? "Mot-cle ajoute a la roadmap." : `Erreur: ${json.error}`);
    if (ok) { setKeyword(""); setBrief(""); load(); }
  }
  function onRaw(v: string) { setRaw(v); setParsed(v.trim() ? parseKeywordInput(v) : null); }
  async function importBulk() {
    if (!parsed?.keywords.length) return;
    setBusy("bulk");
    const items = parsed.keywords.map((k) => ({ keyword: k.keyword, brief: k.brief, priority: k.priority, target_blog_hint: k.targetBlogHint || null }));
    const { ok, json } = await api(`/api/admin/sites/${siteId}/jobs`, { method: "POST", body: JSON.stringify({ items }) });
    setBusy(null); setMsg(ok ? `${json.enqueued} mots-cles importes.` : `Erreur: ${json.error}`);
    if (ok) { setRaw(""); setParsed(null); load(); }
  }
  async function runNow(id: string) {
    setBusy(id); setMsg("Generation en cours (1 a 2 min)...");
    const { ok, json } = await api(`/api/admin/jobs/run`, { method: "POST", body: JSON.stringify({ job_id: id }) });
    setBusy(null); setMsg(ok ? "Article publie." : `Echec: ${json.error}`); load();
  }

  const KPI = ({ label, value, hint }: { label: string; value: string; hint?: string }) => (
    <div className={cardCls}><div className="text-[11px] uppercase tracking-wider text-zinc-500">{label}</div><div className="mt-1 text-2xl font-semibold text-zinc-100">{value}</div>{hint && <div className="text-xs text-zinc-500">{hint}</div>}</div>
  );

  return (
    <div className="space-y-5">
      <div className={`${cardCls} flex items-center justify-between`}>
        <div className="flex items-center gap-3">
          {autoOn ? <Zap size={22} className="text-emerald-400" /> : <ZapOff size={22} className="text-zinc-500" />}
          <div>
            <p className="font-medium">{autoOn ? "Mode auto-publish ACTIF" : "Mode auto-publish INACTIF"}</p>
            <p className="text-xs text-zinc-500">
              {autoOn ? `Le cron tourne et publie jusqu'a ${quota} article(s)/jour automatiquement.`
                : blockedReason ? `Impossible d'activer : ${blockedReason}.`
                : "Active pour que la roadmap se genere et se publie toute seule."}
            </p>
          </div>
        </div>
        <button onClick={toggleAuto} disabled={busy === "auto" || (!autoOn && !!blockedReason)}
          className={autoOn ? "rounded-lg border border-red-700 bg-red-950/30 px-3 py-2 text-sm text-red-300 disabled:opacity-40" : primaryBtn}>
          {busy === "auto" ? <Loader2 size={16} className="inline animate-spin" /> : null} {autoOn ? "Desactiver le flow" : "Activer le flow"}
        </button>
      </div>

      {quota === 0 && (
        <p className="rounded-lg border border-amber-900 bg-amber-950/40 p-3 text-sm text-amber-300">
          Quota a zero : tu peux empiler des mots-cles mais rien ne se generera tant que le quota est a 0. Regle-le dans l'onglet Profil (Articles/jour).
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPI label="Mots-cles en file" value={String(queueSize)} hint={`${pending} pending · ${inProgress} en cours`} />
        <KPI label="Cadence prevue" value={`${quota} / jour`} hint={`${quota * 30}/mois max`} />
        <KPI label="Temps pour vider" value={quota > 0 ? `~${Math.ceil(queueSize / quota)} j` : "-"} />
        <KPI label="Articles generes" value={String(doneCount)} hint="depuis cette roadmap" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className={cardCls}>
          <h3 className="mb-2 flex items-center gap-2 font-medium"><Sparkles size={16} /> Ajout simple</h3>
          <input value={keyword} onChange={(e) => setKeyword(e.target.value)} className={`${inputCls} mb-2`} placeholder="ex: the matcha bienfaits" />
          <textarea value={brief} onChange={(e) => setBrief(e.target.value)} rows={3} className={`${inputCls} mb-3`} placeholder="Brief (optionnel) : angle, intent, audience cible..." />
          <button onClick={addSingle} disabled={busy === "single" || keyword.trim().length < 2} className={primaryBtn}>
            {busy === "single" ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Ajouter a la roadmap
          </button>
        </div>

        <div className={cardCls}>
          <h3 className="mb-2 flex items-center gap-2 font-medium"><ListPlus size={16} /> Import en masse</h3>
          <textarea value={raw} onChange={(e) => onRaw(e.target.value)} rows={6} className={`${inputCls} mb-2 font-mono text-xs`} placeholder={"1 mot-cle par ligne\nOU CSV: Priorite,Categorie,Titre,Keyword,Slug"} />
          {parsed && (
            <p className="mb-2 text-xs text-zinc-400">
              {parsed.keywords.length} mots-cles ({parsed.format})
              {parsed.warnings.length > 0 && <span className="text-amber-400"> · {parsed.warnings.length} avertissement(s)</span>}
            </p>
          )}
          <button onClick={importBulk} disabled={busy === "bulk" || !parsed?.keywords.length} className={primaryBtn}>
            {busy === "bulk" ? <Loader2 size={16} className="animate-spin" /> : <ListPlus size={16} />} Importer {parsed?.keywords.length ? `(${parsed.keywords.length})` : ""}
          </button>
        </div>
      </div>

      <div>
        <h3 className="mb-3 font-medium">File ({jobs.length})</h3>
        <div className="space-y-2">
          {jobs.length === 0 && <p className="text-sm text-zinc-500">Aucun mot-cle en file.</p>}
          {jobs.map((job) => (
            <div key={job.id} className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
              <div className="min-w-0">
                <p className="truncate text-sm text-zinc-200">{job.keyword || job.kind}</p>
                {job.error && <p className="truncate text-xs text-red-400">{job.error}</p>}
                {job.output?.url && <a href={job.output.url} target="_blank" rel="noreferrer" className="text-xs text-emerald-400">Voir l'article</a>}
              </div>
              <div className="flex items-center gap-3">
                <Status status={job.status} />
                {(job.status === "pending" || job.status === "error") && (
                  <button onClick={() => runNow(job.id)} disabled={busy === job.id} className={ghostBtn}>
                    {busy === job.id ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />} Generer
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const FRESHNESS_META: Record<string, { dot: string; label: string; color: string }> = {
  fresh: { dot: "bg-emerald-400", label: "A jour", color: "text-emerald-300" },
  aging: { dot: "bg-amber-400", label: "Vieillissant", color: "text-amber-300" },
  stale: { dot: "bg-red-400", label: "Perime", color: "text-red-300" },
  never: { dot: "bg-zinc-500", label: "Jamais", color: "text-zinc-400" },
};

function ArchiveTab({ siteId, api, setMsg }: { siteId: string; api: ApiFn; setMsg: (s: string | null) => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("stale");
  const [bulkN, setBulkN] = useState(3);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { ok, json } = await api(`/api/admin/sites/${siteId}/blog-archive`);
    setLoading(false);
    if (ok) setData(json); else setMsg(json.error || "Erreur");
  }, [siteId, api, setMsg]);
  useEffect(() => { load(); }, [load]);

  async function setCadence(n: number) {
    setBusy("cad");
    const { ok, json } = await api(`/api/admin/sites/${siteId}/blog-archive/cadence`, { method: "POST", body: JSON.stringify({ daily_update_quota: n }) });
    setBusy(null); setMsg(ok ? `Cadence reglee a ${n}/jour.` : `Erreur: ${json.error}`); load();
  }
  async function refreshOne(a: any) {
    setBusy(a.id); setMsg("Regeneration en cours (images preservees)...");
    const { ok, json } = await api(`/api/admin/sites/${siteId}/blog-archive/refresh-one`, { method: "POST", body: JSON.stringify({ shopify_article_id: a.id, target_title: a.title }) });
    setBusy(null); setMsg(ok ? "Article regenere." : `Echec: ${json.error}`); load();
  }
  async function bulkRun() {
    const targets = (data?.articles || []).filter((a: any) => a.freshness === "stale").slice(0, bulkN);
    if (!targets.length) return;
    setBusy("bulk"); setMsg(`Regeneration de ${targets.length} articles...`);
    for (const a of targets) {
      await api(`/api/admin/sites/${siteId}/blog-archive/refresh-one`, { method: "POST", body: JSON.stringify({ shopify_article_id: a.id, target_title: a.title }) });
    }
    setBusy(null); setMsg("Bulk termine."); load();
  }

  if (loading) return <p className="text-sm text-zinc-400"><Loader2 size={14} className="inline animate-spin" /> Lecture du catalogue...</p>;
  if (!data) return <p className="text-sm text-zinc-500">Aucune donnee.</p>;

  const s = data.stats;
  const stats: [string, number][] = [["Total", s.total], ["A jour", s.fresh], ["Vieillissant", s.aging], ["Perimes", s.stale], ["En cours", s.running], ["En file", s.queued]];
  const filters: [string, number][] = [["all", s.total], ["fresh", s.fresh], ["aging", s.aging], ["stale", s.stale]];
  const shown = (data.articles || []).filter((a: any) => filter === "all" || a.freshness === filter);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
        {stats.map(([label, val]) => (
          <div key={label} className={`${cardCls} text-center`}><div className="text-xl font-semibold text-zinc-100">{val}</div><div className="text-[10px] uppercase text-zinc-500">{label}</div></div>
        ))}
      </div>

      <div className={cardCls}>
        <h3 className="mb-1 font-medium">Cadence auto-refresh</h3>
        <p className="mb-3 text-xs text-zinc-500">Nombre d'articles perimes que le cron regenere chaque jour. 0 = manuel uniquement.</p>
        <div className="flex gap-2">
          {[0, 1, 3, 6].map((n) => (
            <button key={n} onClick={() => setCadence(n)} disabled={busy === "cad"}
              className={`rounded-lg border px-3 py-1.5 text-sm ${data.site.daily_update_quota === n ? "border-emerald-600 bg-emerald-950/30 text-emerald-300" : "border-zinc-700 text-zinc-400"}`}>
              {n === 0 ? "Off" : `${n}/jour`}
            </button>
          ))}
        </div>
      </div>

      {s.stale > 0 && (
        <div className={`${cardCls} flex flex-wrap items-center gap-3`}>
          <span className="text-sm text-zinc-300">{s.stale} articles perimes regenerables</span>
          <div className="flex gap-1">
            {[3, 6, 10].map((n) => (
              <button key={n} onClick={() => setBulkN(n)} className={`rounded px-2 py-1 text-xs ${bulkN === n ? "bg-white text-black" : "border border-zinc-700 text-zinc-400"}`}>{n}</button>
            ))}
          </div>
          <button onClick={bulkRun} disabled={busy === "bulk"} className={primaryBtn}>
            {busy === "bulk" ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />} Lancer {bulkN} maintenant
          </button>
        </div>
      )}

      <div className="flex items-center gap-2">
        {filters.map(([f, n]) => (
          <button key={f} onClick={() => setFilter(f)} className={`rounded-full border px-2.5 py-1 text-xs ${filter === f ? "border-emerald-600 text-emerald-300" : "border-zinc-700 text-zinc-400"}`}>
            {f === "all" ? "Tous" : FRESHNESS_META[f].label} ({n})
          </button>
        ))}
        <button onClick={load} className={`${ghostBtn} ml-auto`}><RefreshCwTab /> Rafraichir</button>
      </div>

      <div className="space-y-2">
        {shown.slice(0, 200).map((a: any) => {
          const fm = FRESHNESS_META[a.freshness] || FRESHNESS_META.never;
          return (
            <div key={a.id} className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className={`h-2 w-2 shrink-0 rounded-full ${fm.dot}`} />
                <div className="min-w-0">
                  <a href={a.url} target="_blank" rel="noreferrer" className="truncate text-sm text-zinc-200 hover:text-emerald-400">{a.title}</a>
                  <p className={`text-xs ${fm.color}`}>{fm.label} · {a.days_since_update}j {a.last_job?.status === "running" ? "· regen en cours" : ""}</p>
                </div>
              </div>
              <button onClick={() => refreshOne(a)} disabled={busy === a.id} className={ghostBtn}>
                {busy === a.id ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />} Regenerer
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const FILTERS = ["all", "needs_work", "proposed", "applied", "not_audited"];

function ProductsTab({ siteId, api, setMsg }: { siteId: string; api: ApiFn; setMsg: (s: string | null) => void }) {
  const [products, setProducts] = useState<any[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [drawer, setDrawer] = useState<any>(null);
  const pw = typeof window !== "undefined" ? localStorage.getItem(PW_KEY) || "" : "";

  const load = useCallback(async () => {
    setLoading(true);
    const { ok, json } = await api(`/api/admin/sites/${siteId}/products`);
    setLoading(false);
    if (ok) setProducts(json.products || []); else setMsg(json.error || "Erreur");
  }, [siteId, api, setMsg]);
  useEffect(() => { load(); }, [load]);

  async function auditAll() {
    setBusy("auditall"); setMsg("Audit heuristique en masse...");
    const { ok, json } = await api(`/api/admin/sites/${siteId}/products/audit-batch`, { method: "POST", body: JSON.stringify({ limit: 1500 }) });
    setBusy(null); setMsg(ok ? `${json.audited} produit(s) audites` : `Erreur: ${json.error}`); load();
  }
  async function optimizeSel() {
    if (!sel.size) return;
    setBusy("optsel"); setMsg(`Optimisation de ${sel.size} produit(s) (Sonnet)...`);
    const { ok, json } = await api(`/api/admin/sites/${siteId}/products/optimize-batch`, { method: "POST", body: JSON.stringify({ external_ids: Array.from(sel) }) });
    setBusy(null); setMsg(ok ? `${json.optimized}/${json.queued} optimise(s)` : `Erreur: ${json.error}`); setSel(new Set()); load();
  }
  async function apply(id: string) {
    setBusy(id + "p"); setMsg("Application sur Shopify...");
    const { ok, json } = await api(`/api/admin/sites/${siteId}/products/apply`, { method: "POST", body: JSON.stringify({ external_id: id }) });
    setBusy(null); setMsg(ok ? "Fiche produit mise a jour." : `Erreur: ${json.error}`); load();
  }
  async function revert(id: string) {
    setBusy(id + "r"); setMsg("Restauration de la version d'origine...");
    const { ok, json } = await api(`/api/admin/sites/${siteId}/products/revert`, { method: "POST", body: JSON.stringify({ external_id: id }) });
    setBusy(null); setMsg(ok ? "Version d'origine restauree." : `Erreur: ${json.error}`); load();
  }
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const shown = products.filter((p) => filter === "all" || p.status === filter);
  const scored = products.filter((p) => p.audit_score != null);
  const avg = scored.length ? Math.round(scored.reduce((a, p) => a + p.audit_score, 0) / scored.length) : 0;
  if (loading) return <p className="text-sm text-zinc-400"><Loader2 size={14} className="inline animate-spin" /> Chargement des produits Shopify...</p>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((fl) => (
          <button key={fl} onClick={() => setFilter(fl)} className={`rounded-full border px-2.5 py-1 text-xs ${filter === fl ? "border-emerald-600 text-emerald-300" : "border-zinc-700 text-zinc-400"}`}>{fl}</button>
        ))}
        <div className="ml-auto flex gap-2">
          <button onClick={auditAll} disabled={busy === "auditall"} className={ghostBtn}>
            {busy === "auditall" ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />} Auditer tout
          </button>
          <button onClick={optimizeSel} disabled={busy === "optsel" || !sel.size} className={primaryBtn}>
            {busy === "optsel" ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Optimiser ({sel.size})
          </button>
        </div>
      </div>

      <div className="flex gap-4 text-xs text-zinc-500">
        <span>{products.length} produits</span>
        <span>Score moyen: {avg}/100</span>
        <span>Need work: {products.filter((p) => p.status === "needs_work").length}</span>
        <span>Proposes: {products.filter((p) => p.status === "proposed").length}</span>
        <span>Appliques: {products.filter((p) => p.status === "applied").length}</span>
      </div>

      {shown.length === 0 && <p className="text-sm text-zinc-500">Aucun produit dans ce filtre.</p>}
      {shown.map((p) => (
        <div key={p.external_id} className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
          <div className="flex min-w-0 items-center gap-3">
            <input type="checkbox" checked={sel.has(p.external_id)} onChange={() => toggle(p.external_id)} />
            {p.image && <img src={p.image} alt="" className="h-10 w-10 rounded object-cover" />}
            <div className="min-w-0">
              <p className="truncate text-sm text-zinc-200">{p.title}</p>
              <div className="flex flex-wrap items-center gap-2">
                <Status status={p.status} />
                {p.audit_score != null && <span className={`text-xs ${p.audit_score >= 80 ? "text-emerald-400" : p.audit_score >= 40 ? "text-amber-400" : "text-red-400"}`}>score {p.audit_score}</span>}
                {(p.audit_issues || []).slice(0, 3).map((iss: string) => <span key={iss} className="rounded bg-red-950/40 px-1.5 text-[10px] text-red-300">{iss}</span>)}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setDrawer(p)} className={ghostBtn}><ExternalLink size={12} /> Detail</button>
            {p.has_proposal && (
              <button onClick={() => apply(p.external_id)} disabled={busy === p.external_id + "p"} className={ghostBtn}>
                {busy === p.external_id + "p" ? <Loader2 size={12} className="animate-spin" /> : <UploadCloud size={12} />} Appliquer
              </button>
            )}
            {p.status === "applied" && (
              <button onClick={() => revert(p.external_id)} disabled={busy === p.external_id + "r"} className={ghostBtn} title="Restaurer l'origine">
                {busy === p.external_id + "r" ? <Loader2 size={12} className="animate-spin" /> : <Undo2 size={12} />} Annuler
              </button>
            )}
          </div>
        </div>
      ))}

      {drawer && <ProductDrawer siteId={siteId} api={api} product={drawer} pw={pw} onClose={() => setDrawer(null)} />}
    </div>
  );
}

function ProductDrawer({ siteId, api, product, pw, onClose }: { siteId: string; api: ApiFn; product: any; pw: string; onClose: () => void }) {
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    api(`/api/admin/sites/${siteId}/products/proposed?external_id=${encodeURIComponent(product.external_id)}`).then(({ ok, json }) => ok && setData(json));
  }, [siteId, api, product.external_id]);
  const pp = data?.proposed;
  const cm = pp?.channel_meta;
  const cro = pp?.cro_signals;
  const Diff = ({ label, a, b }: { label: string; a?: string; b?: string }) => (
    <div className="grid grid-cols-2 gap-2 text-xs">
      <div><p className="mb-1 text-zinc-500">{label} avant</p><p className="line-clamp-3 text-zinc-400">{a || "-"}</p></div>
      <div><p className="mb-1 text-zinc-500">{label} apres</p><p className="line-clamp-3 text-emerald-300">{b || "-"}</p></div>
    </div>
  );
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60">
      <div className="h-full w-full max-w-2xl overflow-y-auto border-l border-zinc-800 bg-zinc-950 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="truncate font-semibold">{product.title}</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-100"><Undo2 size={18} /></button>
        </div>
        {!data && <p className="text-sm text-zinc-400"><Loader2 size={14} className="inline animate-spin" /> Chargement...</p>}
        {data && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-sm">
              <span className={`${data.audit_score >= 80 ? "text-emerald-400" : data.audit_score >= 40 ? "text-amber-400" : "text-red-400"}`}>Score audit {data.audit_score}/100</span>
              <Status status={data.status} />
            </div>
            {(data.audit_issues || []).length > 0 && (
              <div className="flex flex-wrap gap-1">{data.audit_issues.map((i: string) => <span key={i} className="rounded bg-red-950/40 px-1.5 text-[10px] text-red-300">{i}</span>)}</div>
            )}
            {!pp && <p className="text-sm text-zinc-500">Pas encore de version optimisee. Selectionne le produit et clique Optimiser.</p>}
            {pp && (
              <>
                <Diff label="Titre" a={data.current?.title} b={pp.title} />
                <Diff label="Description" a={(data.current?.body_html || "").replace(/<[^>]+>/g, " ").slice(0, 200)} b={(pp.body_html || "").replace(/<[^>]+>/g, " ").slice(0, 200)} />
                {cm && (
                  <div className="grid gap-2 sm:grid-cols-3">
                    {[["Shopify", cm.shopify], ["Google", cm.google_shopping], ["Meta Ads", cm.meta_ads]].map(([name, m]: any) => (
                      <div key={name} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-2 text-[11px]">
                        <p className="mb-1 font-medium text-zinc-300">{name}</p>
                        <pre className="whitespace-pre-wrap break-words text-zinc-500">{JSON.stringify(m, null, 1)}</pre>
                      </div>
                    ))}
                  </div>
                )}
                {cro && (
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(cro).map(([k, v]) => (
                      <span key={k} className={`rounded-full px-2 py-0.5 text-[10px] ${v ? "bg-emerald-500/15 text-emerald-300" : "bg-zinc-800 text-zinc-500"}`}>{k}</span>
                    ))}
                  </div>
                )}
                <iframe src={`/api/admin/sites/${siteId}/products/preview?external_id=${encodeURIComponent(product.external_id)}&pw=${encodeURIComponent(pw)}`} className="h-96 w-full rounded-lg border border-zinc-800 bg-white" />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CategoriesTab({ siteId, api, setMsg }: { siteId: string; api: ApiFn; setMsg: (s: string | null) => void }) {
  const [taxos, setTaxos] = useState<any[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { ok, json } = await api(`/api/admin/sites/${siteId}/taxonomies`);
    setLoading(false);
    if (ok) setTaxos(json.taxonomies || []); else setMsg(json.error || "Erreur");
  }, [siteId, api, setMsg]);
  useEffect(() => { load(); }, [load]);

  const [histFor, setHistFor] = useState<any>(null);

  async function analyze(id: string) {
    setBusy(id + "a"); setMsg("Analyse IA en cours...");
    const { ok, json } = await api(`/api/admin/sites/${siteId}/taxonomies/analyze`, { method: "POST", body: JSON.stringify({ tax_id: id }) });
    setBusy(null); setMsg(ok ? "Version optimisee prete." : `Erreur: ${json.error}`); load();
  }
  async function genImage(id: string) {
    setBusy(id + "i"); setMsg("Generation de l'image de collection (fal)...");
    const { ok, json } = await api(`/api/admin/sites/${siteId}/taxonomies/image`, { method: "POST", body: JSON.stringify({ tax_id: id }) });
    setBusy(null); setMsg(ok ? "Image generee et poussee." : `Erreur: ${json.error}`); load();
  }
  async function push(id: string) {
    setBusy(id + "p"); setMsg("Push sur Shopify...");
    const { ok, json } = await api(`/api/admin/sites/${siteId}/taxonomies/push`, { method: "POST", body: JSON.stringify({ tax_id: id }) });
    setBusy(null); setMsg(ok ? "Collection mise a jour." : `Erreur: ${json.error}`); load();
  }

  if (loading) return <p className="text-sm text-zinc-400"><Loader2 size={14} className="inline animate-spin" /> Synchronisation des collections...</p>;
  return (
    <div className="space-y-2">
      {taxos.length === 0 && <p className="text-sm text-zinc-500">Aucune collection.</p>}
      {taxos.map((t) => (
        <div key={t.id} className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
          <div className="min-w-0">
            <p className="truncate text-sm text-zinc-200">{t.name}</p>
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              {t.quality_score != null && <span>score {t.quality_score}</span>}
              {t.intent_class && <span>{t.intent_class}</span>}
              {t.push_status === "pushed" && <span className="text-emerald-400">pousse</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setHistFor(t)} className={ghostBtn}><History size={12} /> Historique</button>
            <button onClick={() => genImage(t.id)} disabled={busy === t.id + "i"} className={ghostBtn} title="Toujours actif">
              {busy === t.id + "i" ? <Loader2 size={12} className="animate-spin" /> : <ImageIcon size={12} />} {t.suggested_image_url ? "Re-generer image" : "Image"}
            </button>
            <button onClick={() => analyze(t.id)} disabled={busy === t.id + "a"} className={ghostBtn}>
              {busy === t.id + "a" ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />} Analyser
            </button>
            {t.suggested_description_html && (
              <button onClick={() => push(t.id)} disabled={busy === t.id + "p"} className={ghostBtn}>
                {busy === t.id + "p" ? <Loader2 size={12} className="animate-spin" /> : <UploadCloud size={12} />} Pousser
              </button>
            )}
          </div>
        </div>
      ))}
      {histFor && <HistoryDrawer siteId={siteId} api={api} tax={histFor} onClose={() => setHistFor(null)} />}
    </div>
  );
}

function HistoryDrawer({ siteId, api, tax, onClose }: { siteId: string; api: ApiFn; tax: any; onClose: () => void }) {
  const [events, setEvents] = useState<any[]>([]);
  useEffect(() => {
    api(`/api/admin/sites/${siteId}/optimizations?target_id=${tax.id}`).then(({ ok, json }) => ok && setEvents(json.optimizations || []));
  }, [siteId, api, tax.id]);
  const isImg = (v?: string) => typeof v === "string" && /^https?:\/\//.test(v);
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60">
      <div className="h-full w-full max-w-xl overflow-y-auto border-l border-zinc-800 bg-zinc-950 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">Historique: {tax.name}</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-100"><Undo2 size={18} /></button>
        </div>
        {events.length === 0 && <p className="text-sm text-zinc-500">Aucun evenement.</p>}
        <div className="space-y-3">
          {events.map((e) => (
            <div key={e.id} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-sm text-zinc-200">{e.kind}</span>
                <span className="text-xs text-zinc-500">{new Date(e.done_at).toLocaleString()} · {e.source}</span>
              </div>
              {e.note && <p className="mb-2 text-xs text-zinc-500">{e.note}</p>}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="mb-1 text-zinc-500">Avant</p>
                  {isImg(e.before_value) ? <img src={e.before_value} alt="" className="rounded" /> : <p className="line-clamp-4 text-zinc-400">{e.before_value || "-"}</p>}
                </div>
                <div>
                  <p className="mb-1 text-zinc-500">Apres</p>
                  {isImg(e.after_value) ? <img src={e.after_value} alt="" className="rounded" /> : <p className="line-clamp-4 text-zinc-400">{e.after_value || "-"}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const POSITION_OPTS = [
  { v: "0.2", l: "20% de l'article" }, { v: "0.4", l: "40%" }, { v: "0.5", l: "50% (sweet spot)" },
  { v: "0.6", l: "60%" }, { v: "0.8", l: "80%" }, { v: "end", l: "Fin de l'article" },
];

function ScroTab({ siteId, api, setMsg }: { siteId: string; api: ApiFn; setMsg: (s: string | null) => void }) {
  const [config, setConfig] = useState<any>(null);
  const [catalog, setCatalog] = useState<any>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    const [c, cat] = await Promise.all([api(`/api/admin/sites/${siteId}/scro`), api(`/api/admin/sites/${siteId}/scro/catalog`)]);
    if (c.ok) setConfig(c.json.config);
    if (cat.ok) setCatalog(cat.json);
  }, [siteId, api]);
  useEffect(() => { load(); }, [load]);

  const patch = (p: any) => { setConfig((c: any) => ({ ...c, ...p })); setDirty(true); };
  const setSidebar = (k: string, v: any) => { setConfig((c: any) => ({ ...c, sidebar: { ...c.sidebar, [k]: { ...c.sidebar?.[k], ...v } } })); setDirty(true); };

  async function save() {
    setBusy("save");
    const { ok, json } = await api(`/api/admin/sites/${siteId}/scro`, { method: "POST", body: JSON.stringify(config) });
    setBusy(null); setMsg(ok ? "Config sauvegardee." : `Erreur: ${json.error}`);
    if (ok) { setConfig(json.config); setDirty(false); }
  }
  async function push() {
    setBusy("push"); setMsg("Push des blocs CRO dans le theme...");
    if (dirty) await api(`/api/admin/sites/${siteId}/scro`, { method: "POST", body: JSON.stringify(config) });
    const { ok, json } = await api(`/api/admin/sites/${siteId}/scro/push`, { method: "POST", body: JSON.stringify({}) });
    setBusy(null); setMsg(ok ? "Blocs pousses dans le theme." : `Erreur: ${json.error}`);
    if (ok) { setDirty(false); load(); }
  }
  async function removeScro() {
    setBusy("remove"); setMsg("Retrait des blocs du theme...");
    const { ok, json } = await api(`/api/admin/sites/${siteId}/scro/remove`, { method: "POST", body: JSON.stringify({}) });
    setBusy(null); setMsg(ok ? "Blocs retires du theme." : `Erreur: ${json.error}`); if (ok) load();
  }
  async function genIcons() {
    setBusy("icons"); setMsg("Generation des icones (Claude)...");
    const { ok, json } = await api(`/api/admin/sites/${siteId}/scro/generate-icons`, { method: "POST", body: JSON.stringify({}) });
    setBusy(null); setMsg(ok ? "Icones generees." : `Erreur: ${json.error}`);
  }
  async function autoData() {
    setBusy("auto"); setMsg("Auto-remplissage (collections + articles)...");
    const { ok, json } = await api(`/api/admin/sites/${siteId}/scro/auto-data`, { method: "POST", body: JSON.stringify({ want: ["lead_magnet", "top_collections", "top_articles"] }) });
    setBusy(null);
    if (ok) {
      if (json.lead_magnet?.data) setSidebar("lead_magnet", json.lead_magnet.data);
      if (json.top_collections?.data) setSidebar("top_categories", { manual_handles: json.top_collections.data.map((d: any) => d.handle), auto: false });
      if (json.top_articles?.data) setSidebar("top_articles", { manual_handles: json.top_articles.data.map((d: any) => d.handle) });
      setMsg("Auto-rempli."); setDirty(true);
    } else setMsg(`Erreur: ${json.error}`);
  }

  function addBlock() {
    if ((config.blocks || []).length >= 5) return;
    patch({ blocks: [...(config.blocks || []), { position: "0.4", kind: "product", handle: "", label: "Coup de coeur", cta: "Voir le produit" }] });
  }
  function updateBlock(i: number, p: any) {
    const blocks = [...config.blocks]; blocks[i] = { ...blocks[i], ...p }; patch({ blocks });
  }
  function removeBlock(i: number) { patch({ blocks: config.blocks.filter((_: any, j: number) => j !== i) }); }

  if (!config || !catalog) return <p className="text-sm text-zinc-400"><Loader2 size={14} className="inline animate-spin" /> Chargement SCRO...</p>;
  const br = catalog.branding || {};
  const sb = config.sidebar || {};
  const productOpts = catalog.products || [];
  const collectionOpts = catalog.collections || [];

  return (
    <div className="space-y-5 pb-24">
      <div className={cardCls}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="flex items-center gap-2 font-medium"><ShoppingBag size={16} className="text-amber-300" /> SCRO, blocs CRO dans le theme</h3>
            <p className="mt-1 text-xs text-zinc-500">Injecte des cartes produit/collection + une sidebar dans tes articles. Push ecrit dans `sections/main-article.liquid`. Re-pushable, rollback en 1 clic.</p>
          </div>
          <button onClick={() => patch({ inline_enabled: !config.inline_enabled })} className={`rounded-lg border px-3 py-1.5 text-sm ${config.inline_enabled ? "border-emerald-600 text-emerald-300" : "border-zinc-700 text-zinc-400"}`}>
            Inline {config.inline_enabled ? "ON" : "OFF"}
          </button>
        </div>
        {config.last_push_status && (
          <p className="mt-3 text-xs text-zinc-500">
            Dernier push : {config.last_pushed_at ? new Date(config.last_pushed_at).toLocaleString() : "-"} · statut{" "}
            <span className={config.last_push_status === "ok" ? "text-emerald-400" : config.last_push_status === "removed" ? "text-zinc-400" : "text-red-400"}>{config.last_push_status}</span>
            {config.last_push_error ? ` · ${config.last_push_error}` : ""}
          </p>
        )}
      </div>

      <div className={cardCls}>
        <h3 className="mb-2 font-medium">Palette detectee</h3>
        <div className="flex flex-wrap gap-3">
          {["accent", "accentDark", "cardBg", "border", "textDark", "ratingColor"].map((k) => (
            <div key={k} className="text-center">
              <div className="h-8 w-8 rounded border border-zinc-700" style={{ background: br[k] }} />
              <div className="mt-1 text-[10px] text-zinc-500">{k}</div>
            </div>
          ))}
        </div>
      </div>

      <div className={cardCls}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-medium">Blocs inline ({(config.blocks || []).length}/5)</h3>
          <button onClick={addBlock} disabled={(config.blocks || []).length >= 5} className={ghostBtn}><Plus size={12} /> Ajouter</button>
        </div>
        <div className="space-y-3">
          {(config.blocks || []).length === 0 && <p className="text-sm text-zinc-500">Aucun bloc. Clique Ajouter.</p>}
          {(config.blocks || []).map((b: any, i: number) => (
            <div key={i} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="rounded bg-amber-950/40 px-2 py-0.5 text-[10px] text-amber-300">Slot {i + 1}</span>
                <button onClick={() => removeBlock(i)} className="text-zinc-500 hover:text-red-400"><Trash2 size={14} /></button>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <select value={String(b.position)} onChange={(e) => updateBlock(i, { position: e.target.value })} className={inputCls}>
                  {POSITION_OPTS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
                </select>
                <select value={b.kind} onChange={(e) => updateBlock(i, { kind: e.target.value, handle: "" })} className={inputCls}>
                  <option value="product">Produit</option><option value="collection">Collection</option>
                </select>
                <select value={b.handle} onChange={(e) => updateBlock(i, { handle: e.target.value })} className={`${inputCls} col-span-2`}>
                  <option value="">Choisir...</option>
                  {(b.kind === "product" ? productOpts : collectionOpts).map((o: any) => <option key={o.handle} value={o.handle}>{o.title}</option>)}
                </select>
                <input value={b.label} onChange={(e) => updateBlock(i, { label: e.target.value })} className={inputCls} placeholder="Label" />
                <input value={b.cta} onChange={(e) => updateBlock(i, { cta: e.target.value })} className={inputCls} placeholder="CTA" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={cardCls}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-medium">Sidebar (5 blocs)</h3>
          <button onClick={() => patch({ sidebar_enabled: !config.sidebar_enabled })} className={`rounded-lg border px-3 py-1.5 text-sm ${config.sidebar_enabled ? "border-emerald-600 text-emerald-300" : "border-zinc-700 text-zinc-400"}`}>
            Sidebar {config.sidebar_enabled ? "ON" : "OFF"}
          </button>
        </div>
        <div className="mb-3 flex flex-wrap gap-2">
          <button onClick={genIcons} disabled={busy === "icons"} className={ghostBtn}>{busy === "icons" ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />} Generer icones</button>
          <button onClick={autoData} disabled={busy === "auto"} className={ghostBtn}>{busy === "auto" ? <Loader2 size={12} className="animate-spin" /> : <UploadCloud size={12} />} Auto-remplir</button>
        </div>
        <div className="space-y-3 text-xs">
          {[
            { k: "lead_magnet", label: "1. Lead magnet" },
            { k: "bestsellers", label: "2. Best-sellers" },
            { k: "top_categories", label: "3. Categories" },
            { k: "top_articles", label: "4. Articles" },
            { k: "author", label: "5. Auteur / trust" },
          ].map(({ k, label }) => (
            <div key={k} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
              <label className="flex items-center justify-between">
                <span className="font-medium text-zinc-200">{label}</span>
                <input type="checkbox" checked={!!sb[k]?.enabled} onChange={(e) => setSidebar(k, { enabled: e.target.checked })} />
              </label>
              {k === "lead_magnet" && sb[k]?.enabled && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <input value={sb[k].title || ""} onChange={(e) => setSidebar(k, { title: e.target.value })} className={inputCls} placeholder="Titre" />
                  <input value={sb[k].promo_code || ""} onChange={(e) => setSidebar(k, { promo_code: e.target.value })} className={inputCls} placeholder="Code promo" />
                  <input value={sb[k].cta_text || ""} onChange={(e) => setSidebar(k, { cta_text: e.target.value })} className={inputCls} placeholder="CTA texte" />
                  <input value={sb[k].cta_url || ""} onChange={(e) => setSidebar(k, { cta_url: e.target.value })} className={inputCls} placeholder="CTA url" />
                </div>
              )}
              {k === "author" && sb[k]?.enabled && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <input value={sb[k].name || ""} onChange={(e) => setSidebar(k, { name: e.target.value })} className={inputCls} placeholder="Nom (vide = persona)" />
                  <input value={sb[k].role || ""} onChange={(e) => setSidebar(k, { role: e.target.value })} className={inputCls} placeholder="Role" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className={cardCls}>
        <h3 className="mb-2 font-medium">Theme cible</h3>
        <select value={config.theme_id || ""} onChange={(e) => patch({ theme_id: e.target.value || null })} className={inputCls}>
          <option value="">Theme actif (auto)</option>
          {(catalog.themes || []).map((t: any) => <option key={t.id} value={t.id}>{t.name} ({t.role})</option>)}
        </select>
        {catalog.errors?.themes && <p className="mt-2 text-xs text-red-400">{catalog.errors.themes}</p>}
      </div>

      <div className="fixed bottom-4 left-1/2 z-10 flex w-[min(90%,56rem)] -translate-x-1/2 items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950/95 p-3 backdrop-blur">
        <span className="text-xs text-zinc-400">{dirty ? "Modifications non sauvegardees" : "Tout est sauvegarde"}</span>
        <div className="flex gap-2">
          {config.last_push_status === "ok" && (
            <button onClick={removeScro} disabled={busy === "remove"} className={ghostBtn}>{busy === "remove" ? <Loader2 size={12} className="animate-spin" /> : <Undo2 size={12} />} Retirer</button>
          )}
          <button onClick={save} disabled={busy === "save" || !dirty} className={ghostBtn}>{busy === "save" ? <Loader2 size={12} className="animate-spin" /> : null} Sauvegarder</button>
          <button onClick={push} disabled={busy === "push"} className={primaryBtn}>{busy === "push" ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />} Push theme</button>
        </div>
      </div>
    </div>
  );
}

function ProfilTab({ siteId, api, setMsg, onSaved }: { siteId: string; api: ApiFn; setMsg: (s: string | null) => void; onSaved: () => void }) {
  const [vp, setVp] = useState<Record<string, any>>({});
  const [quota, setQuota] = useState(1);
  const [autoPub, setAutoPub] = useState(true);
  const [discoverUrl, setDiscoverUrl] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    api(`/api/admin/sites/list`).then(({ ok, json }) => {
      if (!ok) return;
      const s = (json.sites || []).find((x: any) => x.id === siteId);
      if (s) { setVp(s.voice_profile || {}); setQuota(s.daily_post_quota ?? 1); setAutoPub(!!s.auto_publish_enabled); if (!discoverUrl) setDiscoverUrl(s.url || ""); }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId]);

  const f = (k: string) => vp[k] ?? "";
  const set = (k: string, v: string) => setVp((p) => ({ ...p, [k]: v }));

  async function discover() {
    if (!discoverUrl.trim()) return;
    setBusy("disc"); setMsg("Analyse du site (scrape + IA)...");
    const { ok, json } = await api(`/api/admin/onboarding/discover`, { method: "POST", body: JSON.stringify({ url: discoverUrl }) });
    setBusy(null);
    if (ok) { setVp((p) => ({ ...p, ...json.voice_profile })); setMsg("Profil propose, verifie puis enregistre."); }
    else setMsg(`Erreur: ${json.error}`);
  }
  async function save() {
    setBusy("save");
    const r1 = await api(`/api/admin/sites/update-profile`, { method: "POST", body: JSON.stringify({ site_id: siteId, voice_profile: vp }) });
    const r2 = await api(`/api/admin/sites/update`, { method: "POST", body: JSON.stringify({ site_id: siteId, daily_post_quota: Number(quota), auto_publish_enabled: autoPub }) });
    setBusy(null);
    setMsg(r1.ok && r2.ok ? "Profil enregistre." : "Erreur a l'enregistrement");
    if (r1.ok && r2.ok) onSaved();
  }

  const fields: [string, string, boolean][] = [
    ["mascot", "Mascotte / persona auteur", false],
    ["tone_description", "Ton editorial", true],
    ["audience", "Audience", true],
    ["example_phrases", "Phrases exemple", true],
    ["anti_ai_custom", "Regles persona custom", true],
    ["bonus_instructions", "Instructions bonus", true],
    ["product_tone_description", "Ton fiches produit", true],
    ["image_style_hint", "Style des images", false],
    ["author_name", "Nom auteur", false],
    ["author_role", "Role auteur", false],
    ["branding_accent_hex", "Couleur accent (#hex)", false],
  ];
  const ANTI_AI_PRESETS = ["in conclusion", "delve", "tapestry", "de nos jours", "incontournable", "il est important de noter"];
  const activePatterns: string[] = Array.isArray(vp.anti_ai_patterns) ? vp.anti_ai_patterns : [];
  const togglePattern = (p: string) =>
    setVp((prev) => {
      const cur: string[] = Array.isArray(prev.anti_ai_patterns) ? prev.anti_ai_patterns : [];
      return { ...prev, anti_ai_patterns: cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p] };
    });

  return (
    <div className="space-y-5">
      <div className={cardCls}>
        <h3 className="mb-2 flex items-center gap-2 font-medium"><Sparkles size={16} /> Auto-decouverte</h3>
        <div className="flex gap-2">
          <input value={discoverUrl} onChange={(e) => setDiscoverUrl(e.target.value)} className={inputCls} placeholder="https://monsite.com" />
          <button onClick={discover} disabled={busy === "disc"} className={primaryBtn}>
            {busy === "disc" ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} Analyser
          </button>
        </div>
      </div>

      <div className={`${cardCls} space-y-3`}>
        <div>
          <label className="mb-1 block text-xs text-zinc-400">Langue du site (verrouillee apres choix)</label>
          <select value={f("content_language") || ""} onChange={(e) => set("content_language", e.target.value)} className={inputCls}>
            <option value="">Choisir une langue...</option>
            {LANGUAGES.map((l) => (
              <option key={l} value={l} className="capitalize">{l}</option>
            ))}
          </select>
        </div>
        {fields.map(([k, label, long]) => (
          <div key={k}>
            <label className="mb-1 block text-xs text-zinc-400">{label}</label>
            {long ? (
              <textarea value={f(k)} onChange={(e) => set(k, e.target.value)} rows={2} className={inputCls} />
            ) : (
              <input value={f(k)} onChange={(e) => set(k, e.target.value)} className={inputCls} />
            )}
          </div>
        ))}
        <div>
          <label className="mb-1 block text-xs text-zinc-400">Anti-AI patterns (formules a bannir)</label>
          <div className="flex flex-wrap gap-2">
            {Array.from(new Set([...ANTI_AI_PRESETS, ...activePatterns])).map((p) => (
              <button
                key={p}
                onClick={() => togglePattern(p)}
                className={`rounded-full border px-2.5 py-1 text-xs ${
                  activePatterns.includes(p) ? "border-emerald-600 bg-emerald-950/40 text-emerald-300" : "border-zinc-700 text-zinc-400"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-400">Bio auteur</label>
          <textarea value={f("author_bio")} onChange={(e) => set("author_bio", e.target.value)} rows={2} className={inputCls} />
        </div>
      </div>

      <div className={`${cardCls} flex items-center gap-6`}>
        <div>
          <label className="mb-1 block text-xs text-zinc-400">Articles / jour</label>
          <input type="number" min={0} max={50} value={quota} onChange={(e) => setQuota(Number(e.target.value))} className={`${inputCls} w-24`} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={autoPub} onChange={(e) => setAutoPub(e.target.checked)} /> Publication auto
        </label>
      </div>

      <button onClick={save} disabled={busy === "save"} className={primaryBtn}>
        {busy === "save" ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} Enregistrer
      </button>
    </div>
  );
}

const IMAGE_PRESETS_UI = [
  { id: "icon-lineart", label: "Icon line-art", model: "fal-ai/flux/schnell", cost: 0.003, desc: "Icone monoligne fond sombre, glow blanc." },
  { id: "warm-cosy", label: "Warm cosy", model: "fal-ai/flux/schnell", cost: 0.003, desc: "Photo chaleureuse, lumiere naturelle, terracotta." },
  { id: "business-editorial", label: "Business editorial", model: "fal-ai/flux/dev", cost: 0.025, desc: "Photo business moderne, sharp focus. B2B." },
  { id: "photo-real-premium", label: "Photo-real premium 4K", model: "fal-ai/flux-pro/v1.1", cost: 0.04, desc: "Ultra-realiste haut de gamme. Luxe, lifestyle." },
  { id: "abstract-minimal", label: "Abstract minimal", model: "fal-ai/flux/schnell", cost: 0.003, desc: "Formes geometriques, palettes douces. Tech, SaaS." },
  { id: "symbolic-icon", label: "Symbolic icon studio", model: "fal-ai/flux/schnell", cost: 0.003, desc: "Un objet centre, lumiere studio. Sobre." },
  { id: "vibrant-flat", label: "Vibrant flat illustration", model: "fal-ai/flux/dev", cost: 0.025, desc: "Illustration plate, couleurs vives. SaaS." },
];

function ImageTab({ siteId, site, api, setMsg }: { siteId: string; site: any; api: ApiFn; setMsg: (s: string | null) => void }) {
  const [topic, setTopic] = useState("");
  const [customHint, setCustomHint] = useState("");
  const [customModel, setCustomModel] = useState("fal-ai/flux/dev");
  const [busy, setBusy] = useState<string | null>(null);
  const [samples, setSamples] = useState<any[]>([]);

  useEffect(() => { setTopic(`Article ${site?.name || ""}`.trim()); }, [site?.name]);
  const savedStyle = site?.voice_profile?.image_style_label;

  async function genPreset(presetId: string, label: string) {
    if (!topic.trim()) { setMsg("Renseigne un sujet sample."); return; }
    setBusy(presetId); setMsg(`Generation (${label})...`);
    const { ok, json } = await api(`/api/admin/sites/${siteId}/test-image`, { method: "POST", body: JSON.stringify({ sample_topic: topic, preset_id: presetId }) });
    setBusy(null);
    if (ok) { setSamples((s) => [{ ...json, preset_id: presetId }, ...s]); setMsg(null); } else setMsg(`Erreur: ${json.error}`);
  }
  async function genCustom() {
    if (customHint.trim().length < 10) return;
    setBusy("custom"); setMsg("Generation custom...");
    const { ok, json } = await api(`/api/admin/sites/${siteId}/test-image`, { method: "POST", body: JSON.stringify({ sample_topic: topic, custom_style_hint: customHint, custom_model: customModel, custom_label: "Custom" }) });
    setBusy(null);
    if (ok) { setSamples((s) => [{ ...json, custom: true }, ...s]); setMsg(null); } else setMsg(`Erreur: ${json.error}`);
  }
  async function saveDefault(sample: any) {
    setBusy("save" + (sample.preset_id || "custom"));
    const payload = sample.preset_id ? { preset_id: sample.preset_id } : { custom_style_hint: customHint, custom_model: sample.model, custom_label: sample.label };
    const { ok, json } = await api(`/api/admin/sites/${siteId}/save-image-style`, { method: "POST", body: JSON.stringify(payload) });
    setBusy(null); setMsg(ok ? `Style par defaut: ${json.saved.image_style_label}` : `Erreur: ${json.error}`);
  }

  const totalCost = samples.reduce((a, s) => a + (s.cost_usd || 0), 0);

  return (
    <div className="space-y-4">
      <div className={cardCls}>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-medium">Image Lab, onboarding visuel</h3>
          {savedStyle ? (
            <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300"><Check size={11} /> Defaut: {savedStyle}</span>
          ) : (
            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-300">Aucun style sauvegarde</span>
          )}
        </div>
        <input value={topic} onChange={(e) => setTopic(e.target.value)} className={inputCls} placeholder="Sujet sample (section H2 fictive)" />
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {IMAGE_PRESETS_UI.map((p) => (
          <div key={p.id} className={cardCls}>
            <div className="mb-1 flex items-center justify-between">
              <ImageIcon size={18} className="text-sky-300" />
              <span className="text-[10px] text-zinc-500">{p.model.split("/").slice(-1)[0]} · ${p.cost}</span>
            </div>
            <p className="font-medium text-zinc-100">{p.label}</p>
            <p className="mb-3 min-h-[34px] text-xs text-zinc-500">{p.desc}</p>
            <button onClick={() => genPreset(p.id, p.label)} disabled={busy === p.id} className={ghostBtn}>
              {busy === p.id ? <Loader2 size={12} className="animate-spin" /> : <ImageIcon size={12} />} Generer sample
            </button>
          </div>
        ))}
      </div>

      <div className={cardCls}>
        <h3 className="mb-2 font-medium">Style custom</h3>
        <textarea value={customHint} onChange={(e) => setCustomHint(e.target.value)} rows={2} className={`${inputCls} mb-2`} placeholder="Decris le style (min 10 caracteres)" />
        <div className="flex gap-2">
          <select value={customModel} onChange={(e) => setCustomModel(e.target.value)} className={inputCls}>
            <option value="fal-ai/flux/schnell">flux/schnell ($0.003)</option>
            <option value="fal-ai/flux/dev">flux/dev ($0.025)</option>
            <option value="fal-ai/flux-pro/v1.1">flux-pro v1.1 ($0.04)</option>
            <option value="fal-ai/flux-pro">flux-pro ($0.05)</option>
          </select>
          <button onClick={genCustom} disabled={busy === "custom" || customHint.trim().length < 10} className={primaryBtn}>
            {busy === "custom" ? <Loader2 size={16} className="animate-spin" /> : <ImageIcon size={16} />} Generer custom
          </button>
        </div>
      </div>

      {samples.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-medium">Samples generes ({samples.length})</h3>
            <span className="text-xs text-emerald-300">Cout total: ${totalCost.toFixed(3)}</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {samples.map((s, i) => (
              <div key={i} className={cardCls}>
                <img src={s.url} alt="" className="mb-2 aspect-video w-full rounded object-cover" />
                <p className="text-xs text-zinc-300">{s.label}</p>
                <p className="mb-2 text-[10px] text-zinc-500">{s.model} · ${s.cost_usd}</p>
                <button onClick={() => saveDefault(s)} disabled={busy === "save" + (s.preset_id || "custom")} className="w-full rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs text-emerald-300 hover:bg-emerald-500/25">
                  Sauver comme defaut
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function HistoryTab({ siteId, api }: { siteId: string; api: ApiFn }) {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => { api(`/api/admin/sites/${siteId}/optimizations`).then(({ ok, json }) => ok && setItems(json.optimizations || [])); }, [siteId, api]);
  return (
    <div className="space-y-2">
      {items.length === 0 && <p className="text-sm text-zinc-500">Aucune optimisation enregistree.</p>}
      {items.map((o) => (
        <div key={o.id} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-200">{o.target_title || o.kind}</span>
            <span className="text-xs text-zinc-500">{new Date(o.done_at).toLocaleString()}</span>
          </div>
          <p className="text-xs text-zinc-500">{o.kind} · {o.target_type} {o.note ? `· ${o.note}` : ""}</p>
          {o.target_url && <a href={o.target_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-emerald-400">Voir <ExternalLink size={12} /></a>}
        </div>
      ))}
    </div>
  );
}
