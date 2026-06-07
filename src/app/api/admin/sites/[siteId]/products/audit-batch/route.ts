import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin, unauthorized } from "@/lib/auth";
import { getSiteContext } from "@/lib/site-context";
import { listProducts } from "@/lib/shopify";
import { scoreProduct } from "@/lib/anthropic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const schema = z.object({ limit: z.number().int().min(1).max(50).optional() });

// Audit en masse: score l'etat actuel de chaque produit (Haiku), avec budget temps.
export async function POST(req: NextRequest, { params }: { params: { siteId: string } }) {
  if (!isAdmin(req)) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body || {});
  const limit = parsed.success ? parsed.data.limit ?? 15 : 15;

  try {
    const { supabase, shop, token } = await getSiteContext(params.siteId);
    const products = await listProducts(shop, token, Math.min(limit * 2, 100));
    const started = Date.now();
    let audited = 0;

    for (const p of products) {
      if (audited >= limit || Date.now() - started > 270_000) break;
      try {
        const s = await scoreProduct(p.title, p.body_html);
        const now = new Date().toISOString();
        await supabase.from("site_product_audits").upsert(
          {
            site_id: params.siteId,
            external_id: String(p.id),
            handle: p.handle,
            title: p.title,
            current_title: p.title,
            current_body_html: p.body_html,
            quality_score: s.quality_score,
            quality_breakdown: s.quality_breakdown,
            audit_notes: s.notes,
            status: s.quality_score < 70 ? "needs_work" : "proposed",
            audit_at: now,
            updated_at: now,
          },
          { onConflict: "site_id,external_id" }
        );
        audited++;
      } catch {
        // produit suivant
      }
    }
    return NextResponse.json({ audited });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "error" }, { status: 500 });
  }
}
