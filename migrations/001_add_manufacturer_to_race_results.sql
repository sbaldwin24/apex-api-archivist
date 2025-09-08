-- Migration: Add manufacturer field to race_results table
-- This allows for more granular manufacturer analysis per race result

-- Add manufacturer column to race_results
ALTER TABLE race_results 
ADD COLUMN manufacturer VARCHAR(50);

-- Add comment for the new column
COMMENT ON COLUMN race_results.manufacturer IS 'Car manufacturer for this specific race result (e.g., Chevrolet, Ford, Toyota)';

-- Create index for manufacturer queries
CREATE INDEX idx_race_results_manufacturer ON race_results(manufacturer);

-- Update existing records to populate manufacturer from teams table
UPDATE race_results 
SET manufacturer = teams.manufacturer 
FROM teams 
WHERE race_results.team_id = teams.id 
AND race_results.manufacturer IS NULL;
