/*
  # Add event_deleted flag to events table

  1. Changes
    - Add event_deleted column to events table with default value of false
    - Update RLS policies to consider event_deleted flag

  2. Security
    - Modify RLS policies to only show non-deleted events by default
    - Allow authenticated users to soft delete events
*/

-- Add event_deleted column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'events' AND column_name = 'event_deleted'
  ) THEN
    ALTER TABLE events ADD COLUMN event_deleted BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Drop existing policies
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON events;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON events;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON events;

-- Create new policies that consider the event_deleted flag
CREATE POLICY "Enable read access for authenticated users"
  ON events
  FOR SELECT
  TO authenticated
  USING (event_deleted = false);

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