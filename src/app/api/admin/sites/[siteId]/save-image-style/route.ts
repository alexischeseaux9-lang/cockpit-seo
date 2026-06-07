import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin, unauthorized } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase";
import { getPreset } from "@/lib/blog/image-presets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST: sauve le style d'image par defaut dans voice_profile.image_style_*.
const schema = z.object({
  preset_id: z.string().optional(),
  custom_style_hint: z.string().optional(),
  custom_model: z.string().optional(),
  custom_label: z.string().optional(),
});

export async function POST(req: NextRequest, { params }: { params: { siteId: string } }) {
  if (!isAdmin(req)) return unauthorized();
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  let saved: { image_style_label: string; image_style_hint?: string; image_style_model?: string };
  if (parsed.data.preset_id) {
    const p = getPreset(parsed.data.preset_id);
    if (!p) return NextResponse.json({ error: "unknown_preset" }, { status: 400 });
    saved = { image_style_label: p.label, image_style_hint: p.styleHint, image_style_model: p.model };
  } else if (parsed.data.custom_style_hint) {
    saved = { image_style_label: parsed.data.custom_label || "Custom", image_style_hint: parsed.data.custom_style_hint, image_style_model: parsed.data.custom_model };
  } else {
    return NextResponse.json({ error: "missing_preset_or_custom" }, { status: 400 });
  }

  const supabase = getServiceClient();
  const { data: site } = await supabase.from("sites").select("voice_profile").eq("id", params.siteId).maybeSingle();
  const voice = (site?.voice_profile || {}) as Record<string, any>;
  await supabase.from("sites").update({ voice_profile: { ...voice, ...saved }, updated_at: new Date().toISOString() }).eq("id", params.siteId);
  return NextResponse.json({ ok: true, saved });
}
