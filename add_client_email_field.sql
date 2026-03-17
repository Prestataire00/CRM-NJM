-- ================================================
-- MIGRATION: Ajout du champ client_email pour formations
-- ================================================
-- Date: 19 janvier 2026
-- Description: Ajoute le champ email du client pour les convocations

-- ================================================
-- 1. Ajouter le champ client_email à la table formations
-- ================================================

ALTER TABLE public.formations
ADD COLUMN IF NOT EXISTS client_email TEXT;

-- ================================================
-- 2. Commentaire pour documentation
-- ================================================
COMMENT ON COLUMN public.formations.client_email IS 'Adresse email du client/dirigeant pour l''envoi des convocations';

-- ================================================
-- INSTRUCTIONS:
-- 1. Exécutez ce script dans l'éditeur SQL de Supabase
-- 2. Allez sur: https://supabase.com/dashboard
-- 3. Sélectionnez votre projet
-- 4. Allez dans "SQL Editor"
-- 5. Collez ce script et cliquez sur "Run"
-- ================================================
