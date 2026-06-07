# MASTERPROMPT — Solo SEO Cockpit (à coller dans Claude Code)

> **Pour Alexis.** Copie/colle tout ce qui suit dans une session Claude Code neuve, dans un dépôt vide. Le but : reconstruire le cockpit SEO/CRO/IA que Peii t'a montré (forké de Yavok), mais **en mono-utilisateur** : tu es le seul opérateur, tes propres sites e-commerce sont rattachés direct, pas de couche "client / agence".

---

## 1. Identité du projet

Tu construis **un cockpit personnel** qui fait tourner du contenu SEO + des optimisations CRO sur **mes propres sites** (Shopify, WordPress / WooCommerce, et / ou un repo GitHub MDX). Pas de SaaS, pas de portail client, pas de multi-tenant. Un seul admin (moi), un mot de passe d'env, et mes sites listés sur le dashboard.

Stack imposée :

- **Next.js 14 App Router** (TypeScript, server components par défaut)
- **Vercel** (Hobby plan : 300s timeout, fluid compute, crons)
- **Supabase** (Postgres + Auth Service Role)
- **Anthropic Claude Sonnet 4.6** pour la rédaction + Haiku 4.5 pour les tâches courtes
- **fal.ai (flux/dev)** pour les images
- **OpenAI (gpt-image-1)** en backup image
- **SERPAPI** pour l'analyse SERP
- **Resend** pour les alertes par email
- **Lucide React** pour les icônes (zéro emoji dans l'UI)

Versions à fixer :

- node 20
- next 14.2.x
- @supabase/supabase-js 2.x
- @anthropic-ai/sdk 0.30+
- zod 3.23+

---

## 2. Règles ABSOLUES de style (à mettre dans le CLAUDE.md du dépôt)

1. **JAMAIS d'em-dash `—` ni d'en-dash `–`** nulle part : code, commentaires, copy UI, commits, MDX. Remplacer par point, virgule, parenthèses, deux-points. C'est un tell IA visible et un règle dure du projet.
2. **JAMAIS d'emoji dans le dashboard admin.** Toutes les icônes passent par `lucide-react`.
3. **Une feature n'est livrée que si elle est commitée + pushée + déployée + reliée à l'UI.** Du code local invisible pour l'utilisateur n'existe pas.
4. **Pas de menu multi-options dans les réponses.** Tu pickes une option raisonnable et tu ships.
5. **Ne JAMAIS écraser une image hero ni inline lors d'un refresh d'article.** Si je te demande un refresh d'article, tu préserves les images existantes verbatim.
6. **Ne JAMAIS committer un `.env`**, jamais coller des secrets dans le chat.

---

## 3. Architecture en 1 page

```
Browser
  └── /admin (mot de passe simple via env ADMIN_PASSWORD)
        ├── /                          ← liste des sites + santé globale
        ├── /sites/[siteId]            ← detail d'un site avec tabs :
        │      ├── Blog               (planning + briefs + génération)
        │      ├── Archive            (articles publiés)
        │      ├── Image Lab          (générer images standalone)
        │      ├── SCRO               (rang Search Console + injection blog)
        │      ├── Roadmap            (calendrier 6-mois)
        │      ├── Profil             (voice_profile : ton, persona, branding)
        │      ├── Products           (audit + optim fiches produit)
        │      ├── Product Categories (audit + optim collections)
        │      └── Optimisations      (log historique des changements)
        ├── /sites/new                 ← onboarding wizard
        └── /studio                    ← optionnel : génération offres / leadmagnets

Cron Vercel (vercel.ts)
  ├── /api/cron/auto-publish       toutes les heures
  ├── /api/cron/batch-enqueue      toutes les 4h
  ├── /api/cron/health-monitor     toutes les 10 min

Supabase tables (cf. SECTION 4)
  sites, site_jobs, site_taxonomies, site_optimizations,
  site_product_audits, blog_posts (optionnel), onboarding_runs

Services externes
  Anthropic (writer + editor + brief)
  fal.ai (cover + inline images)
  SERPAPI (SERP analysis)
  Shopify Admin GraphQL / WP REST / GitHub Contents API
  Resend (email alerts)
```

---

## 4. Schéma Supabase (consolidé en 1 migration `0001_init.sql`)

```sql
-- ============================================================
-- SITES : 1 ligne par site. Pas de client_id, pas de team.
-- ============================================================
CREATE TABLE sites (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                    text NOT NULL,
  url                     text NOT NULL,
  platform                text NOT NULL CHECK (platform IN ('shopify','wordpress','github_mdx')),
  credentials_encrypted   text, -- AES-256-GCM, clé = SITE_CREDENTIALS_KEY
  connection_status       text NOT NULL DEFAULT 'disconnected'
                          CHECK (connection_status IN ('disconnected','connected','error')),
  connection_error        text,
  voice_profile           jsonb NOT NULL DEFAULT '{}'::jsonb,
  daily_post_quota        int NOT NULL DEFAULT 1,
  daily_update_quota      int NOT NULL DEFAULT 0,
  auto_publish_enabled    boolean NOT NULL DEFAULT true,
  last_published_at       timestamptz,
  paused_at               timestamptz,
  paused_reason           text,
  last_alert_state        text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sites_platform_idx ON sites (platform);
CREATE INDEX sites_status_idx ON sites (connection_status);

-- ============================================================
-- SITE_JOBS : queue unique (generate_article, update_article,
-- audit_product, optimize_product, etc.)
-- ============================================================
CREATE TABLE site_jobs (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id               uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  kind                  text NOT NULL,
  status                text NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','in_progress','done','error','cancelled','paused')),
  priority              int NOT NULL DEFAULT 5,
  keyword               text,
  brief                 text,
  target_blog_hint      text,        -- ex: "gh-mdx:greek:god"
  target_external_id    text,        -- path/ID côté plateforme
  target_title          text,
  input                 jsonb,
  output                jsonb,
  error                 text,
  attempts              int NOT NULL DEFAULT 0,
  last_retried_at       timestamptz,
  paused_reason         text,
  batch_id              text,        -- Anthropic Batch API id
  scheduled_at          timestamptz,
  started_at            timestamptz,
  completed_at          timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX site_jobs_site_status_idx ON site_jobs (site_id, status);
CREATE INDEX site_jobs_kind_idx ON site_jobs (site_id, kind);
CREATE INDEX site_jobs_pending_idx ON site_jobs (status, scheduled_at)
  WHERE status = 'pending';

-- ============================================================
-- SITE_TAXONOMIES : 1 ligne par collection Shopify / category WC
-- ============================================================
CREATE TABLE site_taxonomies (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id                     uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  platform                    text NOT NULL,
  external_id                 text NOT NULL,
  handle                      text NOT NULL,
  name                        text NOT NULL,
  url                         text,
  products_count              int NOT NULL DEFAULT 0,
  current_description         text,
  current_meta_title          text,
  current_meta_description    text,
  current_image_url           text,
  suggested_description_html  text,
  suggested_meta_title        text,
  suggested_meta_description  text,
  intent_class                text, -- commercial / informational / hybrid / navigational
  quality_score               int,
  quality_breakdown           jsonb,
  generation_metadata         jsonb,
  push_status                 text,
  push_error                  text,
  audit_at                    timestamptz,
  analyzed_at                 timestamptz,
  pushed_at                   timestamptz,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_id, platform, external_id)
);
CREATE INDEX site_taxonomies_site_idx ON site_taxonomies (site_id);

-- ============================================================
-- SITE_OPTIMIZATIONS : log historique de TOUT changement appliqué
-- (alimente l'onglet "Historique" sur chaque catégorie + l'onglet
-- "Optimisations" du site).
-- ============================================================
CREATE TABLE site_optimizations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  kind            text NOT NULL,
  target_type     text NOT NULL, -- product | collection | article | page | site
  target_id       text,
  target_title    text,
  target_url      text,
  before_value    text,
  after_value     text,
  before_meta     jsonb,
  after_meta      jsonb,
  note            text,
  source          text NOT NULL DEFAULT 'ai' CHECK (source IN ('manual','ai','system')),
  done_at         timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX site_optimizations_site_done_idx ON site_optimizations (site_id, done_at DESC);
CREATE INDEX site_optimizations_target_idx ON site_optimizations (site_id, target_type, target_id);

-- ============================================================
-- SITE_PRODUCT_AUDITS : audit + version optimisée des fiches produit
-- ============================================================
CREATE TABLE site_product_audits (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id             uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  external_id         text NOT NULL,
  handle              text,
  title               text NOT NULL,
  status              text NOT NULL DEFAULT 'not_audited'
                      CHECK (status IN ('not_audited','needs_work','proposed','applied','error')),
  audit_score         int,
  audit_breakdown     jsonb,
  audit_notes         jsonb,
  proposed_payload    jsonb,  -- title, body_html, image_alts, channel_meta, cro_signals, quality_score
  applied_at          timestamptz,
  applied_revision    int NOT NULL DEFAULT 0,
  audit_at            timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_id, external_id)
);
CREATE INDEX site_product_audits_status_idx ON site_product_audits (site_id, status);

-- ============================================================
-- BLOG_POSTS (optionnel) : pour les sites github_mdx ou WordPress
-- qui stockent une copie côté Supabase.
-- ============================================================
CREATE TABLE blog_posts (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id               uuid REFERENCES sites(id) ON DELETE CASCADE,
  title                 text NOT NULL,
  slug                  text NOT NULL,
  content               text,
  excerpt               text,
  category              text,
  cluster               text,
  cover_image_url       text,
  meta_title            text,
  meta_description      text,
  source_keyword        text,
  quality_score         int,
  serp_analysis         jsonb,
  generation_metadata   jsonb,
  published             boolean NOT NULL DEFAULT false,
  published_at          timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_id, slug)
);

-- ============================================================
-- ONBOARDING_RUNS : trace l'état du wizard d'onboarding
-- ============================================================
CREATE TABLE onboarding_runs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id       uuid REFERENCES sites(id) ON DELETE CASCADE,
  status        text NOT NULL DEFAULT 'discovering',
  url           text NOT NULL,
  discovered    jsonb,
  applied       jsonb,
  error         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
```

---

## 5. Routes / APIs à scaffolder

### Admin pages (server components sauf si state)

```
src/app/admin/
  page.tsx                    Liste sites + cards santé
  sites/
    new/page.tsx              Wizard onboarding (3 étapes: discover → review → connect)
    [siteId]/
      page.tsx                Detail site, charge les tabs ci-dessous
      blog-dashboard.tsx
      archive-tab.tsx
      image-lab-tab.tsx
      scro-tab.tsx
      roadmap-tab.tsx
      profile-tab.tsx
      products-tab.tsx
      categories-tab.tsx
      optimizations-tab.tsx
      category-history-drawer.tsx
      connect-modal.tsx
```

### API routes (toutes en `runtime: 'nodejs'`)

```
src/app/api/admin/
  sites/
    list/route.ts                              GET liste + health agrégée
    create/route.ts                            POST
    update/route.ts                            POST (mise à jour quotas, etc.)
    update-profile/route.ts                    POST voice_profile (merge + passthrough)
    connect/route.ts                           POST credentials chiffrées
    resume/route.ts                            POST relance un site paused
    optimizations/route.ts                     GET/POST/DELETE log
    products/list/route.ts                     GET fiches produit
    products/audit-batch/route.ts              POST audit en masse
    products/optimize-batch/route.ts           POST optim en masse
    products/apply/route.ts                    POST push d'une fiche optimisée vers la plateforme
    products/preview/route.ts                  GET HTML preview standalone
    products/proposed/route.ts                 GET payload optimisé
    [siteId]/taxonomies/list/route.ts          GET catégories audit
    [siteId]/taxonomies/sync/route.ts          POST resync depuis la plateforme
    [siteId]/taxonomies/[taxId]/route.ts       GET détail
    [siteId]/taxonomies/[taxId]/analyze/route.ts   POST génère version optimisée (Claude + SERP)
    [siteId]/taxonomies/[taxId]/image/route.ts     POST génère + attache image
    [siteId]/taxonomies/[taxId]/push/route.ts      POST push live
    onboarding/discover/route.ts               POST scrape + Haiku draft du voice profile
    onboarding/apply/route.ts                  POST persiste le résultat du wizard
    sites/keyword-scout/route.ts               POST 200 keywords de niche

  cron/
    auto-publish/route.ts          GET, cron horaire
    batch-enqueue/route.ts         GET, cron 4h (Anthropic Batch API)
    health-monitor/route.ts        GET, cron 10 min (Telegram/email alerts)
```

### Cron config `vercel.ts`

```ts
import type { VercelConfig } from '@vercel/config/v1';

export const config: VercelConfig = {
  framework: 'nextjs',
  crons: [
    { path: '/api/cron/auto-publish',  schedule: '0 * * * *' },
    { path: '/api/cron/batch-enqueue', schedule: '0 */4 * * *' },
    { path: '/api/cron/health-monitor', schedule: '*/10 * * * *' },
  ],
};
```

---

## 6. Patterns critiques à reproduire (NE PAS sauter)

### 6.1 `job-runner.ts` (cœur du pipeline)

Une seule fonction `runJob(jobId)` qui :

1. Charge le job + le site.
2. Switch sur `kind` : `generate_article`, `update_article`, `refresh_article`, `audit_product`, `optimize_product`.
3. Décrypte les credentials avec AES-256-GCM (clé : env `SITE_CREDENTIALS_KEY`).
4. Délègue à un handler dédié (`generate-shopify-article.ts`, `generate-wordpress-article.ts`, `generate-github-mdx-article.ts`, `refresh-github-mdx-article.ts`, etc.).
5. Catch erreur → passe par `retry-classifier.ts` (cf. 6.4).
6. Sauve `output` JSON et `completed_at`.

### 6.2 Pipeline d'un article (Shopify ou WP) en 6 étapes

```
1. SERP analysis (SERPAPI)
2. Brief (Claude Sonnet)        ── insère draft row tout de suite (idempotent)
3. Writer (Claude Sonnet stream)  
4. Editor (Claude Haiku, anti-pattern guard + persona guard)
5. Cover + inline images (fal.ai)  ── semaphore 6 concurrent max
6. Publish (Shopify Article API / WP REST / GitHub Contents API)
```

### 6.3 Garde-fous OBLIGATOIRES après chaque étape de génération

- **`stripEmDashes(text)`** sur title, body, excerpt, meta, alt, caption.
- **`assertNoAntiPatterns(body)`** : ban "in conclusion", "delve", "tapestry", "in this article", "we will see", clichés français listés en config.
- **`assertPersonaIsolation({ body, expectedShortName, expectedFullName })`** : refuse si un autre auteur du même mascot a fuité du contexte cross-site.

### 6.4 `retry-classifier.ts`

Classe l'erreur et décide :

- `credits_exhausted` (Anthropic 402) → pause le site, alerte (Telegram + email), pas de retry auto.
- `rate_limited` (429) → retry exp backoff (60s, 120s, 240s).
- `network` (timeout, ECONNRESET) → retry × 3.
- `validation` (Zod, prompt, anti-pattern) → fail, pas de retry.
- `unknown_mythology_slug` (github_mdx pre-flight) → fail clair.
- `route_not_resolved` (URL 404 après publish) → fail + alerte humaine.

### 6.5 Pre-flight pour github_mdx (si tu actives ce connecteur)

Avant de lancer Claude :

- Canonicalise le slug (drift : `hinduism` → `hindu`, `greek-mythology` → `greek`).
- Vérifie qu'il est dans le registry connu du site cible.
- Refuse avec `unknown_mythology_slug:<slug>` si absent.

### 6.6 Smoke test post-publish

Après commit GitHub (ou article Shopify), HEAD polling 3 min sur l'URL canonique. Si pas 200 :

- `output.verification_warning = 'route_not_resolved_after_180000ms:last_status=404'`
- Le dashboard affiche un chip "Non vérifié" sur le job.

### 6.7 History log (catégories + produits + articles)

Chaque action AI qui touche un asset insère 1 row dans `site_optimizations` :

```ts
await logChange({
  supabase,
  siteId,
  kind: 'collection_image',          // ou collection_optimized_draft, collection_pushed_live, product_description, article_refreshed, etc.
  target_type: 'collection',         // product | collection | article | page | site
  target_id: taxonomy.id,
  target_title: taxonomy.name,
  before: oldUrl,
  after: newUrl,
  note: 'Image régénérée',
  source: 'ai',
});
```

Le drawer "Historique" (cf. `category-history-drawer.tsx`) lit cette table filtrée par `target_id` et affiche avant/après en timeline reverse-chrono.

---

## 7. Wizard onboarding (en 3 étapes)

Quand l'admin clique "+ Ajouter un site" :

1. **Discover** : scrape la home + 5 sous-pages, Claude Haiku draft :
   - voice_profile (tone_description, audience, content_language, image_style_hint, branding_accent_hex, branding_primary_colors, anti_ai_patterns, mascot)
   - persona auteur (mascot, author_name, author_role, author_bio)
   - keyword pillars (12 piliers)
2. **Review** : formulaire UI éditable. L'admin valide / corrige.
3. **Connect** : champ credentials selon plateforme :
   - Shopify : domaine `*.myshopify.com` + access token (OAuth client credentials grant)
   - WordPress : URL + WP user + Application Password
   - GitHub MDX : owner + repo + branch + token PAT + content root

Puis test connexion live. Si OK : `connection_status='connected'` + 180 jobs `generate_article` empilés en `pending` (1 par jour pendant 6 mois, priorisés par cluster).

---

## 8. Cron `auto-publish`

À chaque tick (horaire) :

1. SELECT `sites` WHERE `auto_publish_enabled=true` AND `paused_at IS NULL`.
2. Pour chaque site, compte les `done` du jour. Si < `daily_post_quota` :
   - SELECT 1 job pending priorité min, scheduled_at NULL or <= now()
   - `runJob(id)` (set `in_progress` avant le call pour idempotence)
3. Marque `last_published_at` à la fin.
4. Si Vercel approche les 270s, break et laisse le tick suivant continuer.

---

## 9. Cron `health-monitor`

Toutes les 10 min :

- Compte par site : `pending`, `errors_24h`, `in_progress`, `done_today`.
- Si `errors_24h >= 3` ou si `pending > 50` et 0 `done_today` → alerte (Telegram + email Resend).
- Persiste `last_alert_state` pour éviter le spam.

---

## 10. UI conventions

- **Dark mode only**, palette zinc (zinc-950 fond, zinc-100 texte, accent emerald-400).
- **Cards** : `rounded-lg border border-zinc-800 bg-zinc-900/40 p-4`.
- **Boutons primaires** : `bg-emerald-600 hover:bg-emerald-500`.
- **Boutons danger** : `bg-red-600`.
- **Health chip** : vert < 5 errors_24h, orange 5-10, rouge > 10. Couleur staleness sur `last_published_at` (vert <24h, orange 1-3j, rouge >3j).
- **Tabs** : pattern 3-tab (Planning / Génération / Archives) sur Blog. Tabs nav sticky en haut du detail.
- **Drawer** : pattern `fixed inset-0 z-50 flex justify-end`, max-w-2xl, sticky header.

---

## 11. Env vars (`.env.local`, JAMAIS commit)

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_ACCESS_TOKEN=
SUPABASE_PROJECT_REF=

# Admin (1 seul utilisateur)
ADMIN_PASSWORD=                   # mot de passe pour /admin
SITE_CREDENTIALS_KEY=             # 32 bytes base64 (openssl rand -base64 32)

# Anthropic + IA
ANTHROPIC_API_KEY=
CLAUDE_MODEL=claude-sonnet-4-6
BATCH_MODE_ENABLED=true           # passe par Anthropic Batch API (-50% cost)

# Images
FAL_KEY=
OPENAI_API_KEY=                   # backup gpt-image-1

# SEO data
SERPAPI_KEY=
JINA_API_KEY=                     # scraping markdown

# Alerts
RESEND_API_KEY=
TELEGRAM_BOT_TOKEN=               # optionnel
TELEGRAM_CHAT_ID=                 # optionnel

# Vercel cron auth
CRON_SECRET=                      # vérifié dans chaque /api/cron route

# App
NEXT_PUBLIC_APP_URL=https://<mon-domaine>
```

---

## 12. Garde-fous Vercel Hobby (300s)

- `maxDuration` explicite sur les routes lourdes :
  - `/api/cron/auto-publish` : `maxDuration = 300`
  - `/api/admin/sites/[siteId]/taxonomies/[taxId]/analyze` : `maxDuration = 300`
  - `/api/admin/sites/products/audit-batch` : `maxDuration = 300`
- Génération article doit tenir < 270s. Sinon split via Anthropic Batch API.
- Toutes les routes lourdes : `export const runtime = "nodejs"` + `export const dynamic = "force-dynamic"`.

---

## 13. Phases de delivery (livre dans cet ordre, ne saute pas)

### M1 : Dashboard nu (1 jour)
- Auth bearer simple (`isAdmin(req)` qui compare `Authorization: Bearer <ADMIN_PASSWORD>`).
- Page `/admin` qui liste les sites depuis Supabase avec health agrégée.
- Schéma `0001_init.sql` appliqué.
- Connect modal Shopify (le plus simple).

### M2 : Blog generator Shopify (2 jours)
- Pipeline complet pour 1 site Shopify (SERP → brief → writer → editor → cover → publish).
- Strip em-dashes + anti-pattern + persona guard.
- Cron `/api/cron/auto-publish`.
- Onglet Blog + Archive avec liste articles publiés.

### M3 : Voice profile + Onboarding wizard (1 jour)
- Onglet Profil (form édit voice_profile).
- Endpoint `/api/admin/onboarding/discover` (scrape + Haiku draft).
- Wizard 3 étapes.

### M4 : SCRO + Image Lab (1 jour)
- Onglet SCRO (Search Console rank ingest manuel + injection blog).
- Onglet Image Lab (fal.ai standalone).

### M5 : Products + Product Categories (2 jours)
- Tables `site_product_audits`, `site_taxonomies`.
- Audit batch, optim batch, apply.
- Drawer historique catégorie.
- Bouton "Re-générer image" toujours actif.

### M6 : Workflow hardening (1 jour)
- Retry classifier.
- Pre-flight slug validation (si github_mdx).
- Smoke test post-publish.
- Health monitor cron + alertes Resend.

### M7 (optionnel) : 2e plateforme (1-2 jours)
- WordPress OU GitHub MDX selon besoin perso.

**Total ~8-10 jours de Claude Code en autonomie.**

---

## 14. Convention versioning

```ts
// src/lib/version.ts
export const VERSION = "V1";
```

Affiché en chip dans la sidebar admin. Bump à chaque livraison majeure (`V1` → `V1.1` → `V1.2`) et tag git correspondant (`v1.0.0`, `v1.1.0`).

---

## 15. Première instruction à donner à Claude Code

Quand tu copies ce fichier dans une session neuve, lance avec cette phrase :

> "Lis intégralement ce document, confirme que tu comprends l'architecture et les règles ABSOLUES, puis attaque M1 : crée le repo Next.js 14, applique la migration `0001_init.sql` sur mon projet Supabase, build la page `/admin` avec la liste des sites + une card santé par site, et le connect modal Shopify. Quand M1 est commit + push + déployé + visible, on enchaîne M2. À chaque fin de milestone tu pousses sur main et tu m'attends pour valider."

---

## 16. Ce que je dois te fournir AVANT que tu démarres

- [ ] Repo GitHub vide rattaché à un projet Vercel (Hobby plan suffit pour démarrer).
- [ ] Projet Supabase fresh + service role key.
- [ ] Clés API : Anthropic, fal.ai, OpenAI (backup), SERPAPI, Resend, Jina.
- [ ] Credentials de mon 1er site Shopify (ou WP, ou GitHub).
- [ ] `ADMIN_PASSWORD` choisi et `SITE_CREDENTIALS_KEY` généré (`openssl rand -base64 32`).
- [ ] Mon domaine pointé sur Vercel.

Une fois tout en place : tu lis ce doc, tu poses tes questions de clarification s'il en reste, puis tu attaques M1.

Bon courage. Tout ce qui est ici a été testé et battle-tested sur Yavok.
