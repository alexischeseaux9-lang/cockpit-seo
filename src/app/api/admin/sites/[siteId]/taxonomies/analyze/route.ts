import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin, unauthorized } from "@/lib/auth";
import { getSiteContext } from "@/lib/site-context";
import { analyzeCollection } from "@/lib/anthropic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const schema = z.object({ tax_id: z.string().uuid() });

// POST: genere la version optimisee d'une collection (Claude).
export async function POST(req: NextRequest, { params }: { params: { siteId: string } }) {
  if (!isAdmin(req)) return unauthorized();
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  try {
    const { supabase, voice } = await getSiteContext(params.siteId);
    const { data: tax } = await supabase
      .from("site_taxonomies")
      .select("*")
      .eq("id", parsed.data.tax_id)
      .single();
    if (!tax) return NextResponse.json({ error: "taxonomy_not_found" }, { status: 404 });

    const analysis = await analyzeCollection(tax.name, tax.current_description || "", voice);
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("site_taxonomies")
      .update({
        intent_class: analysis.intent_class,
        quality_score: analysis.quality_score,
        suggested_description_html: analysis.suggested_description_html,
        suggested_meta_title: analysis.suggested_meta_title,
        suggested_meta_description: analysis.suggested_meta_description,
        analyzed_at: now,
        updated_at: now,
      })
      .eq("id", parsed.data.tax_id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ taxonomy: data });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "error" }, { status: 500 });
  }
}
