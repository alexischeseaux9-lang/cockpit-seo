import { NextRequest, NextResponse } from "next/server";
import { isAdmin, unauthorized } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET: articles publies (depuis blog_posts)
export async function GET(req: NextRequest, { params }: { params: { siteId: string } }) {
  if (!isAdmin(req)) return unauthorized();
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("blog_posts")
    .select("id, title, slug, excerpt, cover_image_url, source_keyword, meta_title, published_at, generation_metadata")
    .eq("site_id", params.siteId)
    .order("published_at", { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ articles: data });
}
