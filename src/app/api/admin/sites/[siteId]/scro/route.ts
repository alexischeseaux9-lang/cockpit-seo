import { NextRequest, NextResponse } from "next/server";
import { isAdmin, unauthorized } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_SIDEBAR = {
  lead_magnet: { enabled: true, title: "Cadeau de bienvenue", subtitle: "Reste informe et recois nos meilleurs conseils.", perks: ["Nouveaux articles", "Promos en avant-premiere"], cta_text: "S'inscrire", cta_url: "#", promo_code: "", image_url: "" },
  bestsellers: { enabled: true, auto: true, manual_handles: [], title: "Best-sellers" },
  top_categories: { enabled: true, auto: false, manual_handles: [], title: "Nos univers" },
  top_articles: { enabled: true, auto: true, manual_handles: [], title: "A lire aussi" },
  author: { enabled: true, name: "", role: "", bio: "", image_url: "", trust_badges: [] },
};

// GET: config CRO du site (insert defaults si absente).
export async function GET(req: NextRequest, { params }: { params: { siteId: string } }) {
  if (!isAdmin(req)) return unauthorized();
  const supabase = getServiceClient();
  let { data } = await supabase.from("site_cro_configs").select("*").eq("site_id", params.siteId).maybeSingle();
  if (!data) {
    const ins = await supabase
      .from("site_cro_configs")
      .insert({ site_id: params.siteId, inline_enabled: false, sidebar_enabled: false, blocks: [], sidebar: DEFAULT_SIDEBAR })
      .select("*")
      .single();
    data = ins.data;
  }
  return NextResponse.json({ config: data });
}

// POST: upsert config.
export async function POST(req: NextRequest, { params }: { params: { siteId: string } }) {
  if (!isAdmin(req)) return unauthorized();
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("site_cro_configs")
    .upsert(
      {
        site_id: params.siteId,
        inline_enabled: !!body.inline_enabled,
        sidebar_enabled: !!body.sidebar_enabled,
        blocks: body.blocks ?? [],
        sidebar: body.sidebar ?? DEFAULT_SIDEBAR,
        theme_id: body.theme_id ?? null,
        target_asset_key: body.target_asset_key ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "site_id" }
    )
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ config: data });
}
