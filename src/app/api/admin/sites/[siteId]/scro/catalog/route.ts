import { NextRequest, NextResponse } from "next/server";
import { isAdmin, unauthorized } from "@/lib/auth";
import { getSiteContext } from "@/lib/site-context";
import { listThemes, listProducts, listCollections } from "@/lib/shopify";
import { defaultBranding } from "@/lib/cro/builder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET: themes + produits + collections + branding (depuis voice_profile).
export async function GET(req: NextRequest, { params }: { params: { siteId: string } }) {
  if (!isAdmin(req)) return unauthorized();
  try {
    const { shop, token, voice } = await getSiteContext(params.siteId);
    const errors = { themes: null as string | null, products: null as string | null, collections: null as string | null };
    let themes: any[] = [], products: any[] = [], collections: any[] = [];
    try { themes = await listThemes(shop, token); } catch (e) { errors.themes = e instanceof Error ? e.message : "err"; }
    try { products = (await listProducts(shop, token, 50)).map((p) => ({ handle: p.handle, title: p.title, image: p.image })); } catch (e) { errors.products = e instanceof Error ? e.message : "err"; }
    try { collections = (await listCollections(shop, token)).map((c) => ({ handle: c.handle, title: c.title, productsCount: 0, image: null })); } catch (e) { errors.collections = e instanceof Error ? e.message : "err"; }
    return NextResponse.json({ branding: defaultBranding(voice), themes, products, collections, errors });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "error" }, { status: 500 });
  }
}
