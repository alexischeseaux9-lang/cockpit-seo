import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin, unauthorized } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST: regle la cadence auto-refresh (nb d'articles perimes regeneres / jour).
const schema = z.object({
  daily_update_quota: z.number().int().min(0).max(20),
  auto_publish_enabled: z.boolean().optional(),
});

export async function POST(req: NextRequest, { params }: { params: { siteId: string } }) {
  if (!isAdmin(req)) return unauthorized();
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const patch: Record<string, unknown> = { daily_update_quota: parsed.data.daily_update_quota, updated_at: new Date().toISOString() };
  if (parsed.data.daily_update_quota > 0) patch.auto_publish_enabled = true;
  else if (typeof parsed.data.auto_publish_enabled === "boolean") patch.auto_publish_enabled = parsed.data.auto_publish_enabled;

  const supabase = getServiceClient();
  const { error } = await supabase.from("sites").update(patch).eq("id", params.siteId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
