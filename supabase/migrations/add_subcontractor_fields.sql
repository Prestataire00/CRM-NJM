-- ============================================================
-- Migration: Ajout des colonnes manquantes à subcontractors
-- Fix bug: "column address does not exist" lors de la mise à jour
-- ============================================================

ALTER TABLE subcontractors ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE subcontractors ADD COLUMN IF NOT EXISTS siret TEXT;
ALTER TABLE subcontractors ADD COLUMN IF NOT EXISTS nda TEXT;
ALTER TABLE subcontractors ADD COLUMN IF NOT EXISTS naf TEXT;
