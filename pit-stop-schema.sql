-- Pit Stop Performance Schema
CREATE TABLE IF NOT EXISTS pit_stops (
  id SERIAL PRIMARY KEY,
  event_id VARCHAR(150) NOT NULL REFERENCES events(id),
  driver_id VARCHAR(100) NOT NULL REFERENCES drivers(id),
  car_number VARCHAR(10) NOT NULL,
  pit_stop_number INTEGER NOT NULL,
  pit_time DECIMAL(5,3), -- seconds
  positions_gained INTEGER DEFAULT 0,
  positions_lost INTEGER DEFAULT 0,
  fastest_stop BOOLEAN DEFAULT FALSE,
  pit_crew_sponsor VARCHAR(200),
  UNIQUE(event_id, driver_id, pit_stop_number)
);

-- Caution/Incident Data Schema
CREATE TABLE IF NOT EXISTS cautions (
  id SERIAL PRIMARY KEY,
  event_id VARCHAR(150) NOT NULL REFERENCES events(id),
  caution_number INTEGER NOT NULL,
  lap_start INTEGER NOT NULL,
  lap_end INTEGER,
  reason VARCHAR(500),
  drivers_involved TEXT[],
  lucky_dog_recipient VARCHAR(100),
  wave_around_cars TEXT[],
  UNIQUE(event_id, caution_number)
);

-- Social Media Metrics Schema
CREATE TABLE IF NOT EXISTS social_media_metrics (
  id SERIAL PRIMARY KEY,
  event_id VARCHAR(150) REFERENCES events(id),
  driver_id VARCHAR(100) REFERENCES drivers(id),
  platform VARCHAR(50) NOT NULL, -- 'twitter', 'instagram', 'facebook'
  post_date TIMESTAMP NOT NULL,
  post_content TEXT,
  mentions INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  sponsor_mentions TEXT[],
  hashtags TEXT[],
  scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pit_stops_event ON pit_stops(event_id);
CREATE INDEX IF NOT EXISTS idx_cautions_event ON cautions(event_id);
CREATE INDEX IF NOT EXISTS idx_social_media_date ON social_media_metrics(post_date);
CREATE INDEX IF NOT EXISTS idx_social_media_platform ON social_media_metrics(platform);
