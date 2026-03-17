-- ================================================
-- MIGRATION: Mise à jour de la table BPF
-- Ajoute les colonnes nécessaires pour la création automatique
-- lors de la création d'une formation
-- ================================================

-- Ajouter les nouvelles colonnes
ALTER TABLE public.bpf
ADD COLUMN IF NOT EXISTS formation_type TEXT,
ADD COLUMN IF NOT EXISTS company_name TEXT,
ADD COLUMN IF NOT EXISTS amount_ht DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS number_of_learners INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_hours DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS exported BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS export_amount DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS formation_id BIGINT REFERENCES public.formations(id) ON DELETE SET NULL;

-- Rendre la colonne title optionnelle (elle était NOT NULL avant)
ALTER TABLE public.bpf ALTER COLUMN title DROP NOT NULL;

-- Créer un index sur l'année fiscale pour les requêtes de filtrage
CREATE INDEX IF NOT EXISTS idx_bpf_year ON public.bpf(year);

-- Créer un index sur le type de formation
CREATE INDEX IF NOT EXISTS idx_bpf_formation_type ON public.bpf(formation_type);

-- ================================================
-- Mise à jour des politiques RLS
-- Permettre aux formateurs de créer des BPF (car ils créent les formations)
-- ================================================

-- Supprimer l'ancienne politique admin-only
DROP POLICY IF EXISTS "Admins can manage bpf" ON public.bpf;

-- Nouvelle politique: Admins et formateurs peuvent voir les BPF
CREATE POLICY "Admins and trainers can view bpf"
    ON public.bpf FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('admin', 'formateur')
        )
    );

-- Nouvelle politique: Admins et formateurs peuvent insérer des BPF
CREATE POLICY "Admins and trainers can insert bpf"
    ON public.bpf FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('admin', 'formateur')
        )
    );

-- Politique: Admins peuvent modifier les BPF
CREATE POLICY "Admins can update bpf"
    ON public.bpf FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Politique: Admins peuvent supprimer les BPF
CREATE POLICY "Admins can delete bpf"
    ON public.bpf FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- ================================================
-- TERMINÉ!
-- ================================================
-- Après cette migration, la table BPF aura les colonnes:
-- - formation_type: "Entreprise - Direct", "Écoles - Indirect", etc.
-- - company_name: Raison sociale du client
-- - year: Année fiscale (calculée: si mois >= octobre, année+1)
-- - amount_ht: Montant HT de la formation
-- - number_of_learners: Nombre de stagiaires
-- - total_hours: Total heures stagiaires
-- - exported: Indicateur d'export
-- - export_amount: Montant exporté
-- - formation_id: Référence vers la formation d'origine
