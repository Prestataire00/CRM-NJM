-- Ajout des colonnes de suivi du document préalable
ALTER TABLE formations ADD COLUMN IF NOT EXISTS prealable_recu BOOLEAN DEFAULT FALSE;
ALTER TABLE formations ADD COLUMN IF NOT EXISTS prealable_envoye_at TIMESTAMP WITH TIME ZONE;
