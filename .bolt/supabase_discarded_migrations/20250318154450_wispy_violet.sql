/*
  # Create events table if not exists

  1. New Tables
    - `events`
      - `event_id` (varchar(20), primary key)
      - `name` (varchar(50), not null)
      - `created_at` (timestamp with time zone)

  Note: Policies are already created in previous migrations
*/

-- Create the events table if it doesn't exist
CREATE TABLE IF NOT EXISTS events (
  event_id VARCHAR(20) PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);