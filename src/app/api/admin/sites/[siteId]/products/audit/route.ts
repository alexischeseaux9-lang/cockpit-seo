import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin, unauthorized } from "@/lib/auth";
import { getSiteContext } from "@/lib/site-context";
import { listProducts } from "@/lib/shopify";
import { auditProduct } from "@/lib/anthropic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const schema = z.object({ external_id: z.string().min(1) });

// POST: audite 1 produit (Claude) et stocke la version proposee.
export async function POST(req: NextRequest, { params }: { params: { siteId: string } }) {
  if (!isAdmin(req)) return unauthorized();
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  try {
    const { supabase, shop, token, voice } = await getSiteContext(params.siteId);
    const products = await listProducts(shop, token, 100);
    const p = products.find((x) => String(x.id) === parsed.data.external_id);
    if (!p) return NextResponse.json({ error: "product_not_found" }, { status: 404 });

    const audit = await auditProduct(p.title, p.body_html, voice);
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("site_product_audits")
      .upsert(
        {
          site_id: params.siteId,
          external_id: String(p.id),
          handle: p.handle,
          title: p.title,
          status: "proposed",
          audit_score: audit.audit_score,
          audit_notes: audit.audit_notes,
          proposed_payload: {
            title: audit.proposed_title,
            body_html: audit.proposed_body_html,
            meta_title: audit.proposed_meta_title,
            meta_description: audit.proposed_meta_description,
          },
          audit_at: now,
          updated_at: now,
        },
        { onConflict: "site_id,external_id" }
      )
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ audit: data });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "error" }, { status: 500 });
  }
}
