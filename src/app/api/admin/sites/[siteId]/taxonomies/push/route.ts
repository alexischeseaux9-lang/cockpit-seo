import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin, unauthorized } from "@/lib/auth";
import { getSiteContext, logChange } from "@/lib/site-context";
import { updateCollection } from "@/lib/shopify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const schema = z.object({ tax_id: z.string().uuid() });

// POST: pousse la version optimisee d'une collection vers Shopify + log.
export async function POST(req: NextRequest, { params }: { params: { siteId: string } }) {
  if (!isAdmin(req)) return unauthorized();
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  try {
    const { supabase, shop, token } = await getSiteContext(params.siteId);
    const { data: tax } = await supabase
      .from("site_taxonomies")
      .select("*")
      .eq("id", parsed.data.tax_id)
      .single();
    if (!tax?.suggested_description_html) return NextResponse.json({ error: "no_proposal" }, { status: 404 });

    const kind = (tax.generation_metadata?.kind as "custom" | "smart") || "custom";
    await updateCollection(shop, token, tax.external_id, kind, {
      body_html: tax.suggested_description_html,
      metaTitle: tax.suggested_meta_title,
      metaDescription: tax.suggested_meta_description,
    });

    const now = new Date().toISOString();
    await supabase
      .from("site_taxonomies")
      .update({ push_status: "pushed", pushed_at: now, updated_at: now })
      .eq("id", parsed.data.tax_id);

    await logChange({
      siteId: params.siteId,
      kind: "collection_pushed_live",
      target_type: "collection",
      target_id: tax.id,
      target_title: tax.name,
      before_value: tax.current_description || "",
      after_value: tax.suggested_description_html,
      note: "Description collection poussee en live",
      source: "ai",
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "error" }, { status: 500 });
  }
}
