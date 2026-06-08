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
export type MiniLink = { title: string; url: string; image?: string | null; count?: number };
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

// Icones inline (stroke = currentColor) pour les en-tetes de la sidebar.
const SB_ICONS = {
  gift: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M5 12v9h14v-9"/><path d="M12 8S10 3 7.5 3a2.5 2.5 0 0 0 0 5H12zM12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5H12z"/></svg>',
  award: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="9" r="6"/><path d="M9 14l-1.5 7L12 18l4.5 3L15 14"/></svg>',
  grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>',
};

// ---- CSS (scope .yv-cro*, couleurs interpolees depuis la palette) ----
function styleBlock(br: Branding): string {
  return `<style>
.yv-card{display:flex;gap:18px;align-items:center;border:1px solid ${br.border};border-radius:16px;background:${br.cardBg};padding:18px;max-width:680px;margin:30px auto;box-shadow:0 2px 8px rgba(0,0,0,.06);font-family:inherit}
.yv-card .yv-img{flex:0 0 150px}
.yv-card .yv-img img{width:150px;height:150px;object-fit:cover;border-radius:12px;display:block}
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
.blog-contents{display:none!important}
.yv-layout{display:flex;gap:36px;align-items:flex-start;max-width:1120px;margin:0 auto;width:100%;box-sizing:border-box}
.yv-layout > .yv-content{flex:1 1 auto;min-width:0;max-width:760px}
.yv-content img{max-width:100%;height:auto}
.yv-aside{flex:0 0 320px;width:320px;align-self:flex-start;position:sticky;top:24px;margin:0;font-family:inherit}
.yv-lead-img{width:100%;height:160px;object-fit:cover;border-radius:10px;display:block;margin-bottom:14px}
@media(max-width:900px){.yv-layout{display:block;max-width:760px}.yv-aside{width:auto;position:static;margin:28px auto 0}}
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
    boxes.push(`<div class="yv-box"><h4>${SB_ICONS.grid} ${esc(sb.articles.title || "Read more")}</h4>${sb.articles.items.slice(0, 3).map(miniLink).join("")}</div>`);
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
  function run(){
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
  if(ASIDE){
    var lay=document.createElement('div'); lay.className='yv-layout';
    main.classList.add('yv-content');
    if(main.parentNode){ main.parentNode.insertBefore(lay, main); lay.appendChild(main); lay.appendChild(frag(ASIDE)); }
  }
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
