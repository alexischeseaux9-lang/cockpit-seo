import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin, unauthorized } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase";
import { runJob } from "@/lib/job-runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Accepte external_ids (gids) OU audit_ids (uuid).
const schema = z.object({
  external_ids: z.array(z.string()).optional(),
  audit_ids: z.array(z.string()).optional(),
});

export async function POST(req: NextRequest, { params }: { params: { siteId: string } }) {
  if (!isAdmin(req)) return unauthorized();
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const supabase = getServiceClient();
  // resoudre audit_ids -> external_ids si besoin
  let externalIds = parsed.data.external_ids || [];
  if ((!externalIds.length) && parsed.data.audit_ids?.length) {
    const { data } = await supabase.from("site_product_audits").select("external_id").in("id", parsed.data.audit_ids);
    externalIds = (data || []).map((r) => r.external_id);
  }
  if (!externalIds.length) return NextResponse.json({ error: "no_targets" }, { status: 400 });
  externalIds = externalIds.slice(0, 20);

  // cree les jobs optimize_product
  const rows = externalIds.map((extId) => ({ site_id: params.siteId, kind: "optimize_product", status: "pending", target_external_id: extId }));
  const { data: jobs } = await supabase.from("site_jobs").insert(rows).select("id");

  // run inline avec budget temps
  const started = Date.now();
  let optimized = 0;
  for (const j of jobs || []) {
    if (Date.now() - started > 270_000) break;
    const r = await runJob(j.id);
    if (r.ok) optimized++;
  }
  return NextResponse.json({ ok: true, queued: jobs?.length || 0, optimized });
}
