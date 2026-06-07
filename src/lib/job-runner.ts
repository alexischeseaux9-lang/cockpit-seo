import { getServiceClient } from "./supabase";
import { decryptCredentials } from "./credentials";
import { ensureValidToken, getDefaultBlogId, publishArticle } from "./shopify";
import { analyzeSerp } from "./serp";
import { generateBrief, writeArticle, editArticle, generateImagePrompt } from "./anthropic";
import { generateCoverImage } from "./fal";
import { assertNoAntiPatterns, assertPersonaIsolation } from "./guards";
import { classifyError } from "./retry-classifier";
import { sendAlert } from "./alerts";

// Smoke test post-publish: poll HEAD sur l'URL canonique (court, compatible serverless).
async function smokeTest(url: string): Promise<string | null> {
  const deadline = Date.now() + 18_000;
  let last = 0;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { method: "HEAD", cache: "no-store" });
      last = res.status;
      if (res.status === 200) return null;
    } catch {
      last = 0;
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  return `route_not_resolved_after_18000ms:last_status=${last}`;
}

async function getShopLocale(shop: string, token: string): Promise<string> {
  try {
    const host = shop.includes(".myshopify.com") ? shop : `${shop}.myshopify.com`;
    const res = await fetch(`https://${host}/admin/api/2024-10/shop.json`, {
      headers: { "X-Shopify-Access-Token": token },
      cache: "no-store",
    });
    if (!res.ok) return "en";
    const data = await res.json();
    return (data.shop?.primary_locale || "en").split("-")[0];
  } catch {
    return "en";
  }
}

const LANG_LABEL: Record<string, string> = {
  fr: "francais",
  en: "anglais",
  de: "allemand",
  it: "italien",
  es: "espagnol",
};

// Coeur du pipeline. Pour l'instant: kind = generate_article (Shopify).
export async function runJob(jobId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = getServiceClient();

  const { data: job, error: jobErr } = await supabase
    .from("site_jobs")
    .select("*")
    .eq("id", jobId)
    .single();
  if (jobErr || !job) return { ok: false, error: "job_not_found" };

  const { data: site, error: siteErr } = await supabase
    .from("sites")
    .select("*")
    .eq("id", job.site_id)
    .single();
  if (siteErr || !site) return { ok: false, error: "site_not_found" };

  await supabase
    .from("site_jobs")
    .update({ status: "in_progress", started_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", jobId);

  try {
    if (job.kind !== "generate_article") {
      throw new Error(`unsupported_job_kind:${job.kind}`);
    }
    if (!site.credentials_encrypted) throw new Error("site_not_connected");

    const keyword: string = job.keyword || job.target_title || "";
    if (!keyword) throw new Error("missing_keyword");

    const voice: Record<string, any> = site.voice_profile || {};
    const creds = decryptCredentials(site.credentials_encrypted);

    // 0. Token valide (refresh auto si besoin)
    const token = await ensureValidToken(supabase, site.id, creds);

    // langue: voice_profile sinon locale boutique
    let lang = voice.content_language;
    if (!lang) {
      const loc = await getShopLocale(creds.shop_domain, token);
      lang = LANG_LABEL[loc] || "anglais";
    }
    const voiceWithLang = { ...voice, content_language: lang };

    // 1. SERP
    const gl = lang === "francais" ? "fr" : "us";
    const hl = lang === "francais" ? "fr" : "en";
    const serp = await analyzeSerp(keyword, gl, hl);

    // 2. Brief
    const brief = await generateBrief(keyword, serp, voiceWithLang);

    // 3. Writer
    const written = await writeArticle(brief, keyword, voiceWithLang);

    // 4. Editor + garde-fous
    const body = await editArticle(written.body_html);
    assertNoAntiPatterns(body);
    assertPersonaIsolation({
      body,
      expectedShortName: voice.author_name,
      expectedFullName: voice.author_name,
      forbiddenNames: voice.forbidden_author_names || [],
    });

    // 5. Cover image
    let imageUrl: string | undefined;
    try {
      const imgPrompt = await generateImagePrompt(brief.title, voiceWithLang);
      imageUrl = await generateCoverImage(imgPrompt);
    } catch {
      // image non bloquante: on publie sans cover plutot que d'echouer tout l'article
      imageUrl = undefined;
    }

    // 6. Publish
    const blogId = await getDefaultBlogId(creds.shop_domain, token);
    const author = voice.author_name || site.name;
    const result = await publishArticle({
      shop: creds.shop_domain,
      token,
      blogId,
      title: brief.title,
      bodyHtml: body,
      excerpt: written.excerpt,
      author,
      tags: brief.secondary_keywords.slice(0, 5),
      imageUrl,
      metaTitle: brief.meta_title,
      metaDescription: brief.meta_description,
    });

    const nowIso = new Date().toISOString();

    // smoke test (non bloquant: on garde l'article mais on flag si non verifie)
    const verificationWarning = await smokeTest(result.url);

    // blog_posts (copie cote Supabase)
    await supabase.from("blog_posts").insert({
      site_id: site.id,
      title: brief.title,
      slug: result.handle,
      content: body,
      excerpt: written.excerpt,
      cover_image_url: imageUrl,
      meta_title: brief.meta_title,
      meta_description: brief.meta_description,
      source_keyword: keyword,
      serp_analysis: serp,
      generation_metadata: { brief, article_id: result.articleId, url: result.url },
      published: true,
      published_at: nowIso,
    });

    // log historique
    await supabase.from("site_optimizations").insert({
      site_id: site.id,
      kind: "article_published",
      target_type: "article",
      target_id: String(result.articleId),
      target_title: brief.title,
      target_url: result.url,
      after_value: result.url,
      note: `Article publie pour le mot-cle "${keyword}"`,
      source: "ai",
    });

    // job done
    await supabase
      .from("site_jobs")
      .update({
        status: "done",
        output: {
          article_id: result.articleId,
          url: result.url,
          handle: result.handle,
          image: imageUrl,
          title: brief.title,
          verification_warning: verificationWarning,
        },
        completed_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", jobId);

    // site last_published_at
    await supabase
      .from("sites")
      .update({ last_published_at: nowIso, updated_at: nowIso })
      .eq("id", site.id);

    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown_error";
    const attempts = (job.attempts || 0) + 1;
    const decision = classifyError(msg, attempts);
    const nowIso = new Date().toISOString();

    if (decision.retry) {
      // re-planifie en pending avec backoff
      await supabase
        .from("site_jobs")
        .update({
          status: "pending",
          error: msg,
          attempts,
          last_retried_at: nowIso,
          scheduled_at: new Date(Date.now() + decision.delayMs).toISOString(),
          updated_at: nowIso,
        })
        .eq("id", jobId);
    } else {
      await supabase
        .from("site_jobs")
        .update({
          status: decision.pauseSite ? "paused" : "error",
          error: msg,
          paused_reason: decision.pauseSite ? decision.class : null,
          attempts,
          last_retried_at: nowIso,
          updated_at: nowIso,
        })
        .eq("id", jobId);
    }

    if (decision.pauseSite) {
      await supabase
        .from("sites")
        .update({ paused_at: nowIso, paused_reason: decision.class, updated_at: nowIso })
        .eq("id", job.site_id);
    }
    if (decision.alert) {
      await sendAlert(
        `[Cockpit SEO] Job ${decision.class}`,
        `Site ${site.name} (${site.id})\nJob ${jobId}\nErreur: ${msg}`
      );
    }
    return { ok: false, error: msg };
  }
}
