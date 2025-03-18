/*
  # Update timezone settings for Japanese time

  1. Changes
    - Set timezone to 'Asia/Tokyo' for all timestamp operations
*/

ALTER DATABASE postgres SET timezone TO 'Asia/Tokyo';

-- Update existing data to use Asia/Tokyo timezone
UPDATE items SET registered_date = registered_date AT TIME ZONE 'Asia/Tokyo';
UPDATE events SET created_at = created_at AT TIME ZONE 'Asia/Tokyo';
UPDATE control SET control_datetime = control_datetime AT TIME ZONE 'Asia/Tokyo';
UPDATE result SET 
  start_datetime = start_datetime AT TIME ZONE 'Asia/Tokyo',
  end_datetime = CASE 
    WHEN end_datetime IS NOT NULL THEN end_datetime AT TIME ZONE 'Asia/Tokyo'
    ELSE NULL
  END;