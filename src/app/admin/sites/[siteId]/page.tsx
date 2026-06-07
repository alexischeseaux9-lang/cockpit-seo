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
} from "lucide-react";

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

type TabId = "blog" | "archive" | "profil" | "products" | "categories" | "scro" | "image" | "history";

const TABS: { id: TabId; label: string; icon: JSX.Element }[] = [
  { id: "blog", label: "Blog", icon: <FileText size={14} /> },
  { id: "archive", label: "Archive", icon: <FileText size={14} /> },
  { id: "products", label: "Produits", icon: <Package size={14} /> },
  { id: "categories", label: "Categories", icon: <FolderTree size={14} /> },
  { id: "scro", label: "SCRO", icon: <BarChart3 size={14} /> },
  { id: "profil", label: "Profil", icon: <User size={14} /> },
  { id: "image", label: "Image Lab", icon: <ImageIcon size={14} /> },
  { id: "history", label: "Historique", icon: <History size={14} /> },
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
          <div className="mb-5 flex items-center gap-3">
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
        )}

        <div className="mb-6 flex flex-wrap gap-1 border-b border-zinc-800">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setMsg(null); }}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm ${
                tab === t.id ? "border-b-2 border-emerald-400 text-zinc-100" : "text-zinc-400"
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {msg && <p className="mb-4 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 text-sm text-zinc-300">{msg}</p>}

        {password && tab === "blog" && <BlogTab siteId={siteId} api={api} setMsg={setMsg} />}
        {password && tab === "archive" && <ArchiveTab siteId={siteId} api={api} />}
        {password && tab === "products" && <ProductsTab siteId={siteId} api={api} setMsg={setMsg} />}
        {password && tab === "categories" && <CategoriesTab siteId={siteId} api={api} setMsg={setMsg} />}
        {password && tab === "scro" && <ScroTab siteId={siteId} api={api} setMsg={setMsg} />}
        {password && tab === "profil" && <ProfilTab siteId={siteId} api={api} setMsg={setMsg} onSaved={loadSite} />}
        {password && tab === "image" && <ImageTab siteId={siteId} api={api} setMsg={setMsg} />}
        {password && tab === "history" && <HistoryTab siteId={siteId} api={api} />}
      </div>
    </main>
  );
}

type ApiFn = (path: string, init?: RequestInit) => Promise<{ ok: boolean; json: any }>;

