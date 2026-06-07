import { NextRequest, NextResponse } from "next/server";
import { isAdmin, unauthorized } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase";
import { getSiteContext } from "@/lib/site-context";
import { getDefaultBlogId, listArticles } from "@/lib/shopify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function freshnessOf(updatedAt: string): { freshness: string; days: number } {
  const days = Math.floor((Date.now() - new Date(updatedAt).getTime()) / 86_400_000);
  if (days <= 90) return { freshness: "fresh", days };
  if (days <= 180) return { freshness: "aging", days };
  return { freshness: "stale", days };
}

// GET: catalogue d'articles avec fraicheur + stats + dernier job de refresh.
export async function GET(req: NextRequest, { params }: { params: { siteId: string } }) {
  if (!isAdmin(req)) return unauthorized();
  try {
    const { supabase, site, shop, token } = await getSiteContext(params.siteId);
    const blogId = await getDefaultBlogId(shop, token);
    const articles = await listArticles(shop, token, blogId, 250);

    const { data: jobs } = await supabase
      .from("site_jobs")
      .select("id, status, target_external_id, updated_at, error")
      .eq("site_id", params.siteId)
      .eq("kind", "update_article")
      .order("updated_at", { ascending: false });
    const lastJobByArticle = new Map<string, any>();
    for (const j of jobs || []) {
      if (j.target_external_id && !lastJobByArticle.has(j.target_external_id)) lastJobByArticle.set(j.target_external_id, j);
    }

    const rows = articles.map((a) => {
      const f = freshnessOf(a.updated_at);
      const lj = lastJobByArticle.get(String(a.id)) || null;
      return {
        id: String(a.id),
        title: a.title,
        handle: a.handle,
        url: `https://${shop.includes(".myshopify.com") ? shop : shop + ".myshopify.com"}/blogs/news/${a.handle}`,
        blog_title: "News",
        shopify_updated_at: a.updated_at,
        body_len: (a.body_html || "").length,
        has_yavok_blocks: (a.body_html || "").includes("YAVOK_SCRO"),
        freshness: a.published_at ? f.freshness : "never",
        days_since_update: f.days,
        last_job: lj ? { id: lj.id, status: lj.status, updated_at: lj.updated_at, error: lj.error } : null,
      };
    });

    const stats = {
      total: rows.length,
      fresh: rows.filter((r) => r.freshness === "fresh").length,
      aging: rows.filter((r) => r.freshness === "aging").length,
      stale: rows.filter((r) => r.freshness === "stale").length,
      queued: rows.filter((r) => r.last_job?.status === "pending").length,
      running: rows.filter((r) => r.last_job?.status === "in_progress").length,
    };

    return NextResponse.json({
      site: {
        id: site.id,
        daily_update_quota: site.daily_update_quota,
        daily_post_quota: site.daily_post_quota,
        auto_publish_enabled: site.auto_publish_enabled,
      },
      stats,
      articles: rows,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "error" }, { status: 500 });
  }
}
