import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron";
import { getServiceClient } from "@/lib/supabase";
import { sendAlert } from "@/lib/alerts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Cron 15 min. Detecte sites stale (>48h sans publish) + erreurs credits, alerte Resend.
export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = getServiceClient();
  const report: any[] = [];
  const { data: sites } = await supabase
    .from("sites")
    .select("id, name, auto_publish_enabled, last_published_at, paused_at, last_alert_state");

  const now = Date.now();
  for (const site of sites || []) {
    const reasons: string[] = [];

    // 1. stale: auto-publish actif mais rien publie depuis 48h
    if (site.auto_publish_enabled && !site.paused_at) {
      const last = site.last_published_at ? new Date(site.last_published_at).getTime() : 0;
      if (now - last > 48 * 60 * 60 * 1000) reasons.push("no_publish_48h");
    }

    // 2. erreurs credits dans les 5 derniers jobs
    const { data: lastJobs } = await supabase
      .from("site_jobs")
      .select("error, status")
      .eq("site_id", site.id)
      .order("updated_at", { ascending: false })
      .limit(5);
    if ((lastJobs || []).some((j) => /credit_balance|insufficient|credits_exhausted/i.test(j.error || ""))) {
      reasons.push("anthropic_credits");
    }
    if (site.paused_at) reasons.push("site_paused");

    const state = reasons.sort().join(",") || "ok";
    if (reasons.length && site.last_alert_state !== state) {
      await sendAlert(
        `[Cockpit SEO] Alerte: ${site.name}`,
        `Problemes detectes: ${reasons.join(", ")}\nDernier publish: ${site.last_published_at || "jamais"}`
      );
    }
    if (site.last_alert_state !== state) {
      await supabase.from("sites").update({ last_alert_state: state }).eq("id", site.id);
    }
    report.push({ site: site.name, reasons });
  }

  return NextResponse.json({ ok: true, report });
}
