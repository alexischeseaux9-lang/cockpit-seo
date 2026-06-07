import { NextRequest, NextResponse } from "next/server";
import { isAdmin, unauthorized } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase";
import { generateSidebarIcons } from "@/lib/cro/icon-generator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST: Claude genere 5 icones SVG persona-matched, stockees dans voice_profile.sidebar_icons.
export async function POST(req: NextRequest, { params }: { params: { siteId: string } }) {
  if (!isAdmin(req)) return unauthorized();
  const supabase = getServiceClient();
  const { data: site } = await supabase.from("sites").select("voice_profile").eq("id", params.siteId).maybeSingle();
  const voice = (site?.voice_profile || {}) as Record<string, any>;
  const icons = await generateSidebarIcons(voice);
  await supabase.from("sites").update({ voice_profile: { ...voice, sidebar_icons: icons }, updated_at: new Date().toISOString() }).eq("id", params.siteId);
  return NextResponse.json({ ok: true, icons });
}