function BlogTab({ siteId, api, setMsg }: { siteId: string; api: ApiFn; setMsg: (s: string | null) => void }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [keywords, setKeywords] = useState("");
  const [niche, setNiche] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { ok, json } = await api(`/api/admin/sites/${siteId}/jobs`);
    if (ok) setJobs(json.jobs || []);
  }, [siteId, api]);
  useEffect(() => { load(); }, [load]);

  async function enqueue() {
    const list = keywords.split("\n").map((k) => k.trim()).filter(Boolean);
    if (!list.length) return;
    setBusy("enq");
    const { ok, json } = await api(`/api/admin/sites/${siteId}/jobs`, { method: "POST", body: JSON.stringify({ keywords: list }) });
    setBusy(null);
    setMsg(ok ? `${json.enqueued} job(s) en file` : "Erreur");
    if (ok) { setKeywords(""); load(); }
  }
  async function scout() {
    if (!niche.trim()) return;
    setBusy("scout");
    setMsg("Generation de mots-cles...");
    const { ok, json } = await api(`/api/admin/sites/keyword-scout`, { method: "POST", body: JSON.stringify({ site_id: siteId, niche, count: 20, enqueue: true }) });
    setBusy(null);
    setMsg(ok ? `${json.enqueued} mots-cles generes et mis en file` : `Erreur: ${json.error}`);
    if (ok) load();
  }
  async function runNow(id: string) {
    setBusy(id);
    setMsg("Generation en cours (1 a 2 min)...");
    const { ok, json } = await api(`/api/admin/jobs/run`, { method: "POST", body: JSON.stringify({ job_id: id }) });
    setBusy(null);
    setMsg(ok ? "Article publie." : `Echec: ${json.error}`);
    load();
  }

  return (
    <div className="space-y-6">
      <div className={cardCls}>
        <h3 className="mb-2 flex items-center gap-2 font-medium"><Plus size={16} /> Mots-cles (1 par ligne)</h3>
        <textarea value={keywords} onChange={(e) => setKeywords(e.target.value)} rows={3} className={`${inputCls} mb-3`} placeholder={"comment laver des chaussettes en laine"} />
        <button onClick={enqueue} disabled={busy === "enq" || !keywords.trim()} className={primaryBtn}>
          {busy === "enq" ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Mettre en file
        </button>
      </div>

      <div className={cardCls}>
        <h3 className="mb-2 flex items-center gap-2 font-medium"><Sparkles size={16} /> Keyword scout (IA)</h3>
        <p className="mb-2 text-xs text-zinc-500">Decris ta niche, l'IA genere 20 mots-cles et les met en file.</p>
        <div className="flex gap-2">
          <input value={niche} onChange={(e) => setNiche(e.target.value)} className={inputCls} placeholder="chaussettes en laine merinos pour la randonnee" />
          <button onClick={scout} disabled={busy === "scout" || !niche.trim()} className={primaryBtn}>
            {busy === "scout" ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} Generer
          </button>
        </div>
      </div>

      <div>
        <h3 className="mb-3 font-medium">Jobs ({jobs.length})</h3>
        <div className="space-y-2">
          {jobs.length === 0 && <p className="text-sm text-zinc-500">Aucun job.</p>}
          {jobs.map((job) => (
            <div key={job.id} className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
              <div className="min-w-0">
                <p className="truncate text-sm text-zinc-200">{job.keyword || job.kind}</p>
                {job.error && <p className="truncate text-xs text-red-400">{job.error}</p>}
                {job.output?.url && (
                  <a href={job.output.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-emerald-400">
                    Voir l'article <ExternalLink size={12} />
                  </a>
                )}
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

function ArchiveTab({ siteId, api }: { siteId: string; api: ApiFn }) {
  const [articles, setArticles] = useState<any[]>([]);
  useEffect(() => { api(`/api/admin/sites/${siteId}/articles`).then(({ ok, json }) => ok && setArticles(json.articles || [])); }, [siteId, api]);
  return (
    <div className="space-y-3">
      {articles.length === 0 && <p className="text-sm text-zinc-500">Aucun article publie.</p>}
      {articles.map((a) => (
        <div key={a.id} className={cardCls}>
          <div className="flex items-start gap-3">
            {a.cover_image_url && <img src={a.cover_image_url} alt="" className="h-16 w-24 rounded object-cover" />}
            <div className="min-w-0">
              <h4 className="font-medium text-zinc-100">{a.title}</h4>
              {a.excerpt && <p className="mt-1 line-clamp-2 text-sm text-zinc-400">{a.excerpt}</p>}
              {a.generation_metadata?.url && (
                <a href={a.generation_metadata.url} target="_blank" rel="noreferrer" className="mt-2 flex items-center gap-1 text-xs text-emerald-400">
                  Ouvrir <ExternalLink size={12} />
                </a>
              )}
            </div>
          </div>
        </div>
      ))}
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
  const pw = typeof window !== "undefined" ? localStorage.getItem(PW_KEY) || "" : "";

  const load = useCallback(async () => {
    setLoading(true);
    const { ok, json } = await api(`/api/admin/sites/${siteId}/products`);
    setLoading(false);
    if (ok) setProducts(json.products || []); else setMsg(json.error || "Erreur");
  }, [siteId, api, setMsg]);
  useEffect(() => { load(); }, [load]);

  async function auditAll() {
    setBusy("auditall"); setMsg("Audit en masse (Haiku)...");
    const { ok, json } = await api(`/api/admin/sites/${siteId}/products/audit-batch`, { method: "POST", body: JSON.stringify({ limit: 15 }) });
    setBusy(null); setMsg(ok ? `${json.audited} produit(s) audites` : `Erreur: ${json.error}`); load();
  }
  async function optimizeSel() {
    if (!sel.size) return;
    setBusy("optsel"); setMsg(`Optimisation de ${sel.size} produit(s) (Sonnet)...`);
    const { ok, json } = await api(`/api/admin/sites/${siteId}/products/optimize-batch`, { method: "POST", body: JSON.stringify({ external_ids: Array.from(sel) }) });
    setBusy(null); setMsg(ok ? `${json.optimized} optimise(s)` : `Erreur: ${json.error}`); setSel(new Set()); load();
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

      {shown.length === 0 && <p className="text-sm text-zinc-500">Aucun produit dans ce filtre.</p>}
      {shown.map((p) => (
        <div key={p.external_id} className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
          <div className="flex min-w-0 items-center gap-3">
            <input type="checkbox" checked={sel.has(p.external_id)} onChange={() => toggle(p.external_id)} />
            {p.image && <img src={p.image} alt="" className="h-10 w-10 rounded object-cover" />}
            <div className="min-w-0">
              <p className="truncate text-sm text-zinc-200">{p.title}</p>
              <div className="flex items-center gap-2"><Status status={p.status} />{p.audit_score != null && <span className="text-xs text-zinc-500">score {p.audit_score}</span>}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(p.status === "proposed" || p.status === "applied") && (
              <a href={`/api/admin/sites/${siteId}/products/preview?external_id=${encodeURIComponent(p.external_id)}&pw=${encodeURIComponent(pw)}`} target="_blank" rel="noreferrer" className={ghostBtn}>
                <ExternalLink size={12} /> Preview
              </a>
            )}
            {(p.status === "proposed" || p.status === "applied") && (
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

function ScroTab({ siteId, api, setMsg }: { siteId: string; api: ApiFn; setMsg: (s: string | null) => void }) {
  const [rows, setRows] = useState<any[]>([]);
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { ok, json } = await api(`/api/admin/sites/${siteId}/scro`);
    if (ok) setRows(json.rows || []);
  }, [siteId, api]);
  useEffect(() => { load(); }, [load]);

  const [lowHanging, setLowHanging] = useState(false);
  const [injection, setInjection] = useState<{ id: string; text: string; post: string } | null>(null);

  async function ingest() {
    if (!raw.trim()) return;
    setBusy("ing"); setMsg("Ingestion des donnees Search Console...");
    const { ok, json } = await api(`/api/admin/sites/${siteId}/scro`, { method: "POST", body: JSON.stringify({ raw }) });
    setBusy(null); setMsg(ok ? `${json.ingested} requetes ingerees` : `Erreur: ${json.error}`);
    if (ok) { setRaw(""); load(); }
  }
  async function inject(id: string) {
    setBusy(id + "i"); setMsg("Generation de l'injection (langue du site)...");
    const { ok, json } = await api(`/api/admin/sites/${siteId}/scro/inject`, { method: "POST", body: JSON.stringify({ id }) });
    setBusy(null);
    if (ok) { setInjection({ id, text: json.injection, post: json.post_title }); setMsg(null); }
    else setMsg(`Erreur: ${json.error}`);
  }
  async function push(id: string) {
    setBusy(id + "p"); setMsg("Push live de l'injection...");
    const { ok, json } = await api(`/api/admin/sites/${siteId}/scro/push`, { method: "POST", body: JSON.stringify({ id }) });
    setBusy(null); setMsg(ok ? "Injection poussee dans l'article." : `Erreur: ${json.error}`);
    if (ok) { setInjection(null); load(); }
  }

  const shown = lowHanging ? rows.filter((r) => r.position != null && r.position >= 5 && r.position <= 15) : rows;

  return (
    <div className="space-y-5">
      <div className={cardCls}>
        <h3 className="mb-1 flex items-center gap-2 font-medium"><BarChart3 size={16} /> Ingestion Search Console</h3>
        <p className="mb-2 text-xs text-zinc-500">Colle ton export (requete, clics, impressions, ctr, position). Separateur tab/virgule/point-virgule.</p>
        <textarea value={raw} onChange={(e) => setRaw(e.target.value)} rows={5} className={`${inputCls} mb-3 font-mono`} placeholder={"wool work socks\t12\t340\t3.5%\t14.2\nbamboo socks men\t5\t190\t2.6%\t9.8"} />
        <button onClick={ingest} disabled={busy === "ing" || !raw.trim()} className={primaryBtn}>
          {busy === "ing" ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />} Ingerer
        </button>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="font-medium">Requetes ({shown.length})</h3>
        <button onClick={() => setLowHanging((v) => !v)} className={`rounded-full border px-2.5 py-1 text-xs ${lowHanging ? "border-emerald-600 text-emerald-300" : "border-zinc-700 text-zinc-400"}`}>
          low-hanging (pos 5-15)
        </button>
      </div>

      <div className="space-y-2">
        {shown.length === 0 && <p className="text-sm text-zinc-500">Aucune donnee. Colle ton export Search Console ci-dessus.</p>}
        {shown.map((r) => (
          <div key={r.id} className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
            <div className="min-w-0">
              <p className="truncate text-sm text-zinc-200">{r.query}</p>
              <p className="text-xs text-zinc-500">pos {r.position ?? "?"} · {r.impressions} impr · {r.clicks} clics {r.pushed_at ? "· pousse" : ""}</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => inject(r.id)} disabled={busy === r.id + "i"} className={ghostBtn}>
                {busy === r.id + "i" ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />} Injection
              </button>
              {r.suggested_injection && !r.pushed_at && (
                <button onClick={() => push(r.id)} disabled={busy === r.id + "p"} className={ghostBtn}>
                  {busy === r.id + "p" ? <Loader2 size={12} className="animate-spin" /> : <UploadCloud size={12} />} Push live
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {injection && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60">
          <div className="h-full w-full max-w-lg overflow-y-auto border-l border-zinc-800 bg-zinc-950 p-6">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-medium">Injection proposee</h3>
              <button onClick={() => setInjection(null)} className="text-zinc-400 hover:text-zinc-100"><Undo2 size={18} /></button>
            </div>
            <p className="mb-2 text-xs text-zinc-500">Cible: {injection.post}</p>
            <div className="mb-4 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 text-sm text-zinc-300" dangerouslySetInnerHTML={{ __html: injection.text }} />
            <button onClick={() => push(injection.id)} disabled={busy === injection.id + "p"} className={primaryBtn}>
              {busy === injection.id + "p" ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />} Push live dans l'article
            </button>
          </div>
        </div>
      )}
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

function ImageTab({ siteId, api, setMsg }: { siteId: string; api: ApiFn; setMsg: (s: string | null) => void }) {
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("fal-ai/flux/dev");
  const [size, setSize] = useState("landscape_16_9");
  const [busy, setBusy] = useState(false);
  const [runs, setRuns] = useState<any[]>([]);

  const load = useCallback(async () => {
    const { ok, json } = await api(`/api/admin/image-lab?site_id=${siteId}`);
    if (ok) setRuns(json.runs || []);
  }, [siteId, api]);
  useEffect(() => { load(); }, [load]);

  async function gen() {
    if (!prompt.trim()) return;
    setBusy(true); setMsg("Generation de l'image...");
    const { ok, json } = await api(`/api/admin/image-lab`, { method: "POST", body: JSON.stringify({ site_id: siteId, prompt, model, size }) });
    setBusy(false);
    if (ok) { setMsg(null); load(); } else setMsg(`Erreur: ${json.error}`);
  }
  return (
    <div className="space-y-4">
      <div className={cardCls}>
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} className={`${inputCls} mb-3`} placeholder="A cozy flat-lay of wool socks on a wooden table, natural light" />
        <div className="mb-3 grid grid-cols-2 gap-2">
          <select value={model} onChange={(e) => setModel(e.target.value)} className={inputCls}>
            <option value="fal-ai/flux/dev">flux/dev</option>
            <option value="fal-ai/flux-pro">flux-pro</option>
            <option value="fal-ai/flux/schnell">flux/schnell (rapide)</option>
          </select>
          <select value={size} onChange={(e) => setSize(e.target.value)} className={inputCls}>
            <option value="landscape_16_9">landscape 16:9</option>
            <option value="landscape_4_3">landscape 4:3</option>
            <option value="square_hd">square HD</option>
            <option value="portrait_16_9">portrait 16:9</option>
          </select>
        </div>
        <button onClick={gen} disabled={busy || !prompt.trim()} className={primaryBtn}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <ImageIcon size={16} />} Generer
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {runs.map((r) => (
          <div key={r.id} className={cardCls}>
            <img src={r.public_url} alt="" className="mb-2 w-full rounded" />
            <p className="line-clamp-1 text-xs text-zinc-500">{r.prompt}</p>
            <a href={r.public_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-emerald-400">URL <ExternalLink size={11} /></a>
          </div>
        ))}
      </div>
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
