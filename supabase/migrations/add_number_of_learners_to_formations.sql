-- Ajout de la colonne number_of_learners sur formations
-- (utilisée par le questionnaire préalable pour stocker le nombre d'apprenants saisis)
ALTER TABLE formations ADD COLUMN IF NOT EXISTS number_of_learners INTEGER DEFAULT 0;
