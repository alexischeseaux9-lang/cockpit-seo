import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin, unauthorized } from "@/lib/auth";
import { getSiteContext, logChange } from "@/lib/site-context";
import { updateProduct } from "@/lib/shopify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const schema = z.object({ external_id: z.string().min(1) });

// POST: restaure la derniere version d'origine snapshotee (before_meta) d'un produit.
export async function POST(req: NextRequest, { params }: { params: { siteId: string } }) {
  if (!isAdmin(req)) return unauthorized();
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  try {
    const { supabase, shop, token } = await getSiteContext(params.siteId);
    const { data: log } = await supabase
      .from("site_optimizations")
      .select("before_meta")
      .eq("site_id", params.siteId)
      .eq("target_id", parsed.data.external_id)
      .eq("kind", "product_optimized")
      .not("before_meta", "is", null)
      .order("done_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const original = log?.before_meta as { title?: string; body_html?: string } | undefined;
    if (!original?.title && !original?.body_html) {
      return NextResponse.json({ error: "no_snapshot_available" }, { status: 404 });
    }

    await updateProduct(shop, token, parsed.data.external_id, {
      title: original.title,
      body_html: original.body_html,
    });

    const now = new Date().toISOString();
    await supabase
      .from("site_product_audits")
      .update({ status: "proposed", applied_at: null, updated_at: now })
      .eq("site_id", params.siteId)
      .eq("external_id", parsed.data.external_id);

    await logChange({
      siteId: params.siteId,
      kind: "product_reverted",
      target_type: "product",
      target_id: parsed.data.external_id,
      target_title: original.title,
      note: "Restauration de la version d'origine",
      source: "manual",
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "error" }, { status: 500 });
  }
}
