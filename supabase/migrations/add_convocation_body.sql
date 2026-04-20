-- ============================================================
-- Migration: Ajout colonne body à convocation_logs
-- Permet d'archiver et de consulter le contenu des mails envoyés
-- ============================================================

ALTER TABLE convocation_logs ADD COLUMN IF NOT EXISTS body TEXT;
