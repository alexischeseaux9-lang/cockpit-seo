import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin, unauthorized } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET: lignes SCRO triees par opportunite (impressions hautes, position basse d'abord).
export async function GET(req: NextRequest, { params }: { params: { siteId: string } }) {
  if (!isAdmin(req)) return unauthorized();
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("site_scro")
    .select("*")
    .eq("site_id", params.siteId)
    .order("impressions", { ascending: false })
    .limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data || [] });
}

// POST: ingestion manuelle. Accepte un CSV/texte colle (export Search Console)
// ou un tableau de lignes. Colonnes attendues: query, clicks, impressions, position, [url].
const rowSchema = z.object({
  query: z.string().min(1),
  clicks: z.number().int().optional(),
  impressions: z.number().int().optional(),
  position: z.number().optional(),
  url: z.string().optional(),
});
const schema = z.object({
  rows: z.array(rowSchema).optional(),
  raw: z.string().optional(),
});

function parseRaw(raw: string) {
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
  const out: z.infer<typeof rowSchema>[] = [];
  for (const line of lines) {
    // separateur tab, virgule ou point-virgule
    const cols = line.split(/\t|;|,/).map((c) => c.trim());
    if (!cols[0]) continue;
    const low = cols[0].toLowerCase();
    if (low === "query" || low === "requete" || low === "requête" || low === "mot-cle") continue; // header
    const num = (s?: string) => {
      if (!s) return undefined;
      const n = Number(s.replace(/[%\s]/g, "").replace(",", "."));
      return Number.isFinite(n) ? n : undefined;
    };
    out.push({
      query: cols[0],
      clicks: num(cols[1]) != null ? Math.round(num(cols[1])!) : undefined,
      impressions: num(cols[2]) != null ? Math.round(num(cols[2])!) : undefined,
      position: num(cols[3]),
    });
  }
  return out;
}

export async function POST(req: NextRequest, { params }: { params: { siteId: string } }) {
  if (!isAdmin(req)) return unauthorized();
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  let rows = parsed.data.rows || [];
  if ((!rows || rows.length === 0) && parsed.data.raw) rows = parseRaw(parsed.data.raw);
  if (!rows.length) return NextResponse.json({ error: "no_rows_parsed" }, { status: 422 });

  const supabase = getServiceClient();
  const payload = rows.map((r) => ({
    site_id: params.siteId,
    query: r.query,
    clicks: r.clicks ?? 0,
    impressions: r.impressions ?? 0,
    position: r.position ?? null,
    url: r.url ?? null,
    ingested_at: new Date().toISOString(),
  }));
  const { data, error } = await supabase
    .from("site_scro")
    .upsert(payload, { onConflict: "site_id,query" })
    .select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ingested: data?.length || 0 });
}
