-- Signatures électroniques client et sous-traitant stockées en base64 (PNG data URL)
ALTER TABLE formations ADD COLUMN IF NOT EXISTS client_signature TEXT;
ALTER TABLE formations ADD COLUMN IF NOT EXISTS client_signed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE formations ADD COLUMN IF NOT EXISTS subcontractor_signature TEXT;
ALTER TABLE formations ADD COLUMN IF NOT EXISTS subcontractor_signed_at TIMESTAMP WITH TIME ZONE;
