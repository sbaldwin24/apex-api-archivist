-- Telemetry Data Schema
CREATE TABLE IF NOT EXISTS telemetry_data (
  id SERIAL PRIMARY KEY,
  event_id VARCHAR(150) NOT NULL REFERENCES events(id),
  driver_id VARCHAR(100) NOT NULL REFERENCES drivers(id),
  lap_number INTEGER NOT NULL,
  lap_time DECIMAL(8,3) NOT NULL, -- seconds
  speed DECIMAL(6,2) NOT NULL, -- mph
  throttle_position DECIMAL(5,2), -- 0-100%
  brake_position DECIMAL(5,2), -- 0-100%
  steering_angle DECIMAL(6,2), -- degrees
  rpm INTEGER,
  gear INTEGER,
  track_position DECIMAL(10,2), -- feet from start/finish
  sector_times JSONB, -- [sector1, sector2, sector3] times
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(event_id, driver_id, lap_number)
);

-- Tire Strategy Schema
CREATE TABLE IF NOT EXISTS tire_strategy (
  id SERIAL PRIMARY KEY,
  event_id VARCHAR(150) NOT NULL REFERENCES events(id),
  driver_id VARCHAR(100) NOT NULL REFERENCES drivers(id),
  pit_stop_number INTEGER NOT NULL,
  lap_number INTEGER NOT NULL,
  tire_compound VARCHAR(20), -- 'soft', 'medium', 'hard'
  tire_age INTEGER DEFAULT 0, -- laps on current tires
  pit_stop_duration DECIMAL(5,2), -- seconds
  fuel_added DECIMAL(5,2), -- gallons
  adjustments TEXT[], -- array of adjustments made
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(event_id, driver_id, pit_stop_number)
);

-- Fuel Data Schema
CREATE TABLE IF NOT EXISTS fuel_data (
  id SERIAL PRIMARY KEY,
  event_id VARCHAR(150) NOT NULL REFERENCES events(id),
  driver_id VARCHAR(100) NOT NULL REFERENCES drivers(id),
  lap_number INTEGER NOT NULL,
  fuel_remaining DECIMAL(5,2), -- gallons
  fuel_consumption DECIMAL(4,2), -- mpg
  estimated_range INTEGER, -- laps remaining on current fuel
  fuel_saving BOOLEAN DEFAULT FALSE,
  avg_consumption DECIMAL(4,2), -- race average mpg
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(event_id, driver_id, lap_number)
);

-- Car Setup Schema
CREATE TABLE IF NOT EXISTS car_setup (
  id SERIAL PRIMARY KEY,
  event_id VARCHAR(150) NOT NULL REFERENCES events(id),
  driver_id VARCHAR(100) NOT NULL REFERENCES drivers(id),
  session_type VARCHAR(20) NOT NULL, -- 'practice', 'qualifying', 'race'
  front_spoiler DECIMAL(4,2), -- degrees
  rear_spoiler DECIMAL(4,2), -- degrees
  wedge DECIMAL(6,2), -- pounds
  track_bar DECIMAL(4,2), -- inches
  gear_ratios JSONB, -- array of gear ratios
  spring_rates JSONB, -- [front, rear] spring rates
  shock_settings TEXT,
  tire_pressures JSONB, -- [LF, RF, LR, RR] pressures
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(event_id, driver_id, session_type)
);

