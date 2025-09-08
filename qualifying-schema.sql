-- Qualifying Results Schema
CREATE TABLE IF NOT EXISTS qualifying_results (
  id SERIAL PRIMARY KEY,
  event_id VARCHAR(150) NOT NULL REFERENCES events(id),
  driver_id VARCHAR(100) NOT NULL REFERENCES drivers(id),
  car_number VARCHAR(10) NOT NULL,
  qualifying_position INTEGER NOT NULL,
  qualifying_time VARCHAR(20),
  qualifying_speed DECIMAL(6,3),
  round VARCHAR(20), -- 'Round 1', 'Round 2', 'Round 3'
  pole_winner BOOLEAN DEFAULT FALSE,
  UNIQUE(event_id, driver_id, round)
);

CREATE INDEX IF NOT EXISTS idx_qualifying_event ON qualifying_results(event_id);
CREATE INDEX IF NOT EXISTS idx_qualifying_position ON qualifying_results(qualifying_position);
