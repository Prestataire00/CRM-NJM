-- ============================================================
-- Migration: Ajout colonne category sur email_templates
-- Permet le groupement dynamique et les templates personnalisés
-- ============================================================

ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'autre';

UPDATE email_templates SET category = 'avant' WHERE id IN ('acces_client', 'prealable_reminder', 'convocation_v2', 'relance_convention_v2', 'contrat_sous_traitance', 'convocation');
UPDATE email_templates SET category = 'apres' WHERE id IN ('fin_formation_v2', 'fin_formation', 'relance_questionnaires', 'avis_google_sous_traitant', 'avis_google_direct', 'relance_convention');
