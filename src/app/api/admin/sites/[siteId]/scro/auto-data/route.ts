import { NextRequest, NextResponse } from "next/server";
import { isAdmin, unauthorized } from "@/lib/auth";
import { getSiteContext } from "@/lib/site-context";
import { getDefaultBlogId, listArticles, listCollections } from "@/lib/shopify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST: auto-remplit lead_magnet / top_collections / top_articles (best-effort).
export async function POST(req: NextRequest, { params }: { params: { siteId: string } }) {
  if (!isAdmin(req)) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const want: string[] = body?.want || ["lead_magnet", "top_collections", "top_articles"];

  try {
    const { shop, token } = await getSiteContext(params.siteId);
    const out: any = { lead_magnet: null, top_collections: null, top_articles: null };

    if (want.includes("top_collections")) {
      const cols = await listCollections(shop, token);
      out.top_collections = { ok: true, data: cols.slice(0, 3).map((c) => ({ handle: c.handle, title: c.title })) };
    }
    if (want.includes("top_articles")) {
      const blogId = await getDefaultBlogId(shop, token);
      const arts = await listArticles(shop, token, blogId, 10);
      const recent = arts.filter((a) => a.published_at).slice(0, 3);
      out.top_articles = { ok: true, data: recent.map((a) => ({ handle: a.handle, title: a.title })) };
    }
    if (want.includes("lead_magnet")) {
      out.lead_magnet = { ok: true, data: { title: "Cadeau de bienvenue", subtitle: "Inscris-toi et recois nos conseils + une offre.", perks: ["Nouveaux articles", "Promos en avant-premiere"], cta_text: "S'inscrire", cta_url: "/pages/contact", promo_code: "", image_url: "" } };
    }
    return NextResponse.json(out);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "error" }, { status: 500 });
  }
}
