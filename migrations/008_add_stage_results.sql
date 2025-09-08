-- Migration: Add stage results table for NASCAR stage winners and points
-- This allows for stage-specific analysis and fantasy scoring

-- Create stage_results table
CREATE TABLE stage_results (
    id SERIAL PRIMARY KEY,
    event_id VARCHAR(100) NOT NULL REFERENCES events(id),
    stage_number INTEGER NOT NULL,
    driver_id VARCHAR(100) NOT NULL REFERENCES drivers(id),
    team_id VARCHAR(100) NOT NULL REFERENCES teams(id),
    stage_points INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add comments
COMMENT ON TABLE stage_results IS 'NASCAR stage winners and points earned per stage';
COMMENT ON COLUMN stage_results.event_id IS 'Reference to the race event';
COMMENT ON COLUMN stage_results.stage_number IS 'Stage number (1, 2, etc.)';
COMMENT ON COLUMN stage_results.driver_id IS 'Driver who won the stage';
COMMENT ON COLUMN stage_results.team_id IS 'Team the driver competed for';
COMMENT ON COLUMN stage_results.stage_points IS 'Points earned for winning the stage';

-- Create indexes for efficient queries
CREATE INDEX idx_stage_results_event_id ON stage_results(event_id);
CREATE INDEX idx_stage_results_driver_id ON stage_results(driver_id);
CREATE INDEX idx_stage_results_team_id ON stage_results(team_id);
CREATE INDEX idx_stage_results_stage_number ON stage_results(stage_number);

-- Create unique constraint to prevent duplicate stage winners
CREATE UNIQUE INDEX idx_stage_results_unique ON stage_results(event_id, stage_number);
