import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Cron 4h (Anthropic Batch API). Implemente en M2/M6.
export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ ok: true, stub: "batch-enqueue", milestone: "M2" });
}
