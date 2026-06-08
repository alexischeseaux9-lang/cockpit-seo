// Builder des blocs CRO injectes dans le theme Shopify (sections/main-article.liquid).
// Approche : un <style> + <script> places entre markers. Le script trouve le conteneur
// de l'article et insere les cartes produit AUX POSITIONS configurees (dans le contenu,
// pas a la fin), avec image + prix reels bakes au moment du push (style Yavok/buddhive).

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
};
export type MiniProduct = { title: string; url: string; image: string | null; price?: string | null; compareAt?: string | null };
export type MiniLink = { title: string; url: string; image?: string | null };
export type SidebarResolved = {
  lead_magnet?: SidebarConfig["lead_magnet"] | null;
  bestsellers?: { enabled: boolean; title: string; items: MiniProduct[] } | null;
  categories?: { enabled: boolean; title: string; items: MiniLink[] } | null;
  articles?: { enabled: boolean; title: string; items: MiniLink[] } | null;
  author?: SidebarConfig["author"] | null;
};

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

// ---- CSS (scope .yv-cro*, couleurs interpolees depuis la palette) ----
function styleBlock(br: Branding): string {
  return `<style>
.yv-card{display:flex;gap:14px;align-items:center;border:1px solid ${br.border};border-radius:14px;background:${br.cardBg};padding:14px;max-width:480px;margin:28px auto;box-shadow:0 1px 3px rgba(0,0,0,.05);font-family:inherit}
.yv-card .yv-img{flex:0 0 110px}
.yv-card .yv-img img{width:110px;height:110px;object-fit:cover;border-radius:10px;display:block}
.yv-card .yv-bd{flex:1;min-width:0}
.yv-card .yv-lbl{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${br.accent}}
.yv-card .yv-ttl{font-size:15px;font-weight:600;color:${br.textDark};margin:3px 0;line-height:1.3}
.yv-card .yv-st{font-size:12px;color:${br.ratingColor};letter-spacing:1px}
.yv-card .yv-st span{color:${br.textMuted};margin-left:5px;letter-spacing:0}
.yv-card .yv-pr{display:flex;align-items:center;gap:8px;margin:6px 0 10px}
.yv-card .yv-pr b{font-size:16px;color:${br.textDark}}
.yv-card .yv-pr s{font-size:13px;color:${br.textMuted}}
.yv-card .yv-bdg{font-size:11px;font-weight:700;color:#fff;background:${br.accent};border-radius:6px;padding:2px 7px}
.yv-card .yv-cta{display:inline-block;background:${br.accent};color:#fff;padding:9px 18px;border-radius:9px;text-decoration:none;font-size:14px;font-weight:600}
.yv-card .yv-cta:hover{background:${br.accentDark}}
.yv-aside{max-width:320px;float:right;margin:8px 0 22px 28px;font-family:inherit}
@media(max-width:849px){.yv-aside{float:none;margin:24px auto;max-width:480px}}
.yv-box{border:1px solid ${br.border};border-radius:14px;background:${br.cardBg};padding:16px;margin-bottom:16px}
.yv-box h4{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:${br.accent};margin:0 0 10px}
.yv-mini{display:flex;gap:10px;align-items:center;padding:7px 0;text-decoration:none;border-top:1px solid ${br.border}}
.yv-mini:first-of-type{border-top:0}
.yv-mini img{width:46px;height:46px;object-fit:cover;border-radius:8px;flex:0 0 46px}
.yv-mini .m-t{font-size:13px;color:${br.textDark};line-height:1.25;font-weight:500}
.yv-mini .m-p{font-size:12px;font-weight:700;color:${br.accent}}
.yv-lead p{margin:0 0 8px;font-size:13px;color:${br.textMuted}}
.yv-lead .perk{font-size:13px;color:${br.textDark};padding:2px 0}
.yv-lead .promo{margin:8px 0;font-weight:700;color:${br.accentDark};letter-spacing:.04em}
.yv-lead .yv-cta{display:inline-block;background:${br.accent};color:#fff;padding:9px 16px;border-radius:9px;text-decoration:none;font-size:13px;font-weight:600;margin-top:4px}
.yv-auth .row{display:flex;align-items:center;gap:10px}
.yv-auth img{width:48px;height:48px;border-radius:50%;object-fit:cover}
.yv-auth .nm{font-weight:700;color:${br.textDark};font-size:14px}
.yv-auth .rl{font-size:12px;color:${br.textMuted}}
.yv-auth .bio{font-size:13px;color:${br.textMuted};margin:8px 0 0}
.yv-auth .badge{font-size:12px;color:${br.textDark};padding:2px 0}
</style>`;
}

