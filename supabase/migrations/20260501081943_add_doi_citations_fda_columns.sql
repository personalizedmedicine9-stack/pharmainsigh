/*
  # Extend search_history with enriched metadata columns

  1. Modified Tables
    - `search_history`
      - Add `sources_used` (text[]) — list of APIs queried (PubMed, CrossRef, OpenAlex, OpenFDA)
      - Add `top_citation_count` (integer) — highest citation count in the result set
      - Add `has_fda_data` (boolean) — whether OpenFDA returned drug data

  2. Notes
    - All new columns are nullable to preserve backwards compatibility with existing rows
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'search_history' AND column_name = 'sources_used'
  ) THEN
    ALTER TABLE search_history ADD COLUMN sources_used text[] DEFAULT ARRAY[]::text[];
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'search_history' AND column_name = 'top_citation_count'
  ) THEN
    ALTER TABLE search_history ADD COLUMN top_citation_count integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'search_history' AND column_name = 'has_fda_data'
  ) THEN
    ALTER TABLE search_history ADD COLUMN has_fda_data boolean DEFAULT false;
  END IF;
END $$;
