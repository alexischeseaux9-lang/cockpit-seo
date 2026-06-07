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
  AlertTriangle,
  Clock,
  ExternalLink,
} from "lucide-react";

const PW_KEY = "cockpit_admin_pw";

type Job = {
  id: string;
  kind: string;
  status: string;
  keyword: string | null;
  error: string | null;
  output: any;
  created_at: string;
  completed_at: string | null;
};

type Article = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  cover_image_url: string | null;
  source_keyword: string | null;
  published_at: string | null;
  generation_metadata: any;
};

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { cls: string; icon: JSX.Element }> = {
    pending: { cls: "text-zinc-400", icon: <Clock size={14} /> },
    in_progress: { cls: "text-amber-400", icon: <Loader2 size={14} className="animate-spin" /> },
    done: { cls: "text-emerald-400", icon: <CheckCircle2 size={14} /> },
    error: { cls: "text-red-400", icon: <AlertTriangle size={14} /> },
  };
  const m = map[status] || map.pending;
  return (
    <span className={`flex items-center gap-1.5 text-sm ${m.cls}`}>
      {m.icon}
      {status}
    </span>
  );
}

export default function SiteDetail({ params }: { params: { siteId: string } }) {
  const siteId = params.siteId;
  const [password, setPassword] = useState("");
  const [tab, setTab] = useState<"blog" | "archive">("blog");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [keywords, setKeywords] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem(PW_KEY) : null;
    if (saved) setPassword(saved);
  }, []);

  const headers = useCallback(
    () => ({ "content-type": "application/json", authorization: `Bearer ${password}` }),
    [password]
  );

  const loadJobs = useCallback(async () => {
    const res = await fetch(`/api/admin/sites/${siteId}/jobs`, { headers: headers() });
    if (res.ok) setJobs((await res.json()).jobs || []);
  }, [siteId, headers]);

  const loadArticles = useCallback(async () => {
    const res = await fetch(`/api/admin/sites/${siteId}/articles`, { headers: headers() });
    if (res.ok) setArticles((await res.json()).articles || []);
  }, [siteId, headers]);

  useEffect(() => {
    if (password) {
      loadJobs();
      loadArticles();
    }
  }, [password, loadJobs, loadArticles]);

  async function enqueue() {
    const list = keywords
      .split("\n")
      .map((k) => k.trim())
      .filter(Boolean);
    if (list.length === 0) return;
    setBusy("enqueue");
    setMsg(null);
    const res = await fetch(`/api/admin/sites/${siteId}/jobs`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ keywords: list }),
    });
    const json = await res.json();
    setBusy(null);
    if (res.ok) {
      setMsg(`${json.enqueued} job(s) en file`);
      setKeywords("");
      loadJobs();
    } else {
      setMsg("Erreur enqueue");
    }
  }

  async function runNow(jobId: string) {
    setBusy(jobId);
    setMsg("Generation en cours (SERP, redaction, image, publication). Cela prend 1 a 2 min...");
    const res = await fetch(`/api/admin/jobs/run`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ job_id: jobId }),
    });
    const json = await res.json();
    setBusy(null);
    setMsg(res.ok ? "Article publie." : `Echec: ${json.error || "erreur"}`);
    loadJobs();
    loadArticles();
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-8 text-zinc-100">
      <div className="mx-auto max-w-4xl">
        <Link href="/admin" className="mb-6 flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-100">
          <ArrowLeft size={16} /> Retour
        </Link>

        <div className="mb-6 flex gap-2 border-b border-zinc-800">
          {(["blog", "archive"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm capitalize ${
                tab === t ? "border-b-2 border-emerald-400 text-zinc-100" : "text-zinc-400"
              }`}
            >
              {t === "blog" ? "Blog" : "Archive"}
            </button>
          ))}
        </div>

        {msg && (
          <p className="mb-4 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 text-sm text-zinc-300">
            {msg}
          </p>
        )}

        {tab === "blog" && (
          <div className="space-y-6">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
              <h3 className="mb-2 flex items-center gap-2 font-medium">
                <Plus size={16} /> Ajouter des mots-cles (1 par ligne)
              </h3>
              <textarea
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                rows={4}
                placeholder={"comment laver des chaussettes en laine\nmeilleures chaussettes randonnee"}
                className="mb-3 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-emerald-500"
              />
              <button
                onClick={enqueue}
                disabled={busy === "enqueue" || !keywords.trim()}
                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-40"
              >
                {busy === "enqueue" ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                Mettre en file
              </button>
            </div>

            <div>
              <h3 className="mb-3 font-medium">Jobs ({jobs.length})</h3>
              <div className="space-y-2">
                {jobs.length === 0 && <p className="text-sm text-zinc-500">Aucun job. Ajoute des mots-cles.</p>}
                {jobs.map((job) => (
                  <div
                    key={job.id}
                    className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/40 p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-zinc-200">{job.keyword || job.kind}</p>
                      {job.error && <p className="truncate text-xs text-red-400">{job.error}</p>}
                      {job.output?.url && (
                        <a
                          href={job.output.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-xs text-emerald-400"
                        >
                          Voir l&apos;article <ExternalLink size={12} />
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusChip status={job.status} />
                      {(job.status === "pending" || job.status === "error") && (
                        <button
                          onClick={() => runNow(job.id)}
                          disabled={busy === job.id}
                          className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-2.5 py-1.5 text-xs hover:border-emerald-500 disabled:opacity-40"
                        >
                          {busy === job.id ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Play size={12} />
                          )}
                          Generer
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "archive" && (
          <div className="space-y-3">
            {articles.length === 0 && <p className="text-sm text-zinc-500">Aucun article publie.</p>}
            {articles.map((a) => (
              <div key={a.id} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
                <div className="flex items-start gap-3">
                  {a.cover_image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.cover_image_url} alt="" className="h-16 w-24 rounded object-cover" />
                  )}
                  <div className="min-w-0">
                    <h4 className="flex items-center gap-1.5 font-medium text-zinc-100">
                      <FileText size={14} className="text-zinc-500" /> {a.title}
                    </h4>
                    {a.excerpt && <p className="mt-1 line-clamp-2 text-sm text-zinc-400">{a.excerpt}</p>}
                    <div className="mt-2 flex items-center gap-3 text-xs text-zinc-500">
                      {a.source_keyword && <span>kw: {a.source_keyword}</span>}
                      {a.generation_metadata?.url && (
                        <a
                          href={a.generation_metadata.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-emerald-400"
                        >
                          Ouvrir <ExternalLink size={12} />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
