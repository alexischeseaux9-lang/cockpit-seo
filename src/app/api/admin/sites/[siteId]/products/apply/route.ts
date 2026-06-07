import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin, unauthorized } from "@/lib/auth";
import { getSiteContext, logChange } from "@/lib/site-context";
import { updateProduct, getProduct } from "@/lib/shopify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Accepte external_id (gid) OU audit_id (uuid).
const schema = z.object({ external_id: z.string().optional(), audit_id: z.string().optional() });

function numericId(gidOrId: string): string {
  return gidOrId.includes("/") ? gidOrId.split("/").pop() || gidOrId : gidOrId;
}

export async function POST(req: NextRequest, { params }: { params: { siteId: string } }) {
  if (!isAdmin(req)) return unauthorized();
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  try {
    const { supabase, shop, token } = await getSiteContext(params.siteId);
    let audit: any = null;
    if (parsed.data.external_id) {
      const r = await supabase.from("site_product_audits").select("*").eq("site_id", params.siteId).eq("external_id", parsed.data.external_id).maybeSingle();
      audit = r.data;
    } else if (parsed.data.audit_id) {
      const r = await supabase.from("site_product_audits").select("*").eq("site_id", params.siteId).eq("id", parsed.data.audit_id).maybeSingle();
      audit = r.data;
    }
    if (!audit) return NextResponse.json({ error: "audit_not_found" }, { status: 404 });

    const pp = (audit.proposed || audit.proposed_payload) as any;
    if (!pp) return NextResponse.json({ error: "no_proposal" }, { status: 404 });
    const shopMeta = pp.channel_meta?.shopify || {};
    const pid = numericId(audit.external_id);

    // Snapshot avant (pour revert)
    const original = await getProduct(shop, token, pid);

    await updateProduct(shop, token, pid, {
      title: pp.title,
      body_html: pp.body_html,
      metaTitle: shopMeta.meta_title || pp.meta_title,
      metaDescription: shopMeta.meta_description || pp.meta_description,
    });

    const now = new Date().toISOString();
    await supabase.from("site_product_audits").update({
      status: "applied", applied_at: now, applied_revision_meta: original ? { title: original.title, body_html: original.body_html } : null, updated_at: now,
    }).eq("id", audit.id);

    // 3 logs distincts
    await logChange({ siteId: params.siteId, kind: "product_description", target_type: "product", target_id: audit.external_id, target_title: pp.title, before_value: original?.title, after_value: pp.title, before_meta: original ? { body_html: original.body_html } : undefined, after_meta: { body_html: pp.body_html }, note: "Fiche produit reecrite", source: "ai" });
    await logChange({ siteId: params.siteId, kind: "product_seo_meta", target_type: "product", target_id: audit.external_id, target_title: pp.title, after_value: `${shopMeta.meta_title || ""} | ${shopMeta.meta_description || ""}`, note: "Meta SEO produit", source: "ai" });
    if (Array.isArray(pp.image_alts) && pp.image_alts.length) {
      await logChange({ siteId: params.siteId, kind: "image_alt", target_type: "product", target_id: audit.external_id, target_title: pp.title, after_value: JSON.stringify(pp.image_alts), note: "Alts proposes", source: "ai" });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "error" }, { status: 500 });
  }
}
