-- Migration: Add sponsors table and link to race results
-- This allows for sponsor tracking and marketing analysis

-- Create sponsors table
CREATE TABLE sponsors (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    industry VARCHAR(100),
    website VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add sponsor_id to race_results table
ALTER TABLE race_results 
ADD COLUMN sponsor_id VARCHAR(100) REFERENCES sponsors(id);

-- Add comments
COMMENT ON TABLE sponsors IS 'NASCAR car sponsors and their information';
COMMENT ON COLUMN sponsors.id IS 'Unique identifier for the sponsor';
COMMENT ON COLUMN sponsors.name IS 'Official sponsor name';
COMMENT ON COLUMN sponsors.industry IS 'Sponsor industry category';
COMMENT ON COLUMN sponsors.website IS 'Sponsor website URL';
COMMENT ON COLUMN race_results.sponsor_id IS 'Primary sponsor for this race entry';

-- Create indexes for efficient queries
CREATE INDEX idx_sponsors_name ON sponsors(name);
CREATE INDEX idx_sponsors_industry ON sponsors(industry);
CREATE INDEX idx_race_results_sponsor_id ON race_results(sponsor_id);

-- Insert some common NASCAR sponsors as examples
INSERT INTO sponsors (id, name, industry) VALUES
('coca_cola', 'Coca-Cola', 'Beverage'),
('fedex', 'FedEx', 'Logistics'),
('lowes', 'Lowe''s', 'Retail'),
('home_depot', 'The Home Depot', 'Retail'),
('interstate_batteries', 'Interstate Batteries', 'Automotive'),
('monster_energy', 'Monster Energy', 'Beverage'),
('m_ms', 'M&M''s', 'Food'),
('dewalt', 'DEWALT', 'Tools'),
('stanley', 'Stanley', 'Tools'),
('autotrader', 'AutoTrader', 'Technology');
