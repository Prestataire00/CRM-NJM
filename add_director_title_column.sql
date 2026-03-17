-- Ajouter la colonne company_director_title a la table formations
-- Valeurs: 'dirigeant' ou 'dirigeante'
ALTER TABLE public.formations
ADD COLUMN IF NOT EXISTS company_director_title TEXT DEFAULT 'dirigeant';
