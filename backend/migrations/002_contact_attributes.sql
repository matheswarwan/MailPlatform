-- Add sex field to contacts
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS sex VARCHAR(20);

-- Custom field definitions per account
-- Allows users to define their own contact attributes (e.g. "City", "Income", "Plan")
CREATE TABLE IF NOT EXISTS custom_field_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  key VARCHAR(100) NOT NULL,
  type VARCHAR(20) NOT NULL DEFAULT 'text',
  options JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, key)
);

CREATE INDEX IF NOT EXISTS idx_custom_field_defs_account ON custom_field_definitions(account_id);
