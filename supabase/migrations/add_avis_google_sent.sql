-- ============================================================
-- Migration: Flag avis Google envoyé sur formations
-- Empêche le double envoi par le cron check-avis-google
-- ============================================================

ALTER TABLE formations ADD COLUMN IF NOT EXISTS avis_google_sent BOOLEAN DEFAULT FALSE;
ALTER TABLE formations ADD COLUMN IF NOT EXISTS avis_google_sent_at TIMESTAMP WITH TIME ZONE;
