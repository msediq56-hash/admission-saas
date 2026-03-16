-- Migration: Add requirement_rules table for rule-based requirements system
-- Each rule is a row with a rule_type and a config JSONB payload
-- This runs ALONGSIDE the old requirements system (no changes to existing tables)

CREATE TABLE IF NOT EXISTS requirement_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  certificate_type_id UUID REFERENCES certificate_types(id) ON DELETE SET NULL,
  rule_type TEXT NOT NULL,          -- e.g. 'high_school', 'language_cert', 'sat', 'gpa', 'a_levels', etc.
  config JSONB NOT NULL DEFAULT '{}', -- rule-specific configuration
  effect TEXT NOT NULL DEFAULT 'blocks_admission', -- 'blocks_admission' | 'makes_conditional' | 'scholarship' | 'none'
  effect_message TEXT,              -- Arabic message shown when rule triggers
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE
);

-- Index for fast lookups by program
CREATE INDEX IF NOT EXISTS idx_requirement_rules_program ON requirement_rules(program_id);
CREATE INDEX IF NOT EXISTS idx_requirement_rules_tenant ON requirement_rules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_requirement_rules_type ON requirement_rules(rule_type);

-- RLS: users can only see rules belonging to their tenant
ALTER TABLE requirement_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY requirement_rules_tenant_read ON requirement_rules
  FOR SELECT USING (tenant_id = (SELECT tenant_id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY requirement_rules_tenant_write ON requirement_rules
  FOR ALL USING (tenant_id = (SELECT tenant_id FROM users WHERE auth_id = auth.uid()));
