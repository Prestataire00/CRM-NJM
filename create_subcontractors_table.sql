-- ================================================
-- MIGRATION: Table des sous-traitants
-- Gère les sous-traitants créés lors des formations
-- et leur liaison avec les utilisateurs formateurs
-- ================================================

-- Créer la table subcontractors
CREATE TABLE IF NOT EXISTS public.subcontractors (
    id BIGSERIAL PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    company TEXT,
    notes TEXT,
    created_from_formation_id BIGINT REFERENCES public.formations(id) ON DELETE SET NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour les recherches
CREATE INDEX IF NOT EXISTS idx_subcontractors_name ON public.subcontractors(last_name, first_name);
CREATE INDEX IF NOT EXISTS idx_subcontractors_email ON public.subcontractors(email);

-- Ajouter une colonne subcontractor_id à la table profiles
-- Pour lier un utilisateur formateur à un sous-traitant
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS subcontractor_id BIGINT REFERENCES public.subcontractors(id) ON DELETE SET NULL;

-- Ajouter une colonne subcontractor_id à la table formations
-- Pour enregistrer quel sous-traitant est associé à cette formation
ALTER TABLE public.formations
ADD COLUMN IF NOT EXISTS subcontractor_id BIGINT REFERENCES public.subcontractors(id) ON DELETE SET NULL;

-- Activer RLS
ALTER TABLE public.subcontractors ENABLE ROW LEVEL SECURITY;

-- Politique: Admins et formateurs peuvent voir les sous-traitants
CREATE POLICY "Admins and trainers can view subcontractors"
    ON public.subcontractors FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('admin', 'formateur')
        )
    );

-- Politique: Admins et formateurs peuvent créer des sous-traitants
CREATE POLICY "Admins and trainers can insert subcontractors"
    ON public.subcontractors FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('admin', 'formateur')
        )
    );

-- Politique: Admins peuvent modifier les sous-traitants
CREATE POLICY "Admins can update subcontractors"
    ON public.subcontractors FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Politique: Admins peuvent supprimer les sous-traitants
CREATE POLICY "Admins can delete subcontractors"
    ON public.subcontractors FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Trigger pour updated_at
CREATE TRIGGER update_subcontractors_updated_at
    BEFORE UPDATE ON public.subcontractors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================================
-- TERMINÉ!
-- ================================================
-- Après cette migration:
-- 1. La table subcontractors stocke les sous-traitants
-- 2. profiles.subcontractor_id lie un formateur à un sous-traitant
-- 3. formations.subcontractor_id lie une formation à un sous-traitant
