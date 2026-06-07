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

// M3: onboarding discover. Analyse le texte du site et propose un voice profile.
export type DiscoverResult = {
  voice_profile: {
    tone_description: string;
    audience: string;
    content_language: string;
    image_style_hint: string;
    branding_accent_hex: string;
    author_name: string;
    author_role: string;
    author_bio: string;
  };
  keyword_pillars: string[];
};

export async function discoverProfile(url: string, siteText: string): Promise<DiscoverResult> {
  const c = client();
  const msg = await c.messages.create({
    model: HAIKU,
    max_tokens: 1800,
    system: `Tu analyses un site e-commerce pour en deduire un profil editorial. ${STYLE_RULES}`,
    messages: [
      {
        role: "user",
        content: `Site: ${url}

Contenu extrait (tronque):
${siteText.slice(0, 6000)}

Deduis le profil. Reponds UNIQUEMENT en JSON:
{
  "voice_profile": {
    "tone_description": "ton editorial en 1 phrase",
    "audience": "audience cible",
    "content_language": "francais|anglais|allemand|italien|espagnol",
    "image_style_hint": "style visuel pour les images",
    "branding_accent_hex": "#xxxxxx",
    "author_name": "prenom d'un auteur fictif coherent",
    "author_role": "role de l'auteur",
    "author_bio": "bio courte de l'auteur"
  },
  "keyword_pillars": ["12 thematiques de mots-cles SEO pertinentes pour cette niche"]
}`,
      },
    ],
  });
  const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  return extractJson(text) as DiscoverResult;
}

// M4: genere une liste de mots-cles SEO pour une niche.
export async function keywordScout(niche: string, count: number, lang: string): Promise<string[]> {
  const c = client();
  const msg = await c.messages.create({
    model: HAIKU,
    max_tokens: 4000,
    system: `Tu es un expert SEO. Tu generes des mots-cles long-tail a fort intent. ${STYLE_RULES}`,
    messages: [
      {
        role: "user",
        content: `Genere ${count} mots-cles SEO long-tail en ${lang} pour la niche: "${niche}". Varie informationnel et commercial. Reponds UNIQUEMENT en JSON: { "keywords": ["..."] }`,
      },
    ],
  });
  const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  const out = extractJson(text);
  return (out.keywords || []).map((k: string) => stripEmDashes(k)).slice(0, count);
}

// M5: audit + optimisation d'une fiche produit.
export type ProductAudit = {
  audit_score: number;
  audit_notes: string[];
  proposed_title: string;
  proposed_body_html: string;
  proposed_meta_title: string;
  proposed_meta_description: string;
};

export async function auditProduct(
  title: string,
  bodyHtml: string,
  voiceProfile: Record<string, any>
): Promise<ProductAudit> {
  const c = client();
  const lang = voiceProfile.content_language || "francais";
  const msg = await c.messages.create({
    model: SONNET,
    max_tokens: 3000,
    system: `Tu es un expert CRO et copywriting e-commerce. Tu ecris en ${lang}. ${STYLE_RULES}`,
    messages: [
      {
        role: "user",
        content: `Audite et reecris cette fiche produit pour maximiser conversion et SEO.

Titre actuel: ${title}
Description actuelle (HTML): ${bodyHtml.slice(0, 3000) || "(vide)"}

Reponds UNIQUEMENT en JSON:
{
  "audit_score": <0-100>,
  "audit_notes": ["2 a 4 problemes constates"],
  "proposed_title": "titre optimise",
  "proposed_body_html": "<description HTML optimisee: accroche, benefices en <ul>, reassurance>",
  "proposed_meta_title": "< 60 caracteres",
  "proposed_meta_description": "< 155 caracteres"
}`,
      },
    ],
  });
  const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  const a = extractJson(text) as ProductAudit;
  a.proposed_title = stripEmDashes(a.proposed_title);
  a.proposed_body_html = stripEmDashes(a.proposed_body_html);
  a.proposed_meta_title = stripEmDashes(a.proposed_meta_title);
  a.proposed_meta_description = stripEmDashes(a.proposed_meta_description);
  return a;
}

// M5: optimisation d'une collection / categorie.
export type CollectionAnalysis = {
  quality_score: number;
  intent_class: string;
  suggested_description_html: string;
  suggested_meta_title: string;
  suggested_meta_description: string;
};

export async function analyzeCollection(
  name: string,
  currentDescription: string,
  voiceProfile: Record<string, any>
): Promise<CollectionAnalysis> {
  const c = client();
  const lang = voiceProfile.content_language || "francais";
  const msg = await c.messages.create({
    model: SONNET,
    max_tokens: 2500,
    system: `Tu es un expert SEO e-commerce. Tu ecris en ${lang}. ${STYLE_RULES}`,
    messages: [
      {
        role: "user",
        content: `Optimise cette page collection pour le SEO et la conversion.

Nom: ${name}
Description actuelle: ${currentDescription.slice(0, 2000) || "(vide)"}

Reponds UNIQUEMENT en JSON:
{
  "quality_score": <0-100>,
  "intent_class": "commercial|informational|hybrid|navigational",
  "suggested_description_html": "<description HTML riche et optimisee>",
  "suggested_meta_title": "< 60 caracteres",
  "suggested_meta_description": "< 155 caracteres"
}`,
      },
    ],
  });
  const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  const a = extractJson(text) as CollectionAnalysis;
  a.suggested_description_html = stripEmDashes(a.suggested_description_html);
  a.suggested_meta_title = stripEmDashes(a.suggested_meta_title);
  a.suggested_meta_description = stripEmDashes(a.suggested_meta_description);
  return a;
}

export async function generateImagePrompt(
  title: string,
  voiceProfile: Record<string, any>
): Promise<string> {
  const styleHint = voiceProfile.image_style_hint || "photographie editoriale, lumiere naturelle";
  return `Editorial blog cover image for an article titled "${title}". Style: ${styleHint}. High quality, clean composition, no text, no watermark.`;
}
