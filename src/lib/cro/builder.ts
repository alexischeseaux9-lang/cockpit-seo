// Builder des blocs CRO injectes dans le theme Shopify (sections/main-article.liquid).
// Tout est encadre par des markers pour permettre un re-push propre et un rollback.

export const SCRO_START_MARKER = "<!-- YAVOK_SCRO_START -->";
export const SCRO_END_MARKER = "<!-- YAVOK_SCRO_END -->";

export type Branding = {
  accent: string;
  accentDark: string;
  cardBg: string;
  textDark: string;
  textMuted: string;
  border: string;
  ratingColor: string;
};

export type Block = {
  position: number | "end";
  kind: "product" | "collection";
  handle: string;
  label: string;
  cta: string;
  override_title?: string;
  image_url?: string;
};

export type SidebarConfig = {
  lead_magnet: { enabled: boolean; title: string; subtitle: string; perks: string[]; cta_text: string; cta_url: string; promo_code?: string; image_url?: string };
  bestsellers: { enabled: boolean; auto: boolean; manual_handles: string[]; title: string };
  top_categories: { enabled: boolean; auto: boolean; manual_handles: string[]; title: string };
  top_articles: { enabled: boolean; auto: boolean; manual_handles: string[]; title: string };
  author: { enabled: boolean; name: string; role: string; bio: string; image_url?: string; trust_badges: string[] };
};

export function defaultBranding(voice: Record<string, any>): Branding {
  const accent = voice?.branding_accent_hex || "#10b981";
  return {
    accent,
    accentDark: "#0b7a5a",
    cardBg: "#ffffff",
    textDark: "#18181b",
    textMuted: "#6b7280",
    border: "#e5e7eb",
    ratingColor: "#f59e0b",
  };
}

