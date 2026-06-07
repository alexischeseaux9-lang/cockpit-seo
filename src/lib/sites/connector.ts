// Test de connexion live par plateforme. Throw si echec.

export type Credentials =
  | { platform: "shopify"; shop: string; accessToken: string; client_id?: string; client_secret?: string }
  | { platform: "wordpress"; siteUrl: string; username: string; applicationPassword: string }
  | { platform: "github_mdx"; owner: string; repo: string; branch?: string; token: string; contentRoot?: string };

export async function testConnection(creds: Credentials): Promise<void> {
  if (creds.platform === "shopify") {
    const host = creds.shop.includes(".myshopify.com") ? creds.shop : `${creds.shop}.myshopify.com`;
    const res = await fetch(`https://${host}/admin/api/2024-10/shop.json`, {
      headers: { "X-Shopify-Access-Token": creds.accessToken },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`shopify_connect_failed:${res.status}`);
    return;
  }
  if (creds.platform === "wordpress") {
    const auth = Buffer.from(`${creds.username}:${creds.applicationPassword}`).toString("base64");
    const res = await fetch(`${creds.siteUrl.replace(/\/$/, "")}/wp-json/wp/v2/users/me`, {
      headers: { Authorization: `Basic ${auth}` },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`wordpress_connect_failed:${res.status}`);
    return;
  }
  if (creds.platform === "github_mdx") {
    const res = await fetch(`https://api.github.com/repos/${creds.owner}/${creds.repo}`, {
      headers: { Authorization: `Bearer ${creds.token}`, "User-Agent": "CockpitSEO" },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`github_connect_failed:${res.status}`);
    return;
  }
  throw new Error("unknown_platform");
}
