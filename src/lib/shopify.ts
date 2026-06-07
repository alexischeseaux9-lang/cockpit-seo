import { SupabaseClient } from "@supabase/supabase-js";
import { ShopifyCredentials, encryptCredentials } from "./credentials";

const API_VERSION = "2024-10";

function apiBase(shop: string): string {
  const host = shop.includes(".myshopify.com") ? shop : `${shop}.myshopify.com`;
  return `https://${host}/admin/api/${API_VERSION}`;
}

// client_credentials grant: regenere un access token a partir du client_id/secret.
async function clientCredentialsToken(creds: ShopifyCredentials): Promise<string> {
  if (!creds.client_id || !creds.client_secret) {
    throw new Error("shopify_no_client_credentials_to_refresh");
  }
  const host = creds.shop_domain.includes(".myshopify.com")
    ? creds.shop_domain
    : `${creds.shop_domain}.myshopify.com`;
  const res = await fetch(`https://${host}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: creds.client_id,
      client_secret: creds.client_secret,
      grant_type: "client_credentials",
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`shopify_token_refresh_failed:${res.status}`);
  const data = await res.json();
  if (!data.access_token) throw new Error("shopify_token_refresh_no_token");
  return data.access_token as string;
}

// Verifie le token, le rafraichit via client_credentials si 401, et persiste.
export async function ensureValidToken(
  supabase: SupabaseClient,
  siteId: string,
  creds: ShopifyCredentials
): Promise<string> {
  const ping = await fetch(`${apiBase(creds.shop_domain)}/shop.json`, {
    headers: { "X-Shopify-Access-Token": creds.access_token },
    cache: "no-store",
  });
  if (ping.ok) return creds.access_token;
  if (ping.status !== 401 && ping.status !== 403) {
    throw new Error(`shopify_shop_check_failed:${ping.status}`);
  }
  // refresh
  const fresh = await clientCredentialsToken(creds);
  const updated: ShopifyCredentials = { ...creds, access_token: fresh };
  await supabase
    .from("sites")
    .update({ credentials_encrypted: encryptCredentials(updated), updated_at: new Date().toISOString() })
    .eq("id", siteId);
  return fresh;
}

// ---- Produits (M5) ----
export type ShopifyProduct = {
  id: number;
  title: string;
  handle: string;
  body_html: string;
  image: string | null;
};

export async function listProducts(shop: string, token: string, limit = 50): Promise<ShopifyProduct[]> {
  const res = await fetch(`${apiBase(shop)}/products.json?limit=${limit}`, {
    headers: { "X-Shopify-Access-Token": token },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`shopify_products_failed:${res.status}`);
  const data = await res.json();
  return (data.products || []).map((p: any) => ({
    id: p.id,
    title: p.title,
    handle: p.handle,
    body_html: p.body_html || "",
    image: p.image?.src || null,
  }));
}

export async function getProduct(shop: string, token: string, productId: string | number): Promise<ShopifyProduct | null> {
  const res = await fetch(`${apiBase(shop)}/products/${productId}.json`, {
    headers: { "X-Shopify-Access-Token": token },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const p = (await res.json()).product;
  return { id: p.id, title: p.title, handle: p.handle, body_html: p.body_html || "", image: p.image?.src || null };
}

export async function updateProduct(
  shop: string,
  token: string,
  productId: string | number,
  patch: { title?: string; body_html?: string; metaTitle?: string; metaDescription?: string }
): Promise<void> {
  const product: any = { id: Number(productId) };
  if (patch.title) product.title = patch.title;
  if (patch.body_html) product.body_html = patch.body_html;
  if (patch.metaTitle || patch.metaDescription) {
    product.metafields = [];
    if (patch.metaTitle)
      product.metafields.push({ namespace: "global", key: "title_tag", value: patch.metaTitle, type: "single_line_text_field" });
    if (patch.metaDescription)
      product.metafields.push({ namespace: "global", key: "description_tag", value: patch.metaDescription, type: "single_line_text_field" });
  }
  const res = await fetch(`${apiBase(shop)}/products/${productId}.json`, {
    method: "PUT",
    headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" },
    body: JSON.stringify({ product }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`shopify_product_update_failed:${res.status}`);
}

// ---- Collections (M5) ----
export type ShopifyCollection = {
  id: number;
  title: string;
  handle: string;
  body_html: string;
  kind: "custom" | "smart";
};

export async function listCollections(shop: string, token: string): Promise<ShopifyCollection[]> {
  const [custom, smart] = await Promise.all([
    fetch(`${apiBase(shop)}/custom_collections.json?limit=100`, { headers: { "X-Shopify-Access-Token": token }, cache: "no-store" }),
    fetch(`${apiBase(shop)}/smart_collections.json?limit=100`, { headers: { "X-Shopify-Access-Token": token }, cache: "no-store" }),
  ]);
  const out: ShopifyCollection[] = [];
  if (custom.ok) {
    const d = await custom.json();
    for (const c of d.custom_collections || []) out.push({ id: c.id, title: c.title, handle: c.handle, body_html: c.body_html || "", kind: "custom" });
  }
  if (smart.ok) {
    const d = await smart.json();
    for (const c of d.smart_collections || []) out.push({ id: c.id, title: c.title, handle: c.handle, body_html: c.body_html || "", kind: "smart" });
  }
  return out;
}

export async function updateCollection(
  shop: string,
  token: string,
  collectionId: string | number,
  kind: "custom" | "smart",
  patch: { body_html?: string; metaTitle?: string; metaDescription?: string }
): Promise<void> {
  const key = kind === "custom" ? "custom_collection" : "smart_collection";
  const path = kind === "custom" ? "custom_collections" : "smart_collections";
  const collection: any = { id: Number(collectionId) };
  if (patch.body_html) collection.body_html = patch.body_html;
  if (patch.metaTitle || patch.metaDescription) {
    collection.metafields = [];
    if (patch.metaTitle)
      collection.metafields.push({ namespace: "global", key: "title_tag", value: patch.metaTitle, type: "single_line_text_field" });
    if (patch.metaDescription)
      collection.metafields.push({ namespace: "global", key: "description_tag", value: patch.metaDescription, type: "single_line_text_field" });
  }
  const res = await fetch(`${apiBase(shop)}/${path}/${collectionId}.json`, {
    method: "PUT",
    headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" },
    body: JSON.stringify({ [key]: collection }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`shopify_collection_update_failed:${res.status}`);
}

export async function updateCollectionImage(
  shop: string,
  token: string,
  collectionId: string | number,
  kind: "custom" | "smart",
  imageUrl: string
): Promise<void> {
  const key = kind === "custom" ? "custom_collection" : "smart_collection";
  const path = kind === "custom" ? "custom_collections" : "smart_collections";
  const res = await fetch(`${apiBase(shop)}/${path}/${collectionId}.json`, {
    method: "PUT",
    headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" },
    body: JSON.stringify({ [key]: { id: Number(collectionId), image: { src: imageUrl } } }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`shopify_collection_image_failed:${res.status}`);
}

export async function getDefaultBlogId(shop: string, token: string): Promise<number> {
  const res = await fetch(`${apiBase(shop)}/blogs.json`, {
    headers: { "X-Shopify-Access-Token": token },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`shopify_blogs_failed:${res.status}`);
  const data = await res.json();
  const blog = (data.blogs || [])[0];
  if (!blog) throw new Error("shopify_no_blog");
  return blog.id as number;
}

export async function getArticle(shop: string, token: string, blogId: number, articleId: string | number) {
  const res = await fetch(`${apiBase(shop)}/blogs/${blogId}/articles/${articleId}.json`, {
    headers: { "X-Shopify-Access-Token": token },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json()).article;
}

export async function updateArticleBody(shop: string, token: string, blogId: number, articleId: string | number, bodyHtml: string): Promise<void> {
  const res = await fetch(`${apiBase(shop)}/blogs/${blogId}/articles/${articleId}.json`, {
    method: "PUT",
    headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" },
    body: JSON.stringify({ article: { id: Number(articleId), body_html: bodyHtml } }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`shopify_article_update_failed:${res.status}`);
}

export type PublishInput = {
  shop: string;
  token: string;
  blogId: number;
  title: string;
  bodyHtml: string;
  excerpt: string;
  author: string;
  tags: string[];
  imageUrl?: string;
  metaTitle?: string;
  metaDescription?: string;
};

export type PublishResult = { articleId: number; handle: string; url: string };

export async function publishArticle(input: PublishInput): Promise<PublishResult> {
  const article: any = {
    title: input.title,
    author: input.author,
    body_html: input.bodyHtml,
    summary_html: input.excerpt,
    tags: input.tags.join(", "),
    published: true,
  };
  if (input.imageUrl) article.image = { src: input.imageUrl };
  if (input.metaTitle || input.metaDescription) {
    article.metafields = [];
    if (input.metaTitle)
      article.metafields.push({ namespace: "global", key: "title_tag", value: input.metaTitle, type: "single_line_text_field" });
    if (input.metaDescription)
      article.metafields.push({ namespace: "global", key: "description_tag", value: input.metaDescription, type: "single_line_text_field" });
  }

  const res = await fetch(`${apiBase(input.shop)}/blogs/${input.blogId}/articles.json`, {
    method: "POST",
    headers: { "X-Shopify-Access-Token": input.token, "Content-Type": "application/json" },
    body: JSON.stringify({ article }),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`shopify_publish_failed:${res.status}:${body.slice(0, 300)}`);
  }
  const data = await res.json();
  const a = data.article;
  const host = input.shop.includes(".myshopify.com") ? input.shop : `${input.shop}.myshopify.com`;
  return {
    articleId: a.id,
    handle: a.handle,
    url: `https://${host}/blogs/news/${a.handle}`,
  };
}
