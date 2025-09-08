-- Sponsor ROI Tracker Schema Extension
-- Add to existing schema.sql

-- Sponsors table
CREATE TABLE IF NOT EXISTS sponsors (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  industry VARCHAR(100),
  logo_url VARCHAR(500),
  website VARCHAR(300),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sponsor partnerships (many-to-many between sponsors and teams/drivers)
CREATE TABLE IF NOT EXISTS sponsor_partnerships (
  id SERIAL PRIMARY KEY,
  sponsor_id VARCHAR(100) NOT NULL REFERENCES sponsors(id),
  team_id VARCHAR(100) REFERENCES teams(id),
  driver_id VARCHAR(100) REFERENCES drivers(id),
  contract_start DATE,
  contract_end DATE,
  placement_type VARCHAR(50), -- 'primary', 'associate', 'contingency'
  estimated_value DECIMAL(12,2),
  status VARCHAR(20) DEFAULT 'active' -- 'active', 'expired', 'pending'
);

-- Brand exposure tracking per race
CREATE TABLE IF NOT EXISTS brand_exposures (
  id SERIAL PRIMARY KEY,
  event_id VARCHAR(150) NOT NULL REFERENCES events(id),
  sponsor_id VARCHAR(100) NOT NULL REFERENCES sponsors(id),
  driver_id VARCHAR(100) REFERENCES drivers(id),
  exposure_type VARCHAR(50), -- 'car_placement', 'tv_mention', 'social_media'
  duration_seconds INTEGER,
  estimated_impressions BIGINT,
  engagement_score DECIMAL(5,2),
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Campaign tracking
CREATE TABLE IF NOT EXISTS sponsor_campaigns (
  id SERIAL PRIMARY KEY,
  sponsor_id VARCHAR(100) NOT NULL REFERENCES sponsors(id),
  name VARCHAR(200) NOT NULL,
  start_date DATE,
  end_date DATE,
  budget DECIMAL(12,2),
  target_impressions BIGINT,
  status VARCHAR(20) DEFAULT 'active'
);

-- User favorites for sponsors/teams
CREATE TABLE IF NOT EXISTS user_favorites (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(100) NOT NULL,
  sponsor_id VARCHAR(100) REFERENCES sponsors(id),
  team_id VARCHAR(100) REFERENCES teams(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance (only create if they don't exist)
CREATE INDEX IF NOT EXISTS idx_sponsor_partnerships_sponsor ON sponsor_partnerships(sponsor_id);
CREATE INDEX IF NOT EXISTS idx_brand_exposures_event ON brand_exposures(event_id);
CREATE INDEX IF NOT EXISTS idx_brand_exposures_sponsor ON brand_exposures(sponsor_id);
