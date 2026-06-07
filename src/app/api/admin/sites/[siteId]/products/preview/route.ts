import { NextRequest } from "next/server";
import { isAdmin } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET: rend la fiche optimisee dans une page HTML blanche (storefront preview).
// Auth via Bearer OU ?pw= (pour ouverture dans un iframe/nouvel onglet).
export async function GET(req: NextRequest, { params }: { params: { siteId: string } }) {
  const { searchParams } = new URL(req.url);
  const pw = searchParams.get("pw");
  const authed = isAdmin(req) || (pw && pw === process.env.ADMIN_PASSWORD);
  if (!authed) return new Response("unauthorized", { status: 401 });

  const externalId = searchParams.get("external_id");
  if (!externalId) return new Response("missing external_id", { status: 400 });

  const supabase = getServiceClient();
  const { data: audit } = await supabase
    .from("site_product_audits")
    .select("title, proposed, proposed_payload")
    .eq("site_id", params.siteId)
    .eq("external_id", externalId)
    .maybeSingle();

  const pp = (audit?.proposed || audit?.proposed_payload || {}) as any;
  const title = pp.title || audit?.title || "Preview";
  const body = pp.body_html || "<p>Aucune version optimisee.</p>";

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
  body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 820px; margin: 0 auto; padding: 32px; color: #18181b; background: #fff; line-height: 1.6; }
  h1 { font-size: 2rem; } h2 { font-size: 1.75rem; margin-top: 2rem; } h3 { font-size: 1.25rem; }
  img { max-width: 100%; height: auto; } table { border-collapse: collapse; width: 100%; }
  td, th { border: 1px solid #e4e4e7; padding: 8px; }
</style></head>
<body><h1>${title}</h1>${body}</body></html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}