-- Radio Communications Schema
CREATE TABLE IF NOT EXISTS radio_communications (
  id SERIAL PRIMARY KEY,
  event_id VARCHAR(150) NOT NULL REFERENCES events(id),
  driver_id VARCHAR(100) NOT NULL REFERENCES drivers(id),
  lap_number INTEGER,
  timestamp TIME,
  speaker VARCHAR(20), -- 'driver', 'crew_chief', 'spotter'
  message TEXT NOT NULL,
  sponsor_mentions TEXT[], -- array of sponsor names mentioned
  message_type VARCHAR(20), -- 'strategy', 'performance', 'sponsor', 'safety'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Performance Correlations Schema
CREATE TABLE IF NOT EXISTS performance_correlations (
  id SERIAL PRIMARY KEY,
  event_id VARCHAR(150) NOT NULL REFERENCES events(id),
  driver_id VARCHAR(100) NOT NULL REFERENCES drivers(id),
  sponsor_name VARCHAR(200),
  avg_speed DECIMAL(6,2), -- average speed during race
  avg_lap_time DECIMAL(8,3), -- average lap time
  pit_stop_efficiency DECIMAL(5,2), -- average pit stop time
  fuel_efficiency DECIMAL(4,2), -- average fuel consumption
  setup_effectiveness INTEGER, -- number of setup changes
  radio_mentions INTEGER DEFAULT 0, -- sponsor mentions in radio
  performance_score DECIMAL(8,2), -- calculated performance metric
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(event_id, driver_id, sponsor_name)
);

-- Technical Innovations Schema
CREATE TABLE IF NOT EXISTS technical_innovations (
  id SERIAL PRIMARY KEY,
  event_id VARCHAR(150) REFERENCES events(id),
  driver_id VARCHAR(100) REFERENCES drivers(id),
  team_id VARCHAR(100),
  innovation_type VARCHAR(50), -- 'aerodynamic', 'engine', 'suspension', 'electronics'
  innovation_description TEXT,
  performance_impact DECIMAL(5,2), -- estimated lap time improvement in seconds
  sponsor_attribution VARCHAR(200), -- sponsor who funded/developed innovation
  implementation_date DATE,
  success_rating INTEGER, -- 1-10 effectiveness rating
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Performance Analytics Summary Schema
CREATE TABLE IF NOT EXISTS performance_analytics_summary (
  id SERIAL PRIMARY KEY,
  event_id VARCHAR(150) NOT NULL REFERENCES events(id),
  driver_id VARCHAR(100) NOT NULL REFERENCES drivers(id),
  total_laps INTEGER,
  fastest_lap_time DECIMAL(8,3),
  avg_lap_time DECIMAL(8,3),
  top_speed DECIMAL(6,2),
  avg_speed DECIMAL(6,2),
  pit_stops INTEGER,
  avg_pit_time DECIMAL(5,2),
  fuel_efficiency DECIMAL(4,2),
  tire_changes INTEGER,
  setup_changes INTEGER,
  radio_communications INTEGER,
  sponsor_mentions INTEGER,
  technical_score DECIMAL(8,2), -- overall technical performance score
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(event_id, driver_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_telemetry_event_driver ON telemetry_data(event_id, driver_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_lap ON telemetry_data(lap_number);
CREATE INDEX IF NOT EXISTS idx_tire_strategy_event ON tire_strategy(event_id);
CREATE INDEX IF NOT EXISTS idx_tire_strategy_driver ON tire_strategy(driver_id);
CREATE INDEX IF NOT EXISTS idx_fuel_data_event ON fuel_data(event_id);
CREATE INDEX IF NOT EXISTS idx_fuel_data_driver ON fuel_data(driver_id);
CREATE INDEX IF NOT EXISTS idx_car_setup_event ON car_setup(event_id);
CREATE INDEX IF NOT EXISTS idx_car_setup_session ON car_setup(session_type);
CREATE INDEX IF NOT EXISTS idx_radio_event ON radio_communications(event_id);
CREATE INDEX IF NOT EXISTS idx_radio_driver ON radio_communications(driver_id);
CREATE INDEX IF NOT EXISTS idx_radio_sponsor ON radio_communications USING GIN(sponsor_mentions);
CREATE INDEX IF NOT EXISTS idx_performance_correlations_event ON performance_correlations(event_id);
CREATE INDEX IF NOT EXISTS idx_performance_correlations_sponsor ON performance_correlations(sponsor_name);
CREATE INDEX IF NOT EXISTS idx_technical_innovations_type ON technical_innovations(innovation_type);
CREATE INDEX IF NOT EXISTS idx_performance_summary_event ON performance_analytics_summary(event_id);
