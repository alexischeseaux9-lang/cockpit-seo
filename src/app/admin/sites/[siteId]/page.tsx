"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, RefreshCw, Loader2, Play, PlayCircle, Plus, ListPlus, FileText,
  CheckCircle2, Check, X, ExternalLink, Sparkles, Image as ImageIcon, Package,
  FolderTree, History, User, UserCircle, Wand2, UploadCloud, Undo2, BarChart3,
  Globe, Archive, ShoppingBag, Map, Tag, Zap, ZapOff, Trash2, ChevronRight,
  ChevronDown, AlertCircle, AlertTriangle, Clock, Hourglass, Search, Power,
  Palette, Coffee, Briefcase, Camera, Shapes, Target, Brush, BookOpen, Users,
  Crown, Network, Gift, ShieldCheck, ShieldOff, PlugZap, Unplug, CalendarDays,
} from "lucide-react";
import { parseKeywordInput, type ParseResult } from "@/lib/sites/csv-parser";
import { ConnectModal } from "../../connect-modal";
import { Kpi, StatCard, StatusDot, Toggle, Drawer, Spinner, EmptyState, type Tone } from "../../_components/ui";
import { cn, relativeTime, formatDate, formatDateTime, daysSince } from "@/lib/format";
import { BRAND } from "@/lib/version";

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

const inputCls = "input-base";
const cardCls = "card-base";
const primaryBtn = "btn-primary";
const ghostBtn = "btn-ghost btn-sm";

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

