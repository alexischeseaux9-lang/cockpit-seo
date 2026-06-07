import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin, unauthorized } from "@/lib/auth";
import { discoverProfile } from "@/lib/anthropic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const schema = z.object({ url: z.string().min(1) });

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Scrape la home (best-effort) et propose un voice profile + piliers de mots-cles.
export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  let url = parsed.data.url.trim();
  if (!/^https?:\/\//.test(url)) url = `https://${url}`;

  let text = "";
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; CockpitSEO/1.0)" },
      cache: "no-store",
    });
    text = stripHtml(await res.text());
  } catch {
    text = "";
  }
  if (text.length < 80) {
    return NextResponse.json({ error: "scrape_failed_or_empty" }, { status: 422 });
  }

  try {
    const result = await discoverProfile(url, text);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "discover_failed" },
      { status: 500 }
    );
  }
}
