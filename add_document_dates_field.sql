-- ================================================
-- AJOUT : colonne document_dates sur formations
-- ================================================
-- Stocke la date de création (figée) de chaque document généré
-- pour la formation, sous forme {docType: 'YYYY-MM-DDTHH:MM:SS.sssZ'}.
-- Permet d'éviter que la date affichée dans les conventions /
-- contrats / certificats ne se mette à jour à chaque réouverture.

ALTER TABLE public.formations
ADD COLUMN IF NOT EXISTS document_dates JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.formations.document_dates IS
'Date de création figée par type de document généré (convention, contrat_sous_traitance, certificate, ...). Format: { "convention": "ISO date", ... }';
