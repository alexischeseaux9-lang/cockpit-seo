import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron";
import { getServiceClient } from "@/lib/supabase";
import { sendAlert } from "@/lib/alerts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function computeState(site: any): string | null {
  if (site.paused_at && typeof site.paused_reason === "string") {
    if (site.paused_reason.endsWith("_credit")) return `credit_${site.paused_reason}`;
    if (site.paused_reason === "invalid_credentials") return "creds_invalid";
    return `paused_${site.paused_reason}`;
  }
  if (site.auto_publish_enabled && site.last_published_at) {
    const age = Date.now() - new Date(site.last_published_at).getTime();
    if (age > 48 * 3600 * 1000) return "stuck_no_publish_48h";
  }
  return null;
}

// Cron 15 min. Detecte les etats anormaux, alerte (dedup), clear a la reprise.
export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = getServiceClient();
  const { data: sites } = await supabase.from("sites").select("*");
  const report: any[] = [];

  for (const site of sites || []) {
    const state = computeState(site);
    const now = new Date().toISOString();
    if (state && state !== site.last_alert_state) {
      await sendAlert(
        `[${state}] ${site.name}`,
        `Site "${site.name}" (${site.url})\nEtat: ${state}\nConnexion: ${site.connection_status}\nDernier publish: ${site.last_published_at || "jamais"}\nPause: ${site.paused_reason || "-"}\n${site.connection_error ? "Erreur connexion: " + site.connection_error : ""}`
      );
      await supabase.from("sites").update({ last_alert_state: state, last_alert_at: now }).eq("id", site.id);
    } else if (!state && site.last_alert_state) {
      // recovery
      await supabase.from("sites").update({ last_alert_state: null }).eq("id", site.id);
    }
    report.push({ site: site.name, state });
  }

  return NextResponse.json({ ok: true, report });
}
