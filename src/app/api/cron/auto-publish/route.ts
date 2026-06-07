import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Cron horaire. Logique de publication implementee en M2.
export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ ok: true, stub: "auto-publish", milestone: "M2" });
}
