-- Add points/standings table
CREATE TABLE driver_standings (
  id SERIAL PRIMARY KEY,
  season_id INTEGER NOT NULL REFERENCES seasons(id),
  driver_id VARCHAR(100) NOT NULL REFERENCES drivers(id),
  race_number INTEGER NOT NULL,
  points INTEGER NOT NULL,
  wins INTEGER DEFAULT 0,
  position INTEGER NOT NULL,
  points_behind INTEGER DEFAULT 0,
  UNIQUE(season_id, driver_id, race_number)
);

-- Add qualifying results table
CREATE TABLE qualifying_results (
  id SERIAL PRIMARY KEY,
  event_id VARCHAR(150) NOT NULL REFERENCES events(id),
  driver_id VARCHAR(100) NOT NULL REFERENCES drivers(id),
  team_id VARCHAR(100) NOT NULL REFERENCES teams(id),
  car_number VARCHAR(10) NOT NULL,
  qualifying_position INTEGER NOT NULL,
  qualifying_speed NUMERIC(6,3),
  qualifying_time VARCHAR(20),
  UNIQUE(event_id, driver_id)
);

-- Add stage results table
CREATE TABLE stage_results (
  id SERIAL PRIMARY KEY,
  event_id VARCHAR(150) NOT NULL REFERENCES events(id),
  stage_number INTEGER NOT NULL,
  driver_id VARCHAR(100) NOT NULL REFERENCES drivers(id),
  stage_position INTEGER NOT NULL,
  stage_points INTEGER DEFAULT 0,
  UNIQUE(event_id, stage_number, driver_id)
);

-- Add points and playoff points to race_results
ALTER TABLE race_results 
ADD COLUMN points_earned INTEGER DEFAULT 0,
ADD COLUMN playoff_points INTEGER DEFAULT 0;
