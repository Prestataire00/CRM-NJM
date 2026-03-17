-- Re-Add fields for Pedagogical Sheet (Google Docs Template)
ALTER TABLE formations 
ADD COLUMN IF NOT EXISTS evaluation_methodology TEXT,
ADD COLUMN IF NOT EXISTS added_value TEXT;

-- Comment on columns
COMMENT ON COLUMN formations.evaluation_methodology IS 'Méthodologie d''évaluation pour la fiche pédagogique';
COMMENT ON COLUMN formations.added_value IS 'Le + apporté pour la fiche pédagogique';
