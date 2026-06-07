import { NextRequest, NextResponse } from "next/server";
import { isAdmin, unauthorized } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET: log historique des optimisations (onglet Optimisations + drawer historique).
export async function GET(req: NextRequest, { params }: { params: { siteId: string } }) {
  if (!isAdmin(req)) return unauthorized();
  const { searchParams } = new URL(req.url);
  const targetId = searchParams.get("target_id");

  const supabase = getServiceClient();
  let q = supabase
    .from("site_optimizations")
    .select("*")
    .eq("site_id", params.siteId)
    .order("done_at", { ascending: false })
    .limit(200);
  if (targetId) q = q.eq("target_id", targetId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ optimizations: data });
}
