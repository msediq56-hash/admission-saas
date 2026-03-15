-- Migration 005: Add option_effects to custom_requirements and major_subject_requirements
-- This allows each option in a select question to have its own effect and message
-- Format: { "option_label": { "effect": "none|makes_conditional|blocks_admission", "message": "..." } }

alter table custom_requirements add column option_effects jsonb;

alter table major_subject_requirements add column option_effects jsonb;
