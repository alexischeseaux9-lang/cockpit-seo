import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin, unauthorized } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET: requetes Search Console triees par opportunite (impressions hautes d'abord).
export async function GET(req: NextRequest, { params }: { params: { siteId: string } }) {
  if (!isAdmin(req)) return unauthorized();
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("site_scro_queries")
    .select("*")
    .eq("site_id", params.siteId)
    .order("impressions", { ascending: false })
    .limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data || [] });
}

// POST: ingestion CSV/texte (query, clicks, impressions, ctr, position, [page_url]).
const schema = z.object({ raw: z.string().min(1) });

function num(s?: string) {
  if (!s) return undefined;
  const n = Number(s.replace(/[%\s]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}

export async function POST(req: NextRequest, { params }: { params: { siteId: string } }) {
  if (!isAdmin(req)) return unauthorized();
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const rows: any[] = [];
  for (const line of parsed.data.raw.split("\n").map((l) => l.trim()).filter(Boolean)) {
    const c = line.split(/\t|;|,/).map((x) => x.trim());
    if (!c[0]) continue;
    const low = c[0].toLowerCase();
    if (["query", "requete", "requête", "mot-cle", "top queries"].includes(low)) continue;
    rows.push({
      site_id: params.siteId,
      query: c[0],
      clicks: num(c[1]) != null ? Math.round(num(c[1])!) : 0,
      impressions: num(c[2]) != null ? Math.round(num(c[2])!) : 0,
      ctr: num(c[3]) ?? null,
      position: num(c[4]) ?? null,
      source: "manual",
      imported_at: new Date().toISOString(),
    });
  }
  if (!rows.length) return NextResponse.json({ error: "no_rows_parsed" }, { status: 422 });

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("site_scro_queries")
    .upsert(rows, { onConflict: "site_id,query" })
    .select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ingested: data?.length || 0 });
}
