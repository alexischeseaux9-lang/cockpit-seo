// Audit heuristique 7 dimensions d'une collection (aucun appel IA).

export type TaxonomyBreakdown = {
  description: number; // /30
  meta_title: number; // /15
  meta_description: number; // /15
  image: number; // /10
  products_count: number; // /10
  internal_links: number; // /10
  headings_structure: number; // /10
  notes: string[];
};

export function computeTaxonomyAudit(input: {
  body_html: string;
  meta_title: string | null;
  meta_description: string | null;
  image_url: string | null;
  products_count: number;
}): { score: number; breakdown: TaxonomyBreakdown } {
  const body = input.body_html || "";
  const text = body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const words = text ? text.split(" ").filter(Boolean).length : 0;
  const notes: string[] = [];

  // description /30
  let description = 0;
  if (words >= 150) description = 30;
  else if (words >= 60) description = 18;
  else if (words > 0) description = 8;
  if (description < 30) notes.push(words === 0 ? "Description absente" : "Description trop courte");

  // meta_title /15
  const mt = (input.meta_title || "").length;
  const meta_title = mt >= 30 && mt <= 60 ? 15 : mt > 0 ? 8 : 0;
  if (meta_title < 15) notes.push(mt === 0 ? "Meta title absent" : "Meta title hors plage 30-60");

  // meta_description /15
  const md = (input.meta_description || "").length;
  const meta_description = md >= 80 && md <= 160 ? 15 : md > 0 ? 8 : 0;
  if (meta_description < 15) notes.push(md === 0 ? "Meta description absente" : "Meta description hors plage 80-160");

  // image /10
  const image = input.image_url ? 10 : 0;
  if (!image) notes.push("Image de collection absente");

  // products_count /10
  const products_count = input.products_count >= 8 ? 10 : input.products_count >= 3 ? 6 : input.products_count > 0 ? 3 : 0;
  if (products_count < 6) notes.push("Peu de produits dans la collection");

  // internal_links /10
  const links = (body.match(/href=["'][^"']*\/(products|collections)\//gi) || []).length;
  const internal_links = links >= 3 ? 10 : links > 0 ? 5 : 0;
  if (internal_links < 10) notes.push("Maillage interne faible");

  // headings_structure /10
  const h = (body.match(/<h[23]/gi) || []).length;
  const headings_structure = h >= 2 ? 10 : h === 1 ? 5 : 0;
  if (headings_structure < 10) notes.push("Structure de titres (H2/H3) faible");

  const score = description + meta_title + meta_description + image + products_count + internal_links + headings_structure;
  return { score, breakdown: { description, meta_title, meta_description, image, products_count, internal_links, headings_structure, notes } };
}
