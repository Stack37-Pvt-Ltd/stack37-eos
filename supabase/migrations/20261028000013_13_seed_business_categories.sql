-- ============================================================================
-- Migration: 20261028000013_13_seed_business_categories.sql
-- Description: Seed approved business categories with valid database UUIDs.
-- Task: TASK-UK-SUPER-001 / TASK-STAB-005
-- Authority: CEO Directive — Isolated Business Category Provisioning
-- Invariant: Idempotent execution; preserves existing UUIDs on conflict.
-- ============================================================================

INSERT INTO public.business_categories (id, name, description)
VALUES
  (gen_random_uuid(), 'Retail & E-Commerce', 'Consumer goods, storefronts, supermarkets, and online retail'),
  (gen_random_uuid(), 'Professional Services', 'Consulting, legal, accounting, and advisory'),
  (gen_random_uuid(), 'Wholesale & Distribution', 'B2B distribution, supply chain, and logistics'),
  (gen_random_uuid(), 'Manufacturing & Industrial', 'Production, processing, and assembly'),
  (gen_random_uuid(), 'Software & Technology', 'SaaS, digital products, IT, and telecom'),
  (gen_random_uuid(), 'Healthcare & Life Sciences', 'Clinics, pharmacies, medical equipment'),
  (gen_random_uuid(), 'Hospitality & Food Services', 'Hotels, restaurants, catering, and tourism'),
  (gen_random_uuid(), 'Construction & Real Estate', 'Building contracting, engineering, property')
ON CONFLICT (name) DO UPDATE
SET description = EXCLUDED.description;
