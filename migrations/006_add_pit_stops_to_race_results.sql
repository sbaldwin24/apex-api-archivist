-- Migration: Add pit stops field to race_results table
-- This allows for advanced race strategy and performance analysis

-- Add pit_stops column to race_results
ALTER TABLE race_results 
ADD COLUMN pit_stops INTEGER;

-- Add comment for the new column
COMMENT ON COLUMN race_results.pit_stops IS 'Number of pit stops made during the race';

-- Create index for pit stops queries
CREATE INDEX idx_race_results_pit_stops ON race_results(pit_stops);
