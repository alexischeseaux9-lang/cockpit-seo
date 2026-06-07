import Anthropic from "@anthropic-ai/sdk";
import { logAnthropicUsage } from "../ai-usage";

const HAIKU = "claude-haiku-4-5";

export type SidebarIcons = {
  lead_magnet_svg: string;
  bestsellers_svg: string;
  top_categories_svg: string;
  top_articles_svg: string;
  author_svg: string;
};

// Jeu d'icones neutres (fallback si Claude rate). Monoline 24x24 stroke=currentColor.
export const NEUTRAL_ICONS: SidebarIcons = {
  lead_magnet_svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="8" width="18" height="13" rx="2"/><path d="M12 8v13M3 12h18M12 8a3 3 0 1 0-3-3"/></svg>`,
  bestsellers_svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2l3 6 6 .9-4.5 4.3L18 20l-6-3-6 3 1.5-6.8L3 8.9 9 8z"/></svg>`,
  top_categories_svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 7h18M3 12h18M3 17h18"/></svg>`,
  top_articles_svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 4h12a2 2 0 0 1 2 2v14l-4-3H4z"/></svg>`,
  author_svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>`,
};

export async function generateSidebarIcons(voiceProfile: Record<string, any>): Promise<SidebarIcons> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NEUTRAL_ICONS;
  const persona = voiceProfile?.mascot || voiceProfile?.author_name || "marque generique";
  try {
    const c = new Anthropic({ apiKey });
    const msg = await c.messages.create({
      model: HAIKU,
      max_tokens: 1500,
      system: "Tu generes des icones SVG monoline. Chaque SVG: viewBox 24x24, fill none, stroke currentColor, stroke-width 1.5, width/height 20. Pas d'emoji, pas de texte.",
      messages: [
        {
          role: "user",
          content: `Persona de la marque: ${persona}. Genere 5 icones coherentes avec cette persona. Reponds UNIQUEMENT en JSON:
{ "lead_magnet_svg": "<svg...>", "bestsellers_svg": "<svg...>", "top_categories_svg": "<svg...>", "top_articles_svg": "<svg...>", "author_svg": "<svg...>" }`,
        },
      ],
    });
    await logAnthropicUsage({ model: HAIKU, usage: (msg as any).usage, context: "scro_icons" });
    const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    const parsed = JSON.parse(text.slice(start, end + 1));
    const out: SidebarIcons = { ...NEUTRAL_ICONS };
    for (const k of Object.keys(out) as (keyof SidebarIcons)[]) {
      if (typeof parsed[k] === "string" && parsed[k].includes("<svg")) out[k] = parsed[k];
    }
    return out;
  } catch {
    return NEUTRAL_ICONS;
  }
}
