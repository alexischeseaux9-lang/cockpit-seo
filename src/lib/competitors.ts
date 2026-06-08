// Scrape les sujets d'articles de blog des sites concurrents (sitemaps Shopify ou fallback).
// Sert au "gap de contenu" : on extrait les titres d'articles, Claude filtre ensuite par niche.

function toOrigin(u: string): string {
  try {
    const url = new URL(u.trim().startsWith("http") ? u.trim() : "https://" + u.trim());
    return url.origin;
  } catch {
    return "";
  }
}

function slugToTitle(slug: string): string {
  return slug
    .replace(/\.(html?|php)$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchText(url: string, ms = 12000): Promise<string> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; CockpitSEO/1.0)" }, signal: ctrl.signal, cache: "no-store" });
    clearTimeout(t);
    if (!res.ok) return "";
    return await res.text();
  } catch {
    return "";
  }
}

function locs(xml: string): string[] {
  return Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g)).map((m) => m[1].replace(/&amp;/g, "&").trim());
}

// Extrait les slugs d'articles d'une page HTML (fallback non-Shopify).
function articleSlugsFromHtml(html: string): string[] {
  const out: string[] = [];
  const matches = Array.from(html.matchAll(/href="([^"]*\/(?:blog|blogs|news|articles?)\/[^"]+)"/gi));
  for (const m of matches) {
    const part = m[1].split(/[?#]/)[0].replace(/\/$/, "");
    const slug = part.split("/").pop() || "";
    if (slug && slug.length > 3 && !/^\d+$/.test(slug)) out.push(slug);
  }
  return out;
}

export async function scrapeCompetitorTopics(
  urls: string[],
  perSiteCap = 80,
): Promise<{ topics: string[]; perSite: Record<string, number> }> {
  const perSite: Record<string, number> = {};
  const all = new Set<string>();

  for (const raw of urls) {
    const origin = toOrigin(raw);
    if (!origin) continue;
    let count = 0;
    const before = all.size;

    // 1. sitemap.xml -> sitemaps de blog
    const root = await fetchText(origin + "/sitemap.xml");
    let blogSitemaps = locs(root).filter((u) => /sitemap.*(blog|article|news)/i.test(u));
    // si le sitemap racine liste deja des URLs d'articles
    if (!blogSitemaps.length && /\/blogs?\//i.test(root)) blogSitemaps = [origin + "/sitemap.xml"];

    for (const sm of blogSitemaps.slice(0, 6)) {
      const xml = sm === origin + "/sitemap.xml" ? root : await fetchText(sm);
      for (const u of locs(xml)) {
        const m = u.match(/\/blogs?\/[^/]+\/([^/?#]+)/) || u.match(/\/(?:news|articles?)\/([^/?#]+)/);
        if (!m) continue;
        const slug = m[1];
        if (/^\d+$/.test(slug) || slug.length < 4) continue;
        const title = slugToTitle(slug);
        if (title.length < 4) continue;
        if (!all.has(title)) all.add(title);
        if (all.size - before >= perSiteCap) break;
      }
      if (all.size - before >= perSiteCap) break;
    }

    // 2. fallback : scrape la page fournie + /blogs + /blog
    if (all.size - before === 0) {
      for (const path of ["", "/blogs/news", "/blog", "/blogs"]) {
        const html = await fetchText(origin + path);
        for (const slug of articleSlugsFromHtml(html)) {
          const title = slugToTitle(slug);
          if (title.length >= 4 && !all.has(title)) all.add(title);
          if (all.size - before >= perSiteCap) break;
        }
        if (all.size - before >= perSiteCap) break;
      }
    }

    count = all.size - before;
    perSite[origin] = count;
  }

  return { topics: Array.from(all), perSite };
}