const TAX_DIMS: [string, string, number][] = [
  ["description", "Description", 30], ["meta_title", "Meta title", 15], ["meta_description", "Meta desc", 15],
  ["image", "Image", 10], ["products_count", "Produits", 10], ["internal_links", "Liens int.", 10], ["headings_structure", "Headings", 10],
];

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
    setBusy(null); setMsg(ok ? `${json.fetched} categories, score moyen ${json.summary.avg}` : `Erreur: ${json.error}`); load();
  }
  async function analyze(id: string) {
    setBusy(id + "a"); setMsg("Analyse IA (SERP + FAQ + schema)...");
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
  const scoreColor = (s: number | null) => s == null ? "text-zinc-500" : s >= 80 ? "text-emerald-400" : s >= 40 ? "text-amber-400" : "text-red-400";

  if (loading) return <p className="text-sm text-zinc-400"><Loader2 size={14} className="inline animate-spin" /> Chargement...</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-500">Audit SEO par categorie. Score 0-100 sur 7 dimensions.</p>
        <button onClick={sync} disabled={busy === "sync"} className={primaryBtn}>
          {busy === "sync" ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />} Sync + audit
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        {[["Total", taxos.length], ["Score moyen", avg], ["Excellentes", scored.filter((t) => t.quality_score >= 80).length], ["Moyennes", scored.filter((t) => t.quality_score >= 40 && t.quality_score < 80).length], ["Critiques", scored.filter((t) => t.quality_score < 40).length]].map(([l, v]) => (
          <div key={l} className={`${cardCls} text-center`}><div className="text-xl font-semibold text-zinc-100">{v}</div><div className="text-[10px] uppercase text-zinc-500">{l}</div></div>
        ))}
      </div>

      <div className="flex justify-end">
        <select value={sort} onChange={(e) => setSort(e.target.value)} className={`${inputCls} w-auto`}>
          <option value="score-asc">Score (pire -&gt; meilleur)</option>
          <option value="score-desc">Score (meilleur -&gt; pire)</option>
          <option value="name-asc">Nom (A-Z)</option>
          <option value="products-desc">Plus de produits</option>
        </select>
      </div>

      {sorted.length === 0 && <p className="text-sm text-zinc-500">Aucune categorie. Clique Sync + audit.</p>}
      <div className="space-y-2">
        {sorted.map((t) => {
          const bd = t.quality_breakdown;
          const open = expanded === t.id;
          return (
            <div key={t.id} className="rounded-lg border border-zinc-800 bg-zinc-900/40">
              <button onClick={() => setExpanded(open ? null : t.id)} className="flex w-full items-center gap-3 p-3 text-left">
                <span className={`text-lg font-bold ${scoreColor(t.quality_score)}`}>{t.quality_score ?? "-"}</span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm text-zinc-200">{t.name}</span><span className="text-xs text-zinc-500">/{t.handle} · {t.products_count} produits</span></span>
                {open ? <ChevronRight size={16} className="rotate-90 text-zinc-500" /> : <ChevronRight size={16} className="text-zinc-500" />}
              </button>
              {open && (
                <div className="border-t border-zinc-800 p-3">
                  {bd && (
                    <div className="mb-3 space-y-1">
                      {TAX_DIMS.map(([k, label, max]) => (
                        <div key={k} className="flex items-center gap-2 text-xs">
                          <span className="w-24 text-zinc-500">{label}</span>
                          <div className="h-1.5 flex-1 rounded bg-zinc-800"><div className="h-1.5 rounded bg-emerald-500" style={{ width: `${((bd[k] || 0) / max) * 100}%` }} /></div>
                          <span className="w-10 text-right text-zinc-500">{bd[k] ?? 0}/{max}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {bd?.notes?.length > 0 && (
                    <div className="mb-3 space-y-0.5">
                      {bd.notes.map((n: string, i: number) => <p key={i} className="text-xs text-amber-300">{n}</p>)}
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <button onClick={() => setHistFor(t)} className={ghostBtn}><History size={12} /> Historique</button>
                    <button onClick={() => genImage(t.id)} disabled={busy === t.id + "i"} className={ghostBtn}>
                      {busy === t.id + "i" ? <Loader2 size={12} className="animate-spin" /> : <ImageIcon size={12} />} {t.current_image_url ? "Re-generer image" : "Generer image"}
                    </button>
                    {t.analyzed_at && t.url && <a href={t.url} target="_blank" rel="noreferrer" className={ghostBtn}><ExternalLink size={12} /> Voir l&apos;optimisee</a>}
                    <button onClick={() => analyze(t.id)} disabled={busy === t.id + "a"} className={ghostBtn}>
                      {busy === t.id + "a" ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} {t.analyzed_at ? "Re-generer" : "Generer version optimisee"}
                    </button>
                    {t.suggested_description_html && (
                      <button onClick={() => push(t.id)} disabled={busy === t.id + "p"} className={primaryBtn}>
                        {busy === t.id + "p" ? <Loader2 size={12} className="animate-spin" /> : <UploadCloud size={12} />} Pousser
                      </button>
                    )}
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

const OPTIM_KINDS = [
  "meta_description", "meta_title", "product_description", "product_seo_meta", "collection_description",
  "collection_image", "collection_optimized_draft", "collection_pushed_live", "image_alt", "internal_link",
  "schema_markup", "redirect", "article_generated", "article_refreshed", "scro_injection_pushed", "product_reverted", "other",
];
const TARGET_TYPES = ["product", "collection", "article", "page", "site"];

function HistoryTab({ siteId, site, api, setMsg }: { siteId: string; site: any; api: ApiFn; setMsg: (s: string | null) => void }) {
  const [items, setItems] = useState<any[]>([]);
  const [counters, setCounters] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);
  const [fKind, setFKind] = useState("");
  const [fType, setFType] = useState("");
  const [showLogger, setShowLogger] = useState(false);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState<any>({ kind: "other", target_type: "site", target_id: "", target_title: "", target_url: "", before_value: "", after_value: "", note: "" });

  const load = useCallback(async () => {
    const qs = new URLSearchParams();
    if (fKind) qs.set("kind", fKind);
    if (fType) qs.set("target_type", fType);
    const { ok, json } = await api(`/api/admin/sites/${siteId}/optimizations?${qs}`);
    if (ok) { setItems(json.optimizations || []); setCounters(json.counters || {}); setTotal(json.total || 0); }
  }, [siteId, api, fKind, fType]);
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-400">Log de tout ce qui a ete touche sur ce site ({total}).</p>
        <div className="flex gap-2">
          <button onClick={() => setShowLogger((v) => !v)} className={ghostBtn}><Plus size={12} /> Ajouter manuelle</button>
          {site?.client_view_token && (
            <button onClick={copyPortal} className={ghostBtn}>{copied ? <Check size={12} className="text-emerald-400" /> : <ExternalLink size={12} />} Lien portail</button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {Object.entries(counters).filter(([, v]) => v > 0).map(([k, v]) => (
          <button key={k} onClick={() => setFKind(fKind === k ? "" : k)} className={`rounded-full border px-2 py-0.5 text-[11px] ${fKind === k ? "border-emerald-600 text-emerald-300" : "border-zinc-700 text-zinc-400"}`}>{k}: {v}</button>
        ))}
      </div>

      {showLogger && (
        <div className={`${cardCls} space-y-2`}>
          <div className="grid grid-cols-2 gap-2">
            <select value={form.kind} onChange={(e) => set("kind", e.target.value)} className={inputCls}>{OPTIM_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}</select>
            <select value={form.target_type} onChange={(e) => set("target_type", e.target.value)} className={inputCls}>{TARGET_TYPES.map((k) => <option key={k} value={k}>{k}</option>)}</select>
            <input value={form.target_title} onChange={(e) => set("target_title", e.target.value)} className={inputCls} placeholder="Titre cible" />
            <input value={form.target_url} onChange={(e) => set("target_url", e.target.value)} className={inputCls} placeholder="URL cible" />
          </div>
          <textarea value={form.before_value} onChange={(e) => set("before_value", e.target.value)} rows={2} className={inputCls} placeholder="Avant" />
          <textarea value={form.after_value} onChange={(e) => set("after_value", e.target.value)} rows={2} className={inputCls} placeholder="Apres" />
          <textarea value={form.note} onChange={(e) => set("note", e.target.value)} rows={1} className={inputCls} placeholder="Note" />
          <button onClick={save} className={primaryBtn}><Check size={14} /> Enregistrer</button>
        </div>
      )}

      <div className="space-y-2">
        {items.length === 0 && <p className="text-sm text-zinc-500">Aucune optimisation.</p>}
        {items.map((o) => (
          <div key={o.id} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm text-zinc-200">
                {o.target_title || o.kind}
                <span className={`rounded px-1.5 text-[10px] ${o.source === "ai" ? "bg-purple-950/40 text-purple-300" : o.source === "system" ? "bg-zinc-800 text-zinc-400" : "bg-zinc-700 text-zinc-200"}`}>{o.source}</span>
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500">{new Date(o.done_at).toLocaleString()}</span>
                <button onClick={() => del(o.id)} className="text-zinc-500 hover:text-red-400"><Trash2 size={13} /></button>
              </div>
            </div>
            <p className="text-xs text-zinc-500">{o.kind} · {o.target_type}{o.note ? ` · ${o.note}` : ""}</p>
            {o.target_url && <a href={o.target_url} target="_blank" rel="noreferrer" className="text-xs text-emerald-400">Voir</a>}
          </div>
        ))}
      </div>
    </div>
  );
}
