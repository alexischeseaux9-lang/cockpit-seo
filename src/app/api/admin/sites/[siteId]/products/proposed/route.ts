import { NextRequest, NextResponse } from "next/server";
import { isAdmin, unauthorized } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET: payload propose + snapshot actuel d'un produit (pour le drawer detail).
export async function GET(req: NextRequest, { params }: { params: { siteId: string } }) {
  if (!isAdmin(req)) return unauthorized();
  const { searchParams } = new URL(req.url);
  const externalId = searchParams.get("external_id");
  if (!externalId) return NextResponse.json({ error: "missing_external_id" }, { status: 400 });

  const supabase = getServiceClient();
  const { data: audit } = await supabase
    .from("site_product_audits")
    .select("*")
    .eq("site_id", params.siteId)
    .eq("external_id", externalId)
    .maybeSingle();
  if (!audit) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json({
    current: { title: audit.current_title, body_html: audit.current_body_html },
    proposed: audit.proposed || audit.proposed_payload || null,
    audit_score: audit.audit_score,
    audit_issues: audit.audit_issues || [],
    audit_metrics: audit.audit_metrics || null,
    status: audit.status,
  });
}
