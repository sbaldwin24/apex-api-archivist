-- Complete ROI Analysis Schema for Advanced Analytics and Predictive Modeling

-- Predictive Models Schema
CREATE TABLE IF NOT EXISTS predictive_models (
  id SERIAL PRIMARY KEY,
  model_id VARCHAR(200) UNIQUE NOT NULL,
  sponsor_name VARCHAR(200) NOT NULL,
  model_type VARCHAR(50) NOT NULL, -- 'roi_forecast', 'brand_lift_prediction', 'customer_acquisition'
  training_data JSONB NOT NULL, -- Historical data used for training
  predictions JSONB NOT NULL, -- Array of prediction objects
  accuracy DECIMAL(5,4) NOT NULL, -- Model accuracy (0-1)
  confidence_interval DECIMAL(5,4) NOT NULL, -- Confidence level (0-1)
  model_version VARCHAR(20) DEFAULT '1.0',
  last_trained TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  validation_score DECIMAL(5,4), -- Cross-validation score
  feature_importance JSONB, -- Feature importance weights
  hyperparameters JSONB, -- Model configuration
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Real-time Sentiment Analysis Schema
CREATE TABLE IF NOT EXISTS real_time_sentiment (
  id SERIAL PRIMARY KEY,
  event_id VARCHAR(150) REFERENCES events(id),
  sponsor_name VARCHAR(200) NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  sentiment_score DECIMAL(4,3) NOT NULL, -- -1.0 to 1.0
  volume INTEGER NOT NULL, -- Number of mentions
  platforms JSONB NOT NULL, -- Platform breakdown
  key_topics TEXT[] NOT NULL, -- Array of topics
  influencer_mentions INTEGER DEFAULT 0,
  viral_potential DECIMAL(4,2) DEFAULT 0, -- 0-10 viral potential score
  geographic_distribution JSONB, -- Geographic breakdown of sentiment
  demographic_breakdown JSONB, -- Age/gender breakdown
  trending_score DECIMAL(5,2) DEFAULT 0, -- How trending the content is
  engagement_rate DECIMAL(5,2) DEFAULT 0, -- Engagement percentage
  reach_multiplier DECIMAL(5,2) DEFAULT 1.0, -- Amplification factor
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- A/B Test Results Schema
CREATE TABLE IF NOT EXISTS ab_test_results (
  id SERIAL PRIMARY KEY,
  test_id VARCHAR(200) UNIQUE NOT NULL,
  sponsor_name VARCHAR(200) NOT NULL,
  test_type VARCHAR(50) NOT NULL, -- 'activation_strategy', 'creative_variant', 'channel_mix'
  control_group JSONB NOT NULL, -- Control group metrics
  test_group JSONB NOT NULL, -- Test group metrics
  statistical_significance DECIMAL(5,4) NOT NULL, -- p-value
  winning_variant VARCHAR(20) NOT NULL, -- 'control' or 'test'
  lift_percentage DECIMAL(8,2) NOT NULL, -- Percentage improvement
  recommended_action TEXT NOT NULL,
  test_duration_days INTEGER, -- How long the test ran
  sample_size INTEGER, -- Total sample size
  confidence_level DECIMAL(5,4) DEFAULT 0.95, -- Statistical confidence
  effect_size DECIMAL(6,4), -- Cohen's d or similar
  test_start_date DATE,
  test_end_date DATE,
  business_impact_estimate BIGINT, -- Estimated revenue impact
  implementation_cost BIGINT, -- Cost to implement winning variant
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Geographic Targeting Analysis Schema
CREATE TABLE IF NOT EXISTS geo_targeting_analysis (
  id SERIAL PRIMARY KEY,
  event_id VARCHAR(150),
  sponsor_name VARCHAR(200) NOT NULL,
  market VARCHAR(100) NOT NULL,
  demographics JSONB NOT NULL, -- Market demographics
  performance JSONB NOT NULL, -- Market performance metrics
  optimization JSONB NOT NULL, -- Optimization recommendations
  market_size INTEGER, -- Total addressable market
  market_penetration DECIMAL(5,2), -- Current penetration percentage
  growth_potential DECIMAL(5,2), -- Projected growth rate
  competitive_intensity DECIMAL(5,2), -- Competition level (1-10)
  cost_per_acquisition DECIMAL(8,2), -- Average CPA in market
  lifetime_value DECIMAL(10,2), -- Average customer LTV
  seasonal_factors JSONB, -- Seasonal adjustment factors
  local_partnerships TEXT[], -- Potential local partnerships
  regulatory_considerations TEXT[], -- Market-specific regulations
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(sponsor_name, market)
);

-- Advanced ROI Calculations Schema
CREATE TABLE IF NOT EXISTS advanced_roi_calculations (
  id SERIAL PRIMARY KEY,
  calculation_id VARCHAR(200) UNIQUE NOT NULL,
  sponsor_name VARCHAR(200) NOT NULL,
  driver_id VARCHAR(100) REFERENCES drivers(id),
  event_id VARCHAR(150) REFERENCES events(id),
  calculation_type VARCHAR(50) NOT NULL, -- 'comprehensive', 'predictive', 'incremental', 'attribution'
  calculation_period VARCHAR(50) NOT NULL, -- 'race', 'month', 'quarter', 'season', 'multi_year'
  
  -- Investment Components
  total_investment BIGINT NOT NULL,
  contract_value BIGINT DEFAULT 0,
  activation_spend BIGINT DEFAULT 0,
  production_costs BIGINT DEFAULT 0,
  media_buy BIGINT DEFAULT 0,
  
  -- Return Components
  media_value BIGINT DEFAULT 0,
  digital_value BIGINT DEFAULT 0,
  merchandise_revenue BIGINT DEFAULT 0,
  brand_lift_value BIGINT DEFAULT 0,
  customer_acquisition_value BIGINT DEFAULT 0,
  incremental_sales BIGINT DEFAULT 0,
  
  -- Advanced Metrics
  total_roi_value BIGINT NOT NULL,
  roi_percentage DECIMAL(8,2) NOT NULL,
  incremental_roi DECIMAL(8,2), -- ROI above baseline
  risk_adjusted_roi DECIMAL(8,2), -- Risk-weighted ROI
  time_weighted_roi DECIMAL(8,2), -- NPV-based ROI
  
  -- Attribution Analysis
  direct_attribution DECIMAL(5,2) DEFAULT 100.0, -- Percentage directly attributable
  assisted_conversions DECIMAL(8,2) DEFAULT 0, -- Value of assisted conversions
  cross_channel_impact DECIMAL(8,2) DEFAULT 0, -- Impact on other channels
  halo_effect_value DECIMAL(8,2) DEFAULT 0, -- Indirect benefits
  
  -- Predictive Components
  predicted_future_value BIGINT DEFAULT 0,
  confidence_score DECIMAL(5,4) DEFAULT 0.5, -- Prediction confidence
  volatility_score DECIMAL(5,2) DEFAULT 0, -- ROI volatility measure
  
  calculation_date DATE DEFAULT CURRENT_DATE,
  model_version VARCHAR(20) DEFAULT '2.0',
  validation_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'validated', 'disputed'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Attribution Modeling Schema
CREATE TABLE IF NOT EXISTS attribution_models (
  id SERIAL PRIMARY KEY,
  model_id VARCHAR(200) UNIQUE NOT NULL,
  sponsor_name VARCHAR(200) NOT NULL,
  model_type VARCHAR(50) NOT NULL, -- 'first_touch', 'last_touch', 'linear', 'time_decay', 'position_based', 'algorithmic'
  touchpoint_weights JSONB NOT NULL, -- Weights for each touchpoint
  conversion_windows JSONB NOT NULL, -- Time windows for attribution
  model_performance JSONB, -- Model validation metrics
  baseline_conversion_rate DECIMAL(6,4), -- Pre-sponsorship conversion rate
  incremental_lift DECIMAL(6,4), -- Incremental conversion lift
  attribution_rules JSONB, -- Custom attribution rules
  data_sources TEXT[], -- Sources used for attribution
  lookback_window_days INTEGER DEFAULT 30,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Customer Lifetime Value Analysis Schema
CREATE TABLE IF NOT EXISTS clv_analysis (
  id SERIAL PRIMARY KEY,
  sponsor_name VARCHAR(200) NOT NULL,
  customer_segment VARCHAR(100) NOT NULL,
  acquisition_date DATE NOT NULL,
  
  -- CLV Components
  average_order_value DECIMAL(10,2) NOT NULL,
  purchase_frequency DECIMAL(6,2) NOT NULL, -- Purchases per period
  customer_lifespan_months INTEGER NOT NULL,
  gross_margin_percentage DECIMAL(5,2) NOT NULL,
  
  -- Calculated Values
  clv_total DECIMAL(12,2) NOT NULL,
  clv_present_value DECIMAL(12,2) NOT NULL, -- NPV of CLV
  acquisition_cost DECIMAL(8,2) NOT NULL,
  clv_to_cac_ratio DECIMAL(6,2) NOT NULL, -- CLV to Customer Acquisition Cost ratio
  
  -- Cohort Analysis
  cohort_month DATE NOT NULL,
  retention_rate_month_1 DECIMAL(5,2),
  retention_rate_month_6 DECIMAL(5,2),
  retention_rate_month_12 DECIMAL(5,2),
  
  -- Sponsor Attribution
  sponsor_influence_score DECIMAL(5,2), -- How much sponsor influenced acquisition (0-100)
  touchpoint_journey JSONB, -- Customer journey touchpoints
  conversion_path TEXT[], -- Path that led to conversion
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Competitive Intelligence Schema
CREATE TABLE IF NOT EXISTS competitive_intelligence (
  id SERIAL PRIMARY KEY,
  competitor_name VARCHAR(200) NOT NULL,
  our_sponsor VARCHAR(200) NOT NULL,
  comparison_date DATE NOT NULL,
  
  -- Share of Voice Metrics
  total_mentions INTEGER DEFAULT 0,
  positive_sentiment_percentage DECIMAL(5,2) DEFAULT 0,
  share_of_voice_percentage DECIMAL(5,2) DEFAULT 0,
  
  -- Estimated Investment
  estimated_investment BIGINT, -- Estimated competitor spend
  investment_efficiency_score DECIMAL(5,2), -- ROI efficiency vs competitor
  
  -- Performance Comparison
  brand_awareness_delta DECIMAL(5,2), -- Difference in brand awareness
  engagement_rate_delta DECIMAL(5,2), -- Difference in engagement
  conversion_rate_delta DECIMAL(5,2), -- Difference in conversion
  
  -- Strategic Insights
  competitive_advantages TEXT[], -- Our advantages
  competitive_threats TEXT[], -- Areas where they outperform
  opportunity_areas TEXT[], -- Unexploited opportunities
  
  data_sources TEXT[], -- Where the intel came from
  confidence_score DECIMAL(4,2) DEFAULT 0.5, -- Confidence in the data
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ROI Optimization Recommendations Schema
CREATE TABLE IF NOT EXISTS roi_optimization_recommendations (
  id SERIAL PRIMARY KEY,
  recommendation_id VARCHAR(200) UNIQUE NOT NULL,
  sponsor_name VARCHAR(200) NOT NULL,
  recommendation_type VARCHAR(50) NOT NULL, -- 'budget_reallocation', 'creative_optimization', 'channel_mix', 'timing_optimization'
  current_performance JSONB NOT NULL, -- Current metrics
  projected_improvement JSONB NOT NULL, -- Projected improvements
  
  -- Recommendation Details
  recommended_actions TEXT[] NOT NULL,
  implementation_priority INTEGER NOT NULL, -- 1-5 priority score
  estimated_impact_percentage DECIMAL(5,2) NOT NULL, -- Expected improvement
  implementation_cost BIGINT DEFAULT 0,
  implementation_timeline_days INTEGER DEFAULT 30,
  
  -- Risk Assessment
  risk_level VARCHAR(20) DEFAULT 'medium', -- 'low', 'medium', 'high'
  success_probability DECIMAL(5,2) DEFAULT 0.7, -- Probability of success
  potential_downsides TEXT[], -- Potential negative impacts
  
  -- Validation
  ab_test_recommended BOOLEAN DEFAULT false,
  pilot_program_suggested BOOLEAN DEFAULT false,
  monitoring_metrics TEXT[], -- Metrics to track post-implementation
  
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'implemented', 'rejected'
  created_by VARCHAR(100), -- System or user who created
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  implemented_at TIMESTAMP,
  results_validated_at TIMESTAMP
);

-- ROI Benchmarks Schema
CREATE TABLE IF NOT EXISTS roi_benchmarks (
  id SERIAL PRIMARY KEY,
  industry VARCHAR(100) NOT NULL, -- 'automotive', 'consumer_goods', 'financial_services'
  sponsorship_type VARCHAR(100) NOT NULL, -- 'nascar_cup', 'sports_general', 'entertainment'
  investment_tier VARCHAR(50) NOT NULL, -- 'tier_1' (<$1M), 'tier_2' ($1M-$10M), 'tier_3' (>$10M)
  
  -- Benchmark Metrics
  median_roi_percentage DECIMAL(8,2) NOT NULL,
  percentile_25_roi DECIMAL(8,2) NOT NULL,
  percentile_75_roi DECIMAL(8,2) NOT NULL,
  average_roi_percentage DECIMAL(8,2) NOT NULL,
  
  -- Component Benchmarks
  median_media_value_multiplier DECIMAL(5,2), -- Media value vs investment
  median_brand_lift_percentage DECIMAL(5,2), -- Typical brand lift
  median_customer_acquisition_cost DECIMAL(8,2),
  
  -- Sample Data
  sample_size INTEGER NOT NULL,
  data_collection_period VARCHAR(50), -- 'Q1_2024', '2023_full_year'
  geographic_scope VARCHAR(100) DEFAULT 'north_america',
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(industry, sponsorship_type, investment_tier, data_collection_period)
);

-- Indexes for Performance Optimization
CREATE INDEX IF NOT EXISTS idx_predictive_models_sponsor ON predictive_models(sponsor_name);
CREATE INDEX IF NOT EXISTS idx_predictive_models_type ON predictive_models(model_type);
CREATE INDEX IF NOT EXISTS idx_predictive_models_accuracy ON predictive_models(accuracy);

CREATE INDEX IF NOT EXISTS idx_real_time_sentiment_sponsor ON real_time_sentiment(sponsor_name);
CREATE INDEX IF NOT EXISTS idx_real_time_sentiment_timestamp ON real_time_sentiment(timestamp);
CREATE INDEX IF NOT EXISTS idx_real_time_sentiment_score ON real_time_sentiment(sentiment_score);
CREATE INDEX IF NOT EXISTS idx_real_time_sentiment_volume ON real_time_sentiment(volume);

CREATE INDEX IF NOT EXISTS idx_ab_test_sponsor ON ab_test_results(sponsor_name);
CREATE INDEX IF NOT EXISTS idx_ab_test_type ON ab_test_results(test_type);
CREATE INDEX IF NOT EXISTS idx_ab_test_significance ON ab_test_results(statistical_significance);
CREATE INDEX IF NOT EXISTS idx_ab_test_lift ON ab_test_results(lift_percentage);

CREATE INDEX IF NOT EXISTS idx_geo_targeting_sponsor ON geo_targeting_analysis(sponsor_name);
CREATE INDEX IF NOT EXISTS idx_geo_targeting_market ON geo_targeting_analysis(market);

CREATE INDEX IF NOT EXISTS idx_advanced_roi_sponsor ON advanced_roi_calculations(sponsor_name);
CREATE INDEX IF NOT EXISTS idx_advanced_roi_driver ON advanced_roi_calculations(driver_id);
CREATE INDEX IF NOT EXISTS idx_advanced_roi_event ON advanced_roi_calculations(event_id);
CREATE INDEX IF NOT EXISTS idx_advanced_roi_type ON advanced_roi_calculations(calculation_type);
CREATE INDEX IF NOT EXISTS idx_advanced_roi_period ON advanced_roi_calculations(calculation_period);
CREATE INDEX IF NOT EXISTS idx_advanced_roi_percentage ON advanced_roi_calculations(roi_percentage);
CREATE INDEX IF NOT EXISTS idx_advanced_roi_date ON advanced_roi_calculations(calculation_date);

CREATE INDEX IF NOT EXISTS idx_attribution_models_sponsor ON attribution_models(sponsor_name);
CREATE INDEX IF NOT EXISTS idx_attribution_models_type ON attribution_models(model_type);

CREATE INDEX IF NOT EXISTS idx_clv_sponsor ON clv_analysis(sponsor_name);
CREATE INDEX IF NOT EXISTS idx_clv_segment ON clv_analysis(customer_segment);
CREATE INDEX IF NOT EXISTS idx_clv_cohort ON clv_analysis(cohort_month);
CREATE INDEX IF NOT EXISTS idx_clv_ratio ON clv_analysis(clv_to_cac_ratio);

CREATE INDEX IF NOT EXISTS idx_competitive_intel_competitor ON competitive_intelligence(competitor_name);
CREATE INDEX IF NOT EXISTS idx_competitive_intel_sponsor ON competitive_intelligence(our_sponsor);
CREATE INDEX IF NOT EXISTS idx_competitive_intel_date ON competitive_intelligence(comparison_date);

CREATE INDEX IF NOT EXISTS idx_roi_recommendations_sponsor ON roi_optimization_recommendations(sponsor_name);
CREATE INDEX IF NOT EXISTS idx_roi_recommendations_type ON roi_optimization_recommendations(recommendation_type);
CREATE INDEX IF NOT EXISTS idx_roi_recommendations_priority ON roi_optimization_recommendations(implementation_priority);
CREATE INDEX IF NOT EXISTS idx_roi_recommendations_status ON roi_optimization_recommendations(status);

CREATE INDEX IF NOT EXISTS idx_roi_benchmarks_industry ON roi_benchmarks(industry);
CREATE INDEX IF NOT EXISTS idx_roi_benchmarks_type ON roi_benchmarks(sponsorship_type);
CREATE INDEX IF NOT EXISTS idx_roi_benchmarks_tier ON roi_benchmarks(investment_tier);
