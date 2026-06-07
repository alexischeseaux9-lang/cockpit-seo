import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron";
import { getServiceClient } from "@/lib/supabase";
import { sendAlert } from "@/lib/alerts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Cron 10 min. Surveille chaque site et alerte (avec anti-spam via last_alert_state).
export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = getServiceClient();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const { data: sites } = await supabase.from("sites").select("id, name, last_alert_state");
  const report: any[] = [];

  for (const site of sites || []) {
    const [{ count: pending }, { count: errors24h }, { count: doneToday }] = await Promise.all([
      supabase.from("site_jobs").select("id", { count: "exact", head: true }).eq("site_id", site.id).eq("status", "pending"),
      supabase.from("site_jobs").select("id", { count: "exact", head: true }).eq("site_id", site.id).eq("status", "error").gte("updated_at", since),
      supabase.from("site_jobs").select("id", { count: "exact", head: true }).eq("site_id", site.id).eq("status", "done").gte("completed_at", startOfDay.toISOString()),
    ]);

    const e = errors24h || 0;
    const p = pending || 0;
    const d = doneToday || 0;
    const alarm = e >= 3 || (p > 50 && d === 0);
    const state = alarm ? `alarm:e${e}:p${p}` : "ok";

    if (alarm && site.last_alert_state !== state) {
      await sendAlert(
        `[Cockpit SEO] Alerte sante: ${site.name}`,
        `Erreurs 24h: ${e}\nEn file: ${p}\nPublies aujourd'hui: ${d}`
      );
    }
    if (site.last_alert_state !== state) {
      await supabase.from("sites").update({ last_alert_state: state }).eq("id", site.id);
    }
    report.push({ site: site.name, pending: p, errors_24h: e, done_today: d, alarm });
  }

  return NextResponse.json({ ok: true, report });
}
