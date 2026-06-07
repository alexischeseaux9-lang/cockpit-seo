import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron";
import { getServiceClient } from "@/lib/supabase";
import { runJob } from "@/lib/job-runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Cron horaire. Publie jusqu'au quota quotidien par site, en respectant le
// budget temps Vercel (270s).
export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const started = Date.now();
  const supabase = getServiceClient();
  const ran: { site: string; job: string; ok: boolean; error?: string }[] = [];

  const { data: sites } = await supabase
    .from("sites")
    .select("id, name, daily_post_quota")
    .eq("auto_publish_enabled", true)
    .is("paused_at", null)
    .eq("connection_status", "connected");

  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  for (const site of sites || []) {
    if (Date.now() - started > 270_000) break;

    const { count: doneToday } = await supabase
      .from("site_jobs")
      .select("id", { count: "exact", head: true })
      .eq("site_id", site.id)
      .eq("status", "done")
      .gte("completed_at", startOfDay.toISOString());

    if ((doneToday || 0) >= site.daily_post_quota) continue;

    const nowIso = new Date().toISOString();
    const { data: pending } = await supabase
      .from("site_jobs")
      .select("id")
      .eq("site_id", site.id)
      .eq("status", "pending")
      .or(`scheduled_at.is.null,scheduled_at.lte.${nowIso}`)
      .order("priority", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(1);

    const job = (pending || [])[0];
    if (!job) continue;

    const res = await runJob(job.id);
    ran.push({ site: site.name, job: job.id, ok: res.ok, error: res.error });
  }

  return NextResponse.json({ ok: true, ran, ms: Date.now() - started });
}
