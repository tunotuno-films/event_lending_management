/*
  # Create control table for event items

  1. New Tables
    - `control`
      - `control_id` (serial, primary key)
      - `event_id` (varchar(20), foreign key to events)
      - `item_id` (varchar(13), foreign key to items)
      - `status` (boolean, default false)
      - `created_at` (timestamp with time zone)

  2. Security
    - Enable RLS on control table
    - Add policies for authenticated users to:
      - Read control records
      - Insert new control records
      - Update control records
*/

CREATE TABLE IF NOT EXISTS control (
  control_id SERIAL PRIMARY KEY,
  event_id VARCHAR(20) NOT NULL REFERENCES events(event_id),
  item_id VARCHAR(13) NOT NULL REFERENCES items(item_id),
  status BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(event_id, item_id)
);

-- Enable Row Level Security
ALTER TABLE control ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Enable read access for authenticated users"
  ON control
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Enable insert access for authenticated users"
  ON control
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Enable update access for authenticated users"
  ON control
  FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL);