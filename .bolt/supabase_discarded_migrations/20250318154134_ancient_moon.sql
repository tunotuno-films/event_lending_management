/*
  # Create events table with policies

  1. New Tables
    - `events`
      - `event_id` (varchar(20), primary key)
      - `name` (varchar(50), not null)
      - `created_at` (timestamp with time zone)

  2. Security
    - Enable RLS on `events` table
    - Add policies for authenticated users to:
      - Read events
      - Insert new events
      - Update existing events
*/

-- Create the events table
CREATE TABLE IF NOT EXISTS events (
  event_id VARCHAR(20) PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Enable Row Level Security
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Enable read access for authenticated users"
  ON events
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Enable insert access for authenticated users"
  ON events
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Enable update access for authenticated users"
  ON events
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);