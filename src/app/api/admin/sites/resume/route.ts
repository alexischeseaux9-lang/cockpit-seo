import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin, unauthorized } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ site_id: z.string().uuid() });

// Relance un site en pause: clear paused_at + repasse les jobs 'paused' en 'pending'.
export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const supabase = getServiceClient();
  const now = new Date().toISOString();
  await supabase
    .from("sites")
    .update({ paused_at: null, paused_reason: null, updated_at: now })
    .eq("id", parsed.data.site_id);
  await supabase
    .from("site_jobs")
    .update({ status: "pending", paused_reason: null, updated_at: now })
    .eq("site_id", parsed.data.site_id)
    .eq("status", "paused");
  return NextResponse.json({ ok: true });
}
