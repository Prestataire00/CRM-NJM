-- ================================================
-- MIGRATION: Ajouter colonne initial_password
-- Permet à l'admin de voir le mot de passe initial
-- créé lors de la création d'un utilisateur
-- ================================================

-- Ajouter la colonne initial_password à profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS initial_password TEXT;

-- Commentaire explicatif
COMMENT ON COLUMN public.profiles.initial_password IS 'Mot de passe initial créé par l''admin. Effacé quand l''utilisateur change son mot de passe.';

-- ================================================
-- SÉCURITÉ: Cette colonne ne doit être visible
-- que par les admins (déjà géré par les policies RLS)
-- ================================================
