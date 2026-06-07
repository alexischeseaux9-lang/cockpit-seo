import { NextRequest, NextResponse } from "next/server";
import { isAdmin, unauthorized } from "@/lib/auth";
import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase";
import { encrypt } from "@/lib/encryption";
import { testConnection, Credentials } from "@/lib/sites/connector";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Accepte la forme V3 { site_id, credentials:{platform,...} } OU l'ancienne
// forme Shopify { site_id, shop_domain, access_token, client_id?, client_secret? }.
export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });

  const body = await req.json().catch(() => null);
  if (!body?.site_id) return NextResponse.json({ error: "missing_site_id" }, { status: 400 });

  // Normalisation
  let creds: Credentials | null = null;
  let stored: Record<string, any> | null = null;
  if (body.credentials?.platform) {
    creds = body.credentials as Credentials;
    if (creds.platform === "shopify") {
      stored = { platform: "shopify", shop_domain: creds.shop, access_token: creds.accessToken, client_id: creds.client_id, client_secret: creds.client_secret };
    } else {
      stored = { ...creds };
    }
  } else if (body.shop_domain && body.access_token) {
    creds = { platform: "shopify", shop: body.shop_domain, accessToken: body.access_token, client_id: body.client_id, client_secret: body.client_secret };
    stored = { platform: "shopify", shop_domain: body.shop_domain, access_token: body.access_token, client_id: body.client_id, client_secret: body.client_secret };
  }
  if (!creds || !stored) return NextResponse.json({ error: "missing_credentials" }, { status: 400 });

  // Test live
  let connection_status = "connected";
  let connection_error: string | null = null;
  try {
    await testConnection(creds);
  } catch (e) {
    connection_status = "error";
    connection_error = e instanceof Error ? e.message : "connect_failed";
  }

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("sites")
    .update({
      credentials_encrypted: encrypt(JSON.stringify(stored)),
      connection_status,
      connection_error,
      updated_at: new Date().toISOString(),
    })
    .eq("id", body.site_id)
    .select("id, name, connection_status, connection_error")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: connection_status === "connected", site: data, connection_error });
}
