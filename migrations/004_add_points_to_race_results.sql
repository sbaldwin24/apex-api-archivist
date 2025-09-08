-- Migration: Add points field to race_results table
-- This allows for championship and performance analysis

-- Add points column to race_results
ALTER TABLE race_results 
ADD COLUMN points INTEGER;

-- Add comment for the new column
COMMENT ON COLUMN race_results.points IS 'Championship points earned for this race result';

-- Create index for points queries
CREATE INDEX idx_race_results_points ON race_results(points);
