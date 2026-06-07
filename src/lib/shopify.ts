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
