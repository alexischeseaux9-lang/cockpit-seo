import Anthropic from "@anthropic-ai/sdk";
import { SerpAnalysis } from "./serp";
import { stripEmDashes, findAntiPatterns } from "./guards";
import { logAnthropicUsage } from "./ai-usage";

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
  const persona = voiceProfile.mascot || voiceProfile.author_name;
  const extraBans = [
    ...(Array.isArray(voiceProfile.anti_ai_patterns) ? voiceProfile.anti_ai_patterns : []),
    voiceProfile.anti_ai_custom,
  ].filter(Boolean).join(", ");
  const sys = `Tu es un redacteur SEO expert${persona ? ` qui ecrit sous la plume de ${persona}` : ""}. Tu ecris en ${lang}. ${STYLE_RULES}${
    extraBans ? `\nFormules supplementaires a bannir absolument: ${extraBans}.` : ""
  }${voiceProfile.bonus_instructions ? `\nInstructions specifiques: ${voiceProfile.bonus_instructions}` : ""}`;
  const prompt = `Redige un article de blog complet et optimise SEO.

Titre: ${brief.title}
Mot-cle principal: ${keyword}
Mots-cles secondaires: ${brief.secondary_keywords.join(", ")}
Plan a suivre (H2): ${brief.outline.join(" | ")}
Longueur cible: ~${brief.target_words} mots.
Ton: ${voiceProfile.tone_description || "expert, accessible, concret"}${voiceProfile.example_phrases ? `\nExemples de phrases dans le ton: ${voiceProfile.example_phrases}` : ""}

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
  await logAnthropicUsage({ model: SONNET, usage: (msg as any).usage, context: "writer" });
  const out = extractJson(text) as WrittenArticle;
  out.body_html = stripEmDashes(out.body_html);
  out.excerpt = stripEmDashes(out.excerpt);
  return out;
}

// Editor Haiku: si des anti-patterns subsistent, on demande une reecriture ciblee.
export async function editArticle(body_html: string, extraBans: string[] = []): Promise<string> {
  let cleaned = stripEmDashes(body_html);
  const hits = findAntiPatterns(cleaned, extraBans);
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
    mascot: string;
    tone_description: string;
    audience: string;
    example_phrases: string;
    content_language: string;
    image_style_hint: string;
    branding_accent_hex: string;
    author_name: string;
    author_role: string;
    author_bio: string;
    product_tone_description: string;
    anti_ai_patterns: string[];
  };
  keyword_pillars: string[];
};

export async function discoverProfile(url: string, siteText: string): Promise<DiscoverResult> {
  const c = client();
  const msg = await c.messages.create({
    model: HAIKU,
    max_tokens: 2200,
    system: `Tu analyses un site e-commerce pour en deduire un profil editorial complet. ${STYLE_RULES}`,
    messages: [
      {
        role: "user",
        content: `Site: ${url}

Contenu extrait (tronque):
${siteText.slice(0, 6000)}

Deduis le profil. La langue (content_language) DOIT etre celle du site. Reponds UNIQUEMENT en JSON:
{
  "voice_profile": {
    "mascot": "nom complet d'un auteur persona coherent (ex Camille Renard)",
    "tone_description": "ton editorial detaille en 2-3 phrases",
    "audience": "audience cible detaillee",
    "example_phrases": "3 exemples de phrases dans le ton de la marque",
    "content_language": "francais|anglais|allemand|italien|espagnol|neerlandais",
    "image_style_hint": "style visuel pour les images",
    "branding_accent_hex": "#xxxxxx couleur d'accent de la marque",
    "author_name": "prenom de l'auteur",
    "author_role": "role de l'auteur",
    "author_bio": "bio courte de l'auteur",
    "product_tone_description": "ton pour les fiches produit",
    "anti_ai_patterns": ["3 a 5 formules a bannir specifiques a cette marque"]
  },
  "keyword_pillars": ["12 thematiques de mots-cles SEO pertinentes pour cette niche"]
}`,
      },
    ],
  });
  const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  return extractJson(text) as DiscoverResult;
}

// Re-genere un seul champ du voice profile (bouton "Re-generer ce champ" du wizard).
export async function regenerateProfileField(
  url: string,
  siteText: string,
  field: string,
  lang: string
): Promise<string> {
  const c = client();
  const msg = await c.messages.create({
    model: HAIKU,
    max_tokens: 600,
    system: `Tu generes un seul champ de profil editorial pour un site. Langue: ${lang}. ${STYLE_RULES}`,
    messages: [
      {
        role: "user",
        content: `Site: ${url}\nExtrait: ${siteText.slice(0, 3000)}\n\nGenere uniquement la valeur du champ "${field}". Reponds en texte brut, sans guillemets ni JSON.`,
      },
    ],
  });
  return stripEmDashes(msg.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim());
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

// M5 V2: scoring rapide (Haiku) de l'etat actuel d'une fiche produit.
export type ProductScore = { quality_score: number; quality_breakdown: Record<string, number>; notes: string[] };

export async function scoreProduct(title: string, bodyHtml: string): Promise<ProductScore> {
  const c = client();
  const msg = await c.messages.create({
    model: HAIKU,
    max_tokens: 800,
    system: `Tu audites des fiches produit e-commerce (SEO + CRO). ${STYLE_RULES}`,
    messages: [
      {
        role: "user",
        content: `Note cette fiche (0-100) sur: description, structure_headings, meta, social_proof, urgency, clarte.
