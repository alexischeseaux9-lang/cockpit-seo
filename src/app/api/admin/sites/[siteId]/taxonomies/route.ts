import { NextRequest, NextResponse } from "next/server";
import { isAdmin, unauthorized } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET: liste des taxonomies (collections) auditees du site.
export async function GET(req: NextRequest, { params }: { params: { siteId: string } }) {
  if (!isAdmin(req)) return unauthorized();
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("site_taxonomies")
    .select("id, external_id, name, handle, url, products_count, quality_score, quality_breakdown, intent_class, current_meta_title, current_meta_description, current_description, current_image_url, suggested_description_html, suggested_image_url, audit_at, analyzed_at, pushed_at, push_status, generation_metadata")
    .eq("site_id", params.siteId)
    .order("quality_score", { ascending: true, nullsFirst: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data || [] });
}
