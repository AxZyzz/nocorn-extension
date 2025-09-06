-- Supabase Database Schema for NoCorn Extension Security System

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- User profiles table
CREATE TABLE user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_score INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  security_hash TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'banned')),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User blocked sites
CREATE TABLE user_blocked_sites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  site TEXT NOT NULL,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE(user_id, site)
);

-- User sessions
CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_days INTEGER NOT NULL,
  blocked_sites JSONB NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'emergency_disabled')),
  emergency_attempts INTEGER DEFAULT 0,
  points_awarded INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Blockchain blocks for immutable point records
CREATE TABLE blockchain_blocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  block_hash TEXT UNIQUE NOT NULL,
  previous_hash TEXT NOT NULL,
  action_type TEXT NOT NULL,
  points_awarded INTEGER NOT NULL,
  block_data JSONB NOT NULL,
  nonce INTEGER NOT NULL DEFAULT 0,
  difficulty INTEGER NOT NULL DEFAULT 2,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User point transactions
CREATE TABLE user_point_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  points_awarded INTEGER NOT NULL,
  block_hash TEXT REFERENCES blockchain_blocks(block_hash),
  transaction_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Security logs
CREATE TABLE security_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES user_profiles(user_id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  severity TEXT DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  description TEXT,
  event_data JSONB,
  ip_address INET,
  user_agent TEXT,
  resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User panic mode logs
CREATE TABLE user_panic_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User action counts for rate limiting
CREATE TABLE user_action_counts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  action_count INTEGER DEFAULT 1,
  last_action TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, action_type)
);

-- Admin users
CREATE TABLE admin_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  admin_level INTEGER NOT NULL CHECK (admin_level BETWEEN 1 AND 3),
  permissions TEXT[] NOT NULL,
  created_by UUID REFERENCES admin_users(user_id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);

-- Admin action logs
CREATE TABLE admin_action_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID REFERENCES admin_users(user_id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  action_data JSONB,
  target_user_id UUID,
  ip_address INET,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- System configuration
CREATE TABLE system_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  config_key TEXT UNIQUE NOT NULL,
  config_value JSONB NOT NULL,
  updated_by UUID REFERENCES admin_users(user_id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Flagged activities
CREATE TABLE flagged_activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  activity_data JSONB NOT NULL,
  flagged_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'reviewed', 'resolved', 'false_positive')),
  reviewed_by UUID REFERENCES admin_users(user_id),
  reviewed_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for performance
CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX idx_blockchain_blocks_user_id ON blockchain_blocks(user_id);
CREATE INDEX idx_blockchain_blocks_created_at ON blockchain_blocks(created_at);
CREATE INDEX idx_security_logs_user_id ON security_logs(user_id);
CREATE INDEX idx_security_logs_created_at ON security_logs(created_at);
CREATE INDEX idx_security_logs_severity ON security_logs(severity);
CREATE INDEX idx_user_point_transactions_user_id ON user_point_transactions(user_id);
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_status ON user_sessions(status);

-- Row Level Security (RLS) Policies
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_blocked_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE blockchain_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_point_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_panic_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_action_counts ENABLE ROW LEVEL SECURITY;

-- Users can only access their own data
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own blocked sites" ON user_blocked_sites
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own sessions" ON user_sessions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own blockchain blocks" ON blockchain_blocks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own transactions" ON user_point_transactions
  FOR SELECT USING (auth.uid() = user_id);

-- Admin policies
CREATE POLICY "Admins can view all data" ON user_profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE user_id = auth.uid() AND is_active = TRUE
    )
  );

-- Functions for secure operations
CREATE OR REPLACE FUNCTION get_server_time()
RETURNS TIMESTAMP WITH TIME ZONE
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT NOW();
$$;

CREATE OR REPLACE FUNCTION validate_user_action(
  user_id UUID,
  action_type TEXT,
  action_data JSONB,
  client_timestamp TIMESTAMP WITH TIME ZONE,
  session_key TEXT
)
RETURNS JSONB
LANGUAGE PLPGSQL
SECURITY DEFINER
AS $$
DECLARE
  server_time TIMESTAMP WITH TIME ZONE;
  time_diff INTERVAL;
  user_status TEXT;
  result JSONB;
