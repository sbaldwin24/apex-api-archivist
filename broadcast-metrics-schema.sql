-- Detailed Broadcast Metrics Schema
CREATE TABLE IF NOT EXISTS detailed_broadcast_metrics (
  id SERIAL PRIMARY KEY,
  event_id VARCHAR(150) NOT NULL REFERENCES events(id),
  driver_id VARCHAR(100) NOT NULL REFERENCES drivers(id),
  total_camera_time INTEGER NOT NULL, -- Total seconds on camera
  in_car_camera_time INTEGER DEFAULT 0, -- In-car camera seconds
  onboard_camera_time INTEGER DEFAULT 0, -- Onboard camera seconds
  victory_lane_time INTEGER DEFAULT 0, -- Victory lane coverage seconds
  interview_time INTEGER DEFAULT 0, -- Interview time seconds
  commentator_mentions INTEGER DEFAULT 0, -- Number of mentions
  media_value BIGINT DEFAULT 0, -- Calculated dollar value of exposure
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(event_id, driver_id)
);

-- Sponsor Logo Visibility Schema
CREATE TABLE IF NOT EXISTS sponsor_visibility (
  id SERIAL PRIMARY KEY,
  event_id VARCHAR(150) NOT NULL REFERENCES events(id),
  driver_id VARCHAR(100) NOT NULL REFERENCES drivers(id),
  sponsor_name VARCHAR(200) NOT NULL,
  visibility_time INTEGER NOT NULL, -- Seconds sponsor logo/name was visible
  visibility_type VARCHAR(50), -- 'car_logo', 'uniform', 'backdrop', 'graphic'
  prominence INTEGER DEFAULT 5, -- 1-10 scale of visibility prominence
  estimated_value BIGINT DEFAULT 0, -- Dollar value of this visibility
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(event_id, driver_id, sponsor_name)
);

-- Network TV Ratings Schema
CREATE TABLE IF NOT EXISTS network_ratings (
  id SERIAL PRIMARY KEY,
  event_id VARCHAR(150) UNIQUE NOT NULL REFERENCES events(id),
  network VARCHAR(50) NOT NULL, -- 'FOX', 'NBC', 'FS1', 'USA'
  total_viewers BIGINT NOT NULL,
  peak_viewers BIGINT NOT NULL,
  average_viewers BIGINT NOT NULL,
  rating DECIMAL(4,1), -- Nielsen rating
  share DECIMAL(4,1), -- Market share percentage
  demographics JSONB, -- Age group breakdowns
  market_breakdown JSONB, -- Geographic market ratings
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Broadcast Segments Schema
CREATE TABLE IF NOT EXISTS broadcast_segments (
  id SERIAL PRIMARY KEY,
  event_id VARCHAR(150) NOT NULL REFERENCES events(id),
  driver_id VARCHAR(100) REFERENCES drivers(id),
  segment_type VARCHAR(50) NOT NULL, -- 'race', 'interview', 'victory_lane', 'commercial'
  start_time TIME,
  duration INTEGER NOT NULL, -- Seconds
  driver_focus BOOLEAN DEFAULT FALSE,
  sponsor_mentions TEXT[], -- Array of sponsor names mentioned
  segment_value BIGINT DEFAULT 0, -- Calculated value of this segment
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Commercial Mentions Schema
CREATE TABLE IF NOT EXISTS commercial_mentions (
  id SERIAL PRIMARY KEY,
  event_id VARCHAR(150) NOT NULL REFERENCES events(id),
  sponsor_name VARCHAR(200) NOT NULL,
  mention_type VARCHAR(50), -- 'direct_mention', 'graphic_display', 'product_placement'
  mention_time TIME,
  duration INTEGER DEFAULT 0, -- Seconds
  estimated_reach BIGINT, -- Number of viewers who saw this mention
  estimated_value BIGINT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Media Value Calculations Schema
CREATE TABLE IF NOT EXISTS media_value_calculations (
  id SERIAL PRIMARY KEY,
  event_id VARCHAR(150) NOT NULL REFERENCES events(id),
  sponsor_name VARCHAR(200) NOT NULL,
  calculation_type VARCHAR(50), -- 'tv_exposure', 'digital_mention', 'social_media'
  base_viewership BIGINT,
  exposure_time INTEGER, -- Seconds
  prominence_multiplier DECIMAL(3,2), -- 0.1 to 10.0
  cost_per_second DECIMAL(10,2), -- Dollar cost per second of equivalent ad time
  total_media_value BIGINT,
  calculation_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Broadcast ROI Summary Schema
CREATE TABLE IF NOT EXISTS broadcast_roi_summary (
  id SERIAL PRIMARY KEY,
  event_id VARCHAR(150) NOT NULL REFERENCES events(id),
  driver_id VARCHAR(100) NOT NULL REFERENCES drivers(id),
  sponsor_name VARCHAR(200) NOT NULL,
  total_exposure_time INTEGER, -- Total seconds across all broadcast types
  total_media_value BIGINT, -- Combined value of all exposure
  contract_investment BIGINT, -- Annual contract value allocated to this event
  activation_investment BIGINT, -- Activation costs for this event
  broadcast_roi_percentage DECIMAL(8,2), -- ROI from broadcast exposure alone
  equivalent_ad_cost BIGINT, -- What this exposure would cost as paid advertising
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(event_id, driver_id, sponsor_name)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_broadcast_metrics_event ON detailed_broadcast_metrics(event_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_metrics_driver ON detailed_broadcast_metrics(driver_id);
CREATE INDEX IF NOT EXISTS idx_sponsor_visibility_event ON sponsor_visibility(event_id);
CREATE INDEX IF NOT EXISTS idx_sponsor_visibility_sponsor ON sponsor_visibility(sponsor_name);
CREATE INDEX IF NOT EXISTS idx_network_ratings_event ON network_ratings(event_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_segments_event ON broadcast_segments(event_id);
CREATE INDEX IF NOT EXISTS idx_commercial_mentions_event ON commercial_mentions(event_id);
CREATE INDEX IF NOT EXISTS idx_commercial_mentions_sponsor ON commercial_mentions(sponsor_name);
CREATE INDEX IF NOT EXISTS idx_media_calculations_event ON media_value_calculations(event_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_roi_event ON broadcast_roi_summary(event_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_roi_sponsor ON broadcast_roi_summary(sponsor_name);