Titre: ${title}
HTML: ${bodyHtml.slice(0, 2500) || "(vide)"}
Reponds UNIQUEMENT en JSON: { "quality_score": <0-100>, "quality_breakdown": {"description":0-100,"headings":0-100,"meta":0-100,"social_proof":0-100,"urgency":0-100,"clarity":0-100}, "notes": ["2 a 4 problemes"] }`,
      },
    ],
  });
  const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  return extractJson(text) as ProductScore;
}

// M5 V2: optimisation complete (Sonnet) avec channel_meta + cro_signals + body structure.
export type ProductOptimized = {
  title: string;
  body_html: string;
  image_alts: string[];
  channel_meta: {
    shopify: { title: string; meta_title: string; meta_description: string; tags: string[] };
    google_shopping: { title: string; description: string; brand?: string; condition: string };
    meta_ads: { headline: string; primary_text: string; description: string };
  };
  cro_signals: { urgency_present: boolean; social_proof_present: boolean; risk_reversal_present: boolean; delivery_clarity: boolean };
  quality_score: number;
};

export async function optimizeProductFull(
  title: string,
  bodyHtml: string,
  voiceProfile: Record<string, any>,
  accent: string
): Promise<ProductOptimized> {
  const c = client();
  const lang = voiceProfile.content_language || "francais";
  const sys = `Tu es expert CRO + SEO e-commerce. Tu ecris en ${lang}. ${STYLE_RULES}
Regles HTML: H2/H3 obligatoires avec le mot-cle ou variante long-tail (jamais "Description" ou "Key Benefits" generiques).
Icones uniquement en SVG inline line-art (viewBox 24x24, stroke=currentColor), jamais d'emoji.
Structure: hero, 3 trust badges (SVG inline), story (2-3 paragraphes), grille de 3-4 benefices, table de caracteristiques, liste d'entretien, FAQ.
Utilise la couleur d'accent ${accent} dans les badges et separateurs.`;
  const msg = await c.messages.create({
    model: SONNET,
    max_tokens: 14000,
    system: sys,
    messages: [
      {
        role: "user",
        content: `Optimise cette fiche produit.
Titre actuel: ${title}
HTML actuel: ${bodyHtml.slice(0, 3000) || "(vide)"}
Ton produit: ${voiceProfile.product_tone_description || voiceProfile.tone_description || "expert, rassurant"}

Reponds UNIQUEMENT en JSON STRICT:
{
  "title": "titre optimise",
  "body_html": "<HTML complet structure avec H2/H3, SVG inline, classes Tailwind inline pour H2 font-size>",
  "image_alts": ["alt text par image"],
  "channel_meta": {
    "shopify": { "title": "", "meta_title": "<60c", "meta_description": "<155c", "tags": ["3-5 tags"] },
    "google_shopping": { "title": "", "description": "", "brand": "", "condition": "new" },
    "meta_ads": { "headline": "", "primary_text": "", "description": "" }
  },
  "cro_signals": { "urgency_present": true, "social_proof_present": true, "risk_reversal_present": true, "delivery_clarity": true },
  "quality_score": <0-100>
}`,
      },
    ],
  });
  const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  await logAnthropicUsage({ model: SONNET, usage: (msg as any).usage, context: "product_optimize" });
  const o = extractJson(text) as ProductOptimized;
  o.title = stripEmDashes(o.title);
  o.body_html = stripEmDashes(o.body_html);
  return o;
}

// M5/V3: optimisation complete d'une collection (SERP + intent + FAQ + schema).
export type CollectionAnalysis = {
  quality_score: number;
  intent_class: string;
  suggested_h1: string;
  suggested_description_html: string;
  suggested_meta_title: string;
  suggested_meta_description: string;
  suggested_faq: { q: string; a: string }[];
  suggested_internal_links: { anchor: string; url: string }[];
  suggested_schema: any;
};

