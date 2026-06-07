import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin, unauthorized } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Merge le voice_profile (passthrough des cles non fournies).
const schema = z.object({
  site_id: z.string().uuid(),
  voice_profile: z.record(z.string(), z.any()),
});

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const supabase = getServiceClient();
  const { data: site } = await supabase
    .from("sites")
    .select("voice_profile")
    .eq("id", parsed.data.site_id)
    .single();

  const merged = { ...(site?.voice_profile || {}), ...parsed.data.voice_profile };
  const { data, error } = await supabase
    .from("sites")
    .update({ voice_profile: merged, updated_at: new Date().toISOString() })
    .eq("id", parsed.data.site_id)
    .select("id, voice_profile")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ site: data });
}
