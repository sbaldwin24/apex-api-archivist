-- Migration: Add prize money field to race_results table
-- This allows for financial analysis and historical prize tracking

-- Add prize_money column to race_results
ALTER TABLE race_results 
ADD COLUMN prize_money DECIMAL(12,2);

-- Add comment for the new column
COMMENT ON COLUMN race_results.prize_money IS 'Prize money earned for this race result in USD';

-- Create index for prize money queries
CREATE INDEX idx_race_results_prize_money ON race_results(prize_money);
