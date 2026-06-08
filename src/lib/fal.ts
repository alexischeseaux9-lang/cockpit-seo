import { logFalUsage } from "./ai-usage";

// Generation d'image de couverture via fal.ai (flux/dev).
// Endpoint synchrone: convient au timeout Vercel (300s).

const ALLOWED_MODELS = ["fal-ai/flux/dev", "fal-ai/flux-pro", "fal-ai/flux/schnell"];
const ALLOWED_SIZES = ["landscape_16_9", "landscape_4_3", "square_hd", "portrait_16_9"];

export async function generateImage(
  prompt: string,
  model = "fal-ai/flux/dev",
  size = "landscape_16_9"
): Promise<string> {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error("FAL_KEY manquante");
  const m = ALLOWED_MODELS.includes(model) ? model : "fal-ai/flux/dev";
  const s = ALLOWED_SIZES.includes(size) ? size : "landscape_16_9";

  const res = await fetch(`https://fal.run/${m}`, {
    method: "POST",
    headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, image_size: s, num_images: 1, enable_safety_checker: true }),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`fal_error:${res.status}:${body.slice(0, 200)}`);
  }
  const data = await res.json();
  const url = data?.images?.[0]?.url;
  if (!url) throw new Error("fal_no_image");
  await logFalUsage({ model: m, context: "image_lab", size: s });
  return url as string;
}

// Compat: helper cover image (utilise par le pipeline article + collections).
export async function generateCoverImage(prompt: string): Promise<string> {
  return generateImage(prompt, "fal-ai/flux/dev", "landscape_16_9");
}

// Remplit les <figure><img data-gen="..."> de l'article par de vraies images IA.
// Cap pour tenir le timeout Vercel; les figures au-dela du cap ou en echec sont retirees.
export async function fillArticleImages(html: string, styleHint: string, cap = 4): Promise<string> {
  const figs = Array.from(html.matchAll(/<figure\b[\s\S]*?<\/figure>/gi)).map((m) => m[0]).filter((f) => /data-gen=/i.test(f));
  if (!figs.length) return html;
  const targets = figs.slice(0, cap);
  const style = styleHint || "editorial product photography, natural light";
  const results = await Promise.all(
    targets.map(async (fig) => {
      const dm = fig.match(/data-gen="([^"]*)"/i);
      const desc = dm ? dm[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&").slice(0, 400) : "";
      try {
        const url = await generateImage(
          `Editorial documentary photograph, wide horizontal composition, photorealistic and highly specific (not generic stock). Scene: ${desc}. Render the concrete real world details true to life. Style: ${style}. Sharp focus, natural light, realistic textures and materials, no text, no words, no watermark, no logos.`,
          "fal-ai/flux/dev",
          "landscape_16_9",
        );
        const newFig = fig.replace(/<img\b/i, `<img src="${url}"`).replace(/\sdata-gen="[^"]*"/i, "");
        return { fig, newFig };
      } catch {
        return { fig, newFig: "" };
      }
    }),
  );
  let out = html;
  for (const r of results) out = out.replace(r.fig, r.newFig);
  for (const extra of figs.slice(cap)) out = out.replace(extra, "");
  return out;
}
