-- Sponsor Contracts Schema
CREATE TABLE IF NOT EXISTS sponsor_contracts (
  id SERIAL PRIMARY KEY,
  driver_id VARCHAR(100) NOT NULL REFERENCES drivers(id),
  sponsor_name VARCHAR(200) NOT NULL,
  contract_value BIGINT NOT NULL, -- Annual value in dollars
  contract_length INTEGER NOT NULL, -- Years
  contract_type VARCHAR(50) NOT NULL, -- 'primary', 'associate', 'personal_services'
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  performance_bonus BIGINT DEFAULT 0,
  activation_budget BIGINT DEFAULT 0, -- Sponsor's activation spending
  media_value BIGINT DEFAULT 0, -- Estimated media value of the sponsorship
  merchandise_revenue BIGINT DEFAULT 0, -- Expected merchandise revenue
  digital_rights BIGINT DEFAULT 0, -- Digital and social media rights value
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(driver_id, sponsor_name, start_date)
);

-- Prize Money Schema
CREATE TABLE IF NOT EXISTS prize_money (
  id SERIAL PRIMARY KEY,
  event_id VARCHAR(150) UNIQUE NOT NULL REFERENCES events(id),
  total_purse BIGINT NOT NULL,
  winner_payout BIGINT NOT NULL,
  position_payouts JSONB NOT NULL, -- {1: 1600000, 2: 800000, ...}
  bonuses JSONB, -- {'pole_position': 50000, 'fastest_lap': 25000, ...}
  points_fund BIGINT DEFAULT 0, -- portion contributed to season points fund
  playoff_bonus BIGINT DEFAULT 0, -- playoff-specific bonuses
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Team Budgets Schema
CREATE TABLE IF NOT EXISTS team_budgets (
  id SERIAL PRIMARY KEY,
  team_id VARCHAR(100) NOT NULL,
  season INTEGER NOT NULL,
  total_budget BIGINT NOT NULL,
  driver_salaries BIGINT DEFAULT 0,
  car_development BIGINT DEFAULT 0,
  operations BIGINT DEFAULT 0,
  marketing BIGINT DEFAULT 0,
  travel_expenses BIGINT DEFAULT 0,
  facility_rent BIGINT DEFAULT 0,
  insurance BIGINT DEFAULT 0,
  contingency BIGINT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(team_id, season)
);

-- Merchandise Revenue Schema
CREATE TABLE IF NOT EXISTS merchandise_revenue (
  id SERIAL PRIMARY KEY,
  event_id VARCHAR(150) REFERENCES events(id),
  driver_id VARCHAR(100) REFERENCES drivers(id),
  sponsor_name VARCHAR(200),
  product_category VARCHAR(100), -- 'apparel', 'diecast', 'accessories'
  revenue_amount BIGINT NOT NULL,
  units_sold INTEGER DEFAULT 0,
  average_price DECIMAL(10,2),
  sale_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Licensing Revenue Schema
CREATE TABLE IF NOT EXISTS licensing_revenue (
  id SERIAL PRIMARY KEY,
  driver_id VARCHAR(100) REFERENCES drivers(id),
  sponsor_name VARCHAR(200) NOT NULL,
  license_type VARCHAR(100), -- 'merchandise', 'video_game', 'collectibles'
  revenue_amount BIGINT NOT NULL,
  royalty_percentage DECIMAL(5,2),
  contract_start DATE,
  contract_end DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Activation Costs Schema
CREATE TABLE IF NOT EXISTS activation_costs (
  id SERIAL PRIMARY KEY,
  event_id VARCHAR(150) REFERENCES events(id),
  sponsor_name VARCHAR(200) NOT NULL,
  activation_type VARCHAR(100), -- 'hospitality', 'display', 'sampling', 'contest'
  cost_amount BIGINT NOT NULL,
  estimated_reach INTEGER, -- Number of people reached
  engagement_score INTEGER, -- 1-100 effectiveness rating
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ROI Calculations Schema
CREATE TABLE IF NOT EXISTS sponsor_roi_calculations (
  id SERIAL PRIMARY KEY,
  sponsor_name VARCHAR(200) NOT NULL,
  driver_id VARCHAR(100) REFERENCES drivers(id),
  event_id VARCHAR(150) REFERENCES events(id),
  calculation_period VARCHAR(50), -- 'race', 'month', 'season', 'contract'
  total_investment BIGINT NOT NULL, -- Contract + activation costs
  media_value BIGINT DEFAULT 0, -- TV exposure value
  digital_value BIGINT DEFAULT 0, -- Social media, web value
  merchandise_revenue BIGINT DEFAULT 0,
  brand_lift_value BIGINT DEFAULT 0, -- Survey-based brand awareness value
  total_roi_value BIGINT NOT NULL,
  roi_percentage DECIMAL(8,2), -- (ROI Value - Investment) / Investment * 100
  calculation_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sponsor_contracts_driver ON sponsor_contracts(driver_id);
CREATE INDEX IF NOT EXISTS idx_sponsor_contracts_sponsor ON sponsor_contracts(sponsor_name);
CREATE INDEX IF NOT EXISTS idx_sponsor_contracts_dates ON sponsor_contracts(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_sponsor_contracts_type ON sponsor_contracts(contract_type);
CREATE INDEX IF NOT EXISTS idx_prize_money_event ON prize_money(event_id);
CREATE INDEX IF NOT EXISTS idx_team_budgets_season ON team_budgets(season);
CREATE INDEX IF NOT EXISTS idx_team_budgets_team ON team_budgets(team_id);
CREATE INDEX IF NOT EXISTS idx_merchandise_event ON merchandise_revenue(event_id);
CREATE INDEX IF NOT EXISTS idx_merchandise_driver ON merchandise_revenue(driver_id);
CREATE INDEX IF NOT EXISTS idx_merchandise_category ON merchandise_revenue(product_category);
CREATE INDEX IF NOT EXISTS idx_merchandise_date ON merchandise_revenue(sale_date);
CREATE INDEX IF NOT EXISTS idx_licensing_driver ON licensing_revenue(driver_id);
CREATE INDEX IF NOT EXISTS idx_licensing_type ON licensing_revenue(license_type);
CREATE INDEX IF NOT EXISTS idx_activation_event ON activation_costs(event_id);
CREATE INDEX IF NOT EXISTS idx_activation_sponsor ON activation_costs(sponsor_name);
CREATE INDEX IF NOT EXISTS idx_activation_type ON activation_costs(activation_type);
CREATE INDEX IF NOT EXISTS idx_roi_sponsor ON sponsor_roi_calculations(sponsor_name);
CREATE INDEX IF NOT EXISTS idx_roi_driver ON sponsor_roi_calculations(driver_id);
CREATE INDEX IF NOT EXISTS idx_roi_period ON sponsor_roi_calculations(calculation_period);
CREATE INDEX IF NOT EXISTS idx_roi_date ON sponsor_roi_calculations(calculation_date);
CREATE INDEX IF NOT EXISTS idx_roi_percentage ON sponsor_roi_calculations(roi_percentage);