BEGIN
  -- Get server time
  server_time := NOW();
  time_diff := ABS(server_time - client_timestamp);
  
  -- Check if user exists and is active
  SELECT status INTO user_status 
  FROM user_profiles 
  WHERE user_profiles.user_id = validate_user_action.user_id;
  
  IF user_status IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'User not found');
  END IF;
  
  IF user_status != 'active' THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'User account suspended');
  END IF;
  
  -- Validate timestamp (5 minute window)
  IF time_diff > INTERVAL '5 minutes' THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'Invalid timestamp');
  END IF;
  
  -- Action-specific validations
  IF action_type = 'add_site' THEN
    -- Check if site already exists
    IF EXISTS (
      SELECT 1 FROM user_blocked_sites 
      WHERE user_blocked_sites.user_id = validate_user_action.user_id 
      AND site = action_data->>'site'
    ) THEN
      RETURN jsonb_build_object('valid', false, 'reason', 'Site already exists');
    END IF;
  END IF;
  
  -- Update last activity
  UPDATE user_profiles 
  SET last_activity = server_time 
  WHERE user_profiles.user_id = validate_user_action.user_id;
  
  RETURN jsonb_build_object('valid', true, 'server_time', server_time);
END;
$$;

CREATE OR REPLACE FUNCTION update_user_score_secure(
  user_id UUID,
  points_to_add INTEGER,
  block_hash TEXT,
  session_key TEXT
)
RETURNS JSONB
LANGUAGE PLPGSQL
SECURITY DEFINER
AS $$
DECLARE
  current_score INTEGER;
  new_score INTEGER;
  result JSONB;
BEGIN
  -- Get current score
  SELECT total_score INTO current_score 
  FROM user_profiles 
  WHERE user_profiles.user_id = update_user_score_secure.user_id;
  
  IF current_score IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  
  -- Calculate new score
  new_score := current_score + points_to_add;
  
  -- Ensure score doesn't go negative
  IF new_score < 0 THEN
    new_score := 0;
  END IF;
  
  -- Update score
  UPDATE user_profiles 
  SET 
    total_score = new_score,
    last_activity = NOW()
  WHERE user_profiles.user_id = update_user_score_secure.user_id;
  
  -- Insert transaction record
  INSERT INTO user_point_transactions (user_id, action_type, points_awarded, block_hash)
  VALUES (user_id, 'score_update', points_to_add, block_hash);
  
  RETURN jsonb_build_object(
    'success', true,
    'previous_score', current_score,
    'new_score', new_score,
    'points_added', points_to_add
  );
END;
$$;

CREATE OR REPLACE FUNCTION detect_point_exploits()
RETURNS TABLE (
  user_id UUID,
  total_score INTEGER,
  points_per_hour NUMERIC,
  account_age_days INTEGER,
  streak_days INTEGER,
  pattern_score NUMERIC,
  time_anomalies INTEGER
)
LANGUAGE PLPGSQL
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    up.user_id,
    up.total_score,
    COALESCE(up.total_score::NUMERIC / GREATEST(EXTRACT(EPOCH FROM (NOW() - up.created_at))/3600, 1), 0) as points_per_hour,
    EXTRACT(DAYS FROM (NOW() - up.created_at))::INTEGER as account_age_days,
    up.current_streak,
    -- Pattern score based on various factors
    (
      CASE WHEN up.total_score > 10000 THEN 0.3 ELSE 0 END +
      CASE WHEN up.current_streak > 100 THEN 0.3 ELSE 0 END +
      CASE WHEN COALESCE(up.total_score::NUMERIC / GREATEST(EXTRACT(EPOCH FROM (NOW() - up.created_at))/3600, 1), 0) > 500 THEN 0.4 ELSE 0 END
    ) as pattern_score,
    -- Count of time anomalies (placeholder)
    0 as time_anomalies
  FROM user_profiles up
  WHERE up.status = 'active'
  ORDER BY pattern_score DESC, points_per_hour DESC;
END;
$$;

-- Insert default system configuration
INSERT INTO system_config (config_key, config_value) VALUES
('max_daily_points', '1000'),
('session_max_duration', '365'),
('panic_mode_cooldown', '1800'),
('blockchain_difficulty', '2'),
('rate_limit_windows', '{"add_site": 3600, "panic_mode": 1800}');

-- Insert default admin user (replace with actual admin email)
-- This should be done manually after setup
-- INSERT INTO admin_users (user_id, admin_level, permissions) 
-- VALUES ((SELECT id FROM auth.users WHERE email = 'admin@nocorn.com'), 3, 
--         ARRAY['view_users', 'security_monitoring', 'user_management', 'apply_penalties', 
--               'system_config', 'analytics', 'system_backup', 'emergency_controls', 'blockchain_admin']);
