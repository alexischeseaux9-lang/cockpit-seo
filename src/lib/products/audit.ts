import { ShopifyProductDetailed } from "../shopify";

export type AuditMetrics = {
  word_count: number;
  image_count: number;
  alt_missing: number;
  h2_count: number;
  internal_links: number;
};

export type AuditResult = { score: number; issues: string[]; metrics: AuditMetrics };

// Audit SEO/CRO heuristique d'une fiche produit (aucun appel IA).
export function computeProductAudit(p: ShopifyProductDetailed): AuditResult {
  const body = p.body_html || "";
  const text = body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const word_count = text ? text.split(" ").filter(Boolean).length : 0;
  const image_count = p.images.length;
  const alt_missing = p.images.filter((im) => !im.alt || !im.alt.trim()).length;
  const h2_count = (body.match(/<h2/gi) || []).length;
  const internal_links = (body.match(/href=["'][^"']*\/(products|collections)\//gi) || []).length;

  const issues: string[] = [];
  let score = 100;
  if (word_count < 120) { issues.push("thin_content"); score -= 30; }
  else if (word_count < 250) { issues.push("short_content"); score -= 12; }
  if (h2_count === 0) { issues.push("no_headings"); score -= 15; }
  if (image_count === 0) { issues.push("no_images"); score -= 10; }
  if (alt_missing > 0) { issues.push("missing_alts"); score -= Math.min(15, alt_missing * 5); }
  if (internal_links === 0) { issues.push("no_internal_links"); score -= 12; }
  if (!p.tags.length) { issues.push("no_tags"); score -= 6; }

  return { score: Math.max(0, Math.min(100, score)), issues, metrics: { word_count, image_count, alt_missing, h2_count, internal_links } };
}
