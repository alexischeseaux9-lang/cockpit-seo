import Anthropic from "@anthropic-ai/sdk";
import { SerpAnalysis } from "./serp";
import { stripEmDashes, findAntiPatterns } from "./guards";

const SONNET = process.env.CLAUDE_MODEL || "claude-sonnet-4-6";
const HAIKU = "claude-haiku-4-5";

function client(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY manquante");
  return new Anthropic({ apiKey });
}

// Regle dure injectee dans chaque prompt systeme.
const STYLE_RULES = `Regles de style ABSOLUES, non negociables:
- N'utilise JAMAIS de tiret cadratin (—) ni demi-cadratin (–). Remplace par virgule, point, parentheses ou deux-points.
- Bannis ces formules: "en conclusion", "dans cet article", "de nos jours", "il est important de noter", "plongeons", "decouvrons ensemble", "incontournable", "delve", "tapestry", "in conclusion", "elevate", "unlock".
- Ton naturel, concret, specifique. Zero remplissage. Pas de meta-commentaire ("dans ce paragraphe nous...").`;

function extractJson(text: string): any {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence ? fence[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("json_parse_failed");
  return JSON.parse(raw.slice(start, end + 1));
}

export type ArticleBrief = {
  title: string;
  meta_title: string;
  meta_description: string;
  secondary_keywords: string[];
  outline: string[];
  target_words: number;
};

export async function generateBrief(
  keyword: string,
  serp: SerpAnalysis,
  voiceProfile: Record<string, any>
): Promise<ArticleBrief> {
  const c = client();
  const lang = voiceProfile.content_language || "francais";
  const sys = `Tu es un strategiste SEO editorial. ${STYLE_RULES}`;
  const prompt = `Mot-cle cible: "${keyword}"
Langue de redaction: ${lang}
Ton de marque: ${voiceProfile.tone_description || "expert, accessible"}
Audience: ${voiceProfile.audience || "clients e-commerce"}

Concurrents (SERP top):
${serp.organic.map((o, i) => `${i + 1}. ${o.title} - ${o.snippet}`).join("\n")}

Questions des utilisateurs (People also ask):
${serp.questions.slice(0, 8).map((q) => `- ${q}`).join("\n") || "(aucune)"}

Recherches associees: ${serp.related.slice(0, 8).join(", ") || "(aucune)"}

Produis un brief d'article qui battra ces concurrents. Reponds UNIQUEMENT en JSON:
{
  "title": "titre H1 accrocheur, contient le mot-cle, < 70 caracteres",
  "meta_title": "titre SEO < 60 caracteres",
  "meta_description": "meta description < 155 caracteres, incitative",
  "secondary_keywords": ["5 a 8 mots-cles secondaires"],
  "outline": ["6 a 9 titres de sections H2 couvrant le sujet et les questions"],
  "target_words": 1200
}`;
  const msg = await c.messages.create({
    model: SONNET,
    max_tokens: 1500,
    system: sys,
    messages: [{ role: "user", content: prompt }],
  });
  const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  const brief = extractJson(text) as ArticleBrief;
  brief.title = stripEmDashes(brief.title);
  brief.meta_title = stripEmDashes(brief.meta_title);
  brief.meta_description = stripEmDashes(brief.meta_description);
  return brief;
}

export type WrittenArticle = { body_html: string; excerpt: string };

export async function writeArticle(
  brief: ArticleBrief,
  keyword: string,
  voiceProfile: Record<string, any>
): Promise<WrittenArticle> {
  const c = client();
  const lang = voiceProfile.content_language || "francais";
  const sys = `Tu es un redacteur SEO expert. Tu ecris en ${lang}. ${STYLE_RULES}`;
  const prompt = `Redige un article de blog complet et optimise SEO.

Titre: ${brief.title}
Mot-cle principal: ${keyword}
Mots-cles secondaires: ${brief.secondary_keywords.join(", ")}
Plan a suivre (H2): ${brief.outline.join(" | ")}
Longueur cible: ~${brief.target_words} mots.
Ton: ${voiceProfile.tone_description || "expert, accessible, concret"}

Contraintes:
- Sors du HTML propre: <h2>, <h3>, <p>, <ul><li>, <strong>. Pas de <h1> (le titre est gere a part).
- Introduction qui accroche des la premiere phrase, sans formule cliche.
- Chaque section apporte une info concrete et actionnable.
- Termine par une section pratique (pas "en conclusion").

Reponds UNIQUEMENT en JSON:
{ "body_html": "<le HTML complet de l'article>", "excerpt": "resume de 2 phrases < 200 caracteres" }`;
  const msg = await c.messages.create({
    model: SONNET,
    max_tokens: 8000,
    system: sys,
    messages: [{ role: "user", content: prompt }],
  });
  const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  const out = extractJson(text) as WrittenArticle;
  out.body_html = stripEmDashes(out.body_html);
  out.excerpt = stripEmDashes(out.excerpt);
  return out;
}

// Editor Haiku: si des anti-patterns subsistent, on demande une reecriture ciblee.
export async function editArticle(body_html: string): Promise<string> {
  let cleaned = stripEmDashes(body_html);
  const hits = findAntiPatterns(cleaned);
  if (hits.length === 0) return cleaned;

  const c = client();
  const msg = await c.messages.create({
    model: HAIKU,
    max_tokens: 8000,
    system: `Tu es un editeur. ${STYLE_RULES}`,
    messages: [
      {
        role: "user",
        content: `Reecris ce HTML pour supprimer toute formule cliche (notamment: ${hits.join(", ")}) sans changer le sens ni la structure HTML. Garde exactement les memes balises. Reponds uniquement avec le HTML corrige, rien d'autre.\n\n${cleaned}`,
      },
    ],
  });
  cleaned = stripEmDashes(msg.content.map((b) => (b.type === "text" ? b.text : "")).join(""));
  return cleaned;
}

export async function generateImagePrompt(
  title: string,
  voiceProfile: Record<string, any>
): Promise<string> {
  const styleHint = voiceProfile.image_style_hint || "photographie editoriale, lumiere naturelle";
  return `Editorial blog cover image for an article titled "${title}". Style: ${styleHint}. High quality, clean composition, no text, no watermark.`;
}
