-- Migration: Add surface field to tracks table
-- This allows for surface-based analysis (asphalt, dirt, concrete)

-- Add surface column to tracks
ALTER TABLE tracks 
ADD COLUMN surface VARCHAR(50) DEFAULT 'asphalt';

-- Add comment for the new column
COMMENT ON COLUMN tracks.surface IS 'Track surface type (e.g., asphalt, dirt, concrete)';

-- Create index for surface queries
CREATE INDEX idx_tracks_surface ON tracks(surface);

-- Update existing records with default surface
UPDATE tracks 
SET surface = 'asphalt' 
WHERE surface IS NULL;
