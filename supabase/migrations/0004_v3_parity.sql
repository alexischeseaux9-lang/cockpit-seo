-- ============================================================
-- V3 parity: clients, ai_usage_log, site_cro_configs, colonnes
-- enrichies. Additif et idempotent (ne casse pas les donnees V2).
-- ============================================================

-- trigger updated_at (reutilisable)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN new.updated_at = now(); RETURN new; END;
$$;

-- clients (solo mode : 1 seul row "Solo")
CREATE TABLE IF NOT EXISTS clients (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  slug          text UNIQUE NOT NULL,
  contact_email text, contact_name text, notes text,
  status        text NOT NULL DEFAULT 'active',
  onboarded_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
INSERT INTO clients (name, slug, status)
SELECT 'Solo', 'solo', 'active'
WHERE NOT EXISTS (SELECT 1 FROM clients WHERE slug = 'solo');

-- sites : client_id + last_alert_at
ALTER TABLE sites ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES clients(id) ON DELETE CASCADE;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS last_alert_at timestamptz;
UPDATE sites SET client_id = (SELECT id FROM clients WHERE slug = 'solo') WHERE client_id IS NULL;

-- ai_usage_log (tracking de couts)
CREATE TABLE IF NOT EXISTS ai_usage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK (provider IN ('anthropic','openai','fal')),
  model text NOT NULL, context text,
  input_tokens int NOT NULL DEFAULT 0,
  output_tokens int NOT NULL DEFAULT 0,
  cached_input_tokens int NOT NULL DEFAULT 0,
  cache_creation_tokens int NOT NULL DEFAULT 0,
  image_count int NOT NULL DEFAULT 0,
  image_size text,
  cost_usd numeric(12,6) NOT NULL DEFAULT 0,
  site_id uuid REFERENCES sites(id) ON DELETE SET NULL,
  job_id uuid REFERENCES site_jobs(id) ON DELETE SET NULL,
  blog_post_id uuid REFERENCES blog_posts(id) ON DELETE SET NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_usage_log_created_at_idx ON ai_usage_log (created_at DESC);
CREATE INDEX IF NOT EXISTS ai_usage_log_site_id_idx ON ai_usage_log (site_id, created_at DESC);

-- site_cro_configs (SCRO Liquid)
CREATE TABLE IF NOT EXISTS site_cro_configs (
  site_id uuid PRIMARY KEY REFERENCES sites(id) ON DELETE CASCADE,
  inline_enabled boolean NOT NULL DEFAULT false,
  sidebar_enabled boolean NOT NULL DEFAULT false,
  blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  sidebar jsonb NOT NULL DEFAULT '{}'::jsonb,
  theme_id text,
  target_asset_key text,
  last_pushed_at timestamptz,
  last_push_status text,
  last_push_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- site_taxonomies : colonnes V3 manquantes
ALTER TABLE site_taxonomies ADD COLUMN IF NOT EXISTS kind text;
ALTER TABLE site_taxonomies ADD COLUMN IF NOT EXISTS platform_payload jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE site_taxonomies ADD COLUMN IF NOT EXISTS serp_analysis jsonb;
ALTER TABLE site_taxonomies ADD COLUMN IF NOT EXISTS suggested_h1 text;
ALTER TABLE site_taxonomies ADD COLUMN IF NOT EXISTS suggested_faq jsonb;
ALTER TABLE site_taxonomies ADD COLUMN IF NOT EXISTS suggested_internal_links jsonb;
ALTER TABLE site_taxonomies ADD COLUMN IF NOT EXISTS suggested_schema jsonb;
ALTER TABLE site_taxonomies ADD COLUMN IF NOT EXISTS last_pushed_payload jsonb;

-- site_product_audits : colonnes V3 manquantes
ALTER TABLE site_product_audits ADD COLUMN IF NOT EXISTS url text;
ALTER TABLE site_product_audits ADD COLUMN IF NOT EXISTS audit_issues jsonb;
ALTER TABLE site_product_audits ADD COLUMN IF NOT EXISTS audit_metrics jsonb;
ALTER TABLE site_product_audits ADD COLUMN IF NOT EXISTS audited_at timestamptz;
ALTER TABLE site_product_audits ADD COLUMN IF NOT EXISTS proposed jsonb;
ALTER TABLE site_product_audits ADD COLUMN IF NOT EXISTS proposed_quality int;
ALTER TABLE site_product_audits ADD COLUMN IF NOT EXISTS applied_revision_meta jsonb;

-- onboarding_runs : colonnes V3
ALTER TABLE onboarding_runs ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE onboarding_runs ADD COLUMN IF NOT EXISTS discovery jsonb;
ALTER TABLE onboarding_runs ADD COLUMN IF NOT EXISTS voice_profile jsonb;
