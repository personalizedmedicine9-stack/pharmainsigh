/*
  # Add cached_results table for query caching

  1. New Tables
    - `cached_results`
      - `id` (uuid, primary key)
      - `cache_key` (text, unique) — normalized "drug::herb" key
      - `drug` (text) — drug name as searched
      - `herb` (text) — herb name as searched
      - `results` (jsonb) — full JSON array of StudyResult objects
      - `sources_used` (text[]) — APIs that contributed data
      - `fda_data` (jsonb) — OpenFDA data for the drug, nullable
      - `total` (integer) — number of results cached
      - `top_citation_count` (integer)
      - `cached_at` (timestamptz) — when cache was written
      - `expires_at` (timestamptz) — cache TTL (7 days)

  2. Security
    - Enable RLS
    - Allow anon/authenticated to read and insert (service role handles deletes via TTL)

  3. Index
    - Index on cache_key for fast lookup
    - Index on expires_at for TTL cleanup
*/

CREATE TABLE IF NOT EXISTS cached_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key text UNIQUE NOT NULL,
  drug text NOT NULL DEFAULT '',
  herb text NOT NULL DEFAULT '',
  results jsonb NOT NULL DEFAULT '[]'::jsonb,
  sources_used text[] NOT NULL DEFAULT ARRAY[]::text[],
  fda_data jsonb DEFAULT NULL,
  total integer NOT NULL DEFAULT 0,
  top_citation_count integer NOT NULL DEFAULT 0,
  cached_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days')
);

CREATE INDEX IF NOT EXISTS cached_results_cache_key_idx ON cached_results (cache_key);
CREATE INDEX IF NOT EXISTS cached_results_expires_at_idx ON cached_results (expires_at);

ALTER TABLE cached_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read cached results"
  ON cached_results
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert cached results"
  ON cached_results
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update cached results"
  ON cached_results
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
