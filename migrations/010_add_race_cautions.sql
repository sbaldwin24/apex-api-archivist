-- Migration: Add race cautions table for caution flags and incidents
-- This allows for race flow analysis and incident tracking

-- Create race_cautions table
CREATE TABLE race_cautions (
    id SERIAL PRIMARY KEY,
    event_id VARCHAR(100) NOT NULL REFERENCES events(id),
    caution_number INTEGER NOT NULL,
    lap_start INTEGER NOT NULL,
    lap_end INTEGER,
    laps_under_caution INTEGER,
    reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add comments
COMMENT ON TABLE race_cautions IS 'NASCAR race caution flags and incidents';
COMMENT ON COLUMN race_cautions.event_id IS 'Reference to the race event';
COMMENT ON COLUMN race_cautions.caution_number IS 'Sequential caution number in the race';
COMMENT ON COLUMN race_cautions.lap_start IS 'Lap when caution flag was displayed';
COMMENT ON COLUMN race_cautions.lap_end IS 'Lap when green flag was displayed';
COMMENT ON COLUMN race_cautions.laps_under_caution IS 'Total laps run under caution';
COMMENT ON COLUMN race_cautions.reason IS 'Reason for caution (accident, debris, weather, etc.)';

-- Create indexes for efficient queries
CREATE INDEX idx_race_cautions_event_id ON race_cautions(event_id);
CREATE INDEX idx_race_cautions_lap_start ON race_cautions(lap_start);
CREATE INDEX idx_race_cautions_laps_under_caution ON race_cautions(laps_under_caution);

-- Create unique constraint to prevent duplicate caution entries
CREATE UNIQUE INDEX idx_race_cautions_unique ON race_cautions(event_id, caution_number);
