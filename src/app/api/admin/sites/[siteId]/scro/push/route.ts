import { NextRequest, NextResponse } from "next/server";
import { isAdmin, unauthorized } from "@/lib/auth";
import { getSiteContext } from "@/lib/site-context";
import { listThemes, getThemeAsset, putThemeAsset } from "@/lib/shopify";
import { buildScroLiquid, injectScro, defaultBranding } from "@/lib/cro/builder";
import { NEUTRAL_ICONS } from "@/lib/cro/icon-generator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const DEFAULT_ASSET = "sections/main-article.liquid";

// POST: build le Liquid CRO et l'injecte dans le theme actif (entre markers).
export async function POST(req: NextRequest, { params }: { params: { siteId: string } }) {
  if (!isAdmin(req)) return unauthorized();
  try {
    const { supabase, shop, token, voice } = await getSiteContext(params.siteId);
    const { data: config } = await supabase.from("site_cro_configs").select("*").eq("site_id", params.siteId).maybeSingle();
    if (!config) return NextResponse.json({ error: "no_config" }, { status: 404 });

    // theme cible : configure sinon theme principal (role=main)
    const themes = await listThemes(shop, token);
    const themeId = config.theme_id || themes.find((t) => t.role === "main")?.id || themes[0]?.id;
    if (!themeId) return NextResponse.json({ error: "no_theme" }, { status: 404 });
    const assetKey = config.target_asset_key || DEFAULT_ASSET;

    const branding = defaultBranding(voice);
    const persona = { name: voice.author_name || voice.mascot || "", role: voice.author_role || "", bio: voice.author_bio || "" };
    const icons = voice.sidebar_icons || NEUTRAL_ICONS;

    const liquid = buildScroLiquid({
      inlineEnabled: config.inline_enabled,
      sidebarEnabled: config.sidebar_enabled,
      blocks: config.blocks || [],
      sidebarCfg: config.sidebar || null,
      branding,
      persona,
      icons,
    });

    const current = (await getThemeAsset(shop, token, themeId, assetKey)) || "";
    const next = injectScro(current, liquid);

    const now = new Date().toISOString();
    try {
      await putThemeAsset(shop, token, themeId, assetKey, next);
      await supabase.from("site_cro_configs").update({ theme_id: String(themeId), target_asset_key: assetKey, last_pushed_at: now, last_push_status: "ok", last_push_error: null }).eq("site_id", params.siteId);
      return NextResponse.json({ ok: true, theme_id: themeId, asset_key: assetKey });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "push_failed";
      await supabase.from("site_cro_configs").update({ last_push_status: "error", last_push_error: msg, updated_at: now }).eq("site_id", params.siteId);
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "error" }, { status: 500 });
  }
}
