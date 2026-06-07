import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin, unauthorized } from "@/lib/auth";
import { runJob } from "@/lib/job-runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const schema = z.object({ job_id: z.string().uuid() });

// POST: lance un job immediatement (bouton "Generer maintenant")
export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const res = await runJob(parsed.data.job_id);
  return NextResponse.json(res, { status: res.ok ? 200 : 500 });
}
