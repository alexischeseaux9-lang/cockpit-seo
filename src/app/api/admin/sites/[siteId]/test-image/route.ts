import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin, unauthorized } from "@/lib/auth";
import { generateImage } from "@/lib/fal";
import { getServiceClient } from "@/lib/supabase";
import { getPreset, isAllowedModel, IMAGE_PRESETS } from "@/lib/blog/image-presets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const schema = z.object({
  sample_topic: z.string().min(1),
  preset_id: z.string().optional(),
  custom_style_hint: z.string().optional(),
  custom_model: z.string().optional(),
  custom_label: z.string().optional(),
});

// POST: genere une image sample (preset OU custom) et la persiste dans site_image_lab_runs.
export async function POST(req: NextRequest, { params }: { params: { siteId: string } }) {
  if (!isAdmin(req)) return unauthorized();
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const d = parsed.data;

  let model: string, styleHint: string, label: string;
  if (d.preset_id) {
    const p = getPreset(d.preset_id);
    if (!p) return NextResponse.json({ error: "unknown_preset" }, { status: 400 });
    model = p.model; styleHint = p.styleHint; label = p.label;
  } else if (d.custom_style_hint && d.custom_style_hint.length >= 10) {
    model = isAllowedModel(d.custom_model || "") ? d.custom_model! : "fal-ai/flux/dev";
    styleHint = d.custom_style_hint; label = d.custom_label || "Custom";
  } else {
    return NextResponse.json({ error: "missing_preset_or_custom" }, { status: 400 });
  }

  try {
    const url = await generateImage(`${d.sample_topic}. Style: ${styleHint}`, model, "landscape_16_9");
    const cost = IMAGE_PRESETS.find((p) => p.model === model)?.costPerImage ?? 0.025;
    await getServiceClient().from("site_image_lab_runs").insert({
      site_id: params.siteId, prompt: d.sample_topic, model, size: "landscape_16_9", public_url: url,
    });
    return NextResponse.json({ ok: true, url, label, model, cost_usd: cost });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "image_failed" }, { status: 500 });
  }
}
