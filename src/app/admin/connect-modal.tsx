"use client";

import { useState } from "react";
import { X, Loader2, ShieldCheck } from "lucide-react";

type Props = {
  siteId: string;
  siteName: string;
  platform?: string;
  password: string;
  onClose: () => void;
  onConnected: () => void;
};

const inputCls = "input-base";

export function ConnectModal({ siteId, siteName, platform = "shopify", password, onClose, onConnected }: Props) {
  const [f, setF] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  function buildCredentials() {
    if (platform === "wordpress") return { platform, siteUrl: (f.siteUrl || "").trim(), username: (f.username || "").trim(), applicationPassword: (f.applicationPassword || "").trim() };
    if (platform === "github_mdx") return { platform, owner: (f.owner || "").trim(), repo: (f.repo || "").trim(), branch: (f.branch || "main").trim(), token: (f.token || "").trim(), contentRoot: (f.contentRoot || "content/articles").trim() };
    return { platform: "shopify", shop: (f.shop || "").trim(), accessToken: (f.accessToken || "").trim(), client_id: f.client_id?.trim() || undefined, client_secret: f.client_secret?.trim() || undefined };
  }

  async function submit() {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/admin/sites/connect", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${password}` },
        body: JSON.stringify({ site_id: siteId, credentials: buildCredentials() }),
      });
      const json = await res.json();
      if (!res.ok || json.connection_error) throw new Error(json.connection_error || JSON.stringify(json.error));
      onConnected();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="h-full w-full max-w-md overflow-y-auto border-l border-white/10 bg-[var(--bg-elev)] p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-6 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-zinc-100">Connecter {platform} : {siteName}</h2>
          <button onClick={onClose} className="btn-icon h-8 w-8" aria-label="Fermer"><X size={16} /></button>
        </div>

        <div className="space-y-4">
          {platform === "shopify" && (
            <>
              <Field label="Shop domain" value={f.shop} onChange={(v) => set("shop", v)} placeholder="monshop.myshopify.com" />
              <Field label="Access token" value={f.accessToken} onChange={(v) => set("accessToken", v)} type="password" placeholder="shpat_..." />
              <div className="grid grid-cols-2 gap-2">
                <Field label="client_id (option)" value={f.client_id} onChange={(v) => set("client_id", v)} />
                <Field label="client_secret (option)" value={f.client_secret} onChange={(v) => set("client_secret", v)} type="password" />
              </div>
            </>
          )}
          {platform === "wordpress" && (
            <>
              <Field label="URL WordPress" value={f.siteUrl} onChange={(v) => set("siteUrl", v)} placeholder="https://monsite.fr" />
              <Field label="Username" value={f.username} onChange={(v) => set("username", v)} />
              <Field label="Application Password" value={f.applicationPassword} onChange={(v) => set("applicationPassword", v)} type="password" placeholder="AAAA BBBB CCCC DDDD" />
            </>
          )}
          {platform === "github_mdx" && (
            <>
              <Field label="Owner" value={f.owner} onChange={(v) => set("owner", v)} />
              <Field label="Repo" value={f.repo} onChange={(v) => set("repo", v)} />
              <Field label="Branch" value={f.branch} onChange={(v) => set("branch", v)} placeholder="main" />
              <Field label="Personal Access Token" value={f.token} onChange={(v) => set("token", v)} type="password" placeholder="github_pat_..." />
              <Field label="Content root" value={f.contentRoot} onChange={(v) => set("contentRoot", v)} placeholder="content/articles" />
            </>
          )}

          {error && <p className="rounded-lg border border-red-500/30 bg-red-500/[0.06] p-3 text-sm text-red-300">{error}</p>}

          <button onClick={submit} disabled={loading} className="btn-primary w-full">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />} Tester et connecter
          </button>
          <p className="text-xs text-zinc-500">Credentials chiffres AES-256-GCM, connexion testee en live avant stockage.</p>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", placeholder }: { label: string; value?: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div>
      <label className="mb-1 block text-sm text-zinc-400">{label}</label>
      <input value={value || ""} onChange={(e) => onChange(e.target.value)} type={type} placeholder={placeholder} className={inputCls} />
    </div>
  );
}
