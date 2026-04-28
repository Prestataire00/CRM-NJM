-- Migration: passer number_of_days de INTEGER à NUMERIC(4,1)
-- Pour autoriser les demi-journées (ex: 2,5 jours)
-- Exécuter dans Supabase SQL Editor

ALTER TABLE public.formations
  ALTER COLUMN number_of_days TYPE NUMERIC(4,1)
  USING number_of_days::numeric;

COMMENT ON COLUMN public.formations.number_of_days IS 'Nombre de jours de formation (autorise les demi-journées, ex: 2.5)';
