import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin, unauthorized } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase";
import { encryptCredentials } from "@/lib/credentials";
import { ensureValidToken } from "@/lib/shopify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Etape 3 du wizard: cree le site, chiffre les creds, set le profil, teste la connexion.
const schema = z.object({
  run_id: z.string().uuid().optional(),
  name: z.string().min(1),
  url: z.string().min(1),
  platform: z.enum(["shopify", "wordpress", "github_mdx"]),
  voice_profile: z.record(z.string(), z.any()),
  shop_domain: z.string().optional(),
  access_token: z.string().optional(),
  client_id: z.string().optional(),
  client_secret: z.string().optional(),
});

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const d = parsed.data;

  const supabase = getServiceClient();

  // Insert site
  const { data: site, error: insErr } = await supabase
    .from("sites")
    .insert({ name: d.name, url: d.url, platform: d.platform, voice_profile: d.voice_profile })
    .select()
    .single();
  if (insErr || !site) return NextResponse.json({ error: insErr?.message || "insert_failed" }, { status: 500 });

  // Connect (Shopify pour l'instant)
  let connection_status = "disconnected";
  let connection_error: string | null = null;
  if (d.platform === "shopify" && d.shop_domain && d.access_token) {
    const creds = {
      platform: "shopify" as const,
      shop_domain: d.shop_domain,
      access_token: d.access_token,
      client_id: d.client_id,
      client_secret: d.client_secret,
    };
    try {
      await ensureValidToken(supabase, site.id, creds); // test live
      connection_status = "connected";
    } catch (e) {
      connection_error = e instanceof Error ? e.message : "connect_failed";
      connection_status = "error";
    }
    await supabase
      .from("sites")
      .update({
        credentials_encrypted: encryptCredentials(creds),
        connection_status,
        connection_error,
        updated_at: new Date().toISOString(),
      })
      .eq("id", site.id);
  }

  if (d.run_id) {
    await supabase
      .from("onboarding_runs")
      .update({ status: "applied", applied_site_id: site.id, updated_at: new Date().toISOString() })
      .eq("id", d.run_id);
  }

  return NextResponse.json({ site_id: site.id, connection_status, connection_error });
}