export async function analyzeCollection(
  name: string,
  currentDescription: string,
  voiceProfile: Record<string, any>,
  serp?: SerpAnalysis
): Promise<CollectionAnalysis> {
  const c = client();
  const lang = voiceProfile.content_language || "francais";
  const serpBlock = serp
    ? `\nConcurrents SERP:\n${serp.organic.slice(0, 6).map((o, i) => `${i + 1}. ${o.title}`).join("\n")}\nQuestions: ${serp.questions.slice(0, 6).join(" | ")}`
    : "";
  const msg = await c.messages.create({
    model: SONNET,
    max_tokens: 4000,
    system: `Tu es un expert SEO e-commerce. Tu ecris en ${lang}. ${STYLE_RULES}`,
    messages: [
      {
        role: "user",
        content: `Optimise cette page collection pour le SEO et la conversion.

Nom: ${name}
Description actuelle: ${currentDescription.slice(0, 2000) || "(vide)"}${serpBlock}

Reponds UNIQUEMENT en JSON:
{
  "quality_score": <0-100>,
  "intent_class": "commercial|informational|hybrid|navigational",
  "suggested_h1": "H1 optimise",
  "suggested_description_html": "<description HTML riche, H2/H3, optimisee>",
  "suggested_meta_title": "< 60 caracteres",
  "suggested_meta_description": "< 155 caracteres",
  "suggested_faq": [{"q":"question","a":"reponse"}],
  "suggested_internal_links": [{"anchor":"texte","url":"/collections/..."}],
  "suggested_schema": {"@context":"https://schema.org","@type":"CollectionPage"}
}`,
      },
    ],
  });
  await logAnthropicUsage({ model: SONNET, usage: (msg as any).usage, context: "collection_analyze" });
  const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  const a = extractJson(text) as CollectionAnalysis;
  a.suggested_description_html = stripEmDashes(a.suggested_description_html || "");
  a.suggested_meta_title = stripEmDashes(a.suggested_meta_title || "");
  a.suggested_meta_description = stripEmDashes(a.suggested_meta_description || "");
  a.suggested_h1 = stripEmDashes(a.suggested_h1 || "");
  return a;
}

// Refresh d'un article existant : ameliore/actualise le contenu SANS toucher
// aux images. Regle absolue #5 : ne jamais ecraser une image hero ni inline.
export async function refreshArticle(
  title: string,
  currentBodyHtml: string,
  voiceProfile: Record<string, any>
): Promise<string> {
  const c = client();
  const lang = voiceProfile.content_language || "francais";
  const persona = voiceProfile.mascot || voiceProfile.author_name;
  const sys = `Tu es un editeur SEO qui rafraichit des articles existants en ${lang}${persona ? `, sous la plume de ${persona}` : ""}. ${STYLE_RULES}
REGLE CRITIQUE : conserve TOUTES les balises <img ...> existantes a l'identique (meme src, meme position relative). Ne supprime, ne remplace, ne deplace aucune image.`;
  const msg = await c.messages.create({
    model: SONNET,
    max_tokens: 8000,
    system: sys,
    messages: [
      {
        role: "user",
        content: `Rafraichis cet article: ameliore la clarte, ajoute des infos actuelles, renforce le SEO, corrige le style. Garde la meme structure globale et TOUTES les images. Reponds uniquement avec le HTML complet du body, rien d'autre.

Titre: ${title}
HTML actuel:
${currentBodyHtml.slice(0, 12000)}`,
      },
    ],
  });
  await logAnthropicUsage({ model: SONNET, usage: (msg as any).usage, context: "refresh" });
  let out = stripEmDashes(msg.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim());
  out = out.replace(/^```html\s*/i, "").replace(/```$/i, "").trim();

  // Garde-fou images : reinjecte toute image originale disparue.
  const imgRe = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = imgRe.exec(currentBodyHtml)) !== null) {
    if (!out.includes(m[1])) out += `\n${m[0]}`;
  }
  return out;
}

// M4 SCRO: genere un paragraphe a injecter dans un article existant pour
// renforcer le ranking d'une requete. Respecte STRICTEMENT la langue du site.
export async function generateInjection(
  query: string,
  postTitle: string,
  postExcerpt: string,
  voiceProfile: Record<string, any>
): Promise<string> {
  const c = client();
  const lang = voiceProfile.content_language || "francais";
  const msg = await c.messages.create({
    model: SONNET,
    max_tokens: 900,
    system: `Tu es redacteur SEO. Tu ecris EXCLUSIVEMENT en ${lang}, jamais une autre langue. ${STYLE_RULES}`,
    messages: [
      {
        role: "user",
        content: `Article cible: "${postTitle}". Resume: ${postExcerpt || "(n/a)"}.
Requete a renforcer: "${query}".
Ecris UN paragraphe HTML (<h3> + <p>, 80 a 130 mots) a ajouter a cet article pour mieux ranker sur cette requete. Naturel, utile, integre la requete sans bourrage. Reponds uniquement avec le HTML du bloc, rien d'autre.`,
      },
    ],
  });
  return stripEmDashes(msg.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim());
}

export async function generateImagePrompt(
  title: string,
  voiceProfile: Record<string, any>
): Promise<string> {
  const styleHint = voiceProfile.image_style_hint || "photographie editoriale, lumiere naturelle";
  return `Editorial blog cover image for an article titled "${title}". Style: ${styleHint}. High quality, clean composition, no text, no watermark.`;
}
