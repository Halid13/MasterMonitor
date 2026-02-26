CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  department TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS groups TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS servers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  ip_address TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'offline',
  health_score INTEGER NOT NULL DEFAULT 0,
  cpu_usage DOUBLE PRECISION NOT NULL DEFAULT 0,
  memory_usage DOUBLE PRECISION NOT NULL DEFAULT 0,
  disk_usage DOUBLE PRECISION NOT NULL DEFAULT 0,
  network_in DOUBLE PRECISION NOT NULL DEFAULT 0,
  network_out DOUBLE PRECISION NOT NULL DEFAULT 0,
  process_count INTEGER NOT NULL DEFAULT 0,
  uptime DOUBLE PRECISION NOT NULL DEFAULT 0,
  last_health_check TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE servers ADD COLUMN IF NOT EXISTS services JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS tickets (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'open',
  category TEXT NOT NULL DEFAULT 'other',
  created_by TEXT,
  assigned_to TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE tickets ADD COLUMN IF NOT EXISTS comments JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS ticket_status_history (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS logs (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  level TEXT NOT NULL,
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  object_impacted TEXT NOT NULL,
  username TEXT,
  ip_source TEXT,
  details JSONB,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE logs ADD COLUMN IF NOT EXISTS old_value TEXT;
ALTER TABLE logs ADD COLUMN IF NOT EXISTS new_value TEXT;

CREATE TABLE IF NOT EXISTS equipment (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  serial_number TEXT NOT NULL,
  hardware_id TEXT,
  ip_address TEXT,
  status TEXT NOT NULL DEFAULT 'stock',
  assigned_to_user TEXT,
  department_service TEXT,
  location TEXT,
  network_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  inventory_meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  date_in_service TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ip_addresses (
  id TEXT PRIMARY KEY,
  address TEXT NOT NULL,
  subnet TEXT,
  gateway TEXT,
  dns_servers TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  assigned_to TEXT,
  ip_status TEXT NOT NULL DEFAULT 'free',
  last_seen TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subnets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  main_network_cidr TEXT NOT NULL,
  subnet_cidr TEXT NOT NULL,
  network_address TEXT NOT NULL,
  prefix INTEGER NOT NULL,
  netmask TEXT NOT NULL,
  range_start TEXT NOT NULL,
  range_end TEXT NOT NULL,
  usable_hosts INTEGER NOT NULL DEFAULT 0,
  allocation TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL,
  source TEXT,
  is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ping_results (
  id TEXT PRIMARY KEY,
  target TEXT NOT NULL,
  reachable BOOLEAN NOT NULL DEFAULT FALSE,
  avg_latency_ms DOUBLE PRECISION,
  sent INTEGER NOT NULL DEFAULT 0,
  received INTEGER NOT NULL DEFAULT 0,
  elapsed_ms DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS monitoring_snapshots (
  category TEXT PRIMARY KEY,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS runtime_state (
  state_key TEXT PRIMARY KEY,
  state_value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_logs_level ON logs (level);
CREATE INDEX IF NOT EXISTS idx_logs_category ON logs (category);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets (status);
CREATE INDEX IF NOT EXISTS idx_servers_status ON servers (status);
CREATE INDEX IF NOT EXISTS idx_ticket_status_history_changed_at ON ticket_status_history (changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_ping_results_created_at ON ping_results (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ip_addresses_address ON ip_addresses (address);
