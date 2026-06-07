// Generation d'image de couverture via fal.ai (flux/dev).
// Endpoint synchrone: convient au timeout Vercel (300s).

export async function generateCoverImage(prompt: string): Promise<string> {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error("FAL_KEY manquante");

  const res = await fetch("https://fal.run/fal-ai/flux/dev", {
    method: "POST",
    headers: {
      Authorization: `Key ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      image_size: "landscape_16_9",
      num_images: 1,
      enable_safety_checker: true,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`fal_error:${res.status}:${body.slice(0, 200)}`);
  }
  const data = await res.json();
  const url = data?.images?.[0]?.url;
  if (!url) throw new Error("fal_no_image");
  return url as string;
}
