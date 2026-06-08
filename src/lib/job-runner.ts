import { getServiceClient } from "./supabase";
import { decryptCredentials } from "./credentials";
import { ensureValidToken, getDefaultBlogId, publishArticle, getArticle, updateArticleBody } from "./shopify";
import { analyzeSerp } from "./serp";
import { generateBrief, writeArticle, editArticle, generateImagePrompt, refreshArticle, optimizeProductFull } from "./anthropic";
import { generateCoverImage, fillArticleImages } from "./fal";
import { assertNoAntiPatterns, assertPersonaIsolation } from "./guards";
import { expandAntiAiPatterns } from "./anti-ai";
import { defaultBranding } from "./cro/builder";
import { classifyFailure, MAX_AUTO_RETRIES } from "./retry-classifier";
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
    if (!site.credentials_encrypted) throw new Error("site_not_connected");
    const voice: Record<string, any> = site.voice_profile || {};
    const creds = decryptCredentials(site.credentials_encrypted);
    const token = await ensureValidToken(supabase, site.id, creds);

    // --- kind: update_article (refresh d'un article existant, images preservees) ---
    if (job.kind === "update_article") {
      const articleId = job.target_external_id;
      if (!articleId) throw new Error("missing_target_external_id");
      const blogId = await getDefaultBlogId(creds.shop_domain, token);
      const article = await getArticle(creds.shop_domain, token, blogId, articleId);
      if (!article) throw new Error("article_not_found");
      const newBody = await refreshArticle(article.title, article.body_html || "", voice);
      assertNoAntiPatterns(newBody, expandAntiAiPatterns(voice.anti_ai_patterns));
      await updateArticleBody(creds.shop_domain, token, blogId, articleId, newBody);
      const nowIso = new Date().toISOString();
      await supabase.from("site_optimizations").insert({
        site_id: site.id, kind: "article_refreshed", target_type: "article",
        target_id: String(articleId), target_title: article.title,
        note: "Article rafraichi (images preservees)", source: "ai",
      });
      await supabase.from("site_jobs").update({
        status: "done", output: { article_id: articleId, refreshed: true, title: article.title },
        completed_at: nowIso, updated_at: nowIso,
      }).eq("id", jobId);
      await supabase.from("sites").update({ last_published_at: nowIso, updated_at: nowIso }).eq("id", site.id);
      return { ok: true };
    }

    // --- kind: regenerate_article (reecrit le corps en place, meme URL, structure complete) ---
    if (job.kind === "regenerate_article") {
      const articleId = job.target_external_id;
      if (!articleId) throw new Error("missing_target_external_id");
      const blogId = await getDefaultBlogId(creds.shop_domain, token);
      const article = await getArticle(creds.shop_domain, token, blogId, articleId);
      if (!article) throw new Error("article_not_found");

      let lang = voice.content_language;
      if (!lang) {
        const loc = await getShopLocale(creds.shop_domain, token);
        lang = LANG_LABEL[loc] || "anglais";
      }
      const voiceWithLang = { ...voice, content_language: lang };
      const keyword: string = job.keyword || job.target_title || article.title;
      const gl = lang === "francais" ? "fr" : "us";
      const hl = lang === "francais" ? "fr" : "en";

      const serp = await analyzeSerp(keyword, gl, hl);
      const brief = await generateBrief(keyword, serp, voiceWithLang);
      brief.title = article.title; // on conserve le titre existant de l'article

      const written = await writeArticle(brief, keyword, voiceWithLang, defaultBranding(voice));
      const extraBans = expandAntiAiPatterns(voice.anti_ai_patterns);
      let body = await editArticle(written.body_html, extraBans);
      assertNoAntiPatterns(body, extraBans);
      try { body = await fillArticleImages(body, voice.image_style_hint || "", 6); } catch { /* publie sans les images inline */ }

      await updateArticleBody(creds.shop_domain, token, blogId, articleId, body);
      const nowIso = new Date().toISOString();
      await supabase.from("site_optimizations").insert({
        site_id: site.id, kind: "article_regenerated", target_type: "article",
        target_id: String(articleId), target_title: article.title,
        note: `Article regenere (structure complete) pour "${keyword}"`, source: "ai",
      });
      await supabase.from("site_jobs").update({
        status: "done", output: { article_id: articleId, regenerated: true, title: article.title },
        completed_at: nowIso, updated_at: nowIso,
      }).eq("id", jobId);
      await supabase.from("sites").update({ last_published_at: nowIso, updated_at: nowIso }).eq("id", site.id);
      return { ok: true };
    }

    // --- kind: optimize_product (Sonnet -> proposed) ---
    if (job.kind === "optimize_product") {
      const extId = job.target_external_id;
      if (!extId) throw new Error("missing_target_external_id");
      const { data: audit } = await supabase
        .from("site_product_audits").select("*").eq("site_id", site.id).eq("external_id", extId).maybeSingle();
      if (!audit) throw new Error("audit_row_not_found");
      const opt = await optimizeProductFull(audit.current_title || audit.title || "", audit.current_body_html || "", voice);
      const nowIso = new Date().toISOString();
      await supabase.from("site_product_audits").update({
        proposed: opt, proposed_quality: opt.quality_score, proposed_at: nowIso, status: "proposed", updated_at: nowIso,
      }).eq("id", audit.id);
      await supabase.from("site_jobs").update({
        status: "done", output: { external_id: extId, quality: opt.quality_score }, completed_at: nowIso, updated_at: nowIso,
      }).eq("id", jobId);
      return { ok: true };
    }

    // --- kind: generate_article ---
    if (job.kind !== "generate_article") throw new Error(`unsupported_job_kind:${job.kind}`);
    const keyword: string = job.keyword || job.target_title || "";
    if (!keyword) throw new Error("missing_keyword");

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

    // 3. Writer (structure premium : encadres, figures, callouts, palette de marque)
    const written = await writeArticle(brief, keyword, voiceWithLang, defaultBranding(voice));

    // 4. Editor + garde-fous
    const extraBans = expandAntiAiPatterns(voice.anti_ai_patterns);
    let body = await editArticle(written.body_html, extraBans);
    assertNoAntiPatterns(body, extraBans);
    assertPersonaIsolation({
      body,
      expectedShortName: voice.author_name || voice.mascot,
      expectedFullName: voice.mascot || voice.author_name,
      forbiddenNames: voice.forbidden_author_names || [],
    });

    // 4b. Images inline : remplit les <figure data-gen> par de vraies images IA (non bloquant).
    try { body = await fillArticleImages(body, voice.image_style_hint || "", 4); } catch { /* on publie sans les images inline */ }

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
    const failure = classifyFailure(e);
    const attempts = (job.attempts || 0) + 1;
    const nowIso = new Date().toISOString();

    if (failure.bucket === "retry" && attempts <= MAX_AUTO_RETRIES) {
      const delay = Math.min(60 * 2 ** attempts, 600);
      await supabase
        .from("site_jobs")
        .update({ status: "pending", error: failure.message, attempts, last_retried_at: nowIso, scheduled_at: new Date(Date.now() + delay * 1000).toISOString(), updated_at: nowIso })
        .eq("id", jobId);
    } else if (failure.bucket === "paused") {
      await supabase
        .from("site_jobs")
        .update({ status: "paused", error: failure.message, paused_reason: failure.reason, attempts, last_retried_at: nowIso, updated_at: nowIso })
        .eq("id", jobId);
      // pause le site pour les raisons globales (credits, creds invalides)
      if (failure.reason.endsWith("_credit") || failure.reason === "invalid_credentials") {
        await supabase
          .from("sites")
          .update({ paused_at: nowIso, paused_reason: failure.reason, updated_at: nowIso })
          .eq("id", job.site_id);
      }
      await sendAlert(`[Cockpit SEO] Pause: ${site.name}`, `Raison: ${failure.reason}\nJob ${jobId}\n${failure.message}`);
    } else {
      await supabase
        .from("site_jobs")
        .update({ status: "error", error: failure.message, attempts, last_retried_at: nowIso, updated_at: nowIso })
        .eq("id", jobId);
    }
    return { ok: false, error: failure.message };
  }
}
