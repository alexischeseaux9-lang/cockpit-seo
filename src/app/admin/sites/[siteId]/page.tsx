"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, RefreshCw, Loader2, Play, PlayCircle, Plus, ListPlus, FileText,
  CheckCircle2, Check, X, ExternalLink, Sparkles, Image as ImageIcon, Package,
  FolderTree, History, UserCircle, Wand2, UploadCloud, Undo2,
  Globe, Archive, ShoppingBag, Map, Tag, Zap, ZapOff, Trash2, ChevronRight,
  AlertCircle, AlertTriangle, Clock, Hourglass, Search, Power,
  Palette, Coffee, Briefcase, Camera, Shapes, Target, Brush, BookOpen,
  Crown, Gift, ShieldOff, PlugZap, Unplug,
  Link2, Settings,
} from "lucide-react";
import { parseKeywordInput, type ParseResult } from "@/lib/sites/csv-parser";
import { ConnectModal } from "../../connect-modal";
import { Kpi, StatCard, StatusDot, Toggle, Drawer, Spinner, EmptyState, type Tone } from "../../_components/ui";
import { cn, relativeTime, formatDate, formatDateTime, daysSince } from "@/lib/format";
import { BRAND } from "@/lib/version";

const PW_KEY = "cockpit_admin_pw";

type TabId = "blog" | "archive" | "image" | "scro" | "roadmap" | "profil" | "products" | "categories" | "optimizations";

// Ordre EXACT du master prompt V3.1.
const TABS: { id: TabId; label: string; icon: JSX.Element }[] = [
  { id: "blog", label: "Blog", icon: <FileText size={15} /> },
  { id: "archive", label: "Archive", icon: <Archive size={15} /> },
  { id: "image", label: "Image Lab", icon: <ImageIcon size={15} /> },
  { id: "scro", label: "SCRO", icon: <ShoppingBag size={15} /> },
  { id: "roadmap", label: "Roadmap", icon: <Map size={15} /> },
  { id: "profil", label: "Profil", icon: <UserCircle size={15} /> },
  { id: "products", label: "Products", icon: <Package size={15} /> },
  { id: "categories", label: "Product Categories", icon: <Tag size={15} /> },
  { id: "optimizations", label: "Optimisations", icon: <Sparkles size={15} /> },
];

function platformMeta(platform?: string): { label: string; Icon: typeof ShoppingBag } {
  if (platform === "wordpress") return { label: "WordPress", Icon: Globe };
  if (platform === "github_mdx") return { label: "GitHub MDX", Icon: FileText };
  return { label: "Shopify", Icon: ShoppingBag };
}

function ConnChip({ status }: { status?: string }) {
  if (status === "connected")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/[0.12] px-2.5 py-0.5 text-xs font-medium text-emerald-300 ring-1 ring-inset ring-emerald-500/30">
        <CheckCircle2 size={12} /> Connecté
      </span>
    );
  if (status === "error")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-300 ring-1 ring-inset ring-red-500/30">
        <AlertCircle size={12} /> Erreur
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-300 ring-1 ring-inset ring-amber-500/30">
      <AlertTriangle size={12} /> Déconnecté
    </span>
  );
}

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

  const [bump, setBump] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [showConnect, setShowConnect] = useState(false);

  const refreshAll = useCallback(() => { loadSite(); setBump((b) => b + 1); }, [loadSite]);

  async function scout() {
    if (!site) return;
    const niche = String(site.voice_profile?.niche || site.voice_profile?.audience || site.name || "").slice(0, 120);
    if (!confirm("Scout 100 mots-cles de niche puis les empiler en roadmap ? (~$0.30, ~60s)")) return;
    setBusy("scout"); setMsg("Scout de 100 mots-cles en cours (~60s)...");
    const { ok, json } = await api(`/api/admin/sites/keyword-scout`, {
      method: "POST",
      body: JSON.stringify({ site_id: siteId, niche, count: 100, enqueue: true }),
    });
    setBusy(null);
    setMsg(ok ? `${json.enqueued ?? json.keywords?.length ?? 0} mots-cles empiles dans la roadmap.` : "Erreur scout, verifie le profil / la connexion.");
    if (ok) refreshAll();
  }
  async function resume() {
    setBusy("resume");
    const { ok, json } = await api(`/api/admin/sites/resume`, { method: "POST", body: JSON.stringify({ site_id: siteId }) });
    setBusy(null); setMsg(ok ? "Site relance." : `Erreur: ${json.error}`); if (ok) refreshAll();
  }
  async function disconnect() {
    if (!confirm("Deconnecter ce site ? Les credentials chiffres seront supprimes.")) return;
    setBusy("disc");
    const { ok, json } = await api(`/api/admin/sites/disconnect`, { method: "POST", body: JSON.stringify({ site_id: siteId }) });
    setBusy(null); setMsg(ok ? "Site deconnecte." : `Erreur: ${json.error}`); if (ok) refreshAll();
  }

  const connected = site?.connection_status === "connected";
  const pm = platformMeta(site?.platform);
  const hasProfile = site?.voice_profile && Object.keys(site.voice_profile).length > 0;

  if (!password) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="card-base max-w-sm text-center">
          <p className="text-sm text-zinc-400">Session expiree. Reconnecte-toi pour acceder a ce site.</p>
          <Link href="/admin" className="btn-primary mt-3 inline-flex">Aller au login</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-6 py-6">
      <div className="mx-auto w-full max-w-[1500px]">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight text-zinc-50">{site?.name || "..."}</h1>
            {site && (
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-zinc-500">
                <span className="inline-flex items-center gap-1.5"><pm.Icon size={14} /> {pm.label}</span>
                <span className="text-zinc-700">·</span>
                <a href={site.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-zinc-300">
                  {String(site.url || "").replace(/^https?:\/\//, "")} <ExternalLink size={12} />
                </a>
                <span className="text-zinc-700">·</span>
                <ConnChip status={site.connection_status} />
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/admin" className="btn-ghost"><ArrowLeft size={15} /> {BRAND}</Link>
            {connected && (
              <button onClick={scout} disabled={busy === "scout"} className="btn-ghost">
                {busy === "scout" ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} Scout 100 keywords
              </button>
            )}
            {site?.paused_at && (
              <button onClick={resume} disabled={busy === "resume"} className="btn-emerald">
                {busy === "resume" ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />} Reprendre
              </button>
            )}
            {connected ? (
              <button onClick={disconnect} disabled={busy === "disc"} className="btn-danger">
                {busy === "disc" ? <Loader2 size={15} className="animate-spin" /> : <Unplug size={15} />} Déconnecter
              </button>
            ) : (
              <button onClick={() => setShowConnect(true)} className="btn-primary"><PlugZap size={15} /> Connecter</button>
            )}
            <button onClick={refreshAll} className="btn-icon" aria-label="Rafraichir"><RefreshCw size={15} /></button>
          </div>
        </div>

        {/* Not connected banner */}
        {site && !connected && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.05] px-4 py-3 text-sm text-amber-200">
            <span className="inline-flex items-center gap-2"><AlertTriangle size={16} /> Site pas encore connecté. Connecte la plateforme pour la lecture live et les pushes.</span>
            <button onClick={() => setShowConnect(true)} className="btn-primary btn-sm">Connecter maintenant</button>
          </div>
        )}

        {/* Tabs */}
        <div className="mt-6 flex gap-0.5 overflow-x-auto border-b border-white/10">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => { setTab(t.id); setMsg(null); }}
                className={cn(
                  "-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition",
                  active ? "border-white text-white" : "border-transparent text-zinc-500 hover:text-zinc-200",
                )}
              >
                {t.icon} {t.label}
                {t.id === "roadmap" && site && (site.daily_post_quota ?? 0) > 0 && (
                  <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-300">{site.daily_post_quota}/J</span>
                )}
                {t.id === "profil" && hasProfile && <Check size={13} className="text-emerald-400" />}
              </button>
            );
          })}
        </div>

        {/* Toast */}
        {msg && (
          <div className="mt-4 flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-300">
            <span>{msg}</span>
            <button onClick={() => setMsg(null)} className="text-zinc-600 hover:text-zinc-300"><X size={15} /></button>
          </div>
        )}

        {/* Body */}
        <div className="mt-6 pb-24">
          {tab === "blog" && <BlogTab key={`blog-${bump}`} siteId={siteId} site={site} api={api} setMsg={setMsg} />}
          {tab === "archive" && <ArchiveTab key={`archive-${bump}`} siteId={siteId} api={api} setMsg={setMsg} />}
          {tab === "image" && <ImageTab key={`image-${bump}`} siteId={siteId} site={site} api={api} setMsg={setMsg} />}
          {tab === "scro" && <ScroTab key={`scro-${bump}`} siteId={siteId} api={api} setMsg={setMsg} />}
          {tab === "roadmap" && <RoadmapTab key={`roadmap-${bump}`} siteId={siteId} site={site} api={api} setMsg={setMsg} onSiteChanged={refreshAll} />}
          {tab === "profil" && <ProfilTab key={`profil-${bump}`} siteId={siteId} api={api} setMsg={setMsg} onSaved={refreshAll} />}
          {tab === "products" && <ProductsTab key={`products-${bump}`} siteId={siteId} api={api} setMsg={setMsg} />}
          {tab === "categories" && <CategoriesTab key={`categories-${bump}`} siteId={siteId} api={api} setMsg={setMsg} />}
          {tab === "optimizations" && <HistoryTab key={`opt-${bump}`} siteId={siteId} site={site} api={api} setMsg={setMsg} />}
        </div>
      </div>

      {showConnect && site && (
        <ConnectModal
          siteId={siteId}
          siteName={site.name}
          platform={site.platform}
          password={password}
          onClose={() => setShowConnect(false)}
          onConnected={() => { setShowConnect(false); refreshAll(); }}
        />
      )}
    </main>
  );
}

type ApiFn = (path: string, init?: RequestInit) => Promise<{ ok: boolean; json: any }>;

const SEO_TITLE_MAX = 155;
const SEO_DESC_MAX = 255;
const SEO_TITLE_IDEAL_MIN = 30;
const SEO_DESC_IDEAL_MIN = 80;

function SeoRow({ label, value, max, idealMin }: { label: string; value: string | null; max: number; idealMin: number }) {
  const has = typeof value === "string" && value.length > 0;
  const len = has ? value!.length : 0;
  let Icon = CheckCircle2, color = "text-emerald-400";
  if (value == null) { Icon = Clock; color = "text-zinc-600"; }
  else if (!has || len > max) { Icon = AlertCircle; color = "text-red-400"; }
  else if (len < idealMin) { Icon = Clock; color = "text-amber-400"; }
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <span className="text-zinc-500">{label}</span>
        <p className="truncate text-zinc-300">{value == null ? <span className="text-zinc-600">non lu via l&apos;API Shopify</span> : value || <span className="text-red-400">manquant</span>}</p>
      </div>
      <span className={cn("flex shrink-0 items-center gap-1 tabular-nums", color)}>
        <Icon size={12} /> {value == null ? "-" : `${len} / ${max}`}
      </span>
    </div>
  );
}

function BlogStatusBadge({ published, stale }: { published: boolean; stale: boolean }) {
  if (stale) return <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-300">A actualiser</span>;
  if (!published) return <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-400">Brouillon</span>;
  return <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-300">Publie</span>;
}

