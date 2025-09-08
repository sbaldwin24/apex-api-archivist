-- Migration: Add practice sessions table for complete race weekend coverage
-- This enables practice performance analysis for fantasy and betting applications

-- Create practice_sessions table
CREATE TABLE practice_sessions (
    id SERIAL PRIMARY KEY,
    event_id VARCHAR(100) NOT NULL REFERENCES events(id),
    session_name VARCHAR(100) NOT NULL,
    session_date TIMESTAMP,
    session_duration INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create practice_results table
CREATE TABLE practice_results (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES practice_sessions(id),
    driver_id VARCHAR(100) NOT NULL REFERENCES drivers(id),
    team_id VARCHAR(100) NOT NULL REFERENCES teams(id),
    position INTEGER,
    best_time VARCHAR(20),
    best_speed DECIMAL(6,3),
    laps_completed INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add comments
COMMENT ON TABLE practice_sessions IS 'NASCAR practice sessions for each race weekend';
COMMENT ON COLUMN practice_sessions.event_id IS 'Reference to the race event';
COMMENT ON COLUMN practice_sessions.session_name IS 'Practice session name (Practice 1, Practice 2, etc.)';
COMMENT ON COLUMN practice_sessions.session_date IS 'Date and time of practice session';
COMMENT ON COLUMN practice_sessions.session_duration IS 'Session duration in minutes';

COMMENT ON TABLE practice_results IS 'Individual driver results from practice sessions';
COMMENT ON COLUMN practice_results.session_id IS 'Reference to the practice session';
COMMENT ON COLUMN practice_results.driver_id IS 'Driver who participated';
COMMENT ON COLUMN practice_results.team_id IS 'Team the driver practiced for';
COMMENT ON COLUMN practice_results.position IS 'Position in practice session (1st, 2nd, etc.)';
COMMENT ON COLUMN practice_results.best_time IS 'Best lap time in session';
COMMENT ON COLUMN practice_results.best_speed IS 'Best speed achieved in MPH';
COMMENT ON COLUMN practice_results.laps_completed IS 'Total laps completed in session';

-- Create indexes for efficient queries
CREATE INDEX idx_practice_sessions_event_id ON practice_sessions(event_id);
CREATE INDEX idx_practice_sessions_date ON practice_sessions(session_date);
CREATE INDEX idx_practice_results_session_id ON practice_results(session_id);
CREATE INDEX idx_practice_results_driver_id ON practice_results(driver_id);
CREATE INDEX idx_practice_results_team_id ON practice_results(team_id);
CREATE INDEX idx_practice_results_position ON practice_results(position);
CREATE INDEX idx_practice_results_speed ON practice_results(best_speed);

-- Create unique constraint to prevent duplicate practice entries
CREATE UNIQUE INDEX idx_practice_results_unique ON practice_results(session_id, driver_id);
