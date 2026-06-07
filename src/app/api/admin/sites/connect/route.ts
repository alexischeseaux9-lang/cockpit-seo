import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin, unauthorized } from "@/lib/auth";
import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase";
import { encrypt } from "@/lib/encryption";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Connect Shopify : domaine *.myshopify.com + access token.
// Le token est chiffre AES-256-GCM puis persiste dans sites.credentials_encrypted.
const schema = z.object({
  site_id: z.string().uuid(),
  shop_domain: z.string().min(1),
  access_token: z.string().min(1),
});

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { site_id, shop_domain, access_token } = parsed.data;

  let credentials_encrypted: string;
  try {
    credentials_encrypted = encrypt(
      JSON.stringify({ platform: "shopify", shop_domain, access_token })
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "encryption_failed" },
      { status: 500 }
    );
  }

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("sites")
    .update({
      credentials_encrypted,
      connection_status: "connected",
      connection_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", site_id)
    .select("id, name, connection_status")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ site: data });
}
