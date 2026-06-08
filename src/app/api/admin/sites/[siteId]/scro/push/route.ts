import { NextRequest, NextResponse } from "next/server";
import { isAdmin, unauthorized } from "@/lib/auth";
import { getSiteContext } from "@/lib/site-context";
import {
  listThemes, getThemeAsset, putThemeAsset,
  listProductsWithPrice, listCollectionsLite, getShopCurrency,
  getDefaultBlogId, getDefaultBlogHandle, listArticles, getCollectionFirstProductImage,
  type CroProduct,
} from "@/lib/shopify";
import { buildScroLiquid, injectScro, defaultBranding, type InlineItem, type SidebarResolved, type MiniProduct, type MiniLink } from "@/lib/cro/builder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const DEFAULT_ASSET = "sections/main-article.liquid";

// POST: resout les produits/collections/articles (images + prix reels) puis injecte
// le <style> + <script> CRO dans le theme actif (entre markers). Style Yavok :
// cartes produit positionnees dans le contenu de l'article.
export async function POST(req: NextRequest, { params }: { params: { siteId: string } }) {
  if (!isAdmin(req)) return unauthorized();
  try {
    const { supabase, shop, token, voice } = await getSiteContext(params.siteId);
    const { data: config } = await supabase.from("site_cro_configs").select("*").eq("site_id", params.siteId).maybeSingle();
    if (!config) return NextResponse.json({ error: "no_config" }, { status: 404 });

    const themes = await listThemes(shop, token);
    const themeId = config.theme_id || themes.find((t) => t.role === "main")?.id || themes[0]?.id;
    if (!themeId) return NextResponse.json({ error: "no_theme" }, { status: 404 });
    const assetKey = config.target_asset_key || DEFAULT_ASSET;

    const branding = defaultBranding(voice);
    const persona = { name: voice.author_name || voice.mascot || "", role: voice.author_role || "", bio: voice.author_bio || "" };

    const inlineEnabled = !!config.inline_enabled;
    const sidebarEnabled = !!config.sidebar_enabled;
    const blocks: any[] = config.blocks || [];
    const sb: any = config.sidebar || {};

    const needProducts = inlineEnabled || (sidebarEnabled && sb.bestsellers?.enabled);
    const needCollections = (inlineEnabled && blocks.some((b) => b.kind === "collection")) || (sidebarEnabled && sb.top_categories?.enabled);
    const needArticles = sidebarEnabled && sb.top_articles?.enabled;

    const currency = await getShopCurrency(shop, token);
    let products: CroProduct[] = [];
    if (needProducts) { try { products = await listProductsWithPrice(shop, token, 250); } catch { products = []; } }
    const pMap = new Map(products.map((p) => [p.handle, p]));

    let collections: { id: number; handle: string; title: string; image: string | null; productsCount: number }[] = [];
    if (needCollections) { try { collections = await listCollectionsLite(shop, token); } catch { collections = []; } }
    const cMap = new Map(collections.map((c) => [c.handle, c]));

    // Image des collections utilisees : image de la collection, sinon 1er produit.
    if (needCollections) {
      const catManual = (sb.top_categories?.manual_handles || []).filter(Boolean);
      const catNeeded = catManual.length ? catManual : collections.slice(0, 3).map((c) => c.handle);
      const usedCol = new Set<string>([
        ...blocks.filter((b) => b.kind === "collection" && b.handle).map((b) => b.handle),
        ...(sb.top_categories?.enabled ? catNeeded : []),
      ]);
      await Promise.all(
        Array.from(usedCol).map(async (h) => {
          const c = cMap.get(h);
          if (c && !c.image && c.id) {
            const img = await getCollectionFirstProductImage(shop, token, c.id);
            if (img) c.image = img;
          }
        }),
      );
    }

    let articles: { handle: string; title: string; image: string | null }[] = [];
    let blogHandle = "news";
    if (needArticles) {
      try {
        const blogId = await getDefaultBlogId(shop, token);
        blogHandle = await getDefaultBlogHandle(shop, token);
        const list = await listArticles(shop, token, blogId, 50);
        articles = list.map((a) => ({ handle: a.handle, title: a.title, image: a.image }));
      } catch { articles = []; }
    }
    const aMap = new Map(articles.map((a) => [a.handle, a]));

    // Blocs inline (produit ou collection) resolus
    let inline: InlineItem[] = blocks
      .map((b): InlineItem | null => {
        if (b.kind === "collection") {
          const c = cMap.get(b.handle);
          if (!c) return null;
          return { kind: "collection", position: b.position, label: b.label || "Notre selection", cta: b.cta || "Decouvrir", title: b.override_title || c.title, url: `/collections/${c.handle}`, image: c.image };
        }
        const p = pMap.get(b.handle);
        if (!p) return null;
        return { kind: "product", position: b.position, label: b.label || "Coup de coeur", cta: b.cta || "Voir le produit", title: b.override_title || p.title, url: `/products/${p.handle}`, image: p.image, price: p.price, compareAt: p.compareAt };
      })
      .filter((x): x is InlineItem => x !== null);

    // Fallback Yavok : si inline active mais aucun bloc valide configure, on remplit
    // automatiquement avec les meilleurs produits (cartes produit dans le contenu).
    if (inlineEnabled && inline.length === 0 && products.length) {
      const labels = ["Coup de coeur", "Best-seller", "Notre selection"];
      const positions: (number | "end")[] = [0.25, 0.5, 0.78];
      inline = products.slice(0, 3).map((p, i) => ({
        kind: "product",
        position: positions[i] ?? 0.5,
        label: labels[i] ?? "Coup de coeur",
        cta: "Voir le produit",
        title: p.title,
        url: `/products/${p.handle}`,
        image: p.image,
        price: p.price,
        compareAt: p.compareAt,
      }));
    }

    // Sidebar resolue
    const bestHandles =
      sb.bestsellers?.auto || !(sb.bestsellers?.manual_handles || []).filter(Boolean).length
        ? products.slice(0, 4).map((p) => p.handle)
        : sb.bestsellers.manual_handles;
    const bestItems: MiniProduct[] = (bestHandles || [])
      .map((h: string) => pMap.get(h))
      .filter(Boolean)
      .slice(0, 4)
      .map((p: CroProduct) => ({ title: p.title, url: `/products/${p.handle}`, image: p.image, price: p.price, compareAt: p.compareAt }));

    const catHandles = (sb.top_categories?.manual_handles || []).filter(Boolean).length
      ? sb.top_categories.manual_handles
      : [...collections].sort((a, b) => (b.productsCount || 0) - (a.productsCount || 0)).slice(0, 5).map((c) => c.handle);
    const catItems: MiniLink[] = (catHandles || []).map((h: string) => cMap.get(h)).filter(Boolean).slice(0, 5).map((c: any) => ({ title: c.title, url: `/collections/${c.handle}`, image: c.image, count: c.productsCount }));

    const artHandles = (sb.top_articles?.manual_handles || []).filter(Boolean).length ? sb.top_articles.manual_handles : articles.slice(0, 3).map((a) => a.handle);
    const artItems: MiniLink[] = (artHandles || []).map((h: string) => aMap.get(h)).filter(Boolean).slice(0, 3).map((a: any) => ({ title: a.title, url: `/blogs/${blogHandle}/${a.handle}`, image: a.image }));

    const sidebar: SidebarResolved = {
      lead_magnet: sb.lead_magnet?.enabled ? sb.lead_magnet : null,
      bestsellers: sb.bestsellers?.enabled ? { enabled: true, title: sb.bestsellers.title || "Best-sellers", items: bestItems } : null,
      categories: sb.top_categories?.enabled ? { enabled: true, title: sb.top_categories.title || "Nos univers", items: catItems } : null,
      articles: sb.top_articles?.enabled ? { enabled: true, title: sb.top_articles.title || "A lire aussi", items: artItems } : null,
      author: sb.author?.enabled
        ? { ...sb.author, name: sb.author.name || persona.name, role: sb.author.role || persona.role, bio: sb.author.bio || persona.bio, image_url: sb.author.image_url || voice.author_photo_url || "" }
        : null,
    };

    const liquid = buildScroLiquid({ inlineEnabled, sidebarEnabled, inline, sidebar, branding, currency });

    const current = (await getThemeAsset(shop, token, themeId, assetKey)) || "";
    const next = injectScro(current, liquid);

    const now = new Date().toISOString();
    try {
      await putThemeAsset(shop, token, themeId, assetKey, next);
      await supabase.from("site_cro_configs").update({ theme_id: String(themeId), target_asset_key: assetKey, last_pushed_at: now, last_push_status: "ok", last_push_error: null }).eq("site_id", params.siteId);
      return NextResponse.json({ ok: true, theme_id: themeId, asset_key: assetKey, inline_count: inline.length, sidebar: !!liquid });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "push_failed";
      await supabase.from("site_cro_configs").update({ last_push_status: "error", last_push_error: msg, updated_at: now }).eq("site_id", params.siteId);
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "error" }, { status: 500 });
  }
}