function esc(s: string): string {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function card(b: Block, br: Branding): string {
  const href = b.kind === "product" ? `/products/${b.handle}` : `/collections/${b.handle}`;
  const img = b.image_url
    ? `<img src="${esc(b.image_url)}" alt="${esc(b.override_title || b.handle)}" style="width:100%;height:160px;object-fit:cover;border-radius:8px 8px 0 0">`
    : "";
  return `<div style="border:1px solid ${br.border};border-radius:10px;background:${br.cardBg};overflow:hidden;max-width:420px;margin:24px auto">
  ${img}
  <div style="padding:14px 16px">
    <div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:${br.accent};font-weight:600">${esc(b.label)}</div>
    <div style="font-size:16px;font-weight:600;color:${br.textDark};margin:4px 0 10px">${esc(b.override_title || b.handle)}</div>
    <a href="${href}" style="display:inline-block;background:${br.accent};color:#fff;padding:9px 16px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">${esc(b.cta)}</a>
  </div>
</div>`;
}

function sidebar(cfg: SidebarConfig, br: Branding, persona: { name: string; role: string; bio: string }, icons: Record<string, string>): string {
  const parts: string[] = [];
  if (cfg.lead_magnet?.enabled) {
    parts.push(`<div style="border:1px solid ${br.border};border-radius:10px;padding:16px;margin-bottom:16px;background:${br.cardBg}">
      <div style="display:flex;align-items:center;gap:8px;color:${br.accent}">${icons.lead_magnet_svg || ""}<strong style="color:${br.textDark}">${esc(cfg.lead_magnet.title)}</strong></div>
      <p style="color:${br.textMuted};font-size:13px;margin:8px 0">${esc(cfg.lead_magnet.subtitle)}</p>
      ${(cfg.lead_magnet.perks || []).map((p) => `<div style="font-size:13px;color:${br.textDark}">${esc(p)}</div>`).join("")}
      ${cfg.lead_magnet.promo_code ? `<div style="margin-top:8px;font-weight:700;color:${br.accentDark}">${esc(cfg.lead_magnet.promo_code)}</div>` : ""}
      <a href="${esc(cfg.lead_magnet.cta_url || "#")}" style="display:inline-block;margin-top:10px;background:${br.accent};color:#fff;padding:8px 14px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600">${esc(cfg.lead_magnet.cta_text)}</a>
    </div>`);
  }
  const list = (title: string, handles: string[], base: string, icon: string) => {
    if (!handles?.length) return "";
    return `<div style="border:1px solid ${br.border};border-radius:10px;padding:16px;margin-bottom:16px;background:${br.cardBg}">
      <div style="display:flex;align-items:center;gap:8px;color:${br.accent};margin-bottom:8px">${icon}<strong style="color:${br.textDark}">${esc(title)}</strong></div>
      ${handles.slice(0, 3).map((h) => `<a href="${base}/${esc(h)}" style="display:block;font-size:13px;color:${br.textDark};text-decoration:none;padding:3px 0">${esc(h)}</a>`).join("")}
    </div>`;
  };
  if (cfg.bestsellers?.enabled) parts.push(list(cfg.bestsellers.title, cfg.bestsellers.manual_handles, "/products", icons.bestsellers_svg || ""));
  if (cfg.top_categories?.enabled) parts.push(list(cfg.top_categories.title, cfg.top_categories.manual_handles, "/collections", icons.top_categories_svg || ""));
  if (cfg.top_articles?.enabled) parts.push(list(cfg.top_articles.title, cfg.top_articles.manual_handles, "/blogs/news", icons.top_articles_svg || ""));
  if (cfg.author?.enabled) {
    const name = cfg.author.name || persona.name;
    parts.push(`<div style="border:1px solid ${br.border};border-radius:10px;padding:16px;background:${br.cardBg}">
      <div style="display:flex;align-items:center;gap:10px">
        ${cfg.author.image_url ? `<img src="${esc(cfg.author.image_url)}" alt="${esc(name)}" style="width:48px;height:48px;border-radius:50%;object-fit:cover">` : (icons.author_svg || "")}
        <div><strong style="color:${br.textDark}">${esc(name)}</strong><div style="font-size:12px;color:${br.textMuted}">${esc(cfg.author.role || persona.role)}</div></div>
      </div>
      <p style="font-size:13px;color:${br.textMuted};margin:8px 0 0">${esc(cfg.author.bio || persona.bio)}</p>
      ${(cfg.author.trust_badges || []).map((t) => `<div style="font-size:12px;color:${br.textDark}">${esc(t)}</div>`).join("")}
    </div>`);
  }
  if (!parts.length) return "";
  return `<aside style="max-width:340px;margin:32px auto">${parts.join("")}</aside>`;
}

export function buildScroLiquid(opts: {
  inlineEnabled: boolean;
  sidebarEnabled: boolean;
  blocks: Block[];
  sidebarCfg: SidebarConfig | null;
  branding: Branding;
  persona: { name: string; role: string; bio: string };
  icons: Record<string, string>;
}): string {
  const sections: string[] = [];
  if (opts.inlineEnabled && opts.blocks?.length) {
    sections.push(`<div class="yavok-scro-inline">${opts.blocks.map((b) => card(b, opts.branding)).join("\n")}</div>`);
  }
  if (opts.sidebarEnabled && opts.sidebarCfg) {
    sections.push(sidebar(opts.sidebarCfg, opts.branding, opts.persona, opts.icons));
  }
  if (!sections.length) return "";
  return `${SCRO_START_MARKER}\n<div class="yavok-scro">\n${sections.join("\n")}\n</div>\n${SCRO_END_MARKER}`;
}

// Retire tout bloc SCRO existant entre les markers (idempotence du push).
export function cleanScroFromAsset(asset: string): string {
  const start = asset.indexOf(SCRO_START_MARKER);
  const end = asset.indexOf(SCRO_END_MARKER);
  if (start === -1 || end === -1 || end < start) return asset;
  const before = asset.slice(0, start);
  const after = asset.slice(end + SCRO_END_MARKER.length);
  return (before + after).replace(/\n{3,}/g, "\n\n");
}

export function injectScro(asset: string, scroLiquid: string): string {
  const cleaned = cleanScroFromAsset(asset);
  if (!scroLiquid) return cleaned;
  return `${cleaned}\n${scroLiquid}\n`;
}
