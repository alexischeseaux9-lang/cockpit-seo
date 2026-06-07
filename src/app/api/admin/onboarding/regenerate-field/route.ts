import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin, unauthorized } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase";
import { discoverSite } from "@/lib/onboarding/site-discovery";
import { regenerateProfileField } from "@/lib/anthropic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const schema = z.object({
  run_id: z.string().uuid(),
  field: z.string().min(1),
});

// Bouton "Re-generer ce champ" de l'etape Review.
export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const supabase = getServiceClient();
  const { data: run } = await supabase
    .from("onboarding_runs")
    .select("url, draft_voice_profile")
    .eq("id", parsed.data.run_id)
    .single();
  if (!run) return NextResponse.json({ error: "run_not_found" }, { status: 404 });

  try {
    const meta = await discoverSite(run.url);
    const lang = (run.draft_voice_profile as any)?.content_language || "francais";
    const value = await regenerateProfileField(run.url, `${meta.title} ${meta.description} ${meta.text}`, parsed.data.field, lang);
    return NextResponse.json({ field: parsed.data.field, value });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "regen_failed" }, { status: 500 });
  }
}
