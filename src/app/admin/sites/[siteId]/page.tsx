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
} from "lucide-react";

const PW_KEY = "cockpit_admin_pw";

type Job = {
  id: string;
  kind: string;
  status: string;
  keyword: string | null;
  error: string | null;
  output: any;
};

type TabId = "blog" | "archive" | "profil" | "products" | "categories" | "image" | "history";

const TABS: { id: TabId; label: string; icon: JSX.Element }[] = [
  { id: "blog", label: "Blog", icon: <FileText size={14} /> },
  { id: "archive", label: "Archive", icon: <FileText size={14} /> },
  { id: "products", label: "Produits", icon: <Package size={14} /> },
  { id: "categories", label: "Categories", icon: <FolderTree size={14} /> },
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

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem(PW_KEY) : null;
    if (saved) setPassword(saved);
  }, []);

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
        <Link href="/admin" className="mb-6 flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-100">
          <ArrowLeft size={16} /> Retour
        </Link>

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
        {password && tab === "profil" && <ProfilTab siteId={siteId} api={api} setMsg={setMsg} />}
        {password && tab === "image" && <ImageTab api={api} setMsg={setMsg} />}
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

function ProductsTab({ siteId, api, setMsg }: { siteId: string; api: ApiFn; setMsg: (s: string | null) => void }) {
  const [products, setProducts] = useState<any[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { ok, json } = await api(`/api/admin/sites/${siteId}/products`);
    setLoading(false);
    if (ok) setProducts(json.products || []); else setMsg(json.error || "Erreur");
  }, [siteId, api, setMsg]);
  useEffect(() => { load(); }, [load]);

  async function audit(id: string) {
    setBusy(id + "a"); setMsg("Audit IA en cours...");
    const { ok, json } = await api(`/api/admin/sites/${siteId}/products/audit`, { method: "POST", body: JSON.stringify({ external_id: id }) });
    setBusy(null); setMsg(ok ? "Audit termine, version proposee prete." : `Erreur: ${json.error}`); load();
  }
  async function apply(id: string) {
    setBusy(id + "p"); setMsg("Application sur Shopify...");
    const { ok, json } = await api(`/api/admin/sites/${siteId}/products/apply`, { method: "POST", body: JSON.stringify({ external_id: id }) });
    setBusy(null); setMsg(ok ? "Fiche produit mise a jour." : `Erreur: ${json.error}`); load();
  }

  if (loading) return <p className="text-sm text-zinc-400"><Loader2 size={14} className="inline animate-spin" /> Chargement des produits Shopify...</p>;
  return (
    <div className="space-y-2">
      {products.length === 0 && <p className="text-sm text-zinc-500">Aucun produit.</p>}
      {products.map((p) => (
        <div key={p.external_id} className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
          <div className="flex min-w-0 items-center gap-3">
            {p.image && <img src={p.image} alt="" className="h-10 w-10 rounded object-cover" />}
            <div className="min-w-0">
              <p className="truncate text-sm text-zinc-200">{p.title}</p>
              <div className="flex items-center gap-2"><Status status={p.status} />{p.audit_score != null && <span className="text-xs text-zinc-500">score {p.audit_score}</span>}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => audit(p.external_id)} disabled={busy === p.external_id + "a"} className={ghostBtn}>
              {busy === p.external_id + "a" ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />} Auditer
            </button>
            {(p.status === "proposed" || p.status === "applied") && (
              <button onClick={() => apply(p.external_id)} disabled={busy === p.external_id + "p"} className={ghostBtn}>
                {busy === p.external_id + "p" ? <Loader2 size={12} className="animate-spin" /> : <UploadCloud size={12} />} Appliquer
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

  async function analyze(id: string) {
    setBusy(id + "a"); setMsg("Analyse IA en cours...");
    const { ok, json } = await api(`/api/admin/sites/${siteId}/taxonomies/analyze`, { method: "POST", body: JSON.stringify({ tax_id: id }) });
    setBusy(null); setMsg(ok ? "Version optimisee prete." : `Erreur: ${json.error}`); load();
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
    </div>
  );
}

function ProfilTab({ siteId, api, setMsg }: { siteId: string; api: ApiFn; setMsg: (s: string | null) => void }) {
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
  }

  const fields: [string, string][] = [
    ["tone_description", "Ton editorial"],
    ["audience", "Audience"],
    ["content_language", "Langue (francais/anglais/...)"],
    ["image_style_hint", "Style des images"],
    ["author_name", "Nom auteur"],
    ["author_role", "Role auteur"],
    ["branding_accent_hex", "Couleur accent (#hex)"],
  ];

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
        {fields.map(([k, label]) => (
          <div key={k}>
            <label className="mb-1 block text-xs text-zinc-400">{label}</label>
            <input value={f(k)} onChange={(e) => set(k, e.target.value)} className={inputCls} />
          </div>
        ))}
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

function ImageTab({ api, setMsg }: { api: ApiFn; setMsg: (s: string | null) => void }) {
  const [prompt, setPrompt] = useState("");
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function gen() {
    if (!prompt.trim()) return;
    setBusy(true); setUrl(null); setMsg("Generation de l'image...");
    const { ok, json } = await api(`/api/admin/image-lab`, { method: "POST", body: JSON.stringify({ prompt }) });
    setBusy(false);
    if (ok) { setUrl(json.url); setMsg(null); } else setMsg(`Erreur: ${json.error}`);
  }
  return (
    <div className="space-y-4">
      <div className={cardCls}>
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} className={`${inputCls} mb-3`} placeholder="A cozy flat-lay of wool socks on a wooden table, natural light" />
        <button onClick={gen} disabled={busy || !prompt.trim()} className={primaryBtn}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <ImageIcon size={16} />} Generer
        </button>
      </div>
      {url && (
        <div className={cardCls}>
          <img src={url} alt="" className="w-full rounded-lg" />
          <a href={url} target="_blank" rel="noreferrer" className="mt-2 flex items-center gap-1 text-xs text-emerald-400">Ouvrir <ExternalLink size={12} /></a>
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
