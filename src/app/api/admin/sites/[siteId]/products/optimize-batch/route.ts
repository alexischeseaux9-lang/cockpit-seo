import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin, unauthorized } from "@/lib/auth";
import { getSiteContext } from "@/lib/site-context";
import { listProducts } from "@/lib/shopify";
import { optimizeProductFull } from "@/lib/anthropic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const schema = z.object({ external_ids: z.array(z.string()).min(1).max(20) });

// Optimisation en masse (Sonnet) des produits selectionnes -> proposed_payload.
export async function POST(req: NextRequest, { params }: { params: { siteId: string } }) {
  if (!isAdmin(req)) return unauthorized();
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  try {
    const { supabase, shop, token, voice } = await getSiteContext(params.siteId);
    const accent = voice.branding_accent_hex || "#10b981";
    const products = await listProducts(shop, token, 100);
    const byId = new Map(products.map((p) => [String(p.id), p]));

    const started = Date.now();
    let optimized = 0;
    for (const extId of parsed.data.external_ids) {
      if (Date.now() - started > 270_000) break;
      const p = byId.get(extId);
      if (!p) continue;
      try {
        const opt = await optimizeProductFull(p.title, p.body_html, voice, accent);
        const now = new Date().toISOString();
        await supabase.from("site_product_audits").upsert(
          {
            site_id: params.siteId,
            external_id: extId,
            handle: p.handle,
            title: p.title,
            current_title: p.title,
            current_body_html: p.body_html,
            status: "proposed",
            quality_score: opt.quality_score,
            proposed_payload: opt,
            proposed_at: now,
            updated_at: now,
          },
          { onConflict: "site_id,external_id" }
        );
        optimized++;
      } catch {
        // produit suivant
      }
    }
    return NextResponse.json({ optimized });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "error" }, { status: 500 });
  }
}
