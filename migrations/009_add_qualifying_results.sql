-- Migration: Add qualifying results table for detailed qualifying data
-- This allows for qualifying analysis and complete race weekend coverage

-- Create qualifying_results table
CREATE TABLE qualifying_results (
    id SERIAL PRIMARY KEY,
    event_id VARCHAR(100) NOT NULL REFERENCES events(id),
    driver_id VARCHAR(100) NOT NULL REFERENCES drivers(id),
    team_id VARCHAR(100) NOT NULL REFERENCES teams(id),
    qualifying_position INTEGER NOT NULL,
    qualifying_time VARCHAR(20),
    qualifying_speed DECIMAL(6,3),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add comments
COMMENT ON TABLE qualifying_results IS 'NASCAR qualifying results with times and speeds';
COMMENT ON COLUMN qualifying_results.event_id IS 'Reference to the race event';
COMMENT ON COLUMN qualifying_results.driver_id IS 'Driver who qualified';
COMMENT ON COLUMN qualifying_results.team_id IS 'Team the driver qualified for';
COMMENT ON COLUMN qualifying_results.qualifying_position IS 'Qualifying position (1st, 2nd, etc.)';
COMMENT ON COLUMN qualifying_results.qualifying_time IS 'Qualifying lap time (e.g., "29.123")';
COMMENT ON COLUMN qualifying_results.qualifying_speed IS 'Qualifying speed in MPH';

-- Create indexes for efficient queries
CREATE INDEX idx_qualifying_results_event_id ON qualifying_results(event_id);
CREATE INDEX idx_qualifying_results_driver_id ON qualifying_results(driver_id);
CREATE INDEX idx_qualifying_results_team_id ON qualifying_results(team_id);
CREATE INDEX idx_qualifying_results_position ON qualifying_results(qualifying_position);
CREATE INDEX idx_qualifying_results_speed ON qualifying_results(qualifying_speed);

-- Create unique constraint to prevent duplicate qualifying entries
CREATE UNIQUE INDEX idx_qualifying_results_unique ON qualifying_results(event_id, driver_id);
