-- Migration: Add password authentication and invite token support
-- Date: 2024-12-24

BEGIN;

-- Add password_hash column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Add invite_token and invite_expires_at columns to user_tenants table
ALTER TABLE user_tenants ADD COLUMN IF NOT EXISTS invite_token TEXT UNIQUE;
ALTER TABLE user_tenants ADD COLUMN IF NOT EXISTS invite_expires_at TIMESTAMPTZ;

-- Create index for invite_token
CREATE INDEX IF NOT EXISTS idx_user_tenants_invite_token ON user_tenants(invite_token) WHERE invite_token IS NOT NULL;

COMMIT;