function BlogTab({ siteId, site, api, setMsg }: { siteId: string; site: any; api: ApiFn; setMsg: (s: string | null) => void }) {
  const [posts, setPosts] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({ pending: 0, in_progress: 0 });
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "stale" | "draft">("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const loadPosts = useCallback(async () => {
    const { ok, json } = await api(`/api/admin/sites/${siteId}/posts`);
    if (ok) setPosts(json.posts || []); else setMsg(json.error || "Erreur lecture articles");
  }, [siteId, api, setMsg]);
  const loadJobs = useCallback(async () => {
    const { ok, json } = await api(`/api/admin/sites/${siteId}/jobs`);
    if (ok) { setJobs(json.jobs || []); if (json.counts) setCounts(json.counts); }
  }, [siteId, api]);
  const load = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadPosts(), loadJobs()]);
    setLoading(false);
  }, [loadPosts, loadJobs]);
  useEffect(() => { load(); }, [load]);

  const updateJobs = jobs.filter((j) => j.kind === "update_article");
  const activeUpdates = updateJobs.filter((j) => j.status === "pending" || j.status === "in_progress");
  const recentUpdates = updateJobs.filter((j) => j.status === "done" || j.status === "error").slice(0, 5);
  const queuedIds = new Set(activeUpdates.map((j) => j.target_external_id));
  const hasRunning = jobs.some((j) => j.status === "in_progress");

  useEffect(() => {
    if (!hasRunning) return;
    const id = setInterval(() => { loadJobs(); }, 3000);
    return () => clearInterval(id);
  }, [hasRunning, loadJobs]);
  const prevRunning = useRef(0);
  useEffect(() => {
    const n = activeUpdates.filter((j) => j.status === "in_progress").length;
    if (prevRunning.current > 0 && n === 0) loadPosts();
    prevRunning.current = n;
  }, [jobs, loadPosts, activeUpdates]);

  async function enqueueUpdate(post: any) {
    setBusy(post.external_id);
    const { ok, json } = await api(`/api/admin/sites/${siteId}/jobs`, {
      method: "POST",
      body: JSON.stringify({ update: { target_external_id: post.external_id, target_title: post.title } }),
    });
    setBusy(null);
    setMsg(ok ? (json.already_queued ? "Article deja en file." : "Mise a jour ajoutee a la file.") : `Erreur: ${json.error}`);
    if (ok) loadJobs();
  }
  async function runJob(id: string) {
    setBusy(id); setMsg("Mise a jour en cours (1 a 2 min, images preservees)...");
    const { ok, json } = await api(`/api/admin/jobs/run`, { method: "POST", body: JSON.stringify({ job_id: id }) });
    setBusy(null); setMsg(ok ? "Article rafraichi." : `Echec: ${json.error}`); loadJobs();
  }
  function toggle(id: string) {
    setExpanded((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  const staleCount = posts.filter((p) => daysSince(p.updated_at) >= 180).length;
  const draftCount = posts.filter((p) => p.status !== "published").length;
  const activeJobs = (counts.pending ?? 0) + (counts.in_progress ?? 0);
  const shown = posts.filter((p) =>
    filter === "all" ? true : filter === "stale" ? daysSince(p.updated_at) >= 180 : p.status !== "published",
  );

  if (loading) return <Spinner label="Lecture des articles depuis Shopify..." />;

  const platformLabel = platformMeta(site?.platform).label;

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="flex items-center justify-between">
        <div className="grid flex-1 grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="Articles total" value={posts.length} hint={`${draftCount} brouillon(s)`} />
          <Kpi label="A actualiser" value={staleCount} hint="plus de 6 mois sans update" tone={staleCount > 0 ? "warn" : "default"} />
          <Kpi label="En file d'attente" value={activeJobs} hint="jobs pending + in_progress" tone={activeJobs > 0 ? "accent" : "default"} />
          <Kpi label="Quota auto" value={`${site?.daily_post_quota ?? 0} / j`} hint={`${(site?.daily_post_quota ?? 0) * 30}/mois max`} />
        </div>
        <button onClick={load} className="btn-ghost ml-3 shrink-0"><RefreshCw size={14} /> Tout rafraichir</button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        {/* Queue */}
        <div className="space-y-4">
          <div className="card-base">
            <h3 className="mb-3 text-sm font-semibold text-zinc-100">File de mises a jour</h3>
            {activeUpdates.length === 0 ? (
              <p className="text-xs text-zinc-600">Aucune file de mise a jour. Clique sur &quot;Mettre a jour&quot; sur un article a droite.</p>
            ) : (
              <div className="space-y-2">
                {activeUpdates.map((j) => (
                  <div key={j.id} className="rounded-lg border border-white/[0.06] bg-black/20 p-2.5">
                    <div className="flex items-center gap-2">
                      <StatusDot status={j.status} pulse={j.status === "in_progress"} />
                      <span className="min-w-0 flex-1 truncate text-xs text-zinc-300">{j.target_title || j.target_external_id}</span>
                    </div>
                    {j.status === "in_progress" ? (
                      <p className="mt-1 pl-4 text-[11px] text-amber-300">Pipeline en cours ({platformLabel})...</p>
                    ) : (
                      <button onClick={() => runJob(j.id)} disabled={busy === j.id} className="btn-primary btn-sm mt-2 w-full">
                        {busy === j.id ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />} Lancer maintenant
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          {recentUpdates.length > 0 && (
            <div className="card-base">
              <h3 className="mb-3 text-sm font-semibold text-zinc-100">Mises a jour recentes</h3>
              <div className="space-y-2">
                {recentUpdates.map((j) => (
                  <div key={j.id} className="flex items-center gap-2 text-xs">
                    <StatusDot status={j.status} />
                    <span className="min-w-0 flex-1 truncate text-zinc-400">{j.target_title || j.target_external_id}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Articles list */}
        <div>
          <div className="mb-1">
            <h3 className="text-sm font-semibold text-zinc-100">Articles sur {platformLabel}</h3>
            <p className="text-xs text-zinc-500">Lus en direct depuis l&apos;API, clique sur un article pour le mettre a jour.</p>
          </div>
          <div className="mb-3 mt-3 flex flex-wrap items-center gap-1.5">
            {(["all", "stale", "draft"] as const).map((fl) => (
              <button key={fl} onClick={() => setFilter(fl)} className={cn("pill", filter === fl && "pill-active")}>
                {fl === "all" ? "Tous" : fl === "stale" ? "A actualiser" : "Brouillons"}{" "}
                <span className="opacity-70">{fl === "all" ? posts.length : fl === "stale" ? staleCount : draftCount}</span>
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {shown.length === 0 && <EmptyState>Aucun article dans ce filtre.</EmptyState>}
            {shown.map((p) => {
              const stale = daysSince(p.updated_at) >= 180;
              const open = expanded.has(p.external_id);
              const queued = queuedIds.has(p.external_id);
              return (
                <div key={p.external_id} className="card-base card-hover p-4">
                  <div className="flex items-start gap-3">
                    <button onClick={() => toggle(p.external_id)} className="mt-0.5 text-zinc-500 hover:text-zinc-200">
                      <ChevronRight size={16} className={cn("transition", open && "rotate-90")} />
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="truncate text-sm font-medium text-zinc-100">{p.title}</h4>
                        <BlogStatusBadge published={p.status === "published"} stale={stale} />
                      </div>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        Maj {relativeTime(p.updated_at)} · Pub {formatDate(p.date)}
                        {p.tags?.length ? ` · Tags ${p.tags.slice(0, 3).join(", ")}${p.tags.length > 3 ? ` +${p.tags.length - 3}` : ""}` : ""}
                      </p>
                      {open && (
                        <div className="mt-3 space-y-2.5 border-t border-white/[0.06] pt-3 text-xs">
                          <SeoRow label="Titre H1" value={p.title} max={SEO_TITLE_MAX} idealMin={SEO_TITLE_IDEAL_MIN} />
                          <SeoRow label="Meta title (SEO)" value={p.seo_title} max={SEO_TITLE_MAX} idealMin={SEO_TITLE_IDEAL_MIN} />
                          <SeoRow label="Meta description" value={p.seo_description} max={SEO_DESC_MAX} idealMin={SEO_DESC_IDEAL_MIN} />
                          {p.summary && (
                            <div>
                              <span className="text-zinc-500">Resume</span>
                              <p className="mt-0.5 line-clamp-3 text-zinc-400">{p.summary}</p>
                            </div>
                          )}
                          <a href={p.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300">
                            Voir l&apos;article <ExternalLink size={11} />
                          </a>
                        </div>
                      )}
                    </div>
                    <button onClick={() => enqueueUpdate(p)} disabled={busy === p.external_id || queued} className="btn-ghost btn-sm shrink-0">
                      {busy === p.external_id ? <Loader2 size={12} className="animate-spin" /> : queued ? <Hourglass size={12} /> : <PlayCircle size={12} />}
                      {queued ? "En file" : "Mettre a jour"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}


const ROADMAP_TIMES = [8, 12, 18];
function priorityLabel(p?: number | null): string {
  if (p == null) return "undefined";
  if (p >= 10) return "haute";
  if (p >= 5) return "moyenne";
  return "basse";
}
function SlotStatus({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: "Planifie", cls: "text-zinc-500" },
    in_progress: { label: "En cours", cls: "text-amber-300" },
    done: { label: "Publie", cls: "text-emerald-300" },
    error: { label: "Erreur", cls: "text-red-300" },
  };
  const m = map[status] || { label: status, cls: "text-zinc-500" };
  return (
    <span className={cn("inline-flex items-center gap-1 text-[11px]", m.cls)}>
      {status === "in_progress" ? <Loader2 size={11} className="animate-spin" /> : status === "error" ? <AlertCircle size={11} /> : status === "done" ? <CheckCircle2 size={11} /> : <Clock size={11} />}
      {m.label}
    </span>
  );
}

function RoadmapTab({ siteId, site, api, setMsg, onSiteChanged }: { siteId: string; site: any; api: ApiFn; setMsg: (s: string | null) => void; onSiteChanged: () => void }) {
  const [jobs, setJobs] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({ pending: 0, in_progress: 0, done: 0, error: 0 });
  const [keyword, setKeyword] = useState("");
  const [brief, setBrief] = useState("");
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [filter, setFilter] = useState<"upcoming" | "published" | "errors">("upcoming");
  const [daysShown, setDaysShown] = useState(7);

  const load = useCallback(async () => {
    const { ok, json } = await api(`/api/admin/sites/${siteId}/jobs`);
    if (ok) { setJobs(json.jobs || []); if (json.counts) setCounts(json.counts); }
  }, [siteId, api]);
  useEffect(() => { load(); }, [load]);

  const hasRunning = jobs.some((j) => j.status === "in_progress");
  useEffect(() => {
    if (!hasRunning) return;
    const id = setInterval(load, 3000);
    return () => clearInterval(id);
  }, [hasRunning, load]);

  const quota = site?.daily_post_quota ?? 0;
  const autoOn = !!site?.auto_publish_enabled;
  const connected = site?.connection_status === "connected";
  const pending = counts.pending ?? 0;
  const inProgress = counts.in_progress ?? 0;
  const doneCount = counts.done ?? 0;
  const errorCount = counts.error ?? 0;
  const queueSize = pending + inProgress;
  const blockedReason = !connected ? "Site non connecte" : quota === 0 ? "Quota daily a 0" : null;

  async function toggleAuto() {
    setBusy("auto");
    const { ok, json } = await api(`/api/admin/sites/update`, { method: "POST", body: JSON.stringify({ site_id: siteId, auto_publish_enabled: !autoOn }) });
    setBusy(null); setMsg(ok ? (autoOn ? "Flow desactive." : "Flow active.") : `Erreur: ${json.error}`);
    if (ok) onSiteChanged();
  }
  async function setQuota(n: number) {
    setBusy(`q${n}`);
    const { ok, json } = await api(`/api/admin/sites/update`, { method: "POST", body: JSON.stringify({ site_id: siteId, daily_post_quota: n }) });
    setBusy(null); setMsg(ok ? `Cadence reglee a ${n}/jour.` : `Erreur: ${json.error}`);
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
  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2_000_000) { setMsg("Fichier trop gros (max 2 Mo)."); return; }
    const reader = new FileReader();
    reader.onload = () => onRaw(String(reader.result || ""));
    reader.readAsText(file);
  }
  async function importBulk() {
    if (!parsed?.keywords.length) return;
    setBusy("bulk");
    const items = parsed.keywords.map((k) => ({ keyword: k.keyword, brief: k.brief, priority: k.priority, target_blog_hint: k.targetBlogHint || null }));
    const { ok, json } = await api(`/api/admin/sites/${siteId}/jobs`, { method: "POST", body: JSON.stringify({ items }) });
    setBusy(null); setMsg(ok ? `${json.enqueued} mots-cles importes.` : `Erreur: ${json.error}`);
    if (ok) { setRaw(""); setParsed(null); load(); }
  }
  async function runNow(id: string) {
    setBusy(id); setMsg("Generation lancee (1 a 2 min)...");
    const { ok, json } = await api(`/api/admin/jobs/run`, { method: "POST", body: JSON.stringify({ job_id: id }) });
    setBusy(null); setMsg(ok ? "Job lance, suivi en direct." : `Echec: ${json.error}`); load();
  }
  async function delJob(id: string) {
    setBusy(`del${id}`);
    const { ok, json } = await api(`/api/admin/sites/${siteId}/jobs?id=${id}`, { method: "DELETE" });
    setBusy(null); if (!ok) setMsg(`Erreur: ${json.error}`); load();
  }

  // Projection calendrier : pending + in_progress, ordonnes priorite desc / FIFO (deja trie cote serveur).
  const upcoming = jobs.filter((j) => j.kind === "generate_article" && (j.status === "pending" || j.status === "in_progress"));
  const published = jobs.filter((j) => j.status === "done").sort((a, b) => String(b.completed_at).localeCompare(String(a.completed_at)));
  const errored = jobs.filter((j) => j.status === "error");

  const effQuota = Math.max(1, quota);
  const totalDays = Math.max(1, Math.ceil(upcoming.length / effQuota));
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  function Slot({ time, job }: { time: number; job: any | null }) {
    if (!job) {
      return (
        <div className="px-4 py-3.5">
          <div className="eyebrow text-zinc-700">{time}H</div>
          <p className="mt-2 text-xs text-zinc-700">En attente</p>
        </div>
      );
    }
    return (
      <div className="px-4 py-3.5">
        <div className="flex items-center justify-between">
          <span className="eyebrow text-zinc-500">{time}H</span>
          <SlotStatus status={job.status} />
        </div>
        <p className="mt-1.5 line-clamp-2 text-sm text-zinc-200">{job.keyword || job.target_title || "(sans titre)"}</p>
        <p className="mt-0.5 text-[11px] text-zinc-600">Priorite {priorityLabel(job.priority)}</p>
        {job.error && <p className="mt-1 line-clamp-2 text-[11px] text-red-400">{String(job.error).slice(0, 120)}</p>}
        <div className="mt-2.5 flex items-center gap-1.5">
          <button onClick={() => runNow(job.id)} disabled={busy === job.id} className="btn-primary btn-sm flex-1">
            {busy === job.id ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />} Lancer
          </button>
          <button onClick={() => delJob(job.id)} disabled={busy === `del${job.id}`} className="btn-icon h-8 w-8 shrink-0" aria-label="Supprimer">
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Auto-publish banner */}
      <div className={cn("flex flex-col gap-4 rounded-xl border bg-white/[0.02] p-4 md:flex-row md:items-center md:justify-between", autoOn ? "border-emerald-500/30" : "border-white/[0.07]")}>
        <div className="flex items-center gap-3">
          <span className={cn("flex h-10 w-10 items-center justify-center rounded-full", autoOn ? "bg-emerald-500/15 text-emerald-300" : "bg-white/[0.04] text-zinc-500")}>
            {autoOn ? <Zap size={20} /> : <ZapOff size={20} />}
          </span>
          <div>
            <p className="font-medium text-zinc-100">{autoOn ? "Mode auto-publish ACTIF" : "Mode auto-publish INACTIF"}</p>
            <p className="mt-0.5 max-w-xl text-xs text-zinc-500">
              {autoOn
                ? `Le cron tourne a 8h / 12h / 18h Paris et publie jusqu'a ${quota} article(s) par jour automatiquement.`
                : blockedReason
                  ? `Impossible d'activer : ${blockedReason}.`
                  : "Active pour que les articles de la roadmap soient generes et publies tout seuls (3 par jour max selon ton quota)."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-zinc-500">Articles/jour</span>
            {[0, 1, 2, 3].map((n) => (
              <button key={n} onClick={() => setQuota(n)} disabled={busy === `q${n}`}
                className={cn("h-7 w-7 rounded-md text-xs font-semibold transition", quota === n ? "bg-white text-black" : "border border-white/10 text-zinc-400 hover:border-white/25")}>
                {n}
              </button>
            ))}
          </div>
          <button onClick={toggleAuto} disabled={busy === "auto" || (!autoOn && !!blockedReason)} className={autoOn ? "btn-danger" : "btn-emerald"}>
            {busy === "auto" ? <Loader2 size={15} className="animate-spin" /> : autoOn ? <ZapOff size={15} /> : <Zap size={15} />}
            {autoOn ? "Desactiver le flow" : "Activer le flow"}
          </button>
        </div>
      </div>

      {quota === 0 && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/[0.05] p-3 text-sm text-amber-200">
          Quota a zero : tu peux empiler des mots-cles mais le worker ne les generera pas tant que la cadence est a 0. Regle-la ci-dessus.
        </p>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Mots-cles en file" value={queueSize} hint={`${pending} pending, ${inProgress} en cours`} tone={queueSize > 0 ? "accent" : "default"} />
        <Kpi label="Cadence prevue" value={`${quota} / jour`} hint={`${quota * 30}/mois max`} tone={quota === 0 ? "warn" : "default"} />
        <Kpi label="Temps pour vider" value={quota > 0 ? `~${Math.ceil(queueSize / quota)} j` : "-"} hint={quota > 0 ? "au rythme actuel" : "cadence a 0"} />
        <Kpi label="Articles generes" value={doneCount} hint="depuis cette roadmap" />
      </div>

      {/* Forms */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card-base">
          <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-zinc-100"><Sparkles size={16} className="text-emerald-300" /> Ajout simple</h3>
          <p className="mb-3 text-xs text-zinc-500">Un mot-cle + brief optionnel (angle, intent, audience visee).</p>
          <input value={keyword} onChange={(e) => setKeyword(e.target.value)} maxLength={200} className="input-base mb-2" placeholder="ex: the matcha bienfaits" />
          <textarea value={brief} onChange={(e) => setBrief(e.target.value)} rows={3} maxLength={2000} className="input-base mb-3" placeholder="Brief (optionnel) : angle, intent, audience cible..." />
          <button onClick={addSingle} disabled={busy === "single" || keyword.trim().length < 2} className="btn-primary">
            {busy === "single" ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Ajouter a la roadmap
          </button>
        </div>

        <div className="card-base">
          <div className="mb-1 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-100"><ListPlus size={16} className="text-emerald-300" /> Import en masse</h3>
            <label className="btn-ghost btn-sm cursor-pointer">
              <UploadCloud size={13} /> Fichier CSV
              <input type="file" accept=".csv,text/csv,text/plain" className="hidden" onChange={onFile} />
            </label>
          </div>
          <p className="mb-3 text-xs text-zinc-500">Colle une liste (1 mot-cle par ligne) OU un CSV (Priorite, Categorie, Titre, Keyword, Slug), detection auto.</p>
          <textarea value={raw} onChange={(e) => onRaw(e.target.value)} rows={6} className="input-base mb-2 font-mono text-xs" placeholder={"1 mot-cle par ligne\nOU CSV: Priorite,Categorie,Titre,Keyword,Slug"} />
          {parsed && (
            <p className="mb-2 text-xs text-zinc-400">
              {parsed.keywords.length} mots-cles ({parsed.format})
              {parsed.warnings.length > 0 && <span className="text-amber-400"> · {parsed.warnings.length} avertissement(s)</span>}
            </p>
          )}
          <button onClick={importBulk} disabled={busy === "bulk" || !parsed?.keywords.length} className="btn-primary">
            {busy === "bulk" ? <Loader2 size={15} className="animate-spin" /> : <ListPlus size={15} />} Importer {parsed?.keywords.length ? `(${parsed.keywords.length})` : ""}
          </button>
        </div>
      </div>

      {/* Calendrier editorial */}
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">Calendrier editorial</h3>
            <p className="text-xs text-zinc-500">slots 8h / 12h / 18h (Paris), ordre par priorite decroissante</p>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setFilter("upcoming")} className={cn("pill", filter === "upcoming" && "pill-active")}>A venir <span className="opacity-70">{queueSize}</span></button>
            <button onClick={() => setFilter("published")} className={cn("pill", filter === "published" && "pill-active")}>Publies <span className="opacity-70">{doneCount}</span></button>
            <button onClick={() => setFilter("errors")} className={cn("pill", filter === "errors" && "pill-active")}>Erreurs <span className="opacity-70">{errorCount}</span></button>
          </div>
        </div>

        {filter === "upcoming" && (
          <>
            {errorCount > 0 && (
              <button onClick={() => setFilter("errors")} className="mb-3 flex w-full items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/[0.05] px-3 py-2 text-left text-xs text-red-300">
                <AlertTriangle size={14} /> {errorCount} job(s) en erreur. Voir l&apos;onglet Erreurs pour relancer.
              </button>
            )}
            {upcoming.length === 0 ? (
              <EmptyState>Aucun mot-cle en file. Ajoute des mots-cles ci-dessus.</EmptyState>
            ) : (
              <div className="space-y-3">
                {Array.from({ length: Math.min(daysShown, totalDays) }).map((_, d) => {
                  const date = new Date(today);
                  date.setDate(today.getDate() + d);
                  const filled = ROADMAP_TIMES.filter((_, p) => p < quota && upcoming[d * effQuota + p]).length;
                  const isToday = d === 0;
                  return (
                    <div key={d} className={cn("overflow-hidden rounded-xl border", isToday ? "border-emerald-500/30" : "border-white/[0.07]")}>
                      <div className="flex items-center justify-between border-b border-white/[0.06] bg-white/[0.02] px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-zinc-100">{isToday ? "Aujourd'hui" : `Jour ${d + 1}`}</span>
                          <span className="text-xs text-zinc-500">{formatDate(date.toISOString())}</span>
                          {isToday && <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">LIVE</span>}
                        </div>
                        <span className="text-xs text-zinc-600">{filled} / {quota || 0} planifie(s)</span>
                      </div>
                      <div className="grid grid-cols-1 divide-y divide-white/[0.05] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                        {ROADMAP_TIMES.map((t, p) => {
                          const inQuota = p < quota;
                          if (!inQuota) {
                            return (
                              <div key={t} className="px-4 py-3.5">
                                <div className="eyebrow text-zinc-700">{t}H</div>
                                <p className="mt-2 text-xs text-zinc-700">Hors quota</p>
                              </div>
                            );
                          }
                          return <Slot key={t} time={t} job={upcoming[d * effQuota + p] || null} />;
                        })}
                      </div>
                    </div>
                  );
                })}
                {totalDays > daysShown && (
                  <div className="flex justify-center pt-2">
                    <button onClick={() => setDaysShown((n) => n + 30)} className="btn-ghost">
                      Voir 30 jours de plus ({Math.max(0, upcoming.length - daysShown * effQuota)} restants)
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {filter === "published" && (
          published.length === 0 ? <EmptyState>Aucun article publie depuis cette roadmap.</EmptyState> : (
            <div className="card-base divide-y divide-white/[0.06] p-0">
              {published.slice(0, 100).map((j) => (
                <div key={j.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-zinc-200">{j.keyword || j.target_title}</p>
                    <p className="text-xs text-zinc-500">{j.completed_at ? formatDateTime(j.completed_at) : "publie"}</p>
                  </div>
                  {j.output?.url && <a href={j.output.url} target="_blank" rel="noreferrer" className="btn-ghost btn-sm shrink-0"><ExternalLink size={12} /> Voir</a>}
                </div>
              ))}
            </div>
          )
        )}

        {filter === "errors" && (
          errored.length === 0 ? <EmptyState>Aucun job en erreur.</EmptyState> : (
            <div className="space-y-2">
              {errored.map((j) => (
                <div key={j.id} className="flex items-start justify-between gap-3 rounded-xl border border-red-500/20 bg-red-500/[0.03] p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-zinc-200">{j.keyword || j.target_title}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-red-400">{j.error}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button onClick={() => runNow(j.id)} disabled={busy === j.id} className="btn-ghost btn-sm">
                      {busy === j.id ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />} Relancer
                    </button>
                    <button onClick={() => delJob(j.id)} disabled={busy === `del${j.id}`} className="btn-icon h-8 w-8" aria-label="Supprimer"><Trash2 size={13} /></button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      <p className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-3 text-xs leading-relaxed text-zinc-500">
        Le worker cron draine cette file (generation d&apos;articles complets via Claude, publication automatique sur Shopify selon le quota journalier). Tu peux empiler les mots-cles ; ils attendent leur tour de generation, ou lance-les a la main.
      </p>
    </div>
  );
}

const FRESHNESS_META: Record<string, { dot: string; label: string; color: string }> = {
  fresh: { dot: "bg-emerald-400", label: "A jour", color: "text-emerald-300" },
  aging: { dot: "bg-amber-400", label: "Vieillissant", color: "text-amber-300" },
  stale: { dot: "bg-red-400", label: "Perime", color: "text-red-300" },
  never: { dot: "bg-zinc-500", label: "Jamais", color: "text-zinc-400" },
};

const ARCHIVE_FILTER_ACTIVE: Record<string, string> = {
  default: "bg-white text-black",
  success: "bg-emerald-500/20 text-emerald-200 ring-1 ring-inset ring-emerald-500/40",
  warn: "bg-amber-500/20 text-amber-200 ring-1 ring-inset ring-amber-500/40",
  danger: "bg-red-500/20 text-red-200 ring-1 ring-inset ring-red-500/40",
  info: "bg-sky-500/20 text-sky-200 ring-1 ring-inset ring-sky-500/40",
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

  const running = data?.stats?.running ?? 0;
  useEffect(() => {
    if (running <= 0) return;
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [running, load]);

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

  if (loading) return <Spinner label="Lecture du catalogue..." />;
  if (!data) return <EmptyState>Aucune donnee.</EmptyState>;

  const s = data.stats;
  const quota = data.site?.daily_update_quota ?? 0;
  const yavokCount = (data.articles || []).filter((a: any) => a.has_yavok_blocks).length;
  const statCards: { label: string; value: number; hint?: string; tone: Tone }[] = [
    { label: "Total catalogue", value: s.total, hint: `${yavokCount} regeneres`, tone: "default" },
    { label: "A jour", value: s.fresh, hint: "90 jours ou moins", tone: "success" },
    { label: "Vieillissant", value: s.aging, hint: "90 a 180 jours", tone: s.aging > 0 ? "warn" : "default" },
    { label: "Perimes", value: s.stale, hint: "plus de 180 jours", tone: s.stale > 0 ? "danger" : "default" },
    { label: "En cours", value: s.running, hint: "traites actuellement", tone: s.running > 0 ? "info" : "default" },
    { label: "En file", value: s.queued, hint: "prets pour le cron", tone: "default" },
  ];
  const filters: { f: string; label: string; n: number; tone: keyof typeof ARCHIVE_FILTER_ACTIVE; show: boolean }[] = [
    { f: "all", label: "Tous", n: s.total, tone: "default", show: true },
    { f: "fresh", label: "A jour", n: s.fresh, tone: "success", show: true },
    { f: "aging", label: "Vieillissant", n: s.aging, tone: "warn", show: true },
    { f: "stale", label: "Perimes", n: s.stale, tone: "danger", show: true },
    { f: "running", label: "En cours", n: s.running, tone: "info", show: s.running > 0 },
    { f: "queued", label: "En file", n: s.queued, tone: "default", show: s.queued > 0 },
  ];
  const shown = (data.articles || []).filter((a: any) =>
    filter === "all" ? true : filter === "running" ? a.last_job?.status === "running" : filter === "queued" ? a.last_job?.status === "queued" : a.freshness === filter,
  );
  const stalestQueueable = (data.articles || []).filter((a: any) => a.freshness === "stale").length;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        {statCards.map((c) => <StatCard key={c.label} label={c.label} value={c.value} hint={c.hint} tone={c.tone} />)}
      </div>

      <div className="card-base">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-100"><Power size={15} className="text-emerald-300" /> Cadence auto-refresh</h3>
        <p className="mb-3 mt-1 text-xs text-zinc-500">Nombre d&apos;articles perimes que le cron regenere chaque jour. 0 = manuel uniquement.</p>
        <div className="flex gap-2">
          {[0, 1, 3, 6].map((n) => (
            <button key={n} onClick={() => setCadence(n)} disabled={busy === "cad"}
              className={cn("rounded-lg px-3.5 py-1.5 text-sm font-medium transition", quota === n ? "bg-white text-black" : "border border-white/10 text-zinc-400 hover:border-white/25")}>
              {n === 0 ? "Off" : `${n}/jour`}
            </button>
          ))}
        </div>
        {quota > 0 && s.stale > 0 && (
          <p className="mt-3 text-xs text-zinc-500">
            Prochain refresh auto : demain matin via le cron Vercel. A cette cadence, les {s.stale} articles perimes seront tous regeneres en ~{Math.ceil(s.stale / quota)} jours.
          </p>
        )}
      </div>

      {stalestQueueable > 0 && (
        <div className="card-base flex flex-wrap items-center gap-3">
          <span className="text-sm text-zinc-300">{stalestQueueable} articles perimes peuvent etre regeneres tout de suite</span>
          <div className="ml-auto flex items-center gap-2">
            <div className="flex gap-1">
              {[3, 6, 10].map((n) => (
                <button key={n} onClick={() => setBulkN(n)} className={cn("h-7 w-8 rounded-md text-xs font-semibold transition", bulkN === n ? "bg-white text-black" : "border border-white/10 text-zinc-400 hover:border-white/25")}>{n}</button>
              ))}
            </div>
            <button onClick={bulkRun} disabled={busy === "bulk"} className="btn-primary btn-sm">
              {busy === "bulk" ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />} Lancer {bulkN} maintenant
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        {filters.filter((x) => x.show).map((x) => (
          <button key={x.f} onClick={() => setFilter(x.f)}
            className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition", filter === x.f ? ARCHIVE_FILTER_ACTIVE[x.tone] : "border border-white/10 text-zinc-400 hover:text-zinc-200")}>
            {x.label} <span className="opacity-70">{x.n}</span>
          </button>
        ))}
        <button onClick={load} className="btn-icon ml-auto h-8 w-8" aria-label="Rafraichir"><RefreshCw size={14} /></button>
      </div>

      <div className="card-base divide-y divide-white/[0.06] p-0">
        {shown.length === 0 && <div className="px-4 py-6 text-center text-sm text-zinc-500">Aucun article dans ce filtre.</div>}
        {shown.slice(0, 200).map((a: any) => {
          const fm = FRESHNESS_META[a.freshness] || FRESHNESS_META.never;
          const lj = a.last_job;
          return (
            <div key={a.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className={`h-2 w-2 shrink-0 rounded-full ${fm.dot}`} />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <a href={a.url} target="_blank" rel="noreferrer" className="truncate text-sm text-zinc-200 hover:text-emerald-400">{a.title}</a>
                    {a.blog_title && <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-zinc-500">{a.blog_title}</span>}
                    {a.has_yavok_blocks && <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-300">Optimise</span>}
                  </div>
                  <p className={cn("mt-0.5 text-xs", fm.color)}>
                    {fm.label} · {a.days_since_update}j depuis derniere update
                    {lj?.status === "running" && <span className="ml-1 inline-flex items-center gap-1 text-amber-300"><Loader2 size={10} className="animate-spin" /> regeneration en cours</span>}
                    {lj?.status === "queued" && <span className="ml-1 inline-flex items-center gap-1 text-zinc-400"><Clock size={10} /> en file</span>}
                    {lj?.status === "error" && <span className="ml-1 text-red-400">{String(lj.error || "erreur").slice(0, 80)}</span>}
                  </p>
                </div>
              </div>
              <button onClick={() => refreshOne(a)} disabled={busy === a.id} className="btn-ghost btn-sm shrink-0">
                {busy === a.id ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Regenerer
              </button>
            </div>
          );
        })}
        {shown.length > 200 && <div className="px-4 py-3 text-center text-xs text-zinc-600">Affichage limite aux 200 premiers ({shown.length} au total dans le filtre).</div>}
      </div>
    </div>
  );
}

const PRODUCT_STATUS_META: Record<string, { label: string; cls: string }> = {
  not_audited: { label: "Pas audite", cls: "text-zinc-500" },
  audited: { label: "Audite", cls: "text-sky-300" },
  needs_work: { label: "A retravailler", cls: "text-amber-300" },
  optimization_pending: { label: "Optim en cours", cls: "text-amber-300" },
  proposed: { label: "Propose", cls: "text-emerald-300" },
  applied: { label: "Applique", cls: "text-emerald-300" },
  failed: { label: "Erreur", cls: "text-red-300" },
  error: { label: "Erreur", cls: "text-red-300" },
};
const PRODUCT_FILTERS: { v: string; label: string }[] = [
  { v: "all", label: "Tout" },
  { v: "needs_work", label: "A retravailler" },
  { v: "audited", label: "Audite" },
  { v: "not_audited", label: "Pas audite" },
  { v: "proposed", label: "Propose" },
  { v: "applied", label: "Applique" },
  { v: "failed", label: "Erreur" },
];

function ProductStatusBadge({ status }: { status: string }) {
  const m = PRODUCT_STATUS_META[status] || { label: status, cls: "text-zinc-500" };
  return <span className={cn("inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide", m.cls)}><StatusDot status={status} /> {m.label}</span>;
}

function ProductsTab({ siteId, api, setMsg }: { siteId: string; api: ApiFn; setMsg: (s: string | null) => void }) {
  const [products, setProducts] = useState<any[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
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
    setBusy("auditall"); setMsg("Audit heuristique en masse (peut prendre 1 a 3 min)...");
    const { ok, json } = await api(`/api/admin/sites/${siteId}/products/audit-batch`, { method: "POST", body: JSON.stringify({ limit: 1500 }) });
    setBusy(null); setMsg(ok ? `${json.audited} produit(s) audites` : `Erreur: ${json.error}`); load();
  }
  async function optimizeSel() {
    if (!sel.size) return;
    setBusy("optsel"); setMsg(`Optimisation de ${sel.size} produit(s) (Sonnet)...`);
    const { ok, json } = await api(`/api/admin/sites/${siteId}/products/optimize-batch`, { method: "POST", body: JSON.stringify({ external_ids: Array.from(sel) }) });
    setBusy(null); setMsg(ok ? `${json.optimized ?? json.queued ?? sel.size} optimise(s)` : `Erreur: ${json.error}`); setSel(new Set()); load();
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

  const q = search.trim().toLowerCase();
  const shown = products
    .filter((p) => filter === "all" || p.status === filter)
    .filter((p) => !q || (p.title || "").toLowerCase().includes(q) || (p.product_type || "").toLowerCase().includes(q));
  const scored = products.filter((p) => p.audit_score != null);
  const avg = scored.length ? Math.round(scored.reduce((a, p) => a + p.audit_score, 0) / scored.length) : 0;
  const countFor = (v: string) => (v === "all" ? products.length : products.filter((p) => p.status === v).length);
  const allShownSelected = shown.length > 0 && shown.every((p) => sel.has(p.external_id));
  const toggleAll = () => setSel((s) => {
    const n = new Set(s);
    if (allShownSelected) shown.forEach((p) => n.delete(p.external_id));
    else shown.forEach((p) => n.add(p.external_id));
    return n;
  });

  if (loading) return <Spinner label="Chargement des produits Shopify..." />;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow">Catalogue produits</div>
          <div className="mt-1 flex items-baseline gap-3">
            <span className="text-2xl font-semibold text-zinc-100">{products.length}</span>
            <span className="text-sm text-zinc-500">score moyen {avg}/100</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={auditAll} disabled={busy === "auditall"} className="btn-ghost">
            {busy === "auditall" ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />} Auditer tout (1500 max)
          </button>
          <button onClick={optimizeSel} disabled={busy === "optsel" || !sel.size} className="btn-emerald">
            {busy === "optsel" ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Optimiser ({sel.size})
          </button>
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        {PRODUCT_FILTERS.map((fl) => (
          <button key={fl.v} onClick={() => setFilter(fl.v)} className={cn("pill", filter === fl.v && "pill-active")}>
            {fl.label} <span className="opacity-70">{countFor(fl.v)}</span>
          </button>
        ))}
      </div>

      {/* Search + select all */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} className="input-base pl-9" placeholder="Recherche par titre ou type de produit" />
        </div>
        <button onClick={toggleAll} className="btn-ghost btn-sm shrink-0">
          {allShownSelected ? "Tout deselectionner" : `Tout selectionner (${shown.length})`}
        </button>
      </div>

      {/* List */}
      <div className="space-y-2">
        {shown.length === 0 && <EmptyState>Aucun produit dans ce filtre.</EmptyState>}
        {shown.map((p) => (
          <div key={p.external_id} className="card-base flex items-center justify-between gap-3 p-3">
            <div className="flex min-w-0 items-center gap-3">
              <input type="checkbox" checked={sel.has(p.external_id)} onChange={() => toggle(p.external_id)} className="h-4 w-4 accent-emerald-500" />
              {p.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.image} alt="" className="h-11 w-11 shrink-0 rounded-md object-cover" />
              ) : (
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-white/[0.03] text-zinc-700"><Package size={18} /></div>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm text-zinc-200">{p.title}</p>
                <div className="mt-0.5 flex flex-wrap items-center gap-2">
                  <ProductStatusBadge status={p.status} />
                  {p.audit_score != null && <span className={cn("text-xs font-medium", p.audit_score >= 80 ? "text-emerald-400" : p.audit_score >= 40 ? "text-amber-400" : "text-red-400")}>score {p.audit_score}</span>}
                  {(p.audit_issues || []).slice(0, 3).map((iss: string) => <span key={iss} className="rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] text-red-300">{iss}</span>)}
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {p.url && <a href={p.url} target="_blank" rel="noreferrer" className="btn-icon h-8 w-8" aria-label="Voir"><ExternalLink size={13} /></a>}
              {p.has_proposal && (
                <button onClick={() => apply(p.external_id)} disabled={busy === p.external_id + "p"} className="btn-ghost btn-sm">
                  {busy === p.external_id + "p" ? <Loader2 size={12} className="animate-spin" /> : <UploadCloud size={12} />} Appliquer
                </button>
              )}
              {p.status === "applied" && (
                <button onClick={() => revert(p.external_id)} disabled={busy === p.external_id + "r"} className="btn-ghost btn-sm" title="Restaurer l'origine">
                  {busy === p.external_id + "r" ? <Loader2 size={12} className="animate-spin" /> : <Undo2 size={12} />} Annuler
                </button>
              )}
              <button onClick={() => setDrawer(p)} className="btn-ghost btn-sm">Detail</button>
            </div>
          </div>
        ))}
      </div>

      {drawer && <ProductDrawer siteId={siteId} api={api} product={drawer} pw={pw} setMsg={setMsg} onChanged={load} onClose={() => setDrawer(null)} />}
    </div>
  );
}

const CRO_SIGNAL_LABELS: Record<string, string> = {
  urgency_present: "Urgence",
  social_proof_present: "Preuve sociale",
  risk_reversal_present: "Garantie / risque inverse",
  delivery_clarity: "Livraison claire",
};

function ProductDrawer({ siteId, api, product, pw, setMsg, onChanged, onClose }: { siteId: string; api: ApiFn; product: any; pw: string; setMsg: (s: string | null) => void; onChanged: () => void; onClose: () => void }) {
  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const reload = useCallback(() => {
    api(`/api/admin/sites/${siteId}/products/proposed?external_id=${encodeURIComponent(product.external_id)}`).then(({ ok, json }) => ok && setData(json));
  }, [siteId, api, product.external_id]);
  useEffect(() => { reload(); }, [reload]);

  const pp = data?.proposed;
  const cm = pp?.channel_meta;
  const cro = pp?.cro_signals;

  async function optimize() {
    setBusy("opt"); setMsg("Optimisation IA en cours (Sonnet, 30 a 90s)...");
    const { ok, json } = await api(`/api/admin/sites/${siteId}/products/optimize-batch`, { method: "POST", body: JSON.stringify({ external_ids: [product.external_id] }) });
    setBusy(null); setMsg(ok ? "Optimisation lancee / terminee." : `Erreur: ${json.error}`); reload(); onChanged();
  }
  async function applyNow() {
    setBusy("apply"); setMsg("Application sur Shopify...");
    const { ok, json } = await api(`/api/admin/sites/${siteId}/products/apply`, { method: "POST", body: JSON.stringify({ external_id: product.external_id }) });
    setBusy(null); setMsg(ok ? "Fiche produit mise a jour." : `Erreur: ${json.error}`); onChanged();
  }

  const Diff = ({ label, a, b }: { label: string; a?: string; b?: string }) => (
    <div className="grid grid-cols-2 gap-3 text-xs">
      <div><p className="eyebrow mb-1">{label} avant</p><p className="line-clamp-4 text-zinc-500">{a || "-"}</p></div>
      <div><p className="eyebrow mb-1">{label} apres</p><p className="line-clamp-4 text-emerald-300">{b || "-"}</p></div>
    </div>
  );

  return (
    <Drawer
      title={product.title}
      subtitle={<span className="font-mono text-zinc-600">Fiche produit</span>}
      onClose={onClose}
      headerRight={
        <div className="flex items-center gap-2">
          {product.url && <a href={product.url} target="_blank" rel="noreferrer" className="btn-ghost btn-sm"><ExternalLink size={13} /> Voir sur la boutique</a>}
          <button onClick={optimize} disabled={busy === "opt"} className="btn-emerald btn-sm">{busy === "opt" ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} Lancer optim IA</button>
        </div>
      }
    >
      {!data ? <Spinner /> : (
        <div className="space-y-5">
          <div className="flex items-center gap-3 text-sm">
            {data.audit_score != null && <span className={cn("font-medium", data.audit_score >= 80 ? "text-emerald-400" : data.audit_score >= 40 ? "text-amber-400" : "text-red-400")}>Score audit {data.audit_score}/100</span>}
            <ProductStatusBadge status={data.status} />
          </div>
          {(data.audit_issues || []).length > 0 && (
            <div className="flex flex-wrap gap-1.5">{data.audit_issues.map((i: string) => <span key={i} className="rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] text-red-300">{i}</span>)}</div>
          )}

          {!pp ? (
            <EmptyState>Pas encore de version optimisee. Clique &quot;Lancer optim IA&quot; en haut.</EmptyState>
          ) : (
            <>
              <Diff label="Titre" a={data.current?.title} b={pp.title} />
              <Diff label="Description" a={(data.current?.body_html || "").replace(/<[^>]+>/g, " ").slice(0, 240)} b={(pp.body_html || "").replace(/<[^>]+>/g, " ").slice(0, 240)} />

              {cro && (
                <div>
                  <p className="eyebrow mb-2">Signaux CRO</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(CRO_SIGNAL_LABELS).map(([k, label]) => {
                      const on = !!cro[k];
                      return (
                        <span key={k} className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs", on ? "bg-emerald-500/15 text-emerald-300" : "bg-white/[0.04] text-zinc-600")}>
                          {on ? <Check size={12} /> : <X size={12} />} {label}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {cm && (
                <div>
                  <p className="eyebrow mb-2">Meta par canal</p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {[["Shopify", cm.shopify], ["Google Shopping", cm.google_shopping], ["Meta Ads", cm.meta_ads]].map(([name, m]: any) => (
                      <div key={name} className="rounded-lg border border-white/[0.07] bg-black/20 p-2.5 text-[11px]">
                        <p className="mb-1 font-medium text-zinc-300">{name}</p>
                        <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words font-mono text-zinc-500">{JSON.stringify(m, null, 1)}</pre>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="eyebrow mb-2">Apercu de la fiche optimisee</p>
                <iframe title="preview" src={`/api/admin/sites/${siteId}/products/preview?external_id=${encodeURIComponent(product.external_id)}&pw=${encodeURIComponent(pw)}`} className="h-[28rem] w-full rounded-lg border border-white/10 bg-white" />
              </div>

              <div className="flex gap-2 border-t border-white/[0.06] pt-4">
                <button onClick={applyNow} disabled={busy === "apply"} className="btn-primary">{busy === "apply" ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />} Appliquer sur Shopify</button>
                <button onClick={optimize} disabled={busy === "opt"} className="btn-ghost">{busy === "opt" ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Re-optimiser</button>
              </div>
            </>
          )}
        </div>
      )}
    </Drawer>
  );
}

const TAX_DIMS: [string, string, number][] = [
  ["description", "Description", 30], ["meta_title", "Meta title", 15], ["meta_description", "Meta desc", 15],
  ["image", "Image", 10], ["products_count", "Produits", 10], ["internal_links", "Liens int.", 10], ["headings_structure", "Headings", 10],
];

function barColor(ratio: number): string {
  return ratio >= 0.8 ? "bg-emerald-500" : ratio >= 0.4 ? "bg-amber-500" : "bg-red-500";
}
function ScoreBox({ score }: { score: number | null }) {
  const cls = score == null ? "bg-white/[0.04] text-zinc-500" : score >= 80 ? "bg-emerald-500/15 text-emerald-300" : score >= 40 ? "bg-amber-500/15 text-amber-300" : "bg-red-500/15 text-red-300";
  return <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-sm font-bold", cls)}>{score ?? "-"}</span>;
}
const NEG_NOTE = /aucun|manqu|absent|trop|peu de|courte|court |vide|0 /i;

function CategoriesTab({ siteId, api, setMsg }: { siteId: string; api: ApiFn; setMsg: (s: string | null) => void }) {
  const [taxos, setTaxos] = useState<any[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState("score-asc");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [histFor, setHistFor] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { ok, json } = await api(`/api/admin/sites/${siteId}/taxonomies`);
    setLoading(false);
    if (ok) setTaxos(json.rows || []); else setMsg(json.error || "Erreur");
  }, [siteId, api, setMsg]);
  useEffect(() => { load(); }, [load]);

  async function sync() {
    setBusy("sync"); setMsg("Sync + audit 7 dimensions...");
    const { ok, json } = await api(`/api/admin/sites/${siteId}/taxonomies/sync`, { method: "POST", body: JSON.stringify({}) });
    setBusy(null); setMsg(ok ? `${json.fetched} categories, score moyen ${json.summary?.avg ?? "-"}` : `Erreur: ${json.error}`); load();
  }
  async function analyze(id: string) {
    setBusy(id + "a"); setMsg("Analyse IA (SERP + intent + H1 + FAQ + liens + schema)...");
    const { ok, json } = await api(`/api/admin/sites/${siteId}/taxonomies/analyze`, { method: "POST", body: JSON.stringify({ tax_id: id }) });
    setBusy(null); setMsg(ok ? "Version optimisee prete." : `Erreur: ${json.error}`); load();
  }
  async function genImage(id: string) {
    setBusy(id + "i"); setMsg("Generation image collection (fal)...");
    const { ok, json } = await api(`/api/admin/sites/${siteId}/taxonomies/image`, { method: "POST", body: JSON.stringify({ tax_id: id }) });
    setBusy(null); setMsg(ok ? "Image generee et poussee." : `Erreur: ${json.error}`); load();
  }
  async function push(id: string) {
    setBusy(id + "p"); setMsg("Push sur Shopify...");
    const { ok, json } = await api(`/api/admin/sites/${siteId}/taxonomies/push`, { method: "POST", body: JSON.stringify({ tax_id: id }) });
    setBusy(null); setMsg(ok ? "Collection poussee en live." : `Erreur: ${json.error}`); load();
  }

  const scored = taxos.filter((t) => t.quality_score != null);
  const avg = scored.length ? Math.round(scored.reduce((a, t) => a + t.quality_score, 0) / scored.length) : 0;
  const sorted = [...taxos].sort((a, b) => {
    if (sort === "score-asc") return (a.quality_score ?? 999) - (b.quality_score ?? 999);
    if (sort === "score-desc") return (b.quality_score ?? -1) - (a.quality_score ?? -1);
    if (sort === "name-asc") return a.name.localeCompare(b.name);
    return (b.products_count || 0) - (a.products_count || 0);
  });

  if (loading) return <Spinner label="Chargement des categories..." />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-100"><Tag size={17} /> Product Categories</h2>
          <p className="mt-1 max-w-3xl text-sm text-zinc-500">Audit SEO de chaque categorie / collection. Score 0-100 par dimension : description, meta, image, maillage, structure, headings.</p>
        </div>
        <button onClick={sync} disabled={busy === "sync"} className="btn-emerald">
          {busy === "sync" ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Sync depuis la plateforme
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="Total" value={taxos.length} hint="categories" />
        <StatCard label="Score moyen" value={`${avg}/100`} hint="0 a 100" tone={avg >= 80 ? "success" : avg >= 40 ? "warn" : "default"} />
        <StatCard label="Excellentes" value={scored.filter((t) => t.quality_score >= 80).length} hint="80 et plus" tone="success" />
        <StatCard label="Moyennes" value={scored.filter((t) => t.quality_score >= 40 && t.quality_score < 80).length} hint="40 a 79" tone="warn" />
        <StatCard label="Critiques" value={scored.filter((t) => t.quality_score < 40).length} hint="moins de 40" tone="danger" />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-zinc-500">{taxos.length} categories</span>
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          Trier :
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="input-base w-auto py-1.5">
            <option value="score-asc">Score (pire vers meilleur)</option>
            <option value="score-desc">Score (meilleur vers pire)</option>
            <option value="name-asc">Nom (A-Z)</option>
            <option value="products-desc">Plus de produits</option>
          </select>
        </div>
      </div>

      {sorted.length === 0 && <EmptyState>Aucune categorie. Clique &quot;Sync depuis la plateforme&quot;.</EmptyState>}
      <div className="space-y-2">
        {sorted.map((t) => {
          const bd = t.quality_breakdown;
          const open = expanded === t.id;
          const notes: string[] = Array.isArray(bd?.notes) ? bd.notes : [];
          return (
            <div key={t.id} className="overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.02]">
              <button onClick={() => setExpanded(open ? null : t.id)} className="flex w-full items-center gap-3 p-3 text-left transition hover:bg-white/[0.02]">
                <ScoreBox score={t.quality_score} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-zinc-100">{t.name}</span>
                  <span className="text-xs text-zinc-500">/{t.handle} · {t.products_count} produits</span>
                </span>
                {t.url && <a href={t.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-zinc-600 hover:text-emerald-400"><ExternalLink size={14} /></a>}
                <ChevronRight size={16} className={cn("text-zinc-500 transition", open && "rotate-90")} />
              </button>
              {open && (
                <div className="border-t border-white/[0.06] p-4">
                  {bd && (
                    <>
                      <p className="eyebrow mb-2">Breakdown ({t.quality_score}/100)</p>
                      <div className="mb-4 grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
                        {TAX_DIMS.map(([k, label, max]) => {
                          const val = bd[k] ?? 0;
                          const ratio = max ? val / max : 0;
                          return (
                            <div key={k}>
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="text-zinc-400">{label}</span>
                                <span className="tabular-nums text-zinc-500">{val}/{max}</span>
                              </div>
                              <div className="mt-1 h-1.5 rounded-full bg-white/[0.06]"><div className={cn("h-1.5 rounded-full", barColor(ratio))} style={{ width: `${Math.max(4, ratio * 100)}%` }} /></div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                  {notes.length > 0 && (
                    <div className="mb-4">
                      <p className="eyebrow mb-1.5">Diagnostic</p>
                      <div className="space-y-1">
                        {notes.map((n: string, i: number) => {
                          const neg = NEG_NOTE.test(n);
                          return (
                            <p key={i} className={cn("flex items-start gap-1.5 text-xs", neg ? "text-red-300" : "text-zinc-300")}>
                              {neg ? <AlertCircle size={13} className="mt-0.5 shrink-0 text-red-400" /> : <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-emerald-400" />}
                              {n}
                            </p>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <div className="mb-4 grid gap-3 text-xs sm:grid-cols-2">
                    <div>
                      <p className="eyebrow mb-1">Meta title actuel</p>
                      <p className="text-zinc-400">{t.current_meta_title || <span className="italic text-red-400">(absent)</span>}</p>
                    </div>
                    <div>
                      <p className="eyebrow mb-1">Meta description actuelle</p>
                      <p className="line-clamp-2 text-zinc-400">{t.current_meta_description || <span className="italic text-red-400">(absente)</span>}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-3">
                    <span className="text-[11px] text-zinc-600">
                      {t.audit_at ? `Auditee le ${formatDateTime(t.audit_at)}` : "Pas encore auditee"}
                      {t.analyzed_at && <span className="text-emerald-400"> · Optimisee le {formatDateTime(t.analyzed_at)}</span>}
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button onClick={() => setHistFor(t)} className="btn-ghost btn-sm"><History size={12} /> Historique</button>
                      <button onClick={() => genImage(t.id)} disabled={busy === t.id + "i"} className="btn-violet btn-sm" title={t.current_image_url ? "Regenere l'image et ecrase l'actuelle (l'ancienne reste dans l'historique)" : "Genere une image de categorie coherente avec le branding"}>
                        {busy === t.id + "i" ? <Loader2 size={12} className="animate-spin" /> : <ImageIcon size={12} />} {t.current_image_url ? "Re-generer image" : "Generer image"}
                      </button>
                      {t.analyzed_at && t.url && <a href={t.url} target="_blank" rel="noreferrer" className="btn-ghost btn-sm"><ExternalLink size={12} /> Voir l&apos;optimisee</a>}
                      <button onClick={() => analyze(t.id)} disabled={busy === t.id + "a"} className="btn-emerald btn-sm">
                        {busy === t.id + "a" ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} {t.analyzed_at ? "Re-generer" : "Generer version optimisee"}
                      </button>
                      {t.suggested_description_html && (
                        <button onClick={() => push(t.id)} disabled={busy === t.id + "p"} className="btn-primary btn-sm">
                          {busy === t.id + "p" ? <Loader2 size={12} className="animate-spin" /> : <UploadCloud size={12} />} Pousser en live
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {histFor && <HistoryDrawer siteId={siteId} api={api} tax={histFor} onClose={() => setHistFor(null)} />}
    </div>
  );
}

const TAX_KIND_META: Record<string, { label: string; cls: string }> = {
  collection_image: { label: "Image categorie", cls: "text-purple-300" },
  collection_optimized_draft: { label: "Version optimisee generee", cls: "text-emerald-300" },
  collection_pushed_live: { label: "Poussee en live", cls: "text-sky-300" },
  collection_description: { label: "Description modifiee", cls: "text-zinc-300" },
  meta_title: { label: "Meta title", cls: "text-zinc-300" },
  meta_description: { label: "Meta description", cls: "text-zinc-300" },
};
function isImageUrl(s?: string | null): boolean {
  return typeof s === "string" && /^https?:\/\//.test(s) && /\.(jpg|jpeg|png|webp|gif|avif)(\?|$)/i.test(s.split("?")[0]);
}

function HistoryDrawer({ siteId, api, tax, onClose }: { siteId: string; api: ApiFn; tax: any; onClose: () => void }) {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api(`/api/admin/sites/${siteId}/optimizations?target_id=${tax.id}&limit=100`).then(({ ok, json }) => { setLoading(false); if (ok) setEvents(json.optimizations || []); });
  }, [siteId, api, tax.id]);
  return (
    <Drawer title="Historique des modifications" subtitle={tax.name} onClose={onClose} maxWidth="max-w-2xl">
      {loading ? <Spinner /> : events.length === 0 ? (
        <EmptyState>Aucune modification enregistree pour cette categorie. Des que tu cliques sur &quot;Regenerer image&quot;, &quot;Generer version optimisee&quot; ou que tu pousses en live, ca apparaitra ici.</EmptyState>
      ) : (
        <ol className="space-y-3">
          {events.map((e) => {
            const meta = TAX_KIND_META[e.kind] || { label: e.kind, cls: "text-zinc-400" };
            return (
              <li key={e.id} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className={cn("text-sm font-medium", meta.cls)}>{meta.label}</span>
                  <span className="flex items-center gap-2 text-[11px] text-zinc-500">
                    <span className={cn("rounded px-1.5 py-0.5", e.source === "ai" ? "bg-purple-500/15 text-purple-300" : e.source === "system" ? "bg-white/[0.06] text-zinc-400" : "bg-white/10 text-zinc-200")}>{e.source}</span>
                    {relativeTime(e.done_at)}
                  </span>
                </div>
                {e.note && <p className="mb-2 text-xs italic text-zinc-500">{e.note}</p>}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="eyebrow mb-1">Avant</p>
                    {isImageUrl(e.before_value)
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={e.before_value} alt="" className="max-h-24 rounded-md" />
                      : <p className="line-clamp-3 text-zinc-400">{e.before_value || <span className="italic text-zinc-600">(vide)</span>}</p>}
                  </div>
                  <div>
                    <p className="eyebrow mb-1">Apres</p>
                    {isImageUrl(e.after_value)
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={e.after_value} alt="" className="max-h-24 rounded-md" />
                      : <p className="line-clamp-3 text-emerald-300">{e.after_value || <span className="italic text-zinc-600">(vide)</span>}</p>}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Drawer>
  );
}

const POSITION_OPTS = [
  { v: "0.2", l: "20% de l'article" }, { v: "0.4", l: "40% de l'article" }, { v: "0.5", l: "50% (newsletter sweet spot)" },
  { v: "0.6", l: "60% de l'article" }, { v: "0.8", l: "80% de l'article" }, { v: "end", l: "Fin de l'article" },
];

function ScroField({ label, value, onChange, placeholder, full }: { label: string; value?: string; onChange: (v: string) => void; placeholder?: string; full?: boolean }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <label className="eyebrow mb-1 block">{label}</label>
      <input value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="input-base" />
    </div>
  );
}
function PerksField({ label, value, onChange, placeholder, max = 5 }: { label: string; value?: string[]; onChange: (v: string[]) => void; placeholder?: string; max?: number }) {
  return (
    <div className="sm:col-span-2">
      <label className="eyebrow mb-1 block">{label}</label>
      <textarea value={(value || []).join("\n")} onChange={(e) => onChange(e.target.value.split("\n").slice(0, max))} rows={4} className="input-base text-xs" placeholder={placeholder} />
    </div>
  );
}
function HandleListEditor({ cfg, options, onChange, autoLabel, autoDisabled, autoDisabledHint, hideManual }: { cfg: any; options: any[]; onChange: (p: any) => void; autoLabel: string; autoDisabled?: boolean; autoDisabledHint?: string; hideManual?: boolean }) {
  const handles: string[] = Array.isArray(cfg?.manual_handles) ? cfg.manual_handles : [];
  const setHandle = (i: number, v: string) => { const next = [...handles]; next[i] = v; onChange({ manual_handles: next }); };
  return (
    <div className="space-y-2.5">
      <div>
        <label className="eyebrow mb-1 block">Titre de la section</label>
        <input value={cfg?.title || ""} onChange={(e) => onChange({ title: e.target.value })} className="input-base" />
      </div>
      <label className="flex items-center gap-2 text-xs text-zinc-400">
        <input type="checkbox" checked={!!cfg?.auto} disabled={autoDisabled} onChange={(e) => onChange({ auto: e.target.checked })} className="h-4 w-4 accent-emerald-500" />
        {autoLabel}
      </label>
      {autoDisabled && autoDisabledHint && <p className="text-[11px] text-zinc-600">{autoDisabledHint}</p>}
      {!cfg?.auto && !hideManual && (
        <div className="space-y-1.5">
          {[0, 1, 2].map((i) => (
            <select key={i} value={handles[i] || ""} onChange={(e) => setHandle(i, e.target.value)} className="input-base font-mono text-xs">
              <option value="">{`-- Slot #${i + 1} --`}</option>
              {options.map((o: any) => <option key={o.handle} value={o.handle}>{o.title}</option>)}
            </select>
          ))}
        </div>
      )}
      {!cfg?.auto && hideManual && (
        <p className="text-[11px] text-zinc-600">Pour piocher des articles specifiques au lieu des 3 plus recents, utilise &quot;Auto-remplir&quot; en haut puis re-pick si besoin.</p>
      )}
    </div>
  );
}
function ScroBlockCard({ icon, title, on, onToggle, children }: { icon: React.ReactNode; title: string; on: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-zinc-100">{icon} {title}</h4>
        <Toggle on={on} onClick={onToggle} />
      </div>
      {children}
    </div>
  );
}

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

  if (!config || !catalog) return <Spinner label="Chargement SCRO..." />;
  const br = catalog.branding || {};
  const sb = config.sidebar || {};
  const lead = sb.lead_magnet || {};
  const best = sb.bestsellers || {};
  const cats = sb.top_categories || {};
  const arts = sb.top_articles || {};
  const author = sb.author || {};
  const productOpts = catalog.products || [];
  const collectionOpts = catalog.collections || [];
  const blocks = config.blocks || [];
  const pushStatusColor = config.last_push_status === "ok" ? "text-emerald-400" : config.last_push_status === "removed" ? "text-zinc-400" : "text-red-400";

  return (
    <div className="space-y-5 pb-28">
      {/* Header */}
      <div className="card-base">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-100"><Sparkles size={16} className="text-amber-300" /> SCRO, blocs CRO dans les articles</h3>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-zinc-500">
              Injecte jusqu&apos;a 5 cartes produit / collection a des positions fixes dans CHAQUE article de blog (20%, 40%, 60%, 80%, fin). Les couleurs viennent de ton voice_profile, le push ecrit dans sections/main-article.liquid de ton theme actif. Re-pushable n&apos;importe quand, rollback en 1 clic.
            </p>
          </div>
          <Toggle on={!!config.inline_enabled} onClick={() => patch({ inline_enabled: !config.inline_enabled })} labelOn="Active" labelOff="Desactive" />
        </div>
        {config.last_push_status && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-zinc-500">
            {config.last_push_status === "ok" ? <CheckCircle2 size={13} className="text-emerald-400" /> : config.last_push_status === "removed" ? <Undo2 size={13} /> : <AlertTriangle size={13} className="text-red-400" />}
            Dernier push : {config.last_pushed_at ? formatDateTime(config.last_pushed_at) : "-"} · statut <span className={pushStatusColor}>{config.last_push_status}</span>
            {config.last_push_error ? ` · ${config.last_push_error}` : ""}
          </p>
        )}
      </div>

      {/* Palette */}
      <div className="card-base">
        <h3 className="text-sm font-semibold text-zinc-100">Palette detectee</h3>
        <p className="mb-3 mt-1 text-xs text-zinc-500">Auto depuis le voice_profile du site. Les boutons et accents des blocs CRO suivront ces couleurs.</p>
        <div className="flex flex-wrap gap-4">
          {["accent", "accentDark", "cardBg", "border", "textDark", "ratingColor"].map((k) => (
            <div key={k} className="text-center">
              <div className="h-9 w-9 rounded-md border border-white/10" style={{ background: br[k] || "#222" }} />
              <div className="mt-1 font-mono text-[10px] text-zinc-500">{k}</div>
              <div className="font-mono text-[10px] text-zinc-600">{br[k] || "-"}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Inline blocks */}
      <div className="card-base">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-100">Blocs ({blocks.length}/5)</h3>
          <button onClick={addBlock} disabled={blocks.length >= 5} className="btn-ghost btn-sm"><Plus size={13} /> Ajouter un bloc</button>
        </div>
        {blocks.length === 0 ? (
          <p className="text-sm text-zinc-600">Aucun bloc configure. Click &quot;Ajouter un bloc&quot; pour commencer.</p>
        ) : (
          <div className="space-y-3">
            {blocks.map((b: any, i: number) => {
              const opts = b.kind === "product" ? productOpts : collectionOpts;
              const selected = opts.find((o: any) => o.handle === b.handle);
              const posLabel = b.position === "end" ? "Fin de l'article" : `${Math.round(Number(b.position) * 100)}%`;
              return (
                <div key={i} className="rounded-xl border border-white/[0.07] bg-black/20 p-3">
                  <div className="mb-2.5 flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="rounded bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-300">Slot #{i + 1} · {posLabel}</span>
                      {selected && <span className="truncate text-xs text-zinc-400">{selected.title}</span>}
                    </div>
                    <button onClick={() => removeBlock(i)} className="text-zinc-600 hover:text-red-400"><Trash2 size={14} /></button>
                  </div>
                  <div className="grid gap-2 text-xs md:grid-cols-2">
                    <div>
                      <label className="eyebrow mb-1 block">Position</label>
                      <select value={String(b.position)} onChange={(e) => updateBlock(i, { position: e.target.value })} className="input-base">
                        {POSITION_OPTS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="eyebrow mb-1 block">Type</label>
                      <div className="flex gap-1.5">
                        {[{ v: "product", l: "Produit", Icon: ShoppingBag }, { v: "collection", l: "Collection", Icon: FolderTree }].map((t) => (
                          <button key={t.v} onClick={() => updateBlock(i, { kind: t.v, handle: "" })}
                            className={cn("flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2 transition", b.kind === t.v ? "border-emerald-500/40 bg-emerald-500/[0.08] text-emerald-200" : "border-white/10 text-zinc-400 hover:border-white/20")}>
                            <t.Icon size={13} /> {t.l}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="md:col-span-2">
                      <label className="eyebrow mb-1 block">{b.kind === "product" ? "Produit" : "Collection"} (handle Shopify)</label>
                      <select value={b.handle} onChange={(e) => updateBlock(i, { handle: e.target.value })} className="input-base">
                        <option value="">Choisir...</option>
                        {opts.map((o: any) => <option key={o.handle} value={o.handle}>{o.title}</option>)}
                      </select>
                    </div>
                    <ScroField label="Label / eyebrow (top de carte)" value={b.label} onChange={(v) => updateBlock(i, { label: v })} />
                    <ScroField label="CTA (texte du bouton)" value={b.cta} onChange={(v) => updateBlock(i, { cta: v })} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sidebar 5 blocks */}
      <div className="card-base">
        <div className="mb-1 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-100"><FolderTree size={16} className="text-emerald-300" /> Sidebar 5 blocs (CRO/SEO)</h3>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-zinc-500">
              Lead magnet, 3 bestsellers, 3 categories top vente, 3 articles, auteur/trust. Couleurs auto depuis le branding. Icones generees par Claude pour matcher la persona. Mobile : passe en bas du contenu.
            </p>
          </div>
          <Toggle on={!!config.sidebar_enabled} onClick={() => patch({ sidebar_enabled: !config.sidebar_enabled })} labelOn="Activee" labelOff="Desactivee" />
        </div>
        <div className="mb-4 mt-3 flex flex-wrap gap-2">
          <button onClick={genIcons} disabled={busy === "icons"} className="btn-ghost btn-sm">{busy === "icons" ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />} Generer mes icones (Claude)</button>
          <button onClick={autoData} disabled={busy === "auto"} className="btn-ghost btn-sm">{busy === "auto" ? <Loader2 size={13} className="animate-spin" /> : <UploadCloud size={13} />} Auto-remplir (homepage + commandes 90j + articles recents)</button>
        </div>

        <div className="space-y-3">
          <ScroBlockCard icon={<Gift size={15} className="text-amber-300" />} title="1. Lead magnet" on={!!lead.enabled} onToggle={() => setSidebar("lead_magnet", { enabled: !lead.enabled })}>
            <div className="grid gap-2.5 md:grid-cols-2">
              <ScroField label="Titre" value={lead.title} onChange={(v) => setSidebar("lead_magnet", { title: v })} />
              <ScroField label="Code promo" value={lead.promo_code} onChange={(v) => setSidebar("lead_magnet", { promo_code: v })} placeholder="NAMASTE" />
              <ScroField label="Sous-titre" value={lead.subtitle} onChange={(v) => setSidebar("lead_magnet", { subtitle: v })} full />
              <ScroField label="CTA bouton" value={lead.cta_text} onChange={(v) => setSidebar("lead_magnet", { cta_text: v })} />
              <ScroField label="CTA URL" value={lead.cta_url} onChange={(v) => setSidebar("lead_magnet", { cta_url: v })} placeholder="/contact" />
              <ScroField label="Image URL" value={lead.image_url} onChange={(v) => setSidebar("lead_magnet", { image_url: v })} placeholder="https://cdn.shopify.com/..." full />
              <PerksField label="Perks / benefices (1 par ligne, max 5)" value={lead.perks} onChange={(v) => setSidebar("lead_magnet", { perks: v })} placeholder={"Nouveaux articles\nPromos en avant-premiere"} />
            </div>
          </ScroBlockCard>

          <ScroBlockCard icon={<Crown size={15} className="text-amber-300" />} title="2. Top 3 bestsellers (produits)" on={!!best.enabled} onToggle={() => setSidebar("bestsellers", { enabled: !best.enabled })}>
            <HandleListEditor cfg={best} options={productOpts} onChange={(p) => setSidebar("bestsellers", p)} autoLabel="Auto (best-sellers Shopify natifs)" />
          </ScroBlockCard>

          <ScroBlockCard icon={<FolderTree size={15} className="text-sky-300" />} title="3. Top 3 categories" on={!!cats.enabled} onToggle={() => setSidebar("top_categories", { enabled: !cats.enabled })}>
            <HandleListEditor cfg={cats} options={collectionOpts} onChange={(p) => setSidebar("top_categories", p)} autoLabel="Auto (calcule via commandes Shopify)" autoDisabled autoDisabledHint="Le calcul auto se fait via 'Auto-remplir' ci-dessus (orders API)." />
          </ScroBlockCard>

          <ScroBlockCard icon={<BookOpen size={15} className="text-purple-300" />} title="4. Top 3 articles" on={!!arts.enabled} onToggle={() => setSidebar("top_articles", { enabled: !arts.enabled })}>
            <HandleListEditor cfg={arts} options={[]} onChange={(p) => setSidebar("top_articles", p)} autoLabel="Auto (3 plus recents du blog courant)" hideManual />
          </ScroBlockCard>

          <ScroBlockCard icon={<UserCircle size={15} className="text-rose-300" />} title="5. Auteur / brand / trust" on={!!author.enabled} onToggle={() => setSidebar("author", { enabled: !author.enabled })}>
            <div className="grid gap-2.5 md:grid-cols-2">
              <ScroField label="Nom" value={author.name} onChange={(v) => setSidebar("author", { name: v })} placeholder="(vide = persona du voice_profile)" />
              <ScroField label="Role" value={author.role} onChange={(v) => setSidebar("author", { role: v })} placeholder="Buddhist Monk & Author" />
              <ScroField label="Image URL" value={author.image_url} onChange={(v) => setSidebar("author", { image_url: v })} full />
              <div className="sm:col-span-2">
                <label className="eyebrow mb-1 block">Bio</label>
                <textarea value={author.bio || ""} onChange={(e) => setSidebar("author", { bio: e.target.value })} rows={3} className="input-base" />
              </div>
              <PerksField label="Trust badges (1 par ligne)" value={author.trust_badges} onChange={(v) => setSidebar("author", { trust_badges: v })} max={6} placeholder={"-5% premiere commande\nOffres exclusives"} />
            </div>
          </ScroBlockCard>
        </div>
      </div>

      {/* Theme picker */}
      <div className="card-base">
        <h3 className="mb-2 text-sm font-semibold text-zinc-100">Theme cible</h3>
        <select value={config.theme_id || ""} onChange={(e) => patch({ theme_id: e.target.value || null })} className="input-base">
          <option value="">Theme actif (auto)</option>
          {(catalog.themes || []).map((t: any) => <option key={t.id} value={t.id}>{t.name} ({t.role})</option>)}
        </select>
        {catalog.errors?.themes && <p className="mt-2 text-xs text-red-400">{catalog.errors.themes}</p>}
      </div>

      {/* Sticky actions */}
      <div className="fixed bottom-4 left-1/2 z-20 flex w-[min(92%,60rem)] -translate-x-1/2 items-center justify-between rounded-xl border border-white/10 bg-[var(--bg-elev)]/95 p-3 shadow-2xl shadow-black/40 backdrop-blur">
        <span className={cn("flex items-center gap-1.5 text-xs", dirty ? "text-amber-300" : "text-zinc-500")}>
          {dirty ? <AlertTriangle size={13} /> : <CheckCircle2 size={13} className="text-emerald-400" />}
          {dirty ? "Modifications non sauvegardees" : "Tout est sauvegarde"}
        </span>
        <div className="flex gap-2">
          {config.last_push_status === "ok" && (
            <button onClick={removeScro} disabled={busy === "remove"} className="btn-ghost btn-sm">{busy === "remove" ? <Loader2 size={13} className="animate-spin" /> : <Undo2 size={13} />} Retirer du theme</button>
          )}
          <button onClick={save} disabled={busy === "save" || !dirty} className="btn-ghost btn-sm">{busy === "save" ? <Loader2 size={13} className="animate-spin" /> : null} Sauvegarder</button>
          <button onClick={push} disabled={busy === "push"} className="btn-primary btn-sm">{busy === "push" ? <Loader2 size={13} className="animate-spin" /> : <PlayCircle size={13} />} Push sur le theme</button>
        </div>
      </div>
    </div>
  );
}

const ANTI_AI_LABELS_FOR_UI: { key: string; label: string }[] = [
  // Tirets longs affiches via fromCharCode : la regle projet interdit tout em-dash brut dans le source.
  { key: "em_dash", label: "Em-dash et en-dash «" + String.fromCharCode(0x2014) + "» «" + String.fromCharCode(0x2013) + "»" },
  { key: "dans_cet_article", label: '"Dans cet article nous allons voir"' },
  { key: "noubliez_pas", label: "\"N'oubliez pas que...\"" },
  { key: "ere_du_digital", label: "\"A l'ere du digital\", \"dans un monde ou\"" },
  { key: "en_conclusion", label: '"En conclusion" comme titre' },
  { key: "il_est_important", label: '"Il est important de noter"' },
  { key: "monde_ou", label: "\"Dans un monde ou\", \"a une epoque ou\"" },
  { key: "delve", label: 'Tics traduits ("plonger dans", "explorer", "naviguer")' },
  { key: "important_de_noter", label: "\"Il convient de noter\", \"il faut souligner\"" },
];

function LabelHint({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="mb-1.5">
      <div className="eyebrow">{label}</div>
      {hint ? <p className="mt-1 text-xs leading-relaxed text-zinc-600">{hint}</p> : null}
    </div>
  );
}

function ProfilTab({ siteId, api, setMsg, onSaved }: { siteId: string; api: ApiFn; setMsg: (s: string | null) => void; onSaved: () => void }) {
  const [vp, setVp] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [exists, setExists] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    api(`/api/admin/sites/list`).then(({ ok, json }) => {
      setLoading(false);
      if (!ok) return;
      const s = (json.sites || []).find((x: any) => x.id === siteId);
      if (s) { setVp(s.voice_profile || {}); setExists(!!s.voice_profile && Object.keys(s.voice_profile).length > 0); }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId]);

  const f = (k: string) => vp[k] ?? "";
  const set = (k: string, v: string) => setVp((p) => ({ ...p, [k]: v }));
  const activePatterns: string[] = Array.isArray(vp.anti_ai_patterns) ? vp.anti_ai_patterns : [];
  const togglePattern = (key: string) =>
    setVp((prev) => {
      const cur: string[] = Array.isArray(prev.anti_ai_patterns) ? prev.anti_ai_patterns : [];
      return { ...prev, anti_ai_patterns: cur.includes(key) ? cur.filter((x) => x !== key) : [...cur, key] };
    });

  async function save() {
    setBusy("save");
    const { ok, json } = await api(`/api/admin/sites/update-profile`, {
      method: "POST",
      body: JSON.stringify({ site_id: siteId, voice_profile: vp }),
    });
    setBusy(null); setMsg(ok ? "Profil enregistre." : `Erreur: ${json.error}`);
    if (ok) { setExists(true); onSaved(); }
  }
  async function clearProfile() {
    if (!confirm("Effacer completement le profil de voix de ce site ?")) return;
    setBusy("clear");
    const { ok, json } = await api(`/api/admin/sites/update-profile`, {
      method: "POST",
      body: JSON.stringify({ site_id: siteId, voice_profile: null }),
    });
    setBusy(null); setMsg(ok ? "Profil efface." : `Erreur: ${json.error}`);
    if (ok) { setVp({}); setExists(false); onSaved(); }
  }

  if (loading) return <Spinner label="Chargement du profil..." />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">Profil de voix</h2>
          <p className="mt-1 max-w-3xl text-sm text-zinc-500">
            Injecte dans tous les prompts Claude qui touchent au contenu de ce site : generation d&apos;articles ET optimisation produits. Plus c&apos;est precis, plus la voix correspond.
          </p>
        </div>
        {exists && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/[0.12] px-2.5 py-1 text-xs font-medium text-emerald-300 ring-1 ring-inset ring-emerald-500/30">
            <CheckCircle2 size={13} /> Profil actif
          </span>
        )}
      </div>

      {/* 1. Identite */}
      <section className="card-base space-y-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-100"><UserCircle size={16} className="text-emerald-300" /> Identite</h3>
        <div>
          <LabelHint label="Mascotte / personnage narrateur" hint="Ex: 'Mami Lulu, grand-mere passionnee de the depuis 50 ans, parle comme une grand-mere qui te raconte, glisse parfois des anecdotes de famille ou des blagues douces.'" />
          <textarea value={f("mascot")} onChange={(e) => set("mascot", e.target.value)} rows={3} maxLength={2000} className="input-base" />
        </div>
        <div>
          <LabelHint label="Audience cible" />
          <textarea value={f("audience")} onChange={(e) => set("audience", e.target.value)} rows={2} maxLength={2000} className="input-base" />
        </div>
      </section>

      {/* 2. Carte auteur */}
      <section className="card-base space-y-4">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-100"><UserCircle size={16} className="text-rose-300" /> Carte auteur</h3>
          <p className="mt-1 text-xs text-zinc-500">Affichee dans la sidebar SCRO (bloc 5) et sous les articles. Photo + role + bio courte.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-[120px_1fr]">
          <div className="flex flex-col items-center gap-1.5">
            <div className="h-24 w-24 overflow-hidden rounded-full border border-white/10 bg-white/[0.03]">
              {f("author_photo_url") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={f("author_photo_url")} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-zinc-700"><UserCircle size={48} /></div>
              )}
            </div>
            <span className="text-[11px] text-zinc-600">Preview</span>
          </div>
          <div className="space-y-4">
            <div>
              <LabelHint label="Photo de l'auteur (URL Shopify CDN)" hint="Upload l'image dans Shopify admin > Content > Files puis copie l'URL cdn.shopify.com/... Format carre recommande (200x200+)." />
              <input type="url" value={f("author_photo_url")} onChange={(e) => set("author_photo_url", e.target.value)} maxLength={500} className="input-base" placeholder="https://cdn.shopify.com/..." />
            </div>
            <div>
              <LabelHint label="Role / sous-titre" hint="1 ligne sous le nom. Ex 'Moine bouddhiste & Auteur', 'Buddhist Monk & Author'." />
              <input type="text" value={f("author_role")} onChange={(e) => set("author_role", e.target.value)} maxLength={120} className="input-base" />
            </div>
            <div>
              <LabelHint label="Bio courte" hint="2 a 4 phrases. Affichee sous le role. Credibilite + histoire + valeur ajoutee." />
              <textarea value={f("author_bio")} onChange={(e) => set("author_bio", e.target.value)} rows={4} maxLength={1500} className="input-base" />
            </div>
          </div>
        </div>
      </section>

      {/* 3. Voix editoriale */}
      <section className="card-base space-y-4">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-100"><Sparkles size={16} className="text-emerald-300" /> Voix editoriale</h3>
          <p className="mt-1 text-xs text-zinc-500">Le ton, le rythme, le style. C&apos;est ce qui rend le contenu humain et identifiable.</p>
        </div>
        <div>
          <LabelHint label="Description du ton" hint="Ex: Chaleureux, legerement malicieux. Comme une grand-mere qui te raconte sans le cote pedant. Phrases courtes, quelques expressions familieres, pas de jargon snob." />
          <textarea value={f("tone_description")} onChange={(e) => set("tone_description", e.target.value)} rows={4} maxLength={5000} className="input-base" />
        </div>
        <div>
          <LabelHint label="Exemples de phrases-types" hint="Quelques phrases (3 a 5) qu'on imaginerait dans un article. Claude s'en inspire en few-shot." />
          <textarea value={f("example_phrases")} onChange={(e) => set("example_phrases", e.target.value)} rows={5} maxLength={5000} className="input-base font-mono text-xs" />
        </div>
      </section>

      {/* 4. Regles anti-AI */}
      <section className="card-base space-y-4">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-100"><ShieldOff size={16} className="text-emerald-300" /> Regles anti-AI</h3>
          <p className="mt-1 text-xs text-zinc-500">Les tics d&apos;ecriture qui font crier &apos;ChatGPT&apos; a un lecteur. Coche ceux a bannir.</p>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {ANTI_AI_LABELS_FOR_UI.map((p) => {
            const on = activePatterns.includes(p.key);
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => togglePattern(p.key)}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-xs transition",
                  on ? "border-emerald-500/40 bg-emerald-500/[0.06] text-zinc-200" : "border-white/[0.05] bg-black/20 text-zinc-400 hover:border-white/15",
                )}
              >
                <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded border", on ? "border-emerald-500 bg-emerald-500 text-black" : "border-white/20")}>
                  {on && <Check size={12} />}
                </span>
                {p.label}
              </button>
            );
          })}
        </div>
        <div>
          <LabelHint label="Regles custom" hint="Patterns specifiques a ce site a bannir, 1 par ligne ou en phrases." />
          <textarea value={f("anti_ai_custom")} onChange={(e) => set("anti_ai_custom", e.target.value)} rows={3} maxLength={3000} className="input-base" />
        </div>
      </section>

      {/* 5. Instructions bonus */}
      <section className="card-base space-y-4">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-100"><Wand2 size={16} className="text-emerald-300" /> Instructions bonus</h3>
          <p className="mt-1 text-xs text-zinc-500">Tout ce qui n&apos;entre pas dans les cases precedentes : regles metier, contraintes, opportunites.</p>
        </div>
        <div>
          <LabelHint label="Instructions libres" hint="Ex: 'Quand pertinent, mentionne l'historique du the en Chine ou au Japon. Ne jamais conseiller un produit qu'on ne vend pas dans la boutique.'" />
          <textarea value={f("bonus_instructions")} onChange={(e) => set("bonus_instructions", e.target.value)} rows={5} maxLength={3000} className="input-base" />
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={busy === "save"} className="btn-primary">
          {busy === "save" ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Enregistrer le profil
        </button>
        <button onClick={clearProfile} disabled={busy === "clear"} className="inline-flex items-center gap-2 text-sm font-medium text-red-400 transition hover:text-red-300 disabled:opacity-40">
          {busy === "clear" ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />} Effacer le profil
        </button>
      </div>
    </div>
  );
}

const IMAGE_PRESETS_UI: { id: string; label: string; model: string; cost: number; desc: string; Icon: typeof Palette; color: string }[] = [
  { id: "icon-lineart", label: "Icon line-art", model: "fal-ai/flux/schnell", cost: 0.003, desc: "Icone monoligne sur fond sombre, glow blanc.", Icon: Palette, color: "text-sky-300" },
  { id: "warm-cosy", label: "Warm cosy", model: "fal-ai/flux/schnell", cost: 0.003, desc: "Photo chaleureuse, lumiere naturelle, terracotta.", Icon: Coffee, color: "text-amber-300" },
  { id: "business-editorial", label: "Business editorial", model: "fal-ai/flux/dev", cost: 0.025, desc: "Photo business moderne, sharp focus. B2B, conseil, juridique.", Icon: Briefcase, color: "text-blue-300" },
  { id: "photo-real-premium", label: "Photo-real premium 4K", model: "fal-ai/flux-pro/v1.1", cost: 0.04, desc: "Photo ultra-realiste haut de gamme. Luxury, lifestyle, premium.", Icon: Camera, color: "text-violet-300" },
  { id: "abstract-minimal", label: "Abstract minimal", model: "fal-ai/flux/schnell", cost: 0.003, desc: "Formes geometriques, palettes douces. Tech, SaaS, conceptuel.", Icon: Shapes, color: "text-emerald-300" },
  { id: "symbolic-icon", label: "Symbolic icon studio", model: "fal-ai/flux/schnell", cost: 0.003, desc: "Un seul objet centre, lumiere studio. Visuels sobres conceptuels.", Icon: Target, color: "text-rose-300" },
  { id: "vibrant-flat", label: "Vibrant flat illustration", model: "fal-ai/flux/dev", cost: 0.025, desc: "Illustration plate, couleurs vives. Tech grand public, SaaS.", Icon: Brush, color: "text-fuchsia-300" },
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
    setBusy(null); setMsg(ok ? `Style par defaut: ${json.saved?.image_style_label ?? "ok"}` : `Erreur: ${json.error}`);
  }

  const totalCost = samples.reduce((a, s) => a + (s.cost_usd || 0), 0);

  return (
    <div className="space-y-5">
      <div className="card-base">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">Image Lab, onboarding visuel</h3>
            <p className="mt-1 text-xs text-zinc-500">Teste les styles d&apos;image candidat pour ce site, compare cote-a-cote et sauve le winner.</p>
          </div>
          {savedStyle ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs text-emerald-300"><Check size={12} /> Default actuel : {savedStyle}</span>
          ) : (
            <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs text-amber-300">Aucun style sauvegarde pour ce site</span>
          )}
        </div>
        <label className="eyebrow mb-1 block">Sujet sample (section H2 fictive pour tester)</label>
        <input value={topic} onChange={(e) => setTopic(e.target.value)} className="input-base" placeholder="ex: Article wall clock" />
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {IMAGE_PRESETS_UI.map((p) => (
          <div key={p.id} className="card-base flex flex-col">
            <div className="mb-2 flex items-start justify-between">
              <p.Icon size={22} className={p.color} />
              <span className="text-[10px] text-zinc-500">{p.model.split("/").slice(-1)[0]} · ${p.cost}</span>
            </div>
            <p className="text-sm font-medium text-zinc-100">{p.label}</p>
            <p className="mb-3 mt-0.5 min-h-[40px] text-xs text-zinc-500">{p.desc}</p>
            <button onClick={() => genPreset(p.id, p.label)} disabled={busy === p.id} className="btn-ghost btn-sm mt-auto">
              {busy === p.id ? <Loader2 size={12} className="animate-spin" /> : <ImageIcon size={12} />} Generer sample
            </button>
          </div>
        ))}
      </div>

      <div className="card-base">
        <h3 className="mb-2 text-sm font-semibold text-zinc-100">Style custom</h3>
        <textarea value={customHint} onChange={(e) => setCustomHint(e.target.value)} rows={3} className="input-base mb-2" placeholder="Decris le style (min 10 caracteres)" />
        <div className="flex flex-wrap gap-2">
          <select value={customModel} onChange={(e) => setCustomModel(e.target.value)} className="input-base flex-1">
            <option value="fal-ai/flux/schnell">flux/schnell ($0.003)</option>
            <option value="fal-ai/flux/dev">flux/dev ($0.025)</option>
            <option value="fal-ai/flux-pro/v1.1">flux-pro v1.1 ($0.04)</option>
            <option value="fal-ai/flux-pro">flux-pro ($0.05)</option>
          </select>
          <button onClick={genCustom} disabled={busy === "custom" || customHint.trim().length < 10} className="btn-primary">
            {busy === "custom" ? <Loader2 size={15} className="animate-spin" /> : <ImageIcon size={15} />} Generer custom
          </button>
        </div>
      </div>

      {samples.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-100">Samples generes ({samples.length})</h3>
            <span className="text-xs text-emerald-300">Cout total : ${totalCost.toFixed(3)}</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {samples.map((s, i) => (
              <div key={i} className="card-base">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.url} alt="" className="mb-2 aspect-video w-full rounded-lg object-cover" />
                <p className="text-xs text-zinc-300">{s.label}</p>
                <p className="mb-2 text-[10px] text-zinc-500">{s.model} · ${s.cost_usd}</p>
                <button onClick={() => saveDefault(s)} disabled={busy === "save" + (s.preset_id || "custom")} className="w-full rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/25 disabled:opacity-40">
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

const OPTIM_KIND_OPTIONS: { value: string; label: string; Icon: typeof FileText }[] = [
  { value: "meta_description", label: "Meta description", Icon: FileText },
  { value: "meta_title", label: "Meta title SEO", Icon: Tag },
  { value: "product_description", label: "Fiche produit reecrite", Icon: ShoppingBag },
  { value: "product_seo_meta", label: "SEO produit (h1, breadcrumb)", Icon: Search },
  { value: "collection_description", label: "Page categorie optimisee", Icon: BookOpen },
  { value: "collection_image", label: "Image categorie", Icon: ImageIcon },
  { value: "collection_optimized_draft", label: "Categorie : draft optimise", Icon: Sparkles },
  { value: "collection_pushed_live", label: "Categorie poussee live", Icon: UploadCloud },
  { value: "image_alt", label: "Alt text image", Icon: ImageIcon },
  { value: "internal_link", label: "Lien interne ajoute", Icon: Link2 },
  { value: "schema_markup", label: "Schema markup JSON-LD", Icon: FileText },
  { value: "redirect", label: "Redirection 301", Icon: Undo2 },
  { value: "article_generated", label: "Article genere", Icon: FileText },
  { value: "article_refreshed", label: "Article refresh", Icon: RefreshCw },
  { value: "product_reverted", label: "Produit restaure", Icon: Undo2 },
  { value: "other", label: "Autre optimisation", Icon: Settings },
];
const OPTIM_KIND_MAP = Object.fromEntries(OPTIM_KIND_OPTIONS.map((o) => [o.value, o]));
const TARGET_TYPES = ["product", "collection", "article", "page", "site"];

function HistoryTab({ siteId, site, api, setMsg }: { siteId: string; site: any; api: ApiFn; setMsg: (s: string | null) => void }) {
  const [items, setItems] = useState<any[]>([]);
  const [counters, setCounters] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);
  const [fKind, setFKind] = useState("");
  const [showLogger, setShowLogger] = useState(false);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [form, setForm] = useState<any>({ kind: "other", target_type: "site", target_id: "", target_title: "", target_url: "", before_value: "", after_value: "", note: "" });

  const load = useCallback(async () => {
    const qs = new URLSearchParams();
    if (fKind) qs.set("kind", fKind);
    const { ok, json } = await api(`/api/admin/sites/${siteId}/optimizations?${qs}`);
    if (ok) { setItems(json.optimizations || []); setCounters(json.counters || {}); setTotal(json.total || 0); }
  }, [siteId, api, fKind]);
  useEffect(() => { load(); }, [load]);

  async function save() {
    const { ok, json } = await api(`/api/admin/sites/${siteId}/optimizations`, { method: "POST", body: JSON.stringify({ optimization: { ...form, source: "manual" } }) });
    setMsg(ok ? "Optimisation enregistree." : `Erreur: ${json.error}`);
    if (ok) { setShowLogger(false); load(); }
  }
  async function del(id: string) {
    const { ok } = await api(`/api/admin/sites/${siteId}/optimizations?id=${id}`, { method: "DELETE" });
    if (ok) load();
  }
  function copyPortal() {
    const url = `${window.location.origin}/portail/${site?.client_view_token}`;
    navigator.clipboard?.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000);
  }
  const set = (k: string, v: string) => setForm((f: any) => ({ ...f, [k]: v }));
  const toggleExp = (id: string) => setExpanded((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow">Log d&apos;optimisations</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-3xl font-semibold tracking-tight text-zinc-100">{total}</span>
            <span className="text-sm text-zinc-500">enregistrees</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="btn-icon" aria-label="Rafraichir"><RefreshCw size={15} /></button>
          {site?.client_view_token && (
            <button onClick={copyPortal} className="btn-ghost">{copied ? <Check size={14} className="text-emerald-400" /> : <Link2 size={14} />} {copied ? "Copie" : "Lien portail"}</button>
          )}
          <button onClick={() => setShowLogger((v) => !v)} className="btn-primary"><Plus size={15} /> Logger une optim</button>
        </div>
      </div>

      {Object.entries(counters).filter(([, v]) => v > 0).length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(counters).filter(([, v]) => v > 0).map(([k, v]) => {
            const meta = OPTIM_KIND_MAP[k];
            const Icon = meta?.Icon || Settings;
            return (
              <button key={k} onClick={() => setFKind(fKind === k ? "" : k)} className={cn("pill", fKind === k && "pill-active")}>
                <Icon size={12} /> {meta?.label || k} <span className="opacity-70">{v}</span>
              </button>
            );
          })}
        </div>
      )}

      {showLogger && (
        <div className="card-base space-y-2.5">
          <div className="grid gap-2.5 sm:grid-cols-2">
            <div>
              <label className="eyebrow mb-1 block">Type d&apos;optim</label>
              <select value={form.kind} onChange={(e) => set("kind", e.target.value)} className="input-base">{OPTIM_KIND_OPTIONS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}</select>
            </div>
            <div>
              <label className="eyebrow mb-1 block">Cible</label>
              <select value={form.target_type} onChange={(e) => set("target_type", e.target.value)} className="input-base">{TARGET_TYPES.map((k) => <option key={k} value={k}>{k}</option>)}</select>
            </div>
            <input value={form.target_title} onChange={(e) => set("target_title", e.target.value)} className="input-base" placeholder="Titre cible" />
            <input value={form.target_url} onChange={(e) => set("target_url", e.target.value)} className="input-base" placeholder="URL cible" />
          </div>
          <textarea value={form.before_value} onChange={(e) => set("before_value", e.target.value)} rows={2} maxLength={20000} className="input-base" placeholder="Avant" />
          <textarea value={form.after_value} onChange={(e) => set("after_value", e.target.value)} rows={2} maxLength={20000} className="input-base" placeholder="Apres" />
          <textarea value={form.note} onChange={(e) => set("note", e.target.value)} rows={1} maxLength={2000} className="input-base" placeholder="Note" />
          <div className="flex gap-2">
            <button onClick={save} className="btn-primary"><Check size={14} /> Enregistrer</button>
            <button onClick={() => setShowLogger(false)} className="btn-ghost">Annuler</button>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState>Aucune optimisation pour le moment. Clique sur &quot;Logger une optim&quot; ou laisse le pipeline IA generer.</EmptyState>
      ) : (
        <div className="space-y-2">
          {items.map((o) => {
            const meta = OPTIM_KIND_MAP[o.kind];
            const Icon = meta?.Icon || Settings;
            const open = expanded.has(o.id);
            const hasDiff = o.before_value || o.after_value;
            return (
              <div key={o.id} className="card-base p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <Icon size={15} className="mt-0.5 shrink-0 text-zinc-500" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm text-zinc-200">{o.target_title || meta?.label || o.kind}</span>
                        <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-zinc-500">{o.target_type}</span>
                        <span className={cn("rounded px-1.5 py-0.5 text-[10px]", o.source === "ai" ? "bg-purple-500/15 text-purple-300" : o.source === "system" ? "bg-white/[0.06] text-zinc-400" : "bg-white/10 text-zinc-200")}>{o.source}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-zinc-500">{meta?.label || o.kind}{o.note ? ` · ${o.note}` : ""}</p>
                      {o.target_url && <a href={o.target_url} target="_blank" rel="noreferrer" className="text-xs text-emerald-400 hover:text-emerald-300">Voir la cible</a>}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-[11px] text-zinc-600">{relativeTime(o.done_at)}</span>
                    <button onClick={() => del(o.id)} className="text-zinc-600 hover:text-red-400"><Trash2 size={13} /></button>
                  </div>
                </div>
                {hasDiff && (
                  <button onClick={() => toggleExp(o.id)} className="mt-2 inline-flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300">
                    <ChevronRight size={12} className={cn("transition", open && "rotate-90")} /> {open ? "Masquer" : "Avant / Apres"}
                  </button>
                )}
                {open && hasDiff && (
                  <div className="mt-2 grid grid-cols-2 gap-3 text-xs">
                    <div><p className="eyebrow mb-1">Avant</p><p className="whitespace-pre-wrap break-words text-zinc-500">{o.before_value || "-"}</p></div>
                    <div><p className="eyebrow mb-1">Apres</p><p className="whitespace-pre-wrap break-words text-emerald-300">{o.after_value || "-"}</p></div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
