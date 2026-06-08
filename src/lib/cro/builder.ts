// Builder des blocs CRO injectes dans le theme Shopify (sections/main-article.liquid).
// Approche : un <style> + <script> places entre markers. Le script reconstruit la mise
// en page de l'article (style Yavok/buddhive) : breadcrumb propre, meta date + temps de
// lecture, layout 2 colonnes (contenu + sidebar qui defile), cartes produit variees aux
// positions etalees, recommandations produit en fin d'article et trust badges. Le CSS
// stylise aussi les tables et la FAQ accordeon generees dans le corps par le writer.
// Donnees (images, prix) bakees au moment du push.

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

// Donnees resolues (handles -> produits/collections/articles reels) passees par le push.
export type InlineItem = {
  kind: "product" | "collection";
  position: number | "end";
  label: string;
  cta: string;
  title: string;
  url: string;
  image: string | null;
  price?: string | null;
  compareAt?: string | null;
  icon?: "trophy" | "flame" | "star" | "heart";
};
export type MiniProduct = { title: string; url: string; image: string | null; price?: string | null; compareAt?: string | null };
export type MiniLink = { title: string; url: string; image?: string | null; count?: number };
export type SidebarResolved = {
  lead_magnet?: SidebarConfig["lead_magnet"] | null;
  bestsellers?: { enabled: boolean; title: string; items: MiniProduct[] } | null;
  categories?: { enabled: boolean; title: string; items: MiniLink[] } | null;
  articles?: { enabled: boolean; title: string; items: MiniLink[] } | null;
  author?: SidebarConfig["author"] | null;
};

// Recommandations en fin d'article (produits du site, style grille shoppy).
export type RecoItem = {
  kind: "product" | "article" | "collection";
  title: string;
  url: string;
  image: string | null;
  price?: string | null;
  compareAt?: string | null;
};
export type RecoResolved = { enabled: boolean; title: string; items: RecoItem[] } | null;

export type TrustBadge = { title: string; subtitle: string; icon: "shield" | "truck" | "lock" | "help" };

// Palette de marque. Pilotee par voice_profile.branding (objet complet, editable
// dans l'onglet SCRO). Fallback sur branding_accent_hex puis sur des valeurs neutres.
export function defaultBranding(voice: Record<string, any>): Branding {
  const b = voice?.branding && typeof voice.branding === "object" ? voice.branding : {};
  return {
    accent: b.accent || voice?.branding_accent_hex || "#10b981",
    accentDark: b.accentDark || "#0b7a5a",
    cardBg: b.cardBg || "#ffffff",
    textDark: b.textDark || "#18181b",
    textMuted: b.textMuted || "#6b7280",
    border: b.border || "#e5e7eb",
    ratingColor: b.ratingColor || "#f59e0b",
  };
}

