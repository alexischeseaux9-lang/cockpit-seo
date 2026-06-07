import { getServiceClient } from "./supabase";
import { decryptCredentials } from "./credentials";
import { ensureValidToken } from "./shopify";

// Charge un site, dechiffre ses credentials, garantit un token Shopify valide.
export async function getSiteContext(siteId: string) {
  const supabase = getServiceClient();
  const { data: site, error } = await supabase.from("sites").select("*").eq("id", siteId).single();
  if (error || !site) throw new Error("site_not_found");
  if (!site.credentials_encrypted) throw new Error("site_not_connected");
  const creds = decryptCredentials(site.credentials_encrypted);
  const token = await ensureValidToken(supabase, site.id, creds);
  return { supabase, site, creds, token, shop: creds.shop_domain, voice: site.voice_profile || {} };
}

export async function logChange(opts: {
  siteId: string;
  kind: string;
  target_type: string;
  target_id?: string;
  target_title?: string;
  target_url?: string;
  before_value?: string;
  after_value?: string;
  note?: string;
  source?: "manual" | "ai" | "system";
}) {
  const supabase = getServiceClient();
  await supabase.from("site_optimizations").insert({
    site_id: opts.siteId,
    kind: opts.kind,
    target_type: opts.target_type,
    target_id: opts.target_id,
    target_title: opts.target_title,
    target_url: opts.target_url,
    before_value: opts.before_value,
    after_value: opts.after_value,
    note: opts.note,
    source: opts.source || "ai",
  });
}
