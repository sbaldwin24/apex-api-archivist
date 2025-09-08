-- Paint Scheme Schema for Sponsor Visibility
CREATE TABLE IF NOT EXISTS paint_schemes (
  id SERIAL PRIMARY KEY,
  event_id VARCHAR(150) NOT NULL REFERENCES events(id),
  driver_id VARCHAR(100) NOT NULL REFERENCES drivers(id),
  car_number VARCHAR(10) NOT NULL,
  primary_sponsor VARCHAR(200),
  associate_sponsors TEXT[],
  scheme_type VARCHAR(50), -- 'regular', 'throwback', 'special'
  scheme_image_url VARCHAR(500),
  scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(event_id, driver_id)
);

CREATE INDEX IF NOT EXISTS idx_paint_schemes_event ON paint_schemes(event_id);
CREATE INDEX IF NOT EXISTS idx_paint_schemes_sponsor ON paint_schemes(primary_sponsor);
