import Anthropic from "@anthropic-ai/sdk";
import { SerpAnalysis } from "./serp";
import { stripEmDashes, findAntiPatterns } from "./guards";
import { logAnthropicUsage } from "./ai-usage";
import { expandAntiAiPatterns } from "./anti-ai";

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

type ArticleBranding = { accent: string; accentDark: string; cardBg: string; textDark: string; textMuted: string; border: string };
const DEFAULT_ARTICLE_BRANDING: ArticleBranding = { accent: "#10b981", accentDark: "#0b7a5a", cardBg: "#f6f7f6", textDark: "#18181b", textMuted: "#6b7280", border: "#e5e7eb" };

function svgIcon(path: string): string {
  return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="flex:0 0 auto">${path}</svg>`;
}
const ICON_LIB: Record<string, string> = {
  star: svgIcon('<path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9 6.8 19.2l1-5.8L3.5 9.2l5.9-.9z"/>'),
  bulb: svgIcon('<path d="M9 18h6"/><path d="M10 21h4"/><path d="M12 3a6 6 0 0 0-4 10c.7.7 1 1.6 1 2.5h6c0-.9.3-1.8 1-2.5a6 6 0 0 0-4-10z"/>'),
  check: svgIcon('<path d="M20 6L9 17l-5-5"/>'),
  droplet: svgIcon('<path d="M12 2.7s6 5.5 6 9.8a6 6 0 0 1-12 0c0-4.3 6-9.8 6-9.8z"/>'),
  shield: svgIcon('<path d="M12 3l8 3v6c0 4-3.5 7-8 9-4.5-2-8-5-8-9V6z"/>'),
  clock: svgIcon('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  leaf: svgIcon('<path d="M11 3C6 3 3 7 3 12c0 3 2 6 5 7 0-5 3-9 9-11-2-3-4-5-6-5z"/><path d="M8 19c4-6 8-8 11-9"/>'),
  thermometer: svgIcon('<path d="M14 14V5a2 2 0 0 0-4 0v9a4 4 0 1 0 4 0z"/>'),
  feather: svgIcon('<path d="M20 4C12 4 8 9 8 16v3h3c7 0 12-4 12-12"/><path d="M8 19l-4 1 1-4"/>'),
};

export async function writeArticle(
  brief: ArticleBrief,
  keyword: string,
  voiceProfile: Record<string, any>,
  branding?: Partial<ArticleBranding>
): Promise<WrittenArticle> {
  const c = client();
  const lang = voiceProfile.content_language || "francais";
  const persona = voiceProfile.mascot || voiceProfile.author_name;
  const b: ArticleBranding = { ...DEFAULT_ARTICLE_BRANDING, ...(branding || {}) };
  const extraBans = [
    ...expandAntiAiPatterns(voiceProfile.anti_ai_patterns),
    voiceProfile.anti_ai_custom,
  ].filter(Boolean).join(", ");
  const sys = `Tu es un redacteur SEO expert${persona ? ` qui ecrit sous la plume de ${persona}` : ""}. Tu ecris en ${lang}. ${STYLE_RULES}${
    extraBans ? `\nFormules supplementaires a bannir absolument: ${extraBans}.` : ""
  }${voiceProfile.bonus_instructions ? `\nInstructions specifiques: ${voiceProfile.bonus_instructions}` : ""}`;

  // Composants de marque a reutiliser VERBATIM (couleurs deja injectees).
  const tplKeyPoints = `<div style="background:${b.cardBg};border-left:4px solid ${b.accent};padding:18px 22px;border-radius:10px;margin:26px 0;"><p style="margin:0 0 10px;display:flex;align-items:center;gap:8px;font-weight:700;color:${b.accentDark};font-size:15px;"><span style="color:${b.accent}">${ICON_LIB.star}</span> Key points at a glance</p><ul style="margin:0;padding-left:20px;color:${b.textDark};line-height:1.7;"><li>POINT</li></ul></div>`;
  const tplEssRow = `<div style="display:flex;align-items:center;gap:14px;background:#ffffff;border:1px solid ${b.border};border-radius:12px;padding:14px 18px;"><span style="color:${b.accent}">${ICON_LIB.check}</span><span style="color:${b.textDark};font-weight:500;font-size:15px;">BENEFIT</span></div>`;
  const tplEssentials = `<div style="background:${b.cardBg};border:1px solid ${b.border};border-radius:16px;padding:14px;margin:30px 0;"><p style="text-align:center;font-weight:700;color:${b.accentDark};font-size:18px;margin:8px 0 14px;">TITLE</p><div style="display:flex;flex-direction:column;gap:8px;">${tplEssRow}</div></div>`;
  const tplDidYouKnow = `<div style="background:#eff6ff;border-left:4px solid #3b82f6;padding:18px 22px;border-radius:10px;margin:26px 0;"><p style="margin:0 0 8px;display:flex;align-items:center;gap:8px;font-weight:700;color:#1e40af;font-size:15px;"><span style="color:#3b82f6">${ICON_LIB.bulb}</span> Did you know?</p><p style="margin:0;color:#1e3a8a;line-height:1.6;">FACT</p></div>`;
  const tplFigure = `<figure style="margin:30px 0;"><img data-gen="DESCRIPTION_IMAGE_ANGLAIS_SANS_TEXTE" alt="ALT" style="width:100%;height:auto;border-radius:14px;display:block;background:#f1efe9;"><figcaption style="text-align:center;color:${b.textMuted};font-size:13px;margin-top:10px;font-style:italic;line-height:1.4;">LEGENDE</figcaption></figure>`;
  const iconNames = Object.keys(ICON_LIB).filter((k) => k !== "star" && k !== "bulb").join(", ");

  const prompt = `Redige un article de blog premium, immersif et optimise SEO. Objectif: que le lecteur ait du plaisir a lire (rythme, visuels, encadres), pas juste un mur de texte.

Titre: ${brief.title}
Mot-cle principal: ${keyword}
Mots-cles secondaires: ${brief.secondary_keywords.join(", ")}
Plan indicatif (H2): ${brief.outline.join(" | ")}
Longueur cible: ~${brief.target_words} mots.
Ton: ${voiceProfile.tone_description || "expert, accessible, concret"}${voiceProfile.example_phrases ? `\nExemples de phrases dans le ton: ${voiceProfile.example_phrases}` : ""}

REGLES DE STRUCTURE (a respecter dans l'ordre):
1. Pas de <h1>, pas de table des matieres, pas de date (geres a part).
2. Ouverture: 2 paragraphes courts qui accrochent des la 1ere phrase (pas de cliche).
3. Juste apres, UN encadre "Key points at a glance" (4 a 6 puces resumant l'article).
4. Ensuite UN encadre "essentials" (titre + 3 a 5 lignes a icone) qui met en avant les benefices/points cles pour le lecteur.
5. Puis le corps: alterne <h2> + 2 a 3 paragraphes AERES (2 a 4 phrases chacun), <h3> et <ul><li> quand utile.
6. Insere 3 a 4 visuels <figure> a des moments naturels (pas deux a la suite), chacun avec une description d'image precise et une legende.
7. Insere 1 a 2 encadres "Did you know?" avec un fait reellement interessant et verifiable.
8. Termine par une section pratique et actionnable (jamais "en conclusion").
9. Paragraphes courts, scannables. <strong> sur les idees cles.

COMPOSANTS A REUTILISER EXACTEMENT (copie le HTML tel quel, ne change QUE le texte; garde les couleurs et le style inline):

[KEY POINTS] (une seule fois, repete <li>POINT</li> pour chaque puce):
${tplKeyPoints}

[ESSENTIALS] (une seule fois; repete le bloc de ligne pour chaque benefice; remplace TITLE et BENEFIT; tu peux changer l'icone par une de cette liste: ${iconNames}):
${tplEssentials}
Bibliotheque d'icones (colle l'une d'elles a la place du svg "check" selon le sens):
- droplet (humidite): ${ICON_LIB.droplet}
- shield (protection/durabilite): ${ICON_LIB.shield}
- clock (longevite): ${ICON_LIB.clock}
- leaf (matiere naturelle): ${ICON_LIB.leaf}
- thermometer (temperature): ${ICON_LIB.thermometer}
- feather (confort/legerete): ${ICON_LIB.feather}
- check (general): ${ICON_LIB.check}

[FIGURE] (3 a 4 fois; data-gen = description visuelle en anglais, concrete, sans aucun texte dans l'image; legende courte et utile):
${tplFigure}

[DID YOU KNOW] (1 a 2 fois):
${tplDidYouKnow}

Reponds UNIQUEMENT en JSON:
{ "body_html": "<le HTML complet de l'article avec les encadres, figures et callouts>", "excerpt": "resume de 2 phrases < 200 caracteres" }`;

  const msg = await c.messages.create({
    model: SONNET,
    max_tokens: 16000,
    system: sys,
    messages: [{ role: "user", content: prompt }],
  });
  const text = msg.content.map((bk) => (bk.type === "text" ? bk.text : "")).join("");
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

// Gap de contenu vs concurrents : a partir des sujets concurrents + articles existants,
// propose des idees d'articles pertinentes pour la niche (deduplique, priorise).
export async function competitorGapKeywords(opts: {
  niche: string;
  lang: string;
  count: number;
  existingTitles: string[];
  competitorTopics: string[];
}): Promise<{ keyword: string; brief: string; priority: number }[]> {
  const c = client();
  const msg = await c.messages.create({
    model: HAIKU,
    max_tokens: 6000,
    system: `Tu es un strategiste de contenu SEO e-commerce. ${STYLE_RULES}`,
    messages: [
      {
        role: "user",
        content: `Marque / niche: "${opts.niche}".
Langue de sortie des mots-cles: ${opts.lang}.

Articles DEJA publies par la marque (a NE PAS reproposer, evite les doublons proches):
${opts.existingTitles.map((t) => "- " + t).join("\n") || "(aucun)"}

Sujets d'articles trouves chez les concurrents:
${opts.competitorTopics.map((t) => "- " + t).join("\n")}

Tache: propose ${opts.count} idees d'articles de blog a forte valeur pour CETTE marque, inspirees des sujets concurrents mais UNIQUEMENT ceux pertinents pour sa niche. Exclus tout sujet hors-niche (un sujet qui releve du metier d'un concurrent mais pas du produit de cette marque) et tout doublon avec les articles deja publies. Priorise l'intent commercial et informationnel fort. priority de 1 (faible) a 10 (fort).

Reponds UNIQUEMENT en JSON:
{ "ideas": [ { "keyword": "mot-cle en ${opts.lang}", "brief": "angle + intention + audience en 1 phrase", "priority": 7 } ] }`,
      },
    ],
  });
  const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  const out = extractJson(text);
  const ideas = Array.isArray(out.ideas) ? out.ideas : [];
  return ideas
    .map((i: any) => ({
      keyword: stripEmDashes(String(i.keyword || "")).slice(0, 200),
      brief: stripEmDashes(String(i.brief || "")).slice(0, 2000),
      priority: Math.max(0, Math.min(10, Math.round(Number(i.priority) || 5))),
    }))
    .filter((i: { keyword: string }) => i.keyword.length > 2)
    .slice(0, opts.count);
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
