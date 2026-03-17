-- ================================================
-- MIGRATION: Création de la table convocation_logs
-- ================================================
-- Date: 19 janvier 2026
-- Description: Table pour enregistrer l'historique des envois de convocation

-- ================================================
-- 1. Créer la table convocation_logs
-- ================================================

CREATE TABLE IF NOT EXISTS public.convocation_logs (
    id BIGSERIAL PRIMARY KEY,
    formation_id BIGINT REFERENCES public.formations(id) ON DELETE CASCADE,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sent_to TEXT NOT NULL,
    subject TEXT,
    questionnaire_url TEXT,
    attachments JSONB DEFAULT '[]'::jsonb,
    gmail_message_id TEXT,
    sent_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================================
-- 2. Index pour les recherches rapides
-- ================================================
CREATE INDEX IF NOT EXISTS idx_convocation_logs_formation_id ON public.convocation_logs(formation_id);
CREATE INDEX IF NOT EXISTS idx_convocation_logs_sent_at ON public.convocation_logs(sent_at DESC);

-- ================================================
-- 3. Commentaires pour documentation
-- ================================================
COMMENT ON TABLE public.convocation_logs IS 'Historique des envois de convocation par formation';
COMMENT ON COLUMN public.convocation_logs.formation_id IS 'ID de la formation concernée';
COMMENT ON COLUMN public.convocation_logs.sent_at IS 'Date et heure de l''envoi';
COMMENT ON COLUMN public.convocation_logs.sent_to IS 'Adresse email du destinataire';
COMMENT ON COLUMN public.convocation_logs.subject IS 'Objet du mail envoyé';
COMMENT ON COLUMN public.convocation_logs.questionnaire_url IS 'URL du questionnaire inclus dans le mail';
COMMENT ON COLUMN public.convocation_logs.attachments IS 'Liste des pièces jointes (format JSON)';
COMMENT ON COLUMN public.convocation_logs.gmail_message_id IS 'ID du message Gmail retourné par l''API';
COMMENT ON COLUMN public.convocation_logs.sent_by IS 'Email de l''utilisateur qui a envoyé';

-- ================================================
-- 4. Activer RLS (Row Level Security)
-- ================================================
ALTER TABLE public.convocation_logs ENABLE ROW LEVEL SECURITY;

-- Politique pour permettre toutes les opérations aux utilisateurs authentifiés
CREATE POLICY "Allow all operations for authenticated users" ON public.convocation_logs
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Politique pour permettre la lecture anonyme (pour le CRM)
CREATE POLICY "Allow read for anon" ON public.convocation_logs
    FOR SELECT
    TO anon
    USING (true);

-- Politique pour permettre l'insertion anonyme (pour le CRM)
CREATE POLICY "Allow insert for anon" ON public.convocation_logs
    FOR INSERT
    TO anon
    WITH CHECK (true);

-- ================================================
-- INSTRUCTIONS:
-- 1. Exécutez ce script dans l'éditeur SQL de Supabase
-- 2. Allez sur: https://supabase.com/dashboard
-- 3. Sélectionnez votre projet
-- 4. Allez dans "SQL Editor"
-- 5. Collez ce script et cliquez sur "Run"
-- ================================================
