import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin, unauthorized } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ site_id: z.string().uuid() });

// Deconnecte un site : efface les credentials chiffres + repasse en 'disconnected'.
export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const supabase = getServiceClient();
  const { error } = await supabase
    .from("sites")
    .update({
      credentials_encrypted: null,
      connection_status: "disconnected",
      connection_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.site_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
