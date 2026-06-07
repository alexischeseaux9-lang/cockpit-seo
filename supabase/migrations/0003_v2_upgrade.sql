-- ============================================================
-- V2 upgrade: colonnes et tables additionnelles pour la parite.
-- Idempotent (IF NOT EXISTS partout).
-- ============================================================

-- sites: portail client + (paused_* / last_alert_state existent deja)
ALTER TABLE sites ADD COLUMN IF NOT EXISTS client_view_token text;

-- onboarding_runs: alignement schema V2
ALTER TABLE onboarding_runs ADD COLUMN IF NOT EXISTS platform text;
ALTER TABLE onboarding_runs ADD COLUMN IF NOT EXISTS draft_voice_profile jsonb;
ALTER TABLE onboarding_runs ADD COLUMN IF NOT EXISTS site_meta jsonb;
ALTER TABLE onboarding_runs ADD COLUMN IF NOT EXISTS applied_site_id uuid REFERENCES sites(id) ON DELETE SET NULL;

-- site_product_audits: snapshot original + breakdown
ALTER TABLE site_product_audits ADD COLUMN IF NOT EXISTS current_title text;
ALTER TABLE site_product_audits ADD COLUMN IF NOT EXISTS current_body_html text;
ALTER TABLE site_product_audits ADD COLUMN IF NOT EXISTS current_meta_title text;
ALTER TABLE site_product_audits ADD COLUMN IF NOT EXISTS current_meta_description text;
ALTER TABLE site_product_audits ADD COLUMN IF NOT EXISTS current_image_alts jsonb;
ALTER TABLE site_product_audits ADD COLUMN IF NOT EXISTS quality_score int;
ALTER TABLE site_product_audits ADD COLUMN IF NOT EXISTS proposed_at timestamptz;

-- site_taxonomies: snapshot image pour historique
ALTER TABLE site_taxonomies ADD COLUMN IF NOT EXISTS suggested_image_url text;

-- Image Lab runs
CREATE TABLE IF NOT EXISTS site_image_lab_runs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id     uuid REFERENCES sites(id) ON DELETE CASCADE,
  prompt      text NOT NULL,
  model       text NOT NULL DEFAULT 'fal-ai/flux/dev',
  size        text NOT NULL DEFAULT 'landscape_16_9',
  public_url  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS site_image_lab_runs_site_idx ON site_image_lab_runs (site_id, created_at DESC);

-- SCRO queries (schema V2: injection dans posts existants)
CREATE TABLE IF NOT EXISTS site_scro_queries (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id                uuid REFERENCES sites(id) ON DELETE CASCADE,
  query                  text NOT NULL,
  page_url               text,
  position               real,
  ctr                    real,
  impressions            int DEFAULT 0,
  clicks                 int DEFAULT 0,
  source                 text DEFAULT 'manual',
  suggested_injection    text,
  injected_into_post_id  text,
  imported_at            timestamptz NOT NULL DEFAULT now(),
  pushed_at              timestamptz,
  UNIQUE (site_id, query)
);
CREATE INDEX IF NOT EXISTS site_scro_queries_site_idx ON site_scro_queries (site_id, position);
