import { NextRequest, NextResponse } from "next/server";
import { isAdmin, unauthorized } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase";
import { getSiteContext } from "@/lib/site-context";
import { listProducts } from "@/lib/shopify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

// GET: produits live Shopify + statut d'audit (depuis site_product_audits).
export async function GET(req: NextRequest, { params }: { params: { siteId: string } }) {
  if (!isAdmin(req)) return unauthorized();
  try {
    const { shop, token } = await getSiteContext(params.siteId);
    const products = await listProducts(shop, token, 50);

    const supabase = getServiceClient();
    const { data: audits } = await supabase
      .from("site_product_audits")
      .select("external_id, status, audit_score")
      .eq("site_id", params.siteId);
    const byId = new Map((audits || []).map((a) => [a.external_id, a]));

    const merged = products.map((p) => {
      const a = byId.get(String(p.id));
      return {
        external_id: String(p.id),
        title: p.title,
        handle: p.handle,
        image: p.image,
        status: a?.status || "not_audited",
        audit_score: a?.audit_score ?? null,
      };
    });
    return NextResponse.json({ products: merged });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "error" }, { status: 500 });
  }
}
