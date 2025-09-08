-- Stage Results Schema
CREATE TABLE IF NOT EXISTS stages (
  id SERIAL PRIMARY KEY,
  event_id VARCHAR(150) NOT NULL REFERENCES events(id),
  stage_number INTEGER NOT NULL,
  stage_name VARCHAR(100), -- 'Stage 1', 'Stage 2', 'Final Stage'
  laps INTEGER,
  UNIQUE(event_id, stage_number)
);

CREATE TABLE IF NOT EXISTS stage_results (
  id SERIAL PRIMARY KEY,
  stage_id INTEGER NOT NULL REFERENCES stages(id),
  driver_id VARCHAR(100) NOT NULL REFERENCES drivers(id),
  finish_position INTEGER NOT NULL,
  points_earned INTEGER DEFAULT 0,
  playoff_points INTEGER DEFAULT 0,
  laps_led INTEGER DEFAULT 0,
  UNIQUE(stage_id, driver_id)
);

-- Drop existing indexes if they exist
DROP INDEX IF EXISTS idx_stage_results_stage;
DROP INDEX IF EXISTS idx_stage_results_driver;

-- Create indexes with correct column names
CREATE INDEX IF NOT EXISTS idx_stage_results_stage_id ON stage_results(stage_id);
CREATE INDEX IF NOT EXISTS idx_stage_results_driver_id ON stage_results(driver_id);
