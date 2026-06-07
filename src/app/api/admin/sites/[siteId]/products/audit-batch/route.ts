import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin, unauthorized } from "@/lib/auth";
import { getSiteContext } from "@/lib/site-context";
import { listProductsDetailed } from "@/lib/shopify";
import { computeProductAudit } from "@/lib/products/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const schema = z.object({ limit: z.number().int().min(1).max(1500).optional() });

// Audit heuristique en masse (aucun appel IA) -> rapide, jusqu'a 1500 produits.
export async function POST(req: NextRequest, { params }: { params: { siteId: string } }) {
  if (!isAdmin(req)) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body || {});
  const limit = parsed.success ? parsed.data.limit ?? 1500 : 1500;

  try {
    const { supabase, shop, token } = await getSiteContext(params.siteId);
    const products = await listProductsDetailed(shop, token, limit);
    const host = shop.includes(".myshopify.com") ? shop : `${shop}.myshopify.com`;
    const now = new Date().toISOString();

    const rows = products.map((p) => {
      const a = computeProductAudit(p);
      return {
        site_id: params.siteId,
        external_id: p.gid,
        handle: p.handle,
        title: p.title,
        url: `https://${host}/products/${p.handle}`,
        current_title: p.title,
        current_body_html: p.body_html,
        current_image_alts: p.images.map((im) => im.alt || ""),
        audit_score: a.score,
        audit_issues: a.issues,
        audit_metrics: a.metrics,
        audited_at: now,
        status: a.score < 70 ? "needs_work" : "audited",
        updated_at: now,
      };
    });

    // upsert par batch de 100
    let audited = 0;
    for (let i = 0; i < rows.length; i += 100) {
      const chunk = rows.slice(i, i + 100);
      const { error } = await supabase.from("site_product_audits").upsert(chunk, { onConflict: "site_id,external_id" });
      if (!error) audited += chunk.length;
    }
    return NextResponse.json({ ok: true, audited, total: products.length });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "error" }, { status: 500 });
  }
}
