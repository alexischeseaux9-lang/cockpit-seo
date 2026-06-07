import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin, unauthorized } from "@/lib/auth";
import { getSiteContext, logChange } from "@/lib/site-context";
import { updateCollectionImage } from "@/lib/shopify";
import { generateCoverImage } from "@/lib/fal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const schema = z.object({ tax_id: z.string().uuid() });

// Genere (ou re-genere) l'image d'une collection via fal + push Shopify + log historique.
// Toujours actif, meme si une image existe deja (l'ancienne est conservee dans l'historique).
export async function POST(req: NextRequest, { params }: { params: { siteId: string } }) {
  if (!isAdmin(req)) return unauthorized();
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  try {
    const { supabase, shop, token, voice } = await getSiteContext(params.siteId);
    const { data: tax } = await supabase.from("site_taxonomies").select("*").eq("id", parsed.data.tax_id).single();
    if (!tax) return NextResponse.json({ error: "taxonomy_not_found" }, { status: 404 });

    const style = voice.image_style_hint || "clean editorial product photography, natural light";
    const prompt = `Collection cover image for "${tax.name}". Style: ${style}. No text, no watermark, high quality.`;
    const newUrl = await generateCoverImage(prompt);

    const kind = (tax.generation_metadata?.kind as "custom" | "smart") || "custom";
    await updateCollectionImage(shop, token, tax.external_id, kind, newUrl);

    const now = new Date().toISOString();
    const before = tax.current_image_url || null;
    await supabase
      .from("site_taxonomies")
      .update({ current_image_url: newUrl, suggested_image_url: newUrl, updated_at: now })
      .eq("id", parsed.data.tax_id);

    await logChange({
      siteId: params.siteId,
      kind: "collection_image",
      target_type: "collection",
      target_id: tax.id,
      target_title: tax.name,
      before_value: before || undefined,
      after_value: newUrl,
      note: before ? "Image collection re-generee" : "Image collection generee",
      source: "ai",
    });

    return NextResponse.json({ ok: true, image_url: newUrl });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "error" }, { status: 500 });
  }
}
