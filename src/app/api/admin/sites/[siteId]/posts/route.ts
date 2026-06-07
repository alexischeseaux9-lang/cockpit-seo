import { NextRequest, NextResponse } from "next/server";
import { isAdmin, unauthorized } from "@/lib/auth";
import { getSiteContext } from "@/lib/site-context";
import { getDefaultBlogId, listArticles } from "@/lib/shopify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET: articles lus EN DIRECT depuis Shopify (pour l'onglet Blog).
export async function GET(req: NextRequest, { params }: { params: { siteId: string } }) {
  if (!isAdmin(req)) return unauthorized();
  try {
    const { shop, token } = await getSiteContext(params.siteId);
    const blogId = await getDefaultBlogId(shop, token);
    const articles = await listArticles(shop, token, blogId, 250);
    const posts = articles.map((a) => ({
      external_id: String(a.id),
      title: a.title,
      status: a.published_at ? "published" : "draft",
      url: `https://${shop.includes(".myshopify.com") ? shop : shop + ".myshopify.com"}/blogs/news/${a.handle}`,
      date: a.published_at || a.created_at,
      updated_at: a.updated_at,
      tags: a.tags,
      summary: a.summary_html ? a.summary_html.replace(/<[^>]+>/g, "").slice(0, 300) : null,
      seo_title: null,
      seo_description: null,
    }));
    return NextResponse.json({ posts });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "error" }, { status: 500 });
  }
}
