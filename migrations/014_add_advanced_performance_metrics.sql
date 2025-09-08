-- Migration: Add advanced performance metrics to race results
-- This enables granular analysis for fantasy sports and betting applications

-- Add advanced performance columns to race_results table
ALTER TABLE race_results 
ADD COLUMN fastest_laps INTEGER,
ADD COLUMN passes_made INTEGER,
ADD COLUMN quality_passes INTEGER,
ADD COLUMN avg_running_position DECIMAL(5,2);

-- Add comments for the new columns
COMMENT ON COLUMN race_results.fastest_laps IS 'Number of times driver had fastest lap in race';
COMMENT ON COLUMN race_results.passes_made IS 'Total number of green flag passes made';
COMMENT ON COLUMN race_results.quality_passes IS 'Number of passes made on top-15 cars under green';
COMMENT ON COLUMN race_results.avg_running_position IS 'Average position throughout the race';

-- Create indexes for performance queries
CREATE INDEX idx_race_results_fastest_laps ON race_results(fastest_laps);
CREATE INDEX idx_race_results_passes_made ON race_results(passes_made);
CREATE INDEX idx_race_results_quality_passes ON race_results(quality_passes);
CREATE INDEX idx_race_results_avg_running_position ON race_results(avg_running_position);
