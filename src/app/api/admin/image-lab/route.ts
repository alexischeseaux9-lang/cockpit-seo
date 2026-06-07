import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin, unauthorized } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase";
import { generateImage } from "@/lib/fal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

// GET: 6 dernieres generations du site.
export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();
  const { searchParams } = new URL(req.url);
  const siteId = searchParams.get("site_id");
  const supabase = getServiceClient();
  let q = supabase.from("site_image_lab_runs").select("*").order("created_at", { ascending: false }).limit(6);
  if (siteId) q = q.eq("site_id", siteId);
  const { data } = await q;
  return NextResponse.json({ runs: data || [] });
}

const schema = z.object({
  site_id: z.string().uuid().optional(),
  prompt: z.string().min(3),
  model: z.string().optional(),
  size: z.string().optional(),
});

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  try {
    const url = await generateImage(parsed.data.prompt, parsed.data.model, parsed.data.size);
    const supabase = getServiceClient();
    await supabase.from("site_image_lab_runs").insert({
      site_id: parsed.data.site_id || null,
      prompt: parsed.data.prompt,
      model: parsed.data.model || "fal-ai/flux/dev",
      size: parsed.data.size || "landscape_16_9",
      public_url: url,
    });
    return NextResponse.json({ url });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "image_failed" }, { status: 500 });
  }
}
