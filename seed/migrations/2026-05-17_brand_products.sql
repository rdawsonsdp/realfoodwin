-- Brands enrichment: ensure logo + website URL columns exist, and add a
-- brand_products table to capture "products we like" per brand. The Real
-- Food Win brand directory reads from this so users can tap through to
-- the brand and also see curated products from that brand we recommend.

-- 1. Brand columns (idempotent — no-op if already added).
ALTER TABLE brands ADD COLUMN IF NOT EXISTS website_url text;
ALTER TABLE brands ADD COLUMN IF NOT EXISTS logo_url text;

-- 2. Curated products per brand.
CREATE TABLE IF NOT EXISTS brand_products (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id     uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name         text NOT NULL,
  description  text,
  product_url  text,
  image_url    text,
  tags         text[] NOT NULL DEFAULT '{}',
  sort_order   int  NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brand_products_brand_id ON brand_products(brand_id);
CREATE INDEX IF NOT EXISTS idx_brand_products_sort     ON brand_products(brand_id, sort_order);

-- 3. RLS — public read so the directory renders for anonymous visitors.
ALTER TABLE brand_products ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "brand_products public read" ON brand_products
    FOR SELECT TO anon, authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Write access is service-role-only (no policy = denied for anon/authenticated).
