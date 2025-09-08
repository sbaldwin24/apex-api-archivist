-- Migration: Add driver rating field to race_results table
-- This allows for advanced performance analysis and fantasy sports applications

-- Add driver_rating column to race_results
ALTER TABLE race_results 
ADD COLUMN driver_rating DECIMAL(5,1);

-- Add comment for the new column
COMMENT ON COLUMN race_results.driver_rating IS 'NASCAR Driver Rating for this race (0.0-150.0+)';

-- Create index for driver rating queries
CREATE INDEX idx_race_results_driver_rating ON race_results(driver_rating);
