import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Cron 10 min (alertes Telegram/Resend). Implemente en M6.
export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ ok: true, stub: "health-monitor", milestone: "M6" });
}
