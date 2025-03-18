/*
  # Update control table datetime column

  1. Changes
    - Rename created_at column to control_datetime in control table
    - Keep all existing functionality and constraints
    - Maintain RLS policies

  2. Notes
    - Using IF EXISTS checks for safety
    - Preserving the default CURRENT_TIMESTAMP behavior
*/

DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'control' 
    AND column_name = 'created_at'
  ) THEN
    ALTER TABLE control RENAME COLUMN created_at TO control_datetime;
  END IF;
END $$;