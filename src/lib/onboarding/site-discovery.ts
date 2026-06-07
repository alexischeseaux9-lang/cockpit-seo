// Scrape enrichi de la home pour nourrir le generateur de voice profile (V3).

export type DiscoverySnapshot = {
  url: string;
  hostname: string;
  language: string | null;
  title: string | null;
  description: string | null;
  og_image: string | null;
  favicon: string | null;
  h1: string | null;
  paragraphs: string[];
  inferred_platform: "shopify" | "wordpress" | "unknown";
  about_excerpt: string | null;
  text: string;
};

function pick(re: RegExp, html: string): string {
  const m = html.match(re);
  return m ? m[1].trim() : "";
}

function stripText(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function detectPlatform(html: string): "shopify" | "wordpress" | "unknown" {
  if (/cdn\.shopify\.com|shopify-checkout-api-token|Shopify\.shop/i.test(html)) return "shopify";
  if (/wp-content|wp-json|name=["']generator["'][^>]*WordPress/i.test(html)) return "wordpress";
  return "unknown";
}

function detectLanguage(html: string, text: string): string | null {
  const lang = pick(/<html[^>]+lang=["']([a-z]{2})/i, html);
  if (lang) return lang;
  const low = text.toLowerCase();
  if (/\b(le|la|les|des|vous|nous|et|pour|avec)\b/.test(low)) return "fr";
  if (/\b(the|and|for|with|your|our)\b/.test(low)) return "en";
  return null;
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; CockpitSEO/1.0)" }, cache: "no-store" });
  return res.text();
}

export async function discoverSite(rawUrl: string): Promise<DiscoverySnapshot> {
  let url = rawUrl.trim();
  if (!/^https?:\/\//.test(url)) url = `https://${url}`;
  const hostname = new URL(url).hostname;

  const html = await fetchHtml(url);
  const title = pick(/<title[^>]*>([\s\S]*?)<\/title>/i, html);
  const description = pick(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i, html);
  const og_image = pick(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i, html) || null;
  const favicon = pick(/<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]+href=["']([^"']+)["']/i, html) || null;
  const h1 = pick(/<h1[^>]*>([\s\S]*?)<\/h1>/i, html).replace(/<[^>]+>/g, "").trim() || null;
  const text = stripText(html);
  const paragraphs = (html.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || []).map((p) => p.replace(/<[^>]+>/g, "").trim()).filter((p) => p.length > 40).slice(0, 30);
  const inferred_platform = detectPlatform(html);
  const language = detectLanguage(html, text);

  // about page best-effort
  let about_excerpt: string | null = null;
  for (const path of ["/about", "/a-propos", "/pages/about", "/pages/a-propos", "/notre-histoire"]) {
    try {
      const r = await fetch(new URL(path, url).toString(), { headers: { "User-Agent": "CockpitSEO" }, cache: "no-store" });
      if (r.ok) { about_excerpt = stripText(await r.text()).slice(0, 1500); break; }
    } catch { /* next */ }
  }

  return { url, hostname, language, title: title || null, description: description || null, og_image, favicon, h1, paragraphs, inferred_platform, about_excerpt, text };
}
