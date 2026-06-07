// Parse l'input du formulaire Roadmap : soit 1 mot-cle par ligne (texte),
// soit un CSV (Priorite, Categorie, Titre, Keyword principal, Slug).

export type ParsedKeyword = {
  keyword: string;
  brief: string | null;
  priority: number; // 0 | 5 | 10
  targetBlogHint?: string;
};

export type ParseResult = {
  keywords: ParsedKeyword[];
  format: "csv" | "text";
  warnings: string[];
};

function mapPriority(raw: string | undefined): number {
  const v = (raw || "").trim().toLowerCase();
  if (["1", "high", "haute"].includes(v)) return 10;
  if (["2", "mid", "moyenne", "medium"].includes(v)) return 5;
  if (["3", "low", "basse"].includes(v)) return 0;
  return 0;
}

function splitCsvLine(line: string): string[] {
  // split simple sur virgule ou point-virgule, en tolerant les guillemets
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (const ch of line) {
    if (ch === '"') inQ = !inQ;
    else if ((ch === "," || ch === ";") && !inQ) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim().replace(/^"|"$/g, ""));
}

const KNOWN_HEADERS = ["priorite", "priorité", "categorie", "catégorie", "titre", "keyword", "mot-cle", "slug"];

export function parseKeywordInput(raw: string): ParseResult {
  const warnings: string[] = [];
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return { keywords: [], format: "text", warnings };

  const first = lines[0].toLowerCase();
  const isCsv = (first.includes(",") || first.includes(";")) && KNOWN_HEADERS.some((h) => first.includes(h));

  if (!isCsv) {
    // mode texte: 1 ligne = 1 keyword
    const keywords = lines
      .filter((l) => !KNOWN_HEADERS.includes(l.toLowerCase()))
      .map((l) => ({ keyword: l.slice(0, 200), brief: null, priority: 0 }));
    return { keywords, format: "text", warnings };
  }

  // mode CSV: detecte les colonnes via header
  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const idx = {
    priorite: header.findIndex((h) => h.startsWith("priorit")),
    titre: header.findIndex((h) => h.startsWith("titre")),
    keyword: header.findIndex((h) => h.includes("keyword") || h.includes("mot")),
    slug: header.findIndex((h) => h.includes("slug")),
    categorie: header.findIndex((h) => h.startsWith("categ") || h.startsWith("catég")),
  };
  const keywords: ParsedKeyword[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const kw = (idx.keyword >= 0 ? cols[idx.keyword] : cols[0]) || "";
    if (!kw) { warnings.push(`Ligne ${i + 1} ignoree (pas de mot-cle).`); continue; }
    const titre = idx.titre >= 0 ? cols[idx.titre] : "";
    keywords.push({
      keyword: kw.slice(0, 200),
      brief: titre ? `Titre cible: ${titre}` : null,
      priority: mapPriority(idx.priorite >= 0 ? cols[idx.priorite] : undefined),
      targetBlogHint: idx.categorie >= 0 && cols[idx.categorie] ? cols[idx.categorie] : undefined,
    });
  }
  return { keywords, format: "csv", warnings };
}
