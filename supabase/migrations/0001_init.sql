-- ============================================================
-- SITES : 1 ligne par site. Pas de client_id, pas de team.
-- ============================================================
CREATE TABLE sites (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                    text NOT NULL,
  url                     text NOT NULL,
  platform                text NOT NULL CHECK (platform IN ('shopify','wordpress','github_mdx')),
  credentials_encrypted   text, -- AES-256-GCM, cle = SITE_CREDENTIALS_KEY
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
  target_blog_hint      text,
  target_external_id    text,
  target_title          text,
  input                 jsonb,
  output                jsonb,
  error                 text,
  attempts              int NOT NULL DEFAULT 0,
  last_retried_at       timestamptz,
  paused_reason         text,
  batch_id              text,
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
  intent_class                text,
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
-- SITE_OPTIMIZATIONS : log historique de TOUT changement applique
-- ============================================================
CREATE TABLE site_optimizations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  kind            text NOT NULL,
  target_type     text NOT NULL,
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
-- SITE_PRODUCT_AUDITS : audit + version optimisee des fiches produit
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
  proposed_payload    jsonb,
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
-- ONBOARDING_RUNS : trace l'etat du wizard d'onboarding
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
