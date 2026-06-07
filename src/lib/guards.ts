// Garde-fous OBLIGATOIRES appliques apres chaque etape de generation.
// Voir section 6.3 du master prompt.

// 1. Aucun em-dash ni en-dash nulle part. On remplace par une ponctuation propre.
export function stripEmDashes(text: string): string {
  if (!text) return text;
  return text
    .replace(/\s*[—–]\s*/g, ", ") // em/en dash entoure d'espaces -> virgule
    .replace(/[—–]/g, ", ") // residuel
    .replace(/ {2,}/g, " ")
    .replace(/ ,/g, ",")
    .replace(/,{2,}/g, ",");
}

const ANTI_PATTERNS: string[] = [
  // EN
  "in conclusion",
  "delve",
  "tapestry",
  "in this article",
  "we will see",
  "in today's world",
  "it's important to note",
  "when it comes to",
  "unlock the",
  "elevate your",
  "in the realm of",
  "a testament to",
  "ever-evolving",
  "game-changer",
  "navigating the",
  // FR
  "de nos jours",
  "force est de constater",
  "il est important de noter",
  "dans cet article",
  "en conclusion",
  "plongeons",
  "decouvrons ensemble",
  "il convient de",
  "a l'ere du",
  "a l'ere de",
  "incontournable",
];

export function findAntiPatterns(body: string): string[] {
  const low = body.toLowerCase();
  return ANTI_PATTERNS.filter((p) => low.includes(p));
}

export function assertNoAntiPatterns(body: string): void {
  const hits = findAntiPatterns(body);
  if (hits.length > 0) {
    throw new Error(`anti_patterns_detected:${hits.join(",")}`);
  }
}

// Refuse si un autre auteur/mascot a fuite dans le texte (cross-site leak).
export function assertPersonaIsolation(opts: {
  body: string;
  expectedShortName?: string;
  expectedFullName?: string;
  forbiddenNames?: string[];
}): void {
  const { body, expectedShortName, expectedFullName, forbiddenNames = [] } = opts;
  const low = body.toLowerCase();
  const allowed = new Set(
    [expectedShortName, expectedFullName].filter(Boolean).map((n) => n!.toLowerCase())
  );
  const leaked = forbiddenNames.filter(
    (n) => n && !allowed.has(n.toLowerCase()) && low.includes(n.toLowerCase())
  );
  if (leaked.length > 0) {
    throw new Error(`persona_leak:${leaked.join(",")}`);
  }
}
