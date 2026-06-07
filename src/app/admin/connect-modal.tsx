"use client";

import { useState } from "react";
import { X, Loader2, ShieldCheck } from "lucide-react";

type Props = {
  siteId: string;
  siteName: string;
  password: string;
  onClose: () => void;
  onConnected: () => void;
};

export function ConnectModal({ siteId, siteName, password, onClose, onConnected }: Props) {
  const [shopDomain, setShopDomain] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/sites/connect", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${password}`,
        },
        body: JSON.stringify({
          site_id: siteId,
          shop_domain: shopDomain.trim(),
          access_token: accessToken.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(JSON.stringify(json.error));
      onConnected();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60">
      <div className="h-full w-full max-w-md overflow-y-auto border-l border-zinc-800 bg-zinc-950 p-6">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-100">
            Connecter Shopify : {siteName}
          </h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-100">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-zinc-400">Shop domain</label>
            <input
              value={shopDomain}
              onChange={(e) => setShopDomain(e.target.value)}
              placeholder="monshop.myshopify.com"
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-100 outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-zinc-400">Access token</label>
            <input
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              type="password"
              placeholder="shpat_..."
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-100 outline-none focus:border-emerald-500"
            />
          </div>

          {error && (
            <p className="rounded-lg border border-red-900 bg-red-950/50 p-3 text-sm text-red-300">
              {error}
            </p>
          )}

          <button
            onClick={submit}
            disabled={loading || !shopDomain || !accessToken}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
            Chiffrer et connecter
          </button>
          <p className="text-xs text-zinc-500">
            Token chiffre AES-256-GCM avec SITE_CREDENTIALS_KEY avant stockage. Jamais
            renvoye en clair.
          </p>
        </div>
      </div>
    </div>
  );
}
