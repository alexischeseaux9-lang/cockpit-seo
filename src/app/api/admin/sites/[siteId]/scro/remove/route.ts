import { NextRequest, NextResponse } from "next/server";
import { isAdmin, unauthorized } from "@/lib/auth";
import { getSiteContext } from "@/lib/site-context";
import { getThemeAsset, putThemeAsset } from "@/lib/shopify";
import { cleanScroFromAsset } from "@/lib/cro/builder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST: retire les blocs SCRO du theme (rollback).
export async function POST(req: NextRequest, { params }: { params: { siteId: string } }) {
  if (!isAdmin(req)) return unauthorized();
  try {
    const { supabase, shop, token } = await getSiteContext(params.siteId);
    const { data: config } = await supabase.from("site_cro_configs").select("*").eq("site_id", params.siteId).maybeSingle();
    if (!config?.theme_id || !config?.target_asset_key) return NextResponse.json({ error: "nothing_pushed" }, { status: 404 });
    const current = (await getThemeAsset(shop, token, config.theme_id, config.target_asset_key)) || "";
    await putThemeAsset(shop, token, config.theme_id, config.target_asset_key, cleanScroFromAsset(current));
    await supabase.from("site_cro_configs").update({ last_push_status: "removed", last_pushed_at: new Date().toISOString() }).eq("site_id", params.siteId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "error" }, { status: 500 });
  }
}
