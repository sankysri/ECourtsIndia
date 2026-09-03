-- Indian Court Data Ingestion & Intelligence Platform - Database Schema
-- Milestones 1, 2, 3, 4, 5, & 6 Schema

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Roles Table
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Permissions Table
CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) UNIQUE NOT NULL,
  module VARCHAR(50) NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Role-Permissions Junction
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (role_id, permission_id)
);

-- 4. Users Table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  refresh_token TEXT,
  last_login_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. User-Roles Junction
CREATE TABLE IF NOT EXISTS user_roles (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, role_id)
);

-- 6. Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  entity VARCHAR(100) NOT NULL,
  entity_id VARCHAR(100),
  details JSONB DEFAULT '{}',
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. System Settings Table
CREATE TABLE IF NOT EXISTS system_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key VARCHAR(100) UNIQUE NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  is_public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. States Table (M2)
CREATE TABLE IF NOT EXISTS states (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(10) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. Districts Table (M2)
CREATE TABLE IF NOT EXISTS districts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  state_id UUID NOT NULL REFERENCES states(id) ON DELETE CASCADE,
  code VARCHAR(20) NOT NULL,
  name VARCHAR(150) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (state_id, code)
);

-- 10. Courts Table (M2 Court Master)
CREATE TABLE IF NOT EXISTS courts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  state_id UUID NOT NULL REFERENCES states(id) ON DELETE CASCADE,
  district_id UUID REFERENCES districts(id) ON DELETE SET NULL,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  parent_court_id UUID REFERENCES courts(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'ACTIVE',
  total_cases INTEGER DEFAULT 0,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 11. Dynamic API Reference Enums (M2)
CREATE TABLE IF NOT EXISTS api_enums (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category VARCHAR(50) NOT NULL,
  code VARCHAR(100) NOT NULL,
  label VARCHAR(255) NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (category, code)
);

-- 12. API Request Logs (M2)
CREATE TABLE IF NOT EXISTS api_request_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  endpoint VARCHAR(255) NOT NULL,
  method VARCHAR(10) NOT NULL,
  request_identifier VARCHAR(100) NOT NULL,
  case_cnr VARCHAR(50),
  court_code VARCHAR(50),
  status_code INTEGER NOT NULL,
  success BOOLEAN NOT NULL,
  response_time_ms INTEGER NOT NULL,
  estimated_cost NUMERIC(10, 4) DEFAULT 0.0000,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 13. Case Registry (M3)
CREATE TABLE IF NOT EXISTS case_registry (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cnr VARCHAR(50) UNIQUE NOT NULL,
  court_id UUID NOT NULL REFERENCES courts(id) ON DELETE CASCADE,
  first_discovered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_discovered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_detail_sync_at TIMESTAMP WITH TIME ZONE,
  last_refresh_at TIMESTAMP WITH TIME ZONE,
  case_status VARCHAR(50) DEFAULT 'DISCOVERED',
  sync_status VARCHAR(50) DEFAULT 'PENDING_DETAIL',
  priority_score INTEGER DEFAULT 100,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 14. Backfill Campaigns (M5)
CREATE TABLE IF NOT EXISTS backfill_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  selected_courts JSONB NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  case_types JSONB DEFAULT '[]',
  statuses JSONB DEFAULT '[]',
  status VARCHAR(50) DEFAULT 'QUEUED',
  total_jobs INTEGER DEFAULT 0,
  completed_jobs INTEGER DEFAULT 0,
  failed_jobs INTEGER DEFAULT 0,
  total_cnrs_discovered INTEGER DEFAULT 0,
  total_details_synced INTEGER DEFAULT 0,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 15. Daily Discovery Runs (M6)
CREATE TABLE IF NOT EXISTS daily_discovery_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lookback_window VARCHAR(50) NOT NULL, -- 'TODAY' | 'YESTERDAY' | 'LAST_7_DAYS' | 'LAST_30_DAYS'
  status VARCHAR(50) DEFAULT 'RUNNING', -- 'RUNNING' | 'COMPLETED' | 'FAILED'
  courts_scanned INTEGER DEFAULT 0,
  jobs_created INTEGER DEFAULT 0,
  total_cases_found INTEGER DEFAULT 0,
  new_cnrs_found INTEGER DEFAULT 0,
  existing_cnrs_found INTEGER DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 16. Discovery Jobs (M3 + M5 + M6)
CREATE TABLE IF NOT EXISTS discovery_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID REFERENCES backfill_campaigns(id) ON DELETE CASCADE,
  daily_run_id UUID REFERENCES daily_discovery_runs(id) ON DELETE CASCADE,
  court_id UUID NOT NULL REFERENCES courts(id) ON DELETE CASCADE,
  strategy VARCHAR(50) NOT NULL,
  filters JSONB DEFAULT '{}',
  status VARCHAR(50) DEFAULT 'QUEUED',
  current_page INTEGER DEFAULT 1,
  total_pages INTEGER DEFAULT 1,
  records_found INTEGER DEFAULT 0,
  new_cases_found INTEGER DEFAULT 0,
  existing_cases_found INTEGER DEFAULT 0,
  processed_records INTEGER DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 17. Raw API Responses Storage (M4)
CREATE TABLE IF NOT EXISTS raw_api_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source VARCHAR(100) DEFAULT 'ECOURTS_INDIA',
  endpoint VARCHAR(255) NOT NULL,
  case_cnr VARCHAR(50) NOT NULL,
  storage_path TEXT,
  raw_payload JSONB NOT NULL,
  response_hash VARCHAR(64) NOT NULL,
  parser_version VARCHAR(20) DEFAULT 'v1.0',
  retrieved_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  processing_status VARCHAR(50) DEFAULT 'PROCESSED'
);

-- 18. Detailed Cases Table (M4)
CREATE TABLE IF NOT EXISTS cases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cnr VARCHAR(50) UNIQUE NOT NULL,
  court_id UUID NOT NULL REFERENCES courts(id) ON DELETE CASCADE,
  case_number VARCHAR(100),
  case_type VARCHAR(50),
  filing_number VARCHAR(100),
  filing_date DATE,
  registration_number VARCHAR(100),
  registration_date DATE,
  first_hearing_date DATE,
  next_hearing_date DATE,
  decision_date DATE,
  case_status VARCHAR(50) DEFAULT 'PENDING',
  nature_of_disposal VARCHAR(150),
  sub_category VARCHAR(150),
  under_acts TEXT,
  under_sections TEXT,
  police_station VARCHAR(150),
  fir_number VARCHAR(100),
  fir_year INTEGER,
  title VARCHAR(500),
  raw_response_id UUID REFERENCES raw_api_responses(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 19. Case Parties
CREATE TABLE IF NOT EXISTS case_parties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  party_type VARCHAR(50) NOT NULL,
  party_number INTEGER DEFAULT 1,
  name VARCHAR(255) NOT NULL,
  gender VARCHAR(20),
  age INTEGER,
  address TEXT,
  extra_details JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 20. Advocates Roster
CREATE TABLE IF NOT EXISTS advocates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  bar_registration_number VARCHAR(100) UNIQUE,
  phone VARCHAR(50),
  email VARCHAR(150),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 21. Case-Advocate Links
CREATE TABLE IF NOT EXISTS case_advocates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  advocate_id UUID NOT NULL REFERENCES advocates(id) ON DELETE CASCADE,
  party_type VARCHAR(50) NOT NULL,
  is_lead BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (case_id, advocate_id, party_type)
);

-- 22. Judges Roster
CREATE TABLE IF NOT EXISTS judges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  designation VARCHAR(150) DEFAULT 'Judge',
  court_id UUID REFERENCES courts(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 23. Case-Judge Coram Links
CREATE TABLE IF NOT EXISTS case_judges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  judge_id UUID NOT NULL REFERENCES judges(id) ON DELETE CASCADE,
  role VARCHAR(50) DEFAULT 'PRESIDING_JUDGE',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (case_id, judge_id)
);

-- 24. Case Hearing History
CREATE TABLE IF NOT EXISTS case_hearings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  hearing_date DATE NOT NULL,
  business_purpose VARCHAR(255),
  court_hall_number VARCHAR(50),
  judge_name VARCHAR(255),
  next_hearing_date DATE,
  next_purpose VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 25. Case Orders
CREATE TABLE IF NOT EXISTS case_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  order_number VARCHAR(50),
  order_date DATE NOT NULL,
  order_type VARCHAR(100) DEFAULT 'INTERIM',
  judge_name VARCHAR(255),
  document_url TEXT,
  storage_path TEXT,
  file_size_bytes BIGINT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 26. Case Judgments
CREATE TABLE IF NOT EXISTS case_judgments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  judgment_date DATE NOT NULL,
  judgment_type VARCHAR(100) DEFAULT 'ALLOWED',
  author_judge VARCHAR(255),
  document_url TEXT,
  storage_path TEXT,
  file_size_bytes BIGINT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_discovery_jobs_campaign_id ON discovery_jobs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_discovery_jobs_daily_run_id ON discovery_jobs(daily_run_id);
CREATE INDEX IF NOT EXISTS idx_daily_discovery_runs_status ON daily_discovery_runs(status);
CREATE INDEX IF NOT EXISTS idx_daily_discovery_runs_started ON daily_discovery_runs(started_at DESC);
