import { NextRequest, NextResponse } from "next/server";
import { isAdmin, unauthorized } from "@/lib/auth";
import { getSiteContext } from "@/lib/site-context";
import { listCollections } from "@/lib/shopify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

// GET: synchronise les collections Shopify dans site_taxonomies et renvoie la liste.
export async function GET(req: NextRequest, { params }: { params: { siteId: string } }) {
  if (!isAdmin(req)) return unauthorized();
  try {
    const { supabase, shop, token } = await getSiteContext(params.siteId);
    const collections = await listCollections(shop, token);

    for (const c of collections) {
      await supabase.from("site_taxonomies").upsert(
        {
          site_id: params.siteId,
          platform: "shopify",
          external_id: String(c.id),
          handle: c.handle,
          name: c.title,
          current_description: c.body_html,
          generation_metadata: { kind: c.kind },
          updated_at: new Date().toISOString(),
        },
        { onConflict: "site_id,platform,external_id" }
      );
    }

    const { data } = await supabase
      .from("site_taxonomies")
      .select("id, external_id, name, handle, intent_class, quality_score, suggested_description_html, push_status, analyzed_at, pushed_at")
      .eq("site_id", params.siteId)
      .order("name", { ascending: true });

    return NextResponse.json({ taxonomies: data || [] });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "error" }, { status: 500 });
  }
}
