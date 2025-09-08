-- Migration: Add race dynamics fields to events table
-- This allows for race flow and competitive analysis

-- Add race dynamics columns to events table
ALTER TABLE events 
ADD COLUMN lead_changes INTEGER,
ADD COLUMN different_leaders INTEGER;

-- Add comments for the new columns
COMMENT ON COLUMN events.lead_changes IS 'Total number of lead changes during the race';
COMMENT ON COLUMN events.different_leaders IS 'Number of different drivers who led the race';

-- Create indexes for race dynamics queries
CREATE INDEX idx_events_lead_changes ON events(lead_changes);
CREATE INDEX idx_events_different_leaders ON events(different_leaders);
