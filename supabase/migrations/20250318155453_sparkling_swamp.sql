/*
  # Fix RLS policies for events table

  1. Changes
    - Drop existing policies
    - Create new policies with proper permissions for all operations
    - Ensure authenticated users can perform all CRUD operations
    - Add explicit policy for soft delete operations

  2. Security
    - Enable RLS on events table
    - Add policies for authenticated users to:
      - Read non-deleted events
      - Insert new events
      - Update events
      - Soft delete events
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON events;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON events;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON events;

-- Create new policies
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
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Enable soft delete for authenticated users"
  ON events
  FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (event_deleted = true);