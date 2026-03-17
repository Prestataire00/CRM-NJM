-- ================================================
-- MIGRATION: Table des clients
-- Gère les clients créés lors des formations
-- et leur liaison avec les utilisateurs clients
-- ================================================

-- Créer la table clients
CREATE TABLE IF NOT EXISTS public.clients (
    id BIGSERIAL PRIMARY KEY,
    company_name TEXT NOT NULL,
    contact_name TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    postal_code TEXT,
    city TEXT,
    notes TEXT,
    created_from_formation_id BIGINT REFERENCES public.formations(id) ON DELETE SET NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour les recherches
CREATE INDEX IF NOT EXISTS idx_clients_company_name ON public.clients(company_name);
CREATE INDEX IF NOT EXISTS idx_clients_email ON public.clients(email);

-- Ajouter une colonne client_id à la table profiles
-- Pour lier un utilisateur client à une entreprise cliente
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS client_id BIGINT REFERENCES public.clients(id) ON DELETE SET NULL;

-- Ajouter une colonne client_id à la table formations
-- Pour enregistrer quel client est associé à cette formation
ALTER TABLE public.formations
ADD COLUMN IF NOT EXISTS client_id BIGINT REFERENCES public.clients(id) ON DELETE SET NULL;

-- Activer RLS
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Politique: Admins et formateurs peuvent voir les clients
CREATE POLICY "Admins and trainers can view clients"
    ON public.clients FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('admin', 'formateur')
        )
    );

-- Politique: Admins et formateurs peuvent créer des clients
CREATE POLICY "Admins and trainers can insert clients"
    ON public.clients FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('admin', 'formateur')
        )
    );

-- Politique: Admins peuvent modifier les clients
CREATE POLICY "Admins can update clients"
    ON public.clients FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Politique: Admins peuvent supprimer les clients
CREATE POLICY "Admins can delete clients"
    ON public.clients FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Trigger pour updated_at
CREATE TRIGGER update_clients_updated_at
    BEFORE UPDATE ON public.clients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================================
-- TERMINÉ!
-- ================================================
-- Après cette migration:
-- 1. La table clients stocke les clients (raisons sociales)
-- 2. profiles.client_id lie un utilisateur client à une entreprise
-- 3. formations.client_id lie une formation à un client
