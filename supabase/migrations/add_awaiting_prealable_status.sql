-- Ajouter 'awaiting_prealable' à la contrainte CHECK sur formations.status
ALTER TABLE formations DROP CONSTRAINT IF EXISTS formations_status_check;
ALTER TABLE formations ADD CONSTRAINT formations_status_check
    CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled', 'awaiting_prealable'));
