// Scrape best-effort de la home pour nourrir le generateur de voice profile.

export type SiteMeta = {
  url: string;
  title: string;
  description: string;
  h1: string[];
  headings: string[];
  og_image: string | null;
  text: string;
};

function pick(re: RegExp, html: string): string {
  const m = html.match(re);
  return m ? m[1].trim() : "";
}
function pickAll(re: RegExp, html: string, max: number): string[] {
  const out: string[] = [];
  let m;
  while ((m = re.exec(html)) && out.length < max) out.push(m[1].replace(/<[^>]+>/g, "").trim());
  return out.filter(Boolean);
}

export async function discoverSite(rawUrl: string): Promise<SiteMeta> {
  let url = rawUrl.trim();
  if (!/^https?:\/\//.test(url)) url = `https://${url}`;

  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; CockpitSEO/1.0)" },
    cache: "no-store",
  });
  const html = await res.text();

  const title = pick(/<title[^>]*>([\s\S]*?)<\/title>/i, html);
  const description =
    pick(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i, html) ||
    pick(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i, html);
  const og_image =
    pick(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i, html) || null;
  const h1 = pickAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, html, 5);
  const headings = pickAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, html, 12);
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return { url, title, description, h1, headings, og_image, text };
}
