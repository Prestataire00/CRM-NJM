-- Champs supplémentaires pour le questionnaire préalable client
ALTER TABLE formations ADD COLUMN IF NOT EXISTS prealable_formation_type TEXT;
ALTER TABLE formations ADD COLUMN IF NOT EXISTS opco_name TEXT;
ALTER TABLE formations ADD COLUMN IF NOT EXISTS opco_subrogation BOOLEAN DEFAULT FALSE;
