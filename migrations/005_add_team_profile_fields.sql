-- Migration: Add team profile fields to teams table
-- This allows for comprehensive team analysis and demographics

-- Add team profile columns
ALTER TABLE teams 
ADD COLUMN owner VARCHAR(150),
ADD COLUMN location VARCHAR(150),
ADD COLUMN founded_year INTEGER;

-- Add comments for the new columns
COMMENT ON COLUMN teams.owner IS 'Team owner or ownership group';
COMMENT ON COLUMN teams.location IS 'Team headquarters location (city, state)';
COMMENT ON COLUMN teams.founded_year IS 'Year the team was founded';

-- Create indexes for team profile queries
CREATE INDEX idx_teams_location ON teams(location);
CREATE INDEX idx_teams_founded_year ON teams(founded_year);
