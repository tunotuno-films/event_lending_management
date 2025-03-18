/*
  # Add result table for loan history

  1. New Tables
    - `result`
      - `result_id` (serial, primary key)
      - `event_id` (varchar(20), foreign key to events)
      - `item_id` (varchar(13), foreign key to items)
      - `start_datetime` (timestamptz)
      - `end_datetime` (timestamptz)

  2. Security
    - Enable RLS on `result` table
    - Add policies for authenticated users
*/

CREATE TABLE IF NOT EXISTS result (
  result_id SERIAL PRIMARY KEY,
  event_id VARCHAR(20) NOT NULL REFERENCES events(event_id),
  item_id VARCHAR(13) NOT NULL REFERENCES items(item_id),
  start_datetime TIMESTAMPTZ NOT NULL,
  end_datetime TIMESTAMPTZ,
  CONSTRAINT result_event_item_unique UNIQUE (event_id, item_id, start_datetime)
);

ALTER TABLE result ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable insert access for authenticated users"
  ON result
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Enable read access for authenticated users"
  ON result
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Enable update access for authenticated users"
  ON result
  FOR UPDATE
  TO authenticated
  USING (true);