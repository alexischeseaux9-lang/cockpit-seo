import { NextRequest, NextResponse } from "next/server";
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
      const [{ count: pending }, { count: errors24h }] = await Promise.all([
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
      ]);
      return {
        ...site,
        health: {
          pending: pending || 0,
          errors_24h: errors24h || 0,
          last_published_at: site.last_published_at,
        },
      };
    })
  );

  return NextResponse.json({ sites: enriched });
}
