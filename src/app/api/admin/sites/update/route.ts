import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin, unauthorized } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  site_id: z.string().uuid(),
  daily_post_quota: z.number().int().min(0).max(50).optional(),
  daily_update_quota: z.number().int().min(0).max(50).optional(),
  auto_publish_enabled: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { site_id, ...patch } = parsed.data;
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("sites")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", site_id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ site: data });
}
