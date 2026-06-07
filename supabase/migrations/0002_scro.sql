-- ============================================================
-- SITE_SCRO : ingestion manuelle des positions Search Console.
-- Sert a reperer les mots-cles a fort potentiel (impressions hautes,
-- position basse) et a declencher la generation d'articles ciblee.
-- ============================================================
CREATE TABLE IF NOT EXISTS site_scro (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id       uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  query         text NOT NULL,
  position      numeric,
  clicks        int NOT NULL DEFAULT 0,
  impressions   int NOT NULL DEFAULT 0,
  url           text,
  enqueued      boolean NOT NULL DEFAULT false,
  ingested_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_id, query)
);
CREATE INDEX IF NOT EXISTS site_scro_site_idx ON site_scro (site_id, position);
