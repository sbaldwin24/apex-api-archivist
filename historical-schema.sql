-- Season Standings Schema
CREATE TABLE IF NOT EXISTS season_standings (
  id SERIAL PRIMARY KEY,
  season_id INTEGER NOT NULL REFERENCES seasons(id),
  driver_id VARCHAR(100) NOT NULL REFERENCES drivers(id),
  position INTEGER NOT NULL,
  points INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  top5 INTEGER DEFAULT 0,
  top10 INTEGER DEFAULT 0,
  poles INTEGER DEFAULT 0,
  laps_led INTEGER DEFAULT 0,
  winnings BIGINT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(season_id, driver_id)
);

-- Champions Schema
CREATE TABLE IF NOT EXISTS champions (
  id SERIAL PRIMARY KEY,
  season_id INTEGER UNIQUE NOT NULL REFERENCES seasons(id),
  driver_id VARCHAR(100) NOT NULL REFERENCES drivers(id),
  points INTEGER NOT NULL,
  wins INTEGER DEFAULT 0,
  manufacturer VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Historical Driver Trends Schema
CREATE TABLE IF NOT EXISTS historical_driver_trends (
  id SERIAL PRIMARY KEY,
  driver_id VARCHAR(100) UNIQUE NOT NULL REFERENCES drivers(id),
  years_active INTEGER DEFAULT 0,
  total_wins INTEGER DEFAULT 0,
  total_points INTEGER DEFAULT 0,
  avg_finish DECIMAL(5,2) DEFAULT 0,
  championship_years INTEGER DEFAULT 0,
  best_season_points INTEGER DEFAULT 0,
  career_earnings BIGINT DEFAULT 0,
  peak_performance_year INTEGER,
  consistency_rating DECIMAL(4,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Manufacturer Yearly Performance Schema
CREATE TABLE IF NOT EXISTS manufacturer_yearly_performance (
  id SERIAL PRIMARY KEY,
  year INTEGER NOT NULL,
  manufacturer VARCHAR(50) NOT NULL,
  wins INTEGER DEFAULT 0,
  championships INTEGER DEFAULT 0,
  total_points INTEGER DEFAULT 0,
  market_share DECIMAL(5,2) DEFAULT 0,
  driver_count INTEGER DEFAULT 0,
  avg_finish DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(year, manufacturer)
);

-- Track Historical Performance Schema
CREATE TABLE IF NOT EXISTS track_historical_performance (
  id SERIAL PRIMARY KEY,
  track_id VARCHAR(100) NOT NULL REFERENCES tracks(id),
  year INTEGER NOT NULL,
  winner_driver_id VARCHAR(100) REFERENCES drivers(id),
  winning_manufacturer VARCHAR(50),
  pole_winner_driver_id VARCHAR(100) REFERENCES drivers(id),
  race_distance DECIMAL(6,2),
  avg_speed DECIMAL(6,2),
  cautions INTEGER DEFAULT 0,
  caution_laps INTEGER DEFAULT 0,
  lead_changes INTEGER DEFAULT 0,
  attendance INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(track_id, year)
);

-- Historical Team Performance Schema
CREATE TABLE IF NOT EXISTS historical_team_performance (
  id SERIAL PRIMARY KEY,
  team_name VARCHAR(200) NOT NULL,
  year INTEGER NOT NULL,
  wins INTEGER DEFAULT 0,
  top5 INTEGER DEFAULT 0,
  top10 INTEGER DEFAULT 0,
  poles INTEGER DEFAULT 0,
  total_points INTEGER DEFAULT 0,
  championship_position INTEGER,
  driver_count INTEGER DEFAULT 0,
  manufacturer VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(team_name, year)
);

-- Playoff History Schema
CREATE TABLE IF NOT EXISTS playoff_history (
  id SERIAL PRIMARY KEY,
  season_id INTEGER NOT NULL REFERENCES seasons(id),
  driver_id VARCHAR(100) NOT NULL REFERENCES drivers(id),
  playoff_position INTEGER,
  round_eliminated VARCHAR(50), -- 'Round of 16', 'Round of 12', 'Round of 8', 'Championship 4', 'Champion'
  elimination_points INTEGER,
  playoff_wins INTEGER DEFAULT 0,
  playoff_points INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(season_id, driver_id)
);

-- Historical Rookie Performance Schema
CREATE TABLE IF NOT EXISTS rookie_performance_history (
  id SERIAL PRIMARY KEY,
  season_id INTEGER NOT NULL REFERENCES seasons(id),
  driver_id VARCHAR(100) NOT NULL REFERENCES drivers(id),
  rookie_of_year_winner BOOLEAN DEFAULT FALSE,
  final_position INTEGER,
  points INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  top5 INTEGER DEFAULT 0,
  top10 INTEGER DEFAULT 0,
  best_finish INTEGER DEFAULT 40,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(season_id, driver_id)
);

-- Multi-Year Comparisons Schema
CREATE TABLE IF NOT EXISTS multi_year_comparisons (
  id SERIAL PRIMARY KEY,
  comparison_type VARCHAR(50) NOT NULL, -- 'driver_vs_driver', 'team_vs_team', 'manufacturer_vs_manufacturer'
  entity1_id VARCHAR(200) NOT NULL,
  entity2_id VARCHAR(200) NOT NULL,
  start_year INTEGER NOT NULL,
  end_year INTEGER NOT NULL,
  entity1_wins INTEGER DEFAULT 0,
  entity2_wins INTEGER DEFAULT 0,
  entity1_championships INTEGER DEFAULT 0,
  entity2_championships INTEGER DEFAULT 0,
  entity1_avg_points DECIMAL(8,2) DEFAULT 0,
  entity2_avg_points DECIMAL(8,2) DEFAULT 0,
  head_to_head_record VARCHAR(20), -- 'entity1_wins-entity2_wins'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(comparison_type, entity1_id, entity2_id, start_year, end_year)
);

-- Era Performance Analysis Schema
CREATE TABLE IF NOT EXISTS era_performance_analysis (
  id SERIAL PRIMARY KEY,
  era_name VARCHAR(100) NOT NULL, -- 'Chase Era', 'Playoff Era', 'Gen 6 Era', 'Next Gen Era'
  start_year INTEGER NOT NULL,
  end_year INTEGER,
  dominant_driver_id VARCHAR(100) REFERENCES drivers(id),
  dominant_manufacturer VARCHAR(50),
  total_races INTEGER DEFAULT 0,
  unique_winners INTEGER DEFAULT 0,
  avg_lead_changes DECIMAL(6,2) DEFAULT 0,
  competitive_balance_score DECIMAL(4,2) DEFAULT 0, -- Higher = more competitive
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(era_name)
);

-- Historical Records Schema
CREATE TABLE IF NOT EXISTS historical_records (
  id SERIAL PRIMARY KEY,
  record_type VARCHAR(100) NOT NULL, -- 'most_wins_season', 'most_points_season', 'youngest_winner', etc.
  record_holder_type VARCHAR(50) NOT NULL, -- 'driver', 'team', 'manufacturer'
  record_holder_id VARCHAR(200) NOT NULL,
  record_value DECIMAL(10,2) NOT NULL,
  record_year INTEGER,
  record_event_id VARCHAR(150) REFERENCES events(id),
  previous_record_value DECIMAL(10,2),
  previous_record_holder_id VARCHAR(200),
  record_description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(record_type, record_holder_type)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_season_standings_season ON season_standings(season_id);
CREATE INDEX IF NOT EXISTS idx_season_standings_driver ON season_standings(driver_id);
CREATE INDEX IF NOT EXISTS idx_season_standings_position ON season_standings(position);
CREATE INDEX IF NOT EXISTS idx_champions_season ON champions(season_id);
CREATE INDEX IF NOT EXISTS idx_champions_driver ON champions(driver_id);
CREATE INDEX IF NOT EXISTS idx_historical_trends_driver ON historical_driver_trends(driver_id);
CREATE INDEX IF NOT EXISTS idx_manufacturer_performance_year ON manufacturer_yearly_performance(year);
CREATE INDEX IF NOT EXISTS idx_manufacturer_performance_manufacturer ON manufacturer_yearly_performance(manufacturer);
CREATE INDEX IF NOT EXISTS idx_track_historical_track ON track_historical_performance(track_id);
CREATE INDEX IF NOT EXISTS idx_track_historical_year ON track_historical_performance(year);
CREATE INDEX IF NOT EXISTS idx_team_performance_team ON historical_team_performance(team_name);
CREATE INDEX IF NOT EXISTS idx_team_performance_year ON historical_team_performance(year);
CREATE INDEX IF NOT EXISTS idx_playoff_history_season ON playoff_history(season_id);
CREATE INDEX IF NOT EXISTS idx_playoff_history_driver ON playoff_history(driver_id);
CREATE INDEX IF NOT EXISTS idx_rookie_performance_season ON rookie_performance_history(season_id);
CREATE INDEX IF NOT EXISTS idx_multi_year_comparisons_type ON multi_year_comparisons(comparison_type);
CREATE INDEX IF NOT EXISTS idx_era_analysis_era ON era_performance_analysis(era_name);
CREATE INDEX IF NOT EXISTS idx_historical_records_type ON historical_records(record_type);
