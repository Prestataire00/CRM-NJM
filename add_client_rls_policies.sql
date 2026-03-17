-- ================================================
-- MIGRATION: Ajouter les policies RLS pour les clients
-- Permet aux utilisateurs avec le rôle "client" de
-- voir leurs formations liées via client_id
-- ================================================

-- ================================================
-- POLICY: Permettre aux clients de lire leurs formations
-- ================================================

-- Supprimer la policy si elle existe déjà
DROP POLICY IF EXISTS "Clients can view their own formations" ON public.formations;

-- Créer la policy pour les clients
CREATE POLICY "Clients can view their own formations"
ON public.formations
FOR SELECT
USING (
    -- L'utilisateur peut voir la formation si:
    -- 1. Le client_id de la formation correspond au client_id de son profil
    client_id IN (
        SELECT p.client_id
        FROM public.profiles p
        WHERE p.id = auth.uid()
        AND p.client_id IS NOT NULL
    )
);

-- ================================================
-- POLICY: Permettre aux clients de lire les documents de leurs formations
-- ================================================

DROP POLICY IF EXISTS "Clients can view documents of their formations" ON public.formation_documents;

CREATE POLICY "Clients can view documents of their formations"
ON public.formation_documents
FOR SELECT
USING (
    formation_id IN (
        SELECT f.id
        FROM public.formations f
        INNER JOIN public.profiles p ON f.client_id = p.client_id
        WHERE p.id = auth.uid()
    )
);

-- ================================================
-- POLICY: Permettre aux clients de lire les infos de leur entreprise
-- ================================================

DROP POLICY IF EXISTS "Clients can view their own client record" ON public.clients;

CREATE POLICY "Clients can view their own client record"
ON public.clients
FOR SELECT
USING (
    id IN (
        SELECT p.client_id
        FROM public.profiles p
        WHERE p.id = auth.uid()
        AND p.client_id IS NOT NULL
    )
);

-- ================================================
-- Vérification: S'assurer que RLS est activé sur les tables
-- ================================================
ALTER TABLE public.formations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.formation_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- ================================================
-- IMPORTANT: Cette migration doit être exécutée dans
-- le SQL Editor de Supabase Dashboard
-- ================================================
