-- ================================================
-- MIGRATION: Table de jonction profile_clients
-- Permet a un utilisateur client d'etre lie a
-- plusieurs entites clientes (ex: K Vert + K Vert Jardin)
-- ================================================

-- 1. Creer la table de jonction
CREATE TABLE IF NOT EXISTS public.profile_clients (
    id BIGSERIAL PRIMARY KEY,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    client_id BIGINT NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(profile_id, client_id)
);

-- Index pour les recherches performantes
CREATE INDEX IF NOT EXISTS idx_profile_clients_profile ON public.profile_clients(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_clients_client ON public.profile_clients(client_id);

-- 2. Migrer les donnees existantes de profiles.client_id vers la table de jonction
INSERT INTO public.profile_clients (profile_id, client_id)
SELECT id, client_id
FROM public.profiles
WHERE client_id IS NOT NULL
ON CONFLICT (profile_id, client_id) DO NOTHING;

-- 3. Activer RLS
ALTER TABLE public.profile_clients ENABLE ROW LEVEL SECURITY;

-- Admins peuvent tout faire sur profile_clients
CREATE POLICY "Admins can manage profile_clients"
    ON public.profile_clients FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Les clients peuvent voir leurs propres liaisons
CREATE POLICY "Clients can view their own profile_clients"
    ON public.profile_clients FOR SELECT
    USING (profile_id = auth.uid());

-- Formateurs peuvent voir les liaisons (pour gestion)
CREATE POLICY "Formateurs can view profile_clients"
    ON public.profile_clients FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'formateur'
        )
    );

-- 4. Mettre a jour la RLS policy des formations pour utiliser la table de jonction
DROP POLICY IF EXISTS "Clients can view their own formations" ON public.formations;

CREATE POLICY "Clients can view their own formations"
ON public.formations
FOR SELECT
USING (
    client_id IN (
        SELECT pc.client_id
        FROM public.profile_clients pc
        WHERE pc.profile_id = auth.uid()
    )
);

-- 5. Mettre a jour la RLS policy des documents de formation
DROP POLICY IF EXISTS "Clients can view documents of their formations" ON public.formation_documents;

CREATE POLICY "Clients can view documents of their formations"
ON public.formation_documents
FOR SELECT
USING (
    formation_id IN (
        SELECT f.id
        FROM public.formations f
        INNER JOIN public.profile_clients pc ON f.client_id = pc.client_id
        WHERE pc.profile_id = auth.uid()
    )
);

-- 6. Mettre a jour la RLS policy pour que les clients voient TOUTES leurs entreprises
DROP POLICY IF EXISTS "Clients can view their own client record" ON public.clients;

CREATE POLICY "Clients can view their own client record"
ON public.clients
FOR SELECT
USING (
    id IN (
        SELECT pc.client_id
        FROM public.profile_clients pc
        WHERE pc.profile_id = auth.uid()
    )
);

-- ================================================
-- NOTE: La colonne profiles.client_id est conservee
-- pour compatibilite. Elle peut etre supprimee
-- ulterieurement une fois la migration validee.
-- ================================================
