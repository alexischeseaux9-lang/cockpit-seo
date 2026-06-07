import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin, unauthorized } from "@/lib/auth";
import { getSiteContext, logChange } from "@/lib/site-context";
import { updateProduct, getProduct } from "@/lib/shopify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const schema = z.object({ external_id: z.string().min(1) });

// POST: pousse la version proposee d'un produit vers Shopify + log historique.
export async function POST(req: NextRequest, { params }: { params: { siteId: string } }) {
  if (!isAdmin(req)) return unauthorized();
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  try {
    const { supabase, shop, token } = await getSiteContext(params.siteId);
    const { data: audit } = await supabase
      .from("site_product_audits")
      .select("*")
      .eq("site_id", params.siteId)
      .eq("external_id", parsed.data.external_id)
      .single();
    if (!audit?.proposed_payload) return NextResponse.json({ error: "no_proposal" }, { status: 404 });

    // Snapshot de l'original AVANT ecrasement (pour pouvoir annuler).
    const original = await getProduct(shop, token, parsed.data.external_id);

    const pp = audit.proposed_payload as any;
    // Supporte l'ancien shape (meta_title direct) et le V2 (channel_meta.shopify)
    const shopifyMeta = pp.channel_meta?.shopify || {};
    await updateProduct(shop, token, parsed.data.external_id, {
      title: pp.title,
      body_html: pp.body_html,
      metaTitle: shopifyMeta.meta_title || pp.meta_title,
      metaDescription: shopifyMeta.meta_description || pp.meta_description,
    });

    const now = new Date().toISOString();
    await supabase
      .from("site_product_audits")
      .update({ status: "applied", applied_at: now, applied_revision: (audit.applied_revision || 0) + 1, updated_at: now })
      .eq("id", audit.id);

    await logChange({
      siteId: params.siteId,
      kind: "product_optimized",
      target_type: "product",
      target_id: parsed.data.external_id,
      target_title: pp.title,
      before_value: audit.title,
      after_value: pp.title,
      before_meta: original ? { title: original.title, body_html: original.body_html } : undefined,
      after_meta: { title: pp.title, body_html: pp.body_html },
      note: "Fiche produit optimisee et poussee",
      source: "ai",
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "error" }, { status: 500 });
  }
}
