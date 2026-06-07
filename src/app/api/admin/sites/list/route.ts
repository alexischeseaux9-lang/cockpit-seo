import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { isAdmin, unauthorized } from "@/lib/auth";
import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET : liste des sites + sante agregee (pending jobs, errors_24h, last_published_at)
export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ sites: [], warning: "supabase_not_configured" });
  }

  const supabase = getServiceClient();
  const { data: sites, error } = await supabase
    .from("sites")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const enriched = await Promise.all(
    (sites || []).map(async (site) => {
      // Assure un token de portail client (genere une seule fois)
      if (!site.client_view_token) {
        const tok = crypto.randomBytes(16).toString("base64url");
        await supabase.from("sites").update({ client_view_token: tok }).eq("id", site.id);
        site.client_view_token = tok;
      }
      const fourteenAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
      const [{ count: pending }, { count: errors24h }, { count: published }, { data: recentPosts }] = await Promise.all([
        supabase
          .from("site_jobs")
          .select("id", { count: "exact", head: true })
          .eq("site_id", site.id)
          .eq("status", "pending"),
        supabase
          .from("site_jobs")
          .select("id", { count: "exact", head: true })
          .eq("site_id", site.id)
          .eq("status", "error")
          .gte("updated_at", since),
        supabase
          .from("blog_posts")
          .select("id", { count: "exact", head: true })
          .eq("site_id", site.id)
          .eq("published", true),
        supabase
          .from("blog_posts")
          .select("published_at")
          .eq("site_id", site.id)
          .gte("published_at", fourteenAgo),
      ]);

      // Sparkline 14 jours (articles publies par jour)
      const spark = new Array(14).fill(0);
      for (const p of recentPosts || []) {
        if (!p.published_at) continue;
        const days = Math.floor((Date.now() - new Date(p.published_at).getTime()) / 86_400_000);
        const idx = 13 - days;
        if (idx >= 0 && idx < 14) spark[idx]++;
      }

      const e = errors24h || 0;
      const p = pending || 0;
      const healthLevel = site.paused_at || e >= 4 || p > 20 ? "red" : e >= 1 || p >= 5 ? "yellow" : "green";

      return {
        ...site,
        health: {
          pending: p,
          errors_24h: e,
          published: published || 0,
          last_published_at: site.last_published_at,
          sparkline: spark,
          level: healthLevel,
        },
      };
    })
  );

  return NextResponse.json({ sites: enriched });
}
