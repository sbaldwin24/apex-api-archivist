-- Migration: Add multi-series support for Cup, Xfinity, and Truck Series
-- This allows for comprehensive NASCAR ecosystem coverage

-- Create series table
CREATE TABLE series (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    full_name VARCHAR(200),
    abbreviation VARCHAR(10),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add series_id to events table
ALTER TABLE events 
ADD COLUMN series_id VARCHAR(50) REFERENCES series(id);

-- Add comments
COMMENT ON TABLE series IS 'NASCAR racing series (Cup, Xfinity, Truck, etc.)';
COMMENT ON COLUMN series.id IS 'Unique identifier for the series';
COMMENT ON COLUMN series.name IS 'Series name (Cup Series, Xfinity Series, etc.)';
COMMENT ON COLUMN series.full_name IS 'Full official series name';
COMMENT ON COLUMN series.abbreviation IS 'Series abbreviation (CUP, XFN, TRK)';
COMMENT ON COLUMN events.series_id IS 'NASCAR series this race belongs to';

-- Create indexes for efficient queries
CREATE INDEX idx_series_name ON series(name);
CREATE INDEX idx_events_series_id ON events(series_id);

-- Insert NASCAR series
INSERT INTO series (id, name, full_name, abbreviation) VALUES
('cup', 'Cup Series', 'NASCAR Cup Series', 'CUP'),
('xfinity', 'Xfinity Series', 'NASCAR Xfinity Series', 'XFN'),
('truck', 'Truck Series', 'NASCAR Craftsman Truck Series', 'TRK');

-- Update existing events to Cup Series (assuming current data is Cup Series)
UPDATE events SET series_id = 'cup' WHERE series_id IS NULL;
