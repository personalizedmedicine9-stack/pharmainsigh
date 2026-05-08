/*
  # Create Drug-Herb Interaction Search History Table

  1. New Tables
    - `search_history`
      - `id` (uuid, primary key)
      - `drug` (text) - the drug name searched
      - `herb` (text) - the herb name searched
      - `results_count` (integer) - number of results returned
      - `searched_at` (timestamptz) - when the search was performed

  2. Security
    - Enable RLS on `search_history` table
    - Add policy for public insert (anonymous searches)
    - Add policy for public select to show recent searches
*/

CREATE TABLE IF NOT EXISTS search_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drug text NOT NULL DEFAULT '',
  herb text NOT NULL DEFAULT '',
  results_count integer NOT NULL DEFAULT 0,
  searched_at timestamptz DEFAULT now()
);

ALTER TABLE search_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert search history"
  ON search_history
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can view search history"
  ON search_history
  FOR SELECT
  TO anon, authenticated
  USING (true);
