"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Sparkles, RefreshCw, CheckCircle2, ChevronRight } from "lucide-react";

const PW_KEY = "cockpit_admin_pw";
const inputCls = "input-base";
const primaryBtn = "btn-primary";

const FIELDS: [string, string, boolean][] = [
  ["mascot", "Mascotte / persona auteur", false],
  ["content_language", "Langue", false],
  ["tone_description", "Ton editorial", true],
  ["audience", "Audience", true],
  ["example_phrases", "Phrases exemple", true],
  ["image_style_hint", "Style des images", false],
  ["branding_accent_hex", "Couleur accent", false],
  ["product_tone_description", "Ton fiches produit", true],
];

export default function OnboardingWizard() {
  const router = useRouter();
  const pw = typeof window !== "undefined" ? localStorage.getItem(PW_KEY) || "" : "";
  const headers = { "content-type": "application/json", authorization: `Bearer ${pw}` };

  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [url, setUrl] = useState("");
  const [platform, setPlatform] = useState<"shopify" | "wordpress" | "github_mdx">("shopify");
  const [runId, setRunId] = useState<string | null>(null);
  const [vp, setVp] = useState<Record<string, any>>({});

  const [name, setName] = useState("");
  const [shopDomain, setShopDomain] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");

  const setF = (k: string, v: string) => setVp((p) => ({ ...p, [k]: v }));

  const discover = useCallback(async () => {
    if (!url.trim()) return;
    setBusy("discover"); setMsg("Analyse du site (scrape + IA)...");
    const res = await fetch("/api/admin/onboarding/discover", { method: "POST", headers, body: JSON.stringify({ url, platform }) });
    const json = await res.json();
    setBusy(null);
    if (res.ok) {
      setRunId(json.run_id);
      setVp(json.draft_voice_profile || {});
      if (!name) setName(json.site_meta?.title?.slice(0, 60) || url.replace(/^https?:\/\//, ""));
      setMsg(null);
      setStep(2);
    } else setMsg(`Erreur: ${json.error}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, platform, name]);

  async function regen(field: string) {
    setBusy(field);
    const res = await fetch("/api/admin/onboarding/regenerate-field", { method: "POST", headers, body: JSON.stringify({ run_id: runId, field }) });
    const json = await res.json();
    setBusy(null);
    if (res.ok) setF(field, json.value);
  }

  async function apply() {
    setBusy("apply"); setMsg("Creation du site + test de connexion...");
    const res = await fetch("/api/admin/onboarding/apply", {
      method: "POST",
      headers,
      body: JSON.stringify({
        run_id: runId, name, url, platform, voice_profile: vp,
        shop_domain: shopDomain, access_token: accessToken,
        client_id: clientId || undefined, client_secret: clientSecret || undefined,
      }),
    });
    const json = await res.json();
    setBusy(null);
    if (res.ok) router.push(`/admin/sites/${json.site_id}`);
    else setMsg(`Erreur: ${JSON.stringify(json.error)}`);
  }

  return (
    <main className="min-h-screen px-6 py-8 text-zinc-100">
      <div className="mx-auto max-w-2xl">
        <Link href="/admin" className="mb-4 inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-100">
          <ArrowLeft size={16} /> Retour
        </Link>
        <h1 className="mb-1 text-xl font-semibold">Onboarding d&apos;un site</h1>
        <div className="mb-6 flex items-center gap-2 text-xs text-zinc-500">
          <span className={step >= 1 ? "text-emerald-400" : ""}>1. Decouverte</span>
          <ChevronRight size={12} />
          <span className={step >= 2 ? "text-emerald-400" : ""}>2. Revue</span>
          <ChevronRight size={12} />
          <span className={step >= 3 ? "text-emerald-400" : ""}>3. Connexion</span>
        </div>

        {msg && <p className="mb-4 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-zinc-300">{msg}</p>}

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs text-zinc-400">URL du site</label>
              <input value={url} onChange={(e) => setUrl(e.target.value)} className={inputCls} placeholder="https://monsite.com" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-400">Plateforme</label>
              <select value={platform} onChange={(e) => setPlatform(e.target.value as any)} className={inputCls}>
                <option value="shopify">Shopify</option>
                <option value="wordpress">WordPress</option>
                <option value="github_mdx">GitHub MDX</option>
              </select>
            </div>
            <button onClick={discover} disabled={busy === "discover" || !url.trim()} className={primaryBtn}>
              {busy === "discover" ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} Analyser le site
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            {FIELDS.map(([k, label, long]) => (
              <div key={k}>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-xs text-zinc-400">{label}</label>
                  <button onClick={() => regen(k)} disabled={busy === k} className="flex items-center gap-1 text-xs text-zinc-500 hover:text-emerald-400">
                    {busy === k ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />} re-generer
                  </button>
                </div>
                {long ? (
                  <textarea value={vp[k] || ""} onChange={(e) => setF(k, e.target.value)} rows={2} className={inputCls} />
                ) : (
                  <input value={vp[k] || ""} onChange={(e) => setF(k, e.target.value)} className={inputCls} />
                )}
              </div>
            ))}
            <div className="flex gap-2 pt-2">
              <button onClick={() => setStep(3)} className={primaryBtn}>Continuer <ChevronRight size={16} /></button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs text-zinc-400">Nom du site</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
            </div>
            {platform === "shopify" && (
              <>
                <div>
                  <label className="mb-1 block text-xs text-zinc-400">Shop domain</label>
                  <input value={shopDomain} onChange={(e) => setShopDomain(e.target.value)} className={inputCls} placeholder="monshop.myshopify.com" />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-zinc-400">Access token (ou client id + secret ci-dessous)</label>
                  <input value={accessToken} onChange={(e) => setAccessToken(e.target.value)} type="password" className={inputCls} placeholder="shpat_..." />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input value={clientId} onChange={(e) => setClientId(e.target.value)} className={inputCls} placeholder="client_id (optionnel)" />
                  <input value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} type="password" className={inputCls} placeholder="client_secret (optionnel)" />
                </div>
              </>
            )}
            <button onClick={apply} disabled={busy === "apply" || !name} className={primaryBtn}>
              {busy === "apply" ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} Creer et connecter
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