function inlineCardHtml(it: InlineItem, sym: string): string {
  const img = sizedImg(it.image);
  const pct = discountPct(it.price, it.compareAt);
  const priceRow =
    it.kind === "product" && it.price
      ? `<div class="yv-pr"><b>${esc(money(it.price, sym))}</b>${it.compareAt && pct > 0 ? `<s>${esc(money(it.compareAt, sym))}</s><span class="yv-bdg">-${pct}%</span>` : ""}</div>`
      : "";
  const stars = it.kind === "product" ? `<div class="yv-st">${STARS} <span>Avis clients</span></div>` : "";
  return `<div class="yv-card" data-cro-injected="1">
  ${img ? `<a class="yv-img" href="${esc(it.url)}"><img src="${esc(img)}" alt="${esc(it.title)}" loading="lazy" width="110" height="110"></a>` : ""}
  <div class="yv-bd">
    <div class="yv-lbl">${esc(it.label)}</div>
    <div class="yv-ttl">${esc(it.title)}</div>
    ${stars}${priceRow}
    <a class="yv-cta" href="${esc(it.url)}">${esc(it.cta)} →</a>
  </div>
</div>`;
}

function miniProduct(p: MiniProduct, sym: string): string {
  const img = sizedImg(p.image, 120);
  return `<a class="yv-mini" href="${esc(p.url)}">${img ? `<img src="${esc(img)}" alt="${esc(p.title)}" loading="lazy">` : ""}<span><span class="m-t">${esc(p.title)}</span>${p.price ? `<br><span class="m-p">${esc(money(p.price, sym))}</span>` : ""}</span></a>`;
}
function miniLink(l: MiniLink): string {
  const img = sizedImg(l.image || null, 120);
  return `<a class="yv-mini" href="${esc(l.url)}">${img ? `<img src="${esc(img)}" alt="${esc(l.title)}" loading="lazy">` : ""}<span class="m-t">${esc(l.title)}</span></a>`;
}

