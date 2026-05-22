-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Accounts table (platform users / marketing teams)
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  company VARCHAR(255),
  physical_address TEXT,
  from_name VARCHAR(255),
  from_email VARCHAR(255),
  ses_verified_domain VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contacts
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  company VARCHAR(255),
  phone VARCHAR(50),
  status VARCHAR(50) DEFAULT 'active',
  source VARCHAR(50) DEFAULT 'import',
  tags TEXT[] DEFAULT '{}',
  custom_fields JSONB DEFAULT '{}',
  birthday DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, email)
);

-- Segments
CREATE TABLE IF NOT EXISTS segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  color VARCHAR(7) DEFAULT '#4F7FFF',
  rules JSONB DEFAULT '[]',
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Templates
CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  name VARCHAR(255),
  blocks JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Campaigns
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  subject_line VARCHAR(500),
  preview_text VARCHAR(500),
  from_name VARCHAR(255),
  from_email VARCHAR(255),
  reply_to VARCHAR(255),
  status VARCHAR(50) DEFAULT 'draft',
  segment_id UUID REFERENCES segments(id),
  template_id UUID REFERENCES templates(id),
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sends (per-contact delivery record)
CREATE TABLE IF NOT EXISTS sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  ses_message_id VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending',
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  unsubscribed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Automations
CREATE TABLE IF NOT EXISTS automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  trigger_type VARCHAR(100),
  trigger_config JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT FALSE,
  steps JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Preference Centre Config
CREATE TABLE IF NOT EXISTS preference_centre_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE UNIQUE,
  logo_url VARCHAR(500),
  brand_color VARCHAR(7) DEFAULT '#4F7FFF',
  headline VARCHAR(80),
  description VARCHAR(300),
  subscription_types JSONB DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contact Preferences
CREATE TABLE IF NOT EXISTS contact_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  subscription_type_id VARCHAR(100),
  opted_in BOOLEAN DEFAULT TRUE,
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address INET,
  UNIQUE(contact_id, subscription_type_id)
);

-- Suppression List
CREATE TABLE IF NOT EXISTS suppression_list (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  reason VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, email)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_contacts_account_id ON contacts(account_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_account_id ON campaigns(account_id);
CREATE INDEX IF NOT EXISTS idx_sends_campaign_id ON sends(campaign_id);
CREATE INDEX IF NOT EXISTS idx_sends_contact_id ON sends(contact_id);
CREATE INDEX IF NOT EXISTS idx_sends_ses_message_id ON sends(ses_message_id);
CREATE INDEX IF NOT EXISTS idx_suppression_account_email ON suppression_list(account_id, email);
