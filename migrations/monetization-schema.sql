-- API Keys and Billing
CREATE TABLE api_keys (
  id SERIAL PRIMARY KEY,
  key_value VARCHAR(255) UNIQUE NOT NULL,
  user_id VARCHAR(100) NOT NULL,
  billing_plan VARCHAR(50) DEFAULT 'free',
  created_at TIMESTAMP DEFAULT NOW(),
  last_used TIMESTAMP,
  is_active BOOLEAN DEFAULT true
);

-- API Usage Tracking
CREATE TABLE api_usage (
  id SERIAL PRIMARY KEY,
  api_key VARCHAR(255) NOT NULL,
  endpoint VARCHAR(255) NOT NULL,
  timestamp TIMESTAMP DEFAULT NOW(),
  response_time INTEGER, -- milliseconds
  data_size INTEGER, -- bytes
  tier VARCHAR(50),
  status_code INTEGER,
  user_agent TEXT
);

-- Billing Invoices
CREATE TABLE billing_invoices (
  id SERIAL PRIMARY KEY,
  api_key VARCHAR(255) NOT NULL,
  billing_period_start DATE NOT NULL,
  billing_period_end DATE NOT NULL,
  base_amount DECIMAL(10,2) NOT NULL,
  overage_amount DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- pending, paid, failed
  created_at TIMESTAMP DEFAULT NOW(),
  paid_at TIMESTAMP
);

-- User Events for Analytics
CREATE TABLE user_events (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(100) NOT NULL,
  api_key VARCHAR(255),
  event_name VARCHAR(100) NOT NULL,
  properties JSONB,
  timestamp TIMESTAMP DEFAULT NOW()
);

-- A/B Testing Assignments
CREATE TABLE experiment_assignments (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(100) NOT NULL,
  experiment_id VARCHAR(100) NOT NULL,
  variant VARCHAR(100) NOT NULL,
  assigned_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, experiment_id)
);

-- A/B Testing Conversions
CREATE TABLE experiment_conversions (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(100) NOT NULL,
  experiment_id VARCHAR(100) NOT NULL,
  variant VARCHAR(100) NOT NULL,
  metric_name VARCHAR(100) NOT NULL,
  metric_value DECIMAL(10,4) DEFAULT 1,
  converted_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for Performance
CREATE INDEX idx_api_usage_key_timestamp ON api_usage(api_key, timestamp);
CREATE INDEX idx_api_usage_endpoint ON api_usage(endpoint);
CREATE INDEX idx_api_usage_timestamp ON api_usage(timestamp);
CREATE INDEX idx_user_events_user_timestamp ON user_events(user_id, timestamp);
CREATE INDEX idx_user_events_event ON user_events(event_name);
CREATE INDEX idx_billing_invoices_key_period ON billing_invoices(api_key, billing_period_start);

-- Sample Data
INSERT INTO api_keys (key_value, user_id, billing_plan) VALUES
('demo-key-123', 'user_demo', 'free'),
('starter-key-456', 'user_starter', 'starter'),
('pro-key-789', 'user_pro', 'professional'),
('enterprise-key-000', 'user_enterprise', 'enterprise');

-- Sample usage data
INSERT INTO api_usage (api_key, endpoint, response_time, data_size, tier, status_code) VALUES
('demo-key-123', '/api/races/2024', 150, 2048, 'free', 200),
('starter-key-456', '/api/standings/2024', 120, 1536, 'starter', 200),
('pro-key-789', '/api/drivers/chase_elliott', 80, 1024, 'professional', 200),
('enterprise-key-000', '/api/races/2024/1', 95, 4096, 'enterprise', 200);