function asideHtml(sb: SidebarResolved, sym: string): string {
  const boxes: string[] = [];
  const lm = sb.lead_magnet;
  if (lm?.enabled) {
    boxes.push(`<div class="yv-box yv-lead"><h4>${esc(lm.title || "Cadeau de bienvenue")}</h4>
      ${lm.subtitle ? `<p>${esc(lm.subtitle)}</p>` : ""}
      ${(lm.perks || []).filter(Boolean).map((p) => `<div class="perk">${esc(p)}</div>`).join("")}
      ${lm.promo_code ? `<div class="promo">${esc(lm.promo_code)}</div>` : ""}
      <a class="yv-cta" href="${esc(lm.cta_url || "#")}">${esc(lm.cta_text || "S'inscrire")}</a></div>`);
  }
  if (sb.bestsellers?.enabled && sb.bestsellers.items.length) {
    boxes.push(`<div class="yv-box"><h4>${esc(sb.bestsellers.title || "Best-sellers")}</h4>${sb.bestsellers.items.slice(0, 3).map((p) => miniProduct(p, sym)).join("")}</div>`);
  }
  if (sb.categories?.enabled && sb.categories.items.length) {
    boxes.push(`<div class="yv-box"><h4>${esc(sb.categories.title || "Nos univers")}</h4>${sb.categories.items.slice(0, 3).map(miniLink).join("")}</div>`);
  }
  if (sb.articles?.enabled && sb.articles.items.length) {
    boxes.push(`<div class="yv-box"><h4>${esc(sb.articles.title || "A lire aussi")}</h4>${sb.articles.items.slice(0, 3).map(miniLink).join("")}</div>`);
  }
  const au = sb.author;
  if (au?.enabled && (au.name || au.bio)) {
    boxes.push(`<div class="yv-box yv-auth">
      <div class="row">${au.image_url ? `<img src="${esc(au.image_url)}" alt="${esc(au.name)}">` : ""}<span><span class="nm">${esc(au.name)}</span><br><span class="rl">${esc(au.role)}</span></span></div>
      ${au.bio ? `<p class="bio">${esc(au.bio)}</p>` : ""}
      ${(au.trust_badges || []).filter(Boolean).map((b) => `<div class="badge">${esc(b)}</div>`).join("")}</div>`);
  }
  if (!boxes.length) return "";
  return `<aside class="yv-aside" data-cro-injected="1">${boxes.join("")}</aside>`;
}

export function buildScroLiquid(opts: {
  inlineEnabled: boolean;
  sidebarEnabled: boolean;
  inline: InlineItem[];
  sidebar: SidebarResolved;
  branding: Branding;
  currency: string;
}): string {
  const sym = currencySymbol(opts.currency || "USD");
  const inlineHtml = opts.inlineEnabled ? opts.inline.filter((it) => it.title && it.url).map((it) => inlineCardHtml(it, sym)) : [];
  const pcts = opts.inlineEnabled ? opts.inline.filter((it) => it.title && it.url).map((it) => (it.position === "end" ? null : Number(it.position))) : [];
  const aside = opts.sidebarEnabled ? asideHtml(opts.sidebar, sym) : "";
  if (!inlineHtml.length && !aside) return "";

  const script = `<script>
(function(){
  if (document.querySelector('[data-yv-cro]')) return;
  var sels=['.article-template__content','.article-main','[itemprop="articleBody"]','.article__content','.post-content','.rte'];
  var main=null,i;
  for(i=0;i<sels.length;i++){var el=document.querySelector(sels[i]); if(el && el.querySelectorAll('p').length>=3){main=el;break;}}
  if(!main){for(i=0;i<sels.length;i++){var e2=document.querySelector(sels[i]); if(e2){main=e2;break;}}}
  if(!main) return;
  main.setAttribute('data-yv-cro','1');
  var INLINE=${JSON.stringify(inlineHtml)};
  var PCTS=${JSON.stringify(pcts)};
  var ASIDE=${JSON.stringify(aside)};
  function frag(html){return document.createRange().createContextualFragment(html);}
  if(ASIDE){ main.insertBefore(frag(ASIDE), main.firstChild); }
  var notInj=function(el){return !el.closest('[data-cro-injected]');};
  var paras=Array.prototype.slice.call(main.querySelectorAll(':scope > p, :scope > h2, :scope > h3')).filter(notInj);
  if(paras.length<3){ paras=Array.prototype.slice.call(main.querySelectorAll('p, h2, h3')).filter(notInj); }
  if(paras.length>=2 && INLINE.length){
    for(var j=INLINE.length-1;j>=0;j--){
      var pct=PCTS[j];
      if(pct==null){ var lp=paras[paras.length-1]; if(lp&&lp.parentNode) lp.parentNode.insertBefore(frag(INLINE[j]), lp.nextSibling); }
      else { var idx=Math.max(1,Math.min(paras.length-1,Math.floor(paras.length*pct))); var t=paras[idx]; if(t&&t.parentNode) t.parentNode.insertBefore(frag(INLINE[j]), t); }
    }
  }
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
