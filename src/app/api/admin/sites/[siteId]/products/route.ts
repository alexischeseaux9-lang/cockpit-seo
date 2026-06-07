import { NextRequest, NextResponse } from "next/server";
import { isAdmin, unauthorized } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase";
import { getSiteContext } from "@/lib/site-context";
import { listProductsDetailed } from "@/lib/shopify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

// GET: produits live Shopify + etat d'audit (cle par gid).
export async function GET(req: NextRequest, { params }: { params: { siteId: string } }) {
  if (!isAdmin(req)) return unauthorized();
  try {
    const { shop, token } = await getSiteContext(params.siteId);
    const products = await listProductsDetailed(shop, token, 250);

    const supabase = getServiceClient();
    const { data: audits } = await supabase
      .from("site_product_audits")
      .select("external_id, status, audit_score, audit_issues, proposed, proposed_payload, proposed_quality")
      .eq("site_id", params.siteId);
    const byId = new Map((audits || []).map((a) => [a.external_id, a]));

    const host = shop.includes(".myshopify.com") ? shop : `${shop}.myshopify.com`;
    const rows = products.map((p) => {
      const a = byId.get(p.gid);
      return {
        external_id: p.gid,
        title: p.title,
        handle: p.handle,
        url: `https://${host}/products/${p.handle}`,
        image: p.image,
        status: a?.status || "not_audited",
        audit_score: a?.audit_score ?? null,
        audit_issues: a?.audit_issues || [],
        has_proposal: !!(a?.proposed || a?.proposed_payload),
        proposed_quality: a?.proposed_quality ?? null,
      };
    });
    return NextResponse.json({ products: rows });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "error" }, { status: 500 });
  }
}