function esc(s: string): string {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const CURRENCY_SYMBOLS: Record<string, string> = { USD: "$", CAD: "$", AUD: "$", NZD: "$", EUR: "€", GBP: "£", CHF: "CHF ", JPY: "¥", SEK: "kr ", NOK: "kr ", DKK: "kr " };
export function currencySymbol(code: string): string {
  return CURRENCY_SYMBOLS[code] || code + " ";
}
function money(v: string | null | undefined, sym: string): string {
  if (!v) return "";
  const n = parseFloat(String(v));
  if (!isFinite(n)) return "";
  return sym + (Number.isInteger(n) ? n.toFixed(0) : n.toFixed(2));
}
function discountPct(price?: string | null, compareAt?: string | null): number {
  const p = parseFloat(String(price || ""));
  const c = parseFloat(String(compareAt || ""));
  if (!isFinite(p) || !isFinite(c) || c <= p || c <= 0) return 0;
  return Math.round((1 - p / c) * 100);
}
function sizedImg(src: string | null, w = 440): string {
  if (!src) return "";
  if (src.includes("cdn.shopify.com") || src.includes("/cdn/shop/")) return src + (src.includes("?") ? "&" : "?") + "width=" + w;
  return src;
}

const STARS = "★★★★★";

// Icones inline (stroke = currentColor) pour les en-tetes de la sidebar et la meta.
const SB_ICONS = {
  gift: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M5 12v9h14v-9"/><path d="M12 8S10 3 7.5 3a2.5 2.5 0 0 0 0 5H12zM12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5H12z"/></svg>',
  award: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="9" r="6"/><path d="M9 14l-1.5 7L12 18l4.5 3L15 14"/></svg>',
  grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>',
  book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
};
// Icones de label des cartes inline (variete des blocs produit dans le contenu).
const INLINE_ICONS: Record<string, string> = {
  trophy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h12v3a6 6 0 0 1-12 0V4z"/><path d="M6 6H4a2 2 0 0 0 0 4h2M18 6h2a2 2 0 0 1 0 4h-2M9 17h6M10 21h4M12 17v4"/></svg>',
  flame: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2c1.2 3.6 4 5 4 8.5a4 4 0 0 1-8 0c0-1.2.5-2.2 1.2-3C9 9 9 6.5 12 2z"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.3 6.9.7-5.1 4.6 1.4 6.8L12 17.8 5.9 20.4l1.4-6.8L2.2 9l6.9-.7L12 2z"/></svg>',
  heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 7.6a4.8 4.8 0 0 0-8.8-2.2A4.8 4.8 0 0 0 3.2 7.6c0 4.2 5.5 7.9 8.8 10.4 3.3-2.5 8.8-6.2 8.8-10.4z"/></svg>',
};
// Icones meta (date + temps de lecture), injectees brutes dans le script.
const ICON_CAL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>';
const ICON_CLK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
// Icones des trust badges (fin d'article).
const TB_ICONS: Record<string, string> = {
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z"/><path d="M9 12l2 2 4-4"/></svg>',
  truck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h11v9H3zM14 9h4l3 3v3h-7z"/><circle cx="7" cy="18" r="1.8"/><circle cx="17.5" cy="18" r="1.8"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/></svg>',
  help: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1 .8-1 1.7M12 17h.01"/></svg>',
};

const DEFAULT_TRUST: TrustBadge[] = [
  { title: "Authenticity Guaranteed", subtitle: "Premium work socks, built to last.", icon: "shield" },
  { title: "Fast Delivery", subtitle: "Quick, tracked shipping on every order.", icon: "truck" },
  { title: "Secure Payment", subtitle: "100% encrypted, safe checkout.", icon: "lock" },
  { title: "Customer Service", subtitle: "A real team, ready to help.", icon: "help" },
];

// ---- CSS (scope .yv-*, couleurs interpolees depuis la palette) ----
function styleBlock(br: Branding): string {
  return `<style>
.yv-card{display:flex;gap:18px;align-items:center;border:1px solid ${br.border};border-radius:16px;background:${br.cardBg};padding:18px;max-width:680px;margin:30px auto;box-shadow:0 2px 8px rgba(0,0,0,.06);font-family:inherit}
.yv-card .yv-img{flex:0 0 150px}
.yv-card .yv-img img{width:150px;height:150px;object-fit:cover;border-radius:12px;display:block}
.yv-card .yv-bd{flex:1;min-width:0}
.yv-card .yv-lbl{display:flex;align-items:center;gap:6px;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${br.accent}}
.yv-card .yv-lbl svg{width:14px;height:14px;flex:0 0 auto}
.yv-card .yv-ttl{font-size:15px;font-weight:600;color:${br.textDark};margin:3px 0;line-height:1.3}
.yv-card .yv-st{font-size:12px;color:${br.ratingColor};letter-spacing:1px}
.yv-card .yv-st span{color:${br.textMuted};margin-left:5px;letter-spacing:0}
.yv-card .yv-pr{display:flex;align-items:center;gap:8px;margin:6px 0 10px}
.yv-card .yv-pr b{font-size:16px;color:${br.textDark}}
.yv-card .yv-pr s{font-size:13px;color:${br.textMuted}}
.yv-card .yv-bdg{font-size:11px;font-weight:700;color:#fff;background:${br.accent};border-radius:6px;padding:2px 7px}
.yv-card .yv-cta{display:inline-block;background:${br.accent};color:#fff;padding:9px 18px;border-radius:9px;text-decoration:none;font-size:14px;font-weight:600}
.yv-card .yv-cta:hover{background:${br.accentDark}}
.blog-contents{display:none!important}
/* Layout 2 colonnes : englobe tout l'article (image + titre + contenu) a gauche, sidebar a droite. */
.yv-layout{display:flex;gap:40px;align-items:flex-start;max-width:1160px;margin:0 auto;width:100%;padding:0 24px;box-sizing:border-box}
.yv-layout > .yv-content{flex:1 1 auto;min-width:0;max-width:760px}
.yv-content .page-width{max-width:none!important;padding-left:0!important;padding-right:0!important;margin-left:0!important;margin-right:0!important;width:100%!important}
.yv-content .article-block-padding{padding-left:0!important;padding-right:0!important}
.yv-content .article-header__container{display:block!important}
.yv-content .article-template__title{text-align:left;max-width:100%;margin-top:0}
.yv-content .article-template__excerpt{text-align:left}
.yv-content .article-template__hero-adapt{border-radius:16px;overflow:hidden}
.yv-content .article-template__content-container{border-top:1px solid ${br.border};padding-top:26px!important;margin-top:4px}
.article-template__content img{max-width:100%;height:auto}
.article-template__content figure{margin:30px 0}
.article-template__content figure img{border-radius:14px}
/* Tables generees dans le corps (responsive : scroll horizontal sur mobile). */
.article-template__content table{width:100%;border-collapse:collapse;font-size:15px;margin:6px 0}
.article-template__content th{text-align:left;padding:12px 14px;font-weight:700;color:${br.textDark};background:#faf9f7;border-bottom:2px solid ${br.border}}
.article-template__content td{padding:12px 14px;color:${br.textMuted};border-bottom:1px solid ${br.border};vertical-align:top}
/* FAQ accordeon (details/summary) generee dans le corps. */
.article-template__content .yv-faq{margin:34px 0}
.yv-faq-item{border:1px solid ${br.border};border-radius:12px;margin-bottom:12px;background:${br.cardBg};overflow:hidden}
.yv-faq-item summary{list-style:none;cursor:pointer;padding:16px 18px;font-weight:600;color:${br.textDark};font-size:16px;display:flex;justify-content:space-between;align-items:center;gap:14px}
.yv-faq-item summary::-webkit-details-marker{display:none}
.yv-faq-item summary::after{content:"+";font-size:22px;font-weight:400;color:${br.accent};line-height:1;transition:transform .2s;flex:0 0 auto}
.yv-faq-item[open] summary::after{transform:rotate(45deg)}
.yv-faq-item .yv-faq-a,.yv-faq-item summary + div{padding:0 18px 16px;color:${br.textMuted};line-height:1.65;font-size:15px}
/* La sidebar defile avec l'article (pas de sticky). */
.yv-aside{flex:0 0 320px;width:320px;align-self:flex-start;margin:0;font-family:inherit}
.yv-lead-img{width:100%;height:160px;object-fit:cover;border-radius:10px;display:block;margin-bottom:14px}
.yv-box{border:1px solid ${br.border};border-radius:14px;background:${br.cardBg};padding:16px;margin-bottom:16px}
.yv-box h4{display:flex;align-items:center;gap:8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:${br.accent};margin:0 0 12px}
.yv-box h4 svg{width:16px;height:16px;flex:0 0 auto}
.yv-mini{display:flex;gap:10px;align-items:center;padding:8px 0;text-decoration:none;border-top:1px solid ${br.border}}
.yv-mini:first-of-type{border-top:0}
.yv-mini img{width:46px;height:46px;object-fit:cover;border-radius:8px;flex:0 0 46px}
.yv-mini .m-t{font-size:13px;color:${br.textDark};line-height:1.25;font-weight:500;flex:1;min-width:0}
.yv-mini .m-p{font-size:12px;font-weight:700;color:${br.accent}}
.yv-mini .m-ct{font-size:12px;color:${br.textMuted};white-space:nowrap}
.yv-seeall{display:inline-block;margin-top:10px;font-size:12px;font-weight:600;color:${br.accent};text-decoration:none}
.yv-lead p{margin:0 0 10px;font-size:13px;color:${br.textMuted}}
.yv-lead .perk{display:flex;align-items:center;gap:8px;font-size:13px;color:${br.textDark};padding:3px 0}
.yv-lead .perk svg{width:16px;height:16px;color:${br.accent};flex:0 0 auto}
.yv-lead .promo{margin:10px 0;font-weight:700;color:${br.accentDark};letter-spacing:.04em}
.yv-form{margin-top:12px}
.yv-form input[type=email]{width:100%;box-sizing:border-box;border:1px solid ${br.border};border-radius:9px;padding:10px 12px;font-size:13px;margin-bottom:8px;background:#fff;color:${br.textDark}}
.yv-fbtn{display:block;width:100%;box-sizing:border-box;background:${br.accent};color:#fff;border:0;padding:10px 16px;border-radius:9px;font-size:13px;font-weight:700;cursor:pointer;text-align:center}
.yv-fbtn:hover{background:${br.accentDark}}
.yv-auth .row{display:flex;align-items:center;gap:12px}
.yv-auth .av{width:48px;height:48px;border-radius:50%;object-fit:cover;flex:0 0 48px}
.yv-auth .avi{width:48px;height:48px;border-radius:50%;flex:0 0 48px;display:flex;align-items:center;justify-content:center;background:${br.accent};color:#fff;font-weight:700;font-size:16px}
.yv-auth .nm{font-weight:700;color:${br.textDark};font-size:14px}
.yv-auth .rl{font-size:12px;color:${br.textMuted}}
.yv-auth .bio{font-size:13px;color:${br.textMuted};margin:10px 0 0;line-height:1.55}
.yv-auth .badge{display:flex;align-items:center;gap:8px;font-size:12px;color:${br.textDark};padding:3px 0}
.yv-auth .badge svg{width:14px;height:14px;color:${br.accent};flex:0 0 auto}
/* Breadcrumb refait : aligne a gauche, discret, format Home / Blog / Titre. */
.yv-breadcrumb{max-width:1160px;margin:0 auto;padding:0 24px;display:flex;flex-wrap:wrap;gap:9px;align-items:center;font-size:13px;line-height:1.5;color:${br.textMuted};box-sizing:border-box;text-align:left}
.yv-breadcrumb a{color:${br.textMuted};text-decoration:none}
.yv-breadcrumb a:hover{color:${br.accent}}
.yv-breadcrumb .yv-bcs{color:${br.border}}
.yv-breadcrumb .yv-bcc{color:${br.textDark};font-weight:500}
/* Meta sous le titre : date + temps de lecture, avec icones. */
.yv-meta{display:flex;flex-wrap:wrap;gap:20px;align-items:center;margin:16px 0 2px;color:${br.textMuted};font-size:13px}
.yv-meta .yv-mi{display:inline-flex;align-items:center;gap:7px}
.yv-meta svg{width:15px;height:15px;color:${br.accent};flex:0 0 auto}
/* Recommandations produit en fin d'article. */
.yv-reco{max-width:1160px;margin:48px auto 8px;padding:0 24px;box-sizing:border-box}
.yv-reco h3{font-size:21px;font-weight:700;color:${br.textDark};margin:0 0 18px}
.yv-reco-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:22px}
.yv-rc{display:flex;flex-direction:column;text-decoration:none;border:1px solid ${br.border};border-radius:16px;overflow:hidden;background:${br.cardBg};transition:box-shadow .15s,transform .15s}
.yv-rc:hover{box-shadow:0 8px 24px rgba(0,0,0,.09);transform:translateY(-2px)}
.yv-rc-img{aspect-ratio:1/1;background:#f2f1ee;overflow:hidden}
.yv-rc-img img{width:100%;height:100%;object-fit:cover;display:block}
.yv-rc-bd{padding:14px 15px 16px}
.yv-rc-st{color:${br.ratingColor};font-size:12px;letter-spacing:1px;margin-bottom:4px}
.yv-rc-ttl{font-size:14px;font-weight:600;color:${br.textDark};line-height:1.35}
.yv-rc-pr{margin-top:9px;font-size:15px;font-weight:700;color:${br.textDark}}
.yv-rc-pr s{font-weight:400;color:${br.textMuted};font-size:12px;margin-left:6px}
.yv-rc-bdg{font-size:10px;font-weight:700;color:#fff;background:${br.accent};border-radius:5px;padding:1px 6px;margin-left:6px;vertical-align:1px}
.yv-rc-cta{display:inline-block;margin-top:10px;font-size:12px;font-weight:600;color:${br.accent}}
/* Trust badges (fin d'article). */
.yv-trust{max-width:1160px;margin:10px auto 0;padding:0 24px 8px;box-sizing:border-box}
.yv-trust-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:24px;border-top:1px solid ${br.border};padding-top:32px}
.yv-tb{text-align:center}
.yv-tb-ic{color:${br.accent};margin:0 auto 10px}
.yv-tb-ic svg{width:38px;height:38px}
.yv-tb h5{margin:0 0 5px;font-size:15px;font-weight:700;color:${br.textDark}}
.yv-tb p{margin:0;font-size:13px;color:${br.textMuted};line-height:1.5}
/* Mobile : lecture ultra confortable, cartes empilees, grilles compactes. */
@media(max-width:900px){
  .yv-layout{display:block;max-width:760px;padding:0 18px}
  .yv-aside{width:auto;margin:30px auto 0}
  .yv-breadcrumb,.yv-reco,.yv-trust{padding-left:18px;padding-right:18px}
  .yv-card{flex-direction:column;align-items:stretch;gap:12px;padding:16px;margin:26px auto}
  .yv-card .yv-img{flex:0 0 auto}
  .yv-card .yv-img img{width:100%;height:auto;max-height:260px;border-radius:12px}
  .yv-card .yv-cta{text-align:center}
  .yv-reco-grid{grid-template-columns:repeat(2,1fr);gap:14px}
  .yv-trust-grid{grid-template-columns:repeat(2,1fr);gap:26px 18px}
  .article-template__content p{font-size:16.5px!important;line-height:1.72!important;margin-bottom:1.05em!important}
  .article-template__content li{line-height:1.65}
  .article-template__content figure{margin:22px 0!important}
}
@media(max-width:480px){
  .yv-reco-grid{grid-template-columns:1fr}
}
</style>`;
}

function inlineCardHtml(it: InlineItem, sym: string): string {
  const img = sizedImg(it.image);
  const pct = discountPct(it.price, it.compareAt);
  const ico = it.icon && INLINE_ICONS[it.icon] ? INLINE_ICONS[it.icon] : "";
  const priceRow =
    it.kind === "product" && it.price
      ? `<div class="yv-pr"><b>${esc(money(it.price, sym))}</b>${it.compareAt && pct > 0 ? `<s>${esc(money(it.compareAt, sym))}</s><span class="yv-bdg">-${pct}%</span>` : ""}</div>`
      : "";
  const stars = it.kind === "product" ? `<div class="yv-st">${STARS} <span>Customer Reviews</span></div>` : "";
  return `<div class="yv-card" data-cro-injected="1">
  ${img ? `<a class="yv-img" href="${esc(it.url)}"><img src="${esc(img)}" alt="${esc(it.title)}" loading="lazy" width="110" height="110"></a>` : ""}
  <div class="yv-bd">
    <div class="yv-lbl">${ico}${esc(it.label)}</div>
    <div class="yv-ttl">${esc(it.title)}</div>
    ${stars}${priceRow}
    <a class="yv-cta" href="${esc(it.url)}">${esc(it.cta)} →</a>
  </div>
</div>`;
}

function miniProduct(p: MiniProduct, sym: string): string {
  const img = sizedImg(p.image, 120);
  return `<a class="yv-mini" href="${esc(p.url)}">${img ? `<img src="${esc(img)}" alt="${esc(p.title)}" loading="lazy">` : ""}<span class="m-t">${esc(p.title)}${p.price ? `<br><span class="m-p">${esc(money(p.price, sym))}</span>` : ""}</span></a>`;
}
function miniLink(l: MiniLink): string {
  const img = sizedImg(l.image || null, 120);
  const count = typeof l.count === "number" && l.count > 0 ? `<span class="m-ct">${l.count} products</span>` : "";
  return `<a class="yv-mini" href="${esc(l.url)}">${img ? `<img src="${esc(img)}" alt="${esc(l.title)}" loading="lazy">` : ""}<span class="m-t">${esc(l.title)}</span>${count}</a>`;
}

function asideHtml(sb: SidebarResolved, sym: string): string {
  const boxes: string[] = [];
  const lm = sb.lead_magnet;
  if (lm?.enabled) {
    const form = `<form method="post" action="/contact#yv-nl" accept-charset="UTF-8" class="yv-form"><input type="hidden" name="form_type" value="customer"><input type="hidden" name="utf8" value="&#10003;"><input type="hidden" name="contact[tags]" value="newsletter, blog"><input type="email" name="contact[email]" placeholder="Your email address" required><button type="submit" class="yv-fbtn">${esc(lm.cta_text || "S'inscrire")} →</button></form>`;
    boxes.push(`<div class="yv-box yv-lead">${lm.image_url ? `<img class="yv-lead-img" src="${esc(lm.image_url)}" alt="${esc(lm.title || "Welcome gift")}" loading="lazy">` : ""}<h4>${SB_ICONS.gift} ${esc(lm.title || "Welcome gift")}</h4>${lm.subtitle ? `<p>${esc(lm.subtitle)}</p>` : ""}${(lm.perks || []).filter(Boolean).map((p) => `<div class="perk">${SB_ICONS.check} ${esc(p)}</div>`).join("")}${lm.promo_code ? `<div class="promo">${esc(lm.promo_code)}</div>` : ""}${form}</div>`);
  }
  if (sb.bestsellers?.enabled && sb.bestsellers.items.length) {
    boxes.push(`<div class="yv-box"><h4>${SB_ICONS.award} ${esc(sb.bestsellers.title || "Best sellers")}</h4>${sb.bestsellers.items.slice(0, 4).map((p) => miniProduct(p, sym)).join("")}<a class="yv-seeall" href="/collections/all">See all best sellers →</a></div>`);
  }
  if (sb.categories?.enabled && sb.categories.items.length) {
    boxes.push(`<div class="yv-box"><h4>${SB_ICONS.grid} ${esc(sb.categories.title || "Our collections")}</h4>${sb.categories.items.slice(0, 5).map(miniLink).join("")}</div>`);
  }
  if (sb.articles?.enabled && sb.articles.items.length) {
    boxes.push(`<div class="yv-box"><h4>${SB_ICONS.book} ${esc(sb.articles.title || "Read more")}</h4>${sb.articles.items.slice(0, 3).map(miniLink).join("")}</div>`);
  }
  const au = sb.author;
  if (au?.enabled && (au.name || au.bio)) {
    const initials = (au.name || "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => (w[0] || "").toUpperCase()).join("") || "A";
    const avatar = au.image_url ? `<img class="av" src="${esc(au.image_url)}" alt="${esc(au.name)}">` : `<span class="avi">${esc(initials)}</span>`;
    boxes.push(`<div class="yv-box yv-auth"><h4>${SB_ICONS.user} The author</h4><div class="row">${avatar}<span><span class="nm">${esc(au.name)}</span><br><span class="rl">${esc(au.role)}</span></span></div>${au.bio ? `<p class="bio">${esc(au.bio)}</p>` : ""}${(au.trust_badges || []).filter(Boolean).map((bg) => `<div class="badge">${SB_ICONS.check} ${esc(bg)}</div>`).join("")}</div>`);
  }
  if (!boxes.length) return "";
  return `<aside class="yv-aside" data-cro-injected="1">${boxes.join("")}</aside>`;
}

function recoCard(it: RecoItem, sym: string): string {
  const img = sizedImg(it.image, 480);
  const pct = discountPct(it.price, it.compareAt);
  const price = it.price
    ? `<div class="yv-rc-pr">${esc(money(it.price, sym))}${it.compareAt && pct > 0 ? `<s>${esc(money(it.compareAt, sym))}</s><span class="yv-rc-bdg">-${pct}%</span>` : ""}</div>`
    : "";
  return `<a class="yv-rc" href="${esc(it.url)}">${img ? `<div class="yv-rc-img"><img src="${esc(img)}" alt="${esc(it.title)}" loading="lazy"></div>` : ""}<div class="yv-rc-bd"><div class="yv-rc-st">${STARS}</div><div class="yv-rc-ttl">${esc(it.title)}</div>${price}<span class="yv-rc-cta">View product →</span></div></a>`;
}
function recoHtml(reco: RecoResolved, sym: string): string {
  if (!reco || !reco.enabled || !reco.items.length) return "";
  return `<section class="yv-reco" data-cro-injected="1"><h3>${esc(reco.title || "You may also like")}</h3><div class="yv-reco-grid">${reco.items.map((it) => recoCard(it, sym)).join("")}</div></section>`;
}

function trustHtml(badges: TrustBadge[]): string {
  if (!badges.length) return "";
  return `<section class="yv-trust" data-cro-injected="1"><div class="yv-trust-grid">${badges
    .map((b) => `<div class="yv-tb"><div class="yv-tb-ic">${TB_ICONS[b.icon] || TB_ICONS.shield}</div><h5>${esc(b.title)}</h5><p>${esc(b.subtitle)}</p></div>`)
    .join("")}</div></section>`;
}

export function buildScroLiquid(opts: {
  inlineEnabled: boolean;
  sidebarEnabled: boolean;
  inline: InlineItem[];
  sidebar: SidebarResolved;
  branding: Branding;
  currency: string;
  reco?: RecoResolved;
  trust?: TrustBadge[];
}): string {
  const sym = currencySymbol(opts.currency || "USD");
  const inlineHtml = opts.inlineEnabled ? opts.inline.filter((it) => it.title && it.url).map((it) => inlineCardHtml(it, sym)) : [];
  const pcts = opts.inlineEnabled ? opts.inline.filter((it) => it.title && it.url).map((it) => (it.position === "end" ? null : Number(it.position))) : [];
  const aside = opts.sidebarEnabled ? asideHtml(opts.sidebar, sym) : "";
  const reco = recoHtml(opts.reco || null, sym);
  const trust = trustHtml(opts.trust || DEFAULT_TRUST);
  if (!inlineHtml.length && !aside && !reco) return "";

  const script = `<script>
(function(){
  var CAL=${JSON.stringify(ICON_CAL)},CLK=${JSON.stringify(ICON_CLK)};
  function run(){
  if (document.querySelector('[data-yv-cro]')) return;
  var sels=['.article-template__content','.article-main','[itemprop="articleBody"]','.article__content','.post-content','.rte'];
  var content=null,i;
  for(i=0;i<sels.length;i++){var el0=document.querySelector(sels[i]); if(el0 && el0.querySelectorAll('p').length>=3){content=el0;break;}}
  if(!content){for(i=0;i<sels.length;i++){var e2=document.querySelector(sels[i]); if(e2){content=e2;break;}}}
  if(!content) return;
  content.setAttribute('data-yv-cro','1');
  var INLINE=${JSON.stringify(inlineHtml)};
  var PCTS=${JSON.stringify(pcts)};
  var ASIDE=${JSON.stringify(aside)};
  var RECO=${JSON.stringify(reco)};
  var TRUST=${JSON.stringify(trust)};
  function frag(html){return document.createRange().createContextualFragment(html);}
  function mkdiv(cls){var d=document.createElement('div'); d.className=cls; return d;}
  function escTxt(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

  // Temps de lecture (mots / 200) et titre, calcules sur le contenu.
  var words=(content.innerText||'').trim().split(/\\s+/).filter(Boolean).length;
  var mins=Math.max(1,Math.round(words/200));
  var titleEl=document.querySelector('.article-template__title');
  var titleTxt=titleEl?titleEl.textContent.trim():'';

  // Cartes produit inline aux positions configurees.
  var notInj=function(e){return !e.closest('[data-cro-injected]');};
  var paras=Array.prototype.slice.call(content.querySelectorAll(':scope > p, :scope > h2, :scope > h3')).filter(notInj);
  if(paras.length<3){ paras=Array.prototype.slice.call(content.querySelectorAll('p, h2, h3')).filter(notInj); }
  if(paras.length>=2 && INLINE.length){
    for(var j=INLINE.length-1;j>=0;j--){
      var pct=PCTS[j];
      if(pct==null){ var lp=paras[paras.length-1]; if(lp&&lp.parentNode) lp.parentNode.insertBefore(frag(INLINE[j]), lp.nextSibling); }
      else { var idx=Math.max(1,Math.min(paras.length-1,Math.floor(paras.length*pct))); var t=paras[idx]; if(t&&t.parentNode) t.parentNode.insertBefore(frag(INLINE[j]), t); }
    }
  }

  // Meta : date (lue dans le theme) + temps de lecture, sous le titre.
  var dateNode=document.querySelector('.article-header__date time')||document.querySelector('.article-header__date')||document.querySelector('time');
  var dateTxt=dateNode?dateNode.textContent.trim():'';
  var metaHtml='<div class="yv-meta">'
    +(dateTxt?'<span class="yv-mi">'+CAL+'<span>'+escTxt(dateTxt)+'</span></span>':'')
    +'<span class="yv-mi">'+CLK+'<span>'+mins+' min read</span></span>'
    +'</div>';
  var origDate=document.querySelector('.article-header__date-and-author');
  if(origDate&&origDate.parentNode){ origDate.parentNode.insertBefore(frag(metaHtml), origDate); origDate.style.display='none'; }
  else { var hc=document.querySelector('.article-header__content'); if(hc) hc.appendChild(frag(metaHtml)); }

  // Breadcrumb refait : Home / Blog / Titre, aligne a gauche, discret.
  var bc=document.querySelector('.article__category-nav');
  if(bc){
    var bl=bc.querySelector('a'); var bh=bl?bl.getAttribute('href'):'/blogs/news'; var bn=bl?bl.textContent.trim():'Blog';
    bc.className='yv-breadcrumb'; bc.removeAttribute('style');
    bc.innerHTML='<a href="/">Home</a><span class="yv-bcs">/</span><a href="'+bh+'">'+escTxt(bn)+'</a>'+(titleTxt?'<span class="yv-bcs">/</span><span class="yv-bcc">'+escTxt(titleTxt)+'</span>':'');
  }

  // Layout 2 colonnes : tout l'article a gauche (760px), sidebar a droite qui defile.
  var host=null;
  if(ASIDE){
    var art=content.closest('.article-template')||content.closest('article')||content.parentNode;
    art.setAttribute('data-yv-cro','1');
    var col=mkdiv('yv-content');
    while(art.firstChild){ col.appendChild(art.firstChild); }
    var bcw=null; var bcIn=col.querySelector('.yv-breadcrumb'); if(bcIn){ bcw=bcIn.closest('.article-block-padding')||bcIn; if(bcw.parentNode) bcw.parentNode.removeChild(bcw); }
    var lay=mkdiv('yv-layout'); lay.appendChild(col); lay.appendChild(frag(ASIDE));
    if(bcw) art.appendChild(bcw);
    art.appendChild(lay);
    host=art;
  } else {
    host=content.parentNode||content;
  }
  if(RECO && host) host.appendChild(frag(RECO));
  if(TRUST && host) host.appendChild(frag(TRUST));

  // Ne pas recommander l'article courant (le bloc est partage par toutes les pages).
  if(RECO){
    var here=location.pathname.replace(/\\/+$/,'');
    Array.prototype.slice.call(document.querySelectorAll('.yv-rc')).forEach(function(a){ var h=(a.getAttribute('href')||'').replace(/\\/+$/,''); if(h&&here&&h===here) a.style.display='none'; });
  }
  }
  if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',run);}else{run();}
})();
</script>`;

  return `${SCRO_START_MARKER}\n${styleBlock(opts.branding)}\n${script}\n${SCRO_END_MARKER}`;
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
