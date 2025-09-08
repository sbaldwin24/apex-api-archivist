-- Track Layouts Schema
CREATE TABLE IF NOT EXISTS track_layouts (
  id SERIAL PRIMARY KEY,
  track_id VARCHAR(100) UNIQUE NOT NULL,
  track_name VARCHAR(200) NOT NULL,
  map_image_url VARCHAR(500),
  layout_svg TEXT,
  turns_data JSONB,
  banking_data JSONB,
  dimensions JSONB,
  scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_track_layouts_track_id ON track_layouts(track_id);
