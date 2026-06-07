// Mapping des cles anti-AI (UI Profil) vers les formules reelles a bannir.
// L'UI stocke des cles (em_dash, delve, ...). Le backend expand en phrases
// concretes pour le prompt + le guard assertNoAntiPatterns.
// Retro-compatible : toute string libre (ancien format) est passee telle quelle.

export const ANTI_AI_KEY_TO_PHRASES: Record<string, string[]> = {
  // em_dash est deja gere par stripEmDashes(), pas de phrase a bannir ici.
  em_dash: [],
  dans_cet_article: ["dans cet article", "nous allons voir", "nous verrons ensemble", "in this article"],
  noubliez_pas: ["n'oubliez pas que", "noubliez pas", "gardez a l'esprit que"],
  ere_du_digital: ["a l'ere du digital", "a l'ere du numerique", "dans un monde digital"],
  en_conclusion: ["en conclusion", "pour conclure", "in conclusion"],
  il_est_important: ["il est important de noter", "il est important de comprendre", "il est essentiel de"],
  monde_ou: ["dans un monde ou", "a une epoque ou", "in a world where"],
  delve: ["plonger dans", "plongeons dans", "explorer", "explorons", "naviguer dans", "delve", "tapestry"],
  important_de_noter: ["il convient de noter", "il faut souligner", "notons que", "force est de constater"],
};

export function expandAntiAiPatterns(patterns: unknown): string[] {
  if (!Array.isArray(patterns)) return [];
  const out: string[] = [];
  for (const p of patterns) {
    if (typeof p !== "string") continue;
    const mapped = ANTI_AI_KEY_TO_PHRASES[p];
    if (mapped) out.push(...mapped);
    else if (p.trim()) out.push(p.trim());
  }
  return Array.from(new Set(out));
}
