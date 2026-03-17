-- ================================================
-- MIGRATION: Ajout des champs complets pour formations
-- ================================================
-- Date: 11 janvier 2026
-- Description: Ajoute tous les champs détaillés pour la gestion complète des formations

-- ================================================
-- 1. Ajouter les nouveaux champs à la table formations
-- ================================================

-- Informations générales de la formation
ALTER TABLE public.formations
ADD COLUMN IF NOT EXISTS formation_name TEXT,
ADD COLUMN IF NOT EXISTS formation_type TEXT CHECK (formation_type IN ('ecoles', 'entreprises')),
ADD COLUMN IF NOT EXISTS collaboration_mode TEXT CHECK (collaboration_mode IN ('direct', 'indirect', 'sous-traitant')),
ADD COLUMN IF NOT EXISTS client_name TEXT,

-- Informations entreprise/client
ADD COLUMN IF NOT EXISTS company_name TEXT,
ADD COLUMN IF NOT EXISTS company_address TEXT,
ADD COLUMN IF NOT EXISTS company_postal_code TEXT,
ADD COLUMN IF NOT EXISTS company_director_name TEXT,

-- Détails de la formation
ADD COLUMN IF NOT EXISTS training_location TEXT,
ADD COLUMN IF NOT EXISTS number_of_days INTEGER,
ADD COLUMN IF NOT EXISTS hours_per_day DECIMAL(4,2),
ADD COLUMN IF NOT EXISTS hours_per_learner DECIMAL(4,2),
ADD COLUMN IF NOT EXISTS total_amount DECIMAL(10,2),

-- Contenu pédagogique
ADD COLUMN IF NOT EXISTS target_audience TEXT,
ADD COLUMN IF NOT EXISTS prerequisites TEXT,
ADD COLUMN IF NOT EXISTS objectives TEXT,
ADD COLUMN IF NOT EXISTS module_1 TEXT,
ADD COLUMN IF NOT EXISTS methods_tools TEXT,
ADD COLUMN IF NOT EXISTS access_delays TEXT,

-- Métadonnées
ADD COLUMN IF NOT EXISTS attendance_sheets JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS learners_data JSONB DEFAULT '[]'::jsonb;

-- ================================================
-- 2. Commentaires pour documentation
-- ================================================
COMMENT ON COLUMN public.formations.formation_name IS 'Nom de la formation (ex: Techniques de vente, Management)';
COMMENT ON COLUMN public.formations.formation_type IS 'Type: écoles ou entreprises';
COMMENT ON COLUMN public.formations.collaboration_mode IS 'Mode: direct, indirect ou sous-traitant';
COMMENT ON COLUMN public.formations.attendance_sheets IS 'Feuilles de présence par jour (format JSON)';
COMMENT ON COLUMN public.formations.learners_data IS 'Données des apprenants avec leurs heures (format JSON)';

-- ================================================
-- 3. Exemple de structure JSON pour attendance_sheets
-- ================================================
-- Format attendu pour attendance_sheets:
-- [
--   {
--     "day": 1,
--     "date": "2026-01-15",
--     "learners_hours": [
--       {"learner_id": 1, "learner_name": "Jean Dupont", "hours": 7},
--       {"learner_id": 2, "learner_name": "Marie Martin", "hours": 7}
--     ]
--   }
-- ]

-- ================================================
-- 4. Exemple de structure JSON pour learners_data
-- ================================================
-- Format attendu pour learners_data:
-- [
--   {
--     "id": 1,
--     "first_name": "Jean",
--     "last_name": "Dupont",
--     "position": 1
--   }
-- ]

-- ================================================
-- 5. Index pour optimisation
-- ================================================
CREATE INDEX IF NOT EXISTS idx_formations_formation_type ON public.formations(formation_type);
CREATE INDEX IF NOT EXISTS idx_formations_collaboration_mode ON public.formations(collaboration_mode);
CREATE INDEX IF NOT EXISTS idx_formations_client_name ON public.formations(client_name);

-- ================================================
-- TERMINÉ!
-- ================================================
-- Exécutez ce script dans Supabase SQL Editor
-- Dashboard > SQL Editor > New Query > Coller ce code > Run
