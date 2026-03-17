-- ================================================
-- MIGRATION: Table de journalisation des actions admin
-- Enregistre toutes les actions effectuées par les administrateurs
-- ================================================

-- Créer la table admin_logs
CREATE TABLE IF NOT EXISTS public.admin_logs (
    id BIGSERIAL PRIMARY KEY,
    admin_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    admin_name TEXT,
    admin_email TEXT,
    action_type TEXT NOT NULL,
    action_description TEXT NOT NULL,
    target_type TEXT, -- 'user', 'formation', 'bpf', etc.
    target_id TEXT, -- ID de l'élément concerné
    target_name TEXT, -- Nom/email de l'élément concerné
    old_values JSONB, -- Valeurs avant modification
    new_values JSONB, -- Valeurs après modification
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_admin_logs_admin_id ON public.admin_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_action_type ON public.admin_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON public.admin_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_logs_target_type ON public.admin_logs(target_type);

-- Activer RLS
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;

-- Politique: Seuls les admins peuvent voir les logs
CREATE POLICY "Admins can view admin logs"
    ON public.admin_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Politique: Seuls les admins peuvent insérer des logs
CREATE POLICY "Admins can insert admin logs"
    ON public.admin_logs FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('admin', 'formateur')
        )
    );

-- ================================================
-- Types d'actions à enregistrer:
-- ================================================
-- user_created      : Création d'un utilisateur
-- user_updated      : Modification d'un utilisateur
-- user_deleted      : Suppression/désactivation d'un utilisateur
-- user_password_reset : Réinitialisation de mot de passe
-- user_activated    : Activation d'un compte
-- user_deactivated  : Désactivation d'un compte
-- role_changed      : Changement de rôle
-- formation_created : Création d'une formation
-- formation_updated : Modification d'une formation
-- formation_deleted : Suppression d'une formation
-- bpf_updated       : Modification d'un BPF
-- bpf_deleted       : Suppression d'un BPF
-- login_success     : Connexion réussie
-- login_failed      : Tentative de connexion échouée
-- ================================================

COMMENT ON TABLE public.admin_logs IS 'Journalisation de toutes les actions administratives';
COMMENT ON COLUMN public.admin_logs.action_type IS 'Type d''action: user_created, user_updated, user_deleted, etc.';
COMMENT ON COLUMN public.admin_logs.target_type IS 'Type d''élément concerné: user, formation, bpf, etc.';
