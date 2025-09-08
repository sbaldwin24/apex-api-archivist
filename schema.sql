-- Apex Data API - Foundational Database Schema
-- apex_data - DATABASE Name
-- Version 1.0
-- This script creates the core tables for storing historical and event data.

-- Set timezone to UTC for consistency
SET TIME ZONE 'UTC';

-- Create an ENUM type for flag states for data consistency
CREATE TYPE flag_state AS ENUM ('GREEN', 'YELLOW', 'RED', 'CHECKERED', 'UNKNOWN');

-- Table for racing series (e.g., Cup, Xfinity, Truck)
CREATE TABLE series (
  id VARCHAR(50) PRIMARY KEY, -- e.g., 'nascar_cup_series'
  name VARCHAR(100) NOT NULL, -- e.g., 'NASCAR Cup Series'
  generation VARCHAR(50) -- e.g., 'Next Gen'
);

-- Table for seasons, linking a series to a specific year
CREATE TABLE seasons (
  id SERIAL PRIMARY KEY,
  series_id VARCHAR(50) NOT NULL REFERENCES series(id),
  year INTEGER NOT NULL,
  UNIQUE(series_id, year)
);

-- Table for tracks
CREATE TABLE tracks (
  id VARCHAR(100) PRIMARY KEY, -- e.g., 'daytona_international_speedway'
  name VARCHAR(150) NOT NULL, -- e.g., 'Daytona International Speedway'
  city VARCHAR(100),
  state VARCHAR(50),
  length_miles NUMERIC(5, 3),
  type VARCHAR(50) -- e.g., 'Superspeedway', 'Short Track'
);

-- Table for drivers
CREATE TABLE drivers (
  id VARCHAR(100) PRIMARY KEY, -- e.g., 'chase_elliott'
  first_name VARCHAR(100),
  last_name VARCHAR(100) NOT NULL,
  date_of_birth DATE,
  hometown VARCHAR(150)
);

-- Table for teams
CREATE TABLE teams (
  id VARCHAR(100) PRIMARY KEY, -- e.g., 'hendrick_motorsports'
  name VARCHAR(150) NOT NULL,
  manufacturer VARCHAR(50) -- e.g., 'Chevrolet'
);

-- Table for race events, which represent a race weekend
CREATE TABLE events (
  id VARCHAR(150) PRIMARY KEY, -- e.g., 'daytona_500_2025'
  season_id INTEGER NOT NULL REFERENCES seasons(id),
  track_id VARCHAR(100) NOT NULL REFERENCES tracks(id),
  name VARCHAR(200) NOT NULL, -- e.g., 'Daytona 500'
  event_date DATE NOT NULL
);

-- Table for final race results. This is the core table for historical data.
CREATE TABLE race_results (
  id SERIAL PRIMARY KEY,
  event_id VARCHAR(150) NOT NULL REFERENCES events(id),
  driver_id VARCHAR(100) NOT NULL REFERENCES drivers(id),
  team_id VARCHAR(100) NOT NULL REFERENCES teams(id),
  car_number VARCHAR(10) NOT NULL,
  finish_position INTEGER NOT NULL,
  start_position INTEGER,
  laps_led INTEGER DEFAULT 0,
  laps_completed INTEGER,
  status VARCHAR(50), -- e.g., 'Running', 'Accident', 'Engine'
  -- Using JSONB for flexible, semi-structured data like pit stop details or other stats
  metadata JSONB,
  UNIQUE(event_id, driver_id)
);

-- Table for qualifying results
CREATE TABLE qualifying_results (
  id SERIAL PRIMARY KEY,
  event_id VARCHAR(150) NOT NULL REFERENCES events(id),
  driver_id VARCHAR(100) NOT NULL REFERENCES drivers(id),
  team_id VARCHAR(100) NOT NULL REFERENCES teams(id),
  car_number VARCHAR(10) NOT NULL,
  position INTEGER NOT NULL,
  speed NUMERIC(6, 3),
  time_seconds NUMERIC(8, 4),
  round INTEGER DEFAULT 1, -- Q1, Q2, Q3
  UNIQUE(event_id, driver_id, round)
);

-- Table for practice session results
CREATE TABLE practice_results (
  id SERIAL PRIMARY KEY,
  event_id VARCHAR(150) NOT NULL REFERENCES events(id),
  driver_id VARCHAR(100) NOT NULL REFERENCES drivers(id),
  team_id VARCHAR(100) NOT NULL REFERENCES teams(id),
  car_number VARCHAR(10) NOT NULL,
  session_name VARCHAR(50) NOT NULL, -- 'Practice 1', 'Practice 2', 'Final Practice'
  position INTEGER,
  best_speed NUMERIC(6, 3),
  best_time_seconds NUMERIC(8, 4),
  laps_completed INTEGER DEFAULT 0
);

-- Table for caution periods during races
CREATE TABLE cautions (
  id SERIAL PRIMARY KEY,
  event_id VARCHAR(150) NOT NULL REFERENCES events(id),
  caution_number INTEGER NOT NULL,
  start_lap INTEGER NOT NULL,
  end_lap INTEGER,
  reason VARCHAR(200),
  flag_state flag_state DEFAULT 'YELLOW'
);

-- Table for stage results
CREATE TABLE stage_results (
  id SERIAL PRIMARY KEY,
  event_id VARCHAR(150) NOT NULL REFERENCES events(id),
  driver_id VARCHAR(100) NOT NULL REFERENCES drivers(id),
  stage_number INTEGER NOT NULL,
  finish_position INTEGER NOT NULL,
  points_earned INTEGER DEFAULT 0,
  UNIQUE(event_id, driver_id, stage_number)
);

-- Table for pit stop data
CREATE TABLE pit_stops (
  id SERIAL PRIMARY KEY,
  event_id VARCHAR(150) NOT NULL REFERENCES events(id),
  driver_id VARCHAR(100) NOT NULL REFERENCES drivers(id),
  lap_number INTEGER NOT NULL,
  pit_time_seconds NUMERIC(6, 3),
  reason VARCHAR(100), -- 'Scheduled', 'Damage', 'Penalty'
  position_before INTEGER,
  position_after INTEGER
);

-- Table for lap-by-lap position data
CREATE TABLE lap_data (
  id SERIAL PRIMARY KEY,
  event_id VARCHAR(150) NOT NULL REFERENCES events(id),
  driver_id VARCHAR(100) NOT NULL REFERENCES drivers(id),
  lap_number INTEGER NOT NULL,
  position INTEGER NOT NULL,
  lap_time_seconds NUMERIC(8, 4),
  gap_to_leader_seconds NUMERIC(8, 4),
  UNIQUE(event_id, driver_id, lap_number)
);

-- Table for paint schemes
CREATE TABLE paint_schemes (
  id SERIAL PRIMARY KEY,
  event_id VARCHAR(150) REFERENCES events(id),
  driver_id VARCHAR(100) NOT NULL REFERENCES drivers(id),
  car_number VARCHAR(10) NOT NULL,
  primary_sponsor VARCHAR(200),
  scheme_name VARCHAR(200),
  image_url VARCHAR(500),
  colors JSONB,
  year INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(event_id, driver_id, car_number)
);

-- Comments to guide future development
COMMENT ON TABLE race_results IS 'Stores the final results for a single driver in a single race event.';
COMMENT ON COLUMN race_results.metadata IS 'Flexible JSONB column for storing additional scraped stats like pit stop counts, points gained, etc.';
COMMENT ON TABLE paint_schemes IS 'Stores paint scheme information for drivers by event or year.';