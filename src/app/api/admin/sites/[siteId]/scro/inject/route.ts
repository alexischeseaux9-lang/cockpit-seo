import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin, unauthorized } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase";
import { generateInjection } from "@/lib/anthropic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Genere un paragraphe d'injection pour une requete, cible un article publie.
const schema = z.object({ id: z.string().uuid(), post_id: z.string().uuid().optional() });

export async function POST(req: NextRequest, { params }: { params: { siteId: string } }) {
  if (!isAdmin(req)) return unauthorized();
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const supabase = getServiceClient();
  const { data: row } = await supabase.from("site_scro_queries").select("*").eq("id", parsed.data.id).single();
  if (!row) return NextResponse.json({ error: "query_not_found" }, { status: 404 });

  const { data: site } = await supabase.from("sites").select("voice_profile").eq("id", params.siteId).single();

  // cible: post_id fourni, sinon l'article publie le plus recent
  let post = null;
  if (parsed.data.post_id) {
    const { data } = await supabase.from("blog_posts").select("*").eq("id", parsed.data.post_id).single();
    post = data;
  } else {
    const { data } = await supabase
      .from("blog_posts")
      .select("*")
      .eq("site_id", params.siteId)
      .eq("published", true)
      .order("published_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    post = data;
  }
  if (!post) return NextResponse.json({ error: "no_published_post_to_inject_into" }, { status: 422 });

  try {
    const paragraph = await generateInjection(row.query, post.title, post.excerpt || "", site?.voice_profile || {});
    await supabase
      .from("site_scro_queries")
      .update({ suggested_injection: paragraph, injected_into_post_id: post.id })
      .eq("id", row.id);
    return NextResponse.json({ injection: paragraph, post_title: post.title });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "inject_failed" }, { status: 500 });
  }
}
