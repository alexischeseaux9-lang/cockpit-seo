import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin, unauthorized } from "@/lib/auth";
import { getSiteContext, logChange } from "@/lib/site-context";
import { getDefaultBlogId, getArticle, updateArticleBody } from "@/lib/shopify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Push live: ajoute le paragraphe d'injection a l'article Shopify cible.
const schema = z.object({ id: z.string().uuid() });

export async function POST(req: NextRequest, { params }: { params: { siteId: string } }) {
  if (!isAdmin(req)) return unauthorized();
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  try {
    const { supabase, shop, token } = await getSiteContext(params.siteId);
    const { data: row } = await supabase.from("site_scro_queries").select("*").eq("id", parsed.data.id).single();
    if (!row?.suggested_injection || !row.injected_into_post_id) {
      return NextResponse.json({ error: "no_injection_or_target" }, { status: 422 });
    }
    const { data: post } = await supabase.from("blog_posts").select("*").eq("id", row.injected_into_post_id).single();
    const articleId = post?.generation_metadata?.article_id;
    if (!articleId) return NextResponse.json({ error: "post_has_no_shopify_article_id" }, { status: 422 });

    const blogId = await getDefaultBlogId(shop, token);
    const article = await getArticle(shop, token, blogId, articleId);
    if (!article) return NextResponse.json({ error: "shopify_article_not_found" }, { status: 404 });

    const newBody = `${article.body_html || ""}\n${row.suggested_injection}`;
    await updateArticleBody(shop, token, blogId, articleId, newBody);

    const now = new Date().toISOString();
    await supabase.from("site_scro_queries").update({ pushed_at: now }).eq("id", row.id);
    await supabase.from("blog_posts").update({ content: newBody }).eq("id", post.id);

    await logChange({
      siteId: params.siteId,
      kind: "scro_injection_pushed",
      target_type: "article",
      target_id: String(articleId),
      target_title: post.title,
      after_value: row.suggested_injection,
      note: `Injection pour la requete "${row.query}"`,
      source: "ai",
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "push_failed" }, { status: 500 });
  }
}
