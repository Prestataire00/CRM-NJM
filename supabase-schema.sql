-- ================================================
-- SCHEMA SQL POUR SUPABASE - CRM NJM CONSEIL
-- ================================================
-- Exécutez ce script dans l'éditeur SQL de Supabase
-- Dashboard > SQL Editor > New Query

-- ================================================
-- 1. TABLE: profiles (étend auth.users de Supabase)
-- ================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'formateur', 'client')),
    active BOOLEAN DEFAULT true,
    must_change_password BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_login TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- 2. TABLE: learners (apprenants)
-- ================================================
CREATE TABLE IF NOT EXISTS public.learners (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    company TEXT,
    status TEXT,
    enrollment_date TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- 3. TABLE: formations
-- ================================================
CREATE TABLE IF NOT EXISTS public.formations (
    id BIGSERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    start_date DATE,
    end_date DATE,
    status TEXT CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled')),
    trainer TEXT,
    location TEXT,
    max_participants INTEGER,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- 4. TABLE: formation_documents
-- ================================================
CREATE TABLE IF NOT EXISTS public.formation_documents (
    id BIGSERIAL PRIMARY KEY,
    formation_id BIGINT REFERENCES public.formations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT,
    file_url TEXT,
    file_size INTEGER,
    uploaded_by UUID REFERENCES public.profiles(id),
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- 5. TABLE: veille (types: formation, metier, legal)
-- ================================================
CREATE TABLE IF NOT EXISTS public.veille (
    id BIGSERIAL PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('formation', 'metier', 'legal')),
    title TEXT NOT NULL,
    content TEXT,
    source TEXT,
    url TEXT,
    read BOOLEAN DEFAULT false,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- 6. TABLE: bpf (Bilans pédagogiques et financiers)
-- ================================================
CREATE TABLE IF NOT EXISTS public.bpf (
    id BIGSERIAL PRIMARY KEY,
    year INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    file_url TEXT,
    status TEXT,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- 7. TABLE: pedagogical_library (vente, marketing, reseaux_sociaux)
-- ================================================
CREATE TABLE IF NOT EXISTS public.pedagogical_library (
    id BIGSERIAL PRIMARY KEY,
    category TEXT NOT NULL CHECK (category IN ('vente', 'marketing', 'reseaux_sociaux')),
    title TEXT NOT NULL,
    description TEXT,
    file_url TEXT,
    file_type TEXT,
    file_size INTEGER,
    tags TEXT[],
    uploaded_by UUID REFERENCES public.profiles(id),
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- 8. TABLE: templates_library (pedagogiques, competences, formateurs)
-- ================================================
CREATE TABLE IF NOT EXISTS public.templates_library (
    id BIGSERIAL PRIMARY KEY,
    category TEXT NOT NULL CHECK (category IN ('pedagogiques', 'competences', 'formateurs')),
    title TEXT NOT NULL,
    description TEXT,
    file_url TEXT,
    file_type TEXT,
    expiry_date DATE,
    reminder_set BOOLEAN DEFAULT false,
    uploaded_by UUID REFERENCES public.profiles(id),
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- 9. TABLE: settings
-- ================================================
CREATE TABLE IF NOT EXISTS public.settings (
    id SERIAL PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    value JSONB,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- INDEXES pour améliorer les performances
-- ================================================
CREATE INDEX IF NOT EXISTS idx_learners_enrollment_date ON public.learners(enrollment_date);
CREATE INDEX IF NOT EXISTS idx_formations_status ON public.formations(status);
CREATE INDEX IF NOT EXISTS idx_formations_dates ON public.formations(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_veille_type ON public.veille(type);
CREATE INDEX IF NOT EXISTS idx_veille_read ON public.veille(read);
CREATE INDEX IF NOT EXISTS idx_pedagogical_library_category ON public.pedagogical_library(category);
CREATE INDEX IF NOT EXISTS idx_templates_library_category ON public.templates_library(category);
CREATE INDEX IF NOT EXISTS idx_templates_library_expiry ON public.templates_library(expiry_date);

-- ================================================
-- ROW LEVEL SECURITY (RLS)
-- ================================================

-- Activer RLS sur toutes les tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.formations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.formation_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.veille ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bpf ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedagogical_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- ================================================
-- POLICIES - Profiles
-- ================================================
-- Les utilisateurs peuvent voir leur propre profil
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

-- Les admins peuvent tout voir
CREATE POLICY "Admins can view all profiles"
    ON public.profiles FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Les admins peuvent modifier les profils
CREATE POLICY "Admins can update profiles"
    ON public.profiles FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Les admins peuvent insérer des profils
CREATE POLICY "Admins can insert profiles"
    ON public.profiles FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- ================================================
-- POLICIES - Learners
-- ================================================
-- Admins et formateurs peuvent tout voir
CREATE POLICY "Admins and trainers can view learners"
    ON public.learners FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('admin', 'formateur')
        )
    );

-- Admins et formateurs peuvent insérer
CREATE POLICY "Admins and trainers can insert learners"
    ON public.learners FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('admin', 'formateur')
        )
    );

-- Admins et formateurs peuvent modifier
CREATE POLICY "Admins and trainers can update learners"
    ON public.learners FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('admin', 'formateur')
        )
    );

-- Admins peuvent supprimer
CREATE POLICY "Admins can delete learners"
    ON public.learners FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- ================================================
-- POLICIES - Formations (similaire à learners)
-- ================================================
CREATE POLICY "Admins and trainers can view formations"
    ON public.formations FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('admin', 'formateur')
        )
    );

CREATE POLICY "Admins and trainers can insert formations"
    ON public.formations FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('admin', 'formateur')
        )
    );

CREATE POLICY "Admins and trainers can update formations"
    ON public.formations FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('admin', 'formateur')
        )
    );

CREATE POLICY "Admins can delete formations"
    ON public.formations FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- ================================================
-- POLICIES - Formation Documents
-- ================================================
CREATE POLICY "Admins and trainers can manage formation documents"
    ON public.formation_documents FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('admin', 'formateur')
        )
    );

-- ================================================
-- POLICIES - Veille
-- ================================================
CREATE POLICY "Authenticated users can view veille"
    ON public.veille FOR SELECT
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and trainers can manage veille"
    ON public.veille FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('admin', 'formateur')
        )
    );

-- ================================================
-- POLICIES - BPF
-- ================================================
CREATE POLICY "Admins can manage bpf"
    ON public.bpf FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- ================================================
-- POLICIES - Pedagogical Library
-- ================================================
CREATE POLICY "Authenticated users can view pedagogical library"
    ON public.pedagogical_library FOR SELECT
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and trainers can manage pedagogical library"
    ON public.pedagogical_library FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('admin', 'formateur')
        )
    );

-- ================================================
-- POLICIES - Templates Library
-- ================================================
CREATE POLICY "Authenticated users can view templates"
    ON public.templates_library FOR SELECT
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and trainers can manage templates"
    ON public.templates_library FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('admin', 'formateur')
        )
    );

-- ================================================
-- POLICIES - Settings
-- ================================================
CREATE POLICY "Authenticated users can view settings"
    ON public.settings FOR SELECT
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage settings"
    ON public.settings FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- ================================================
-- FUNCTIONS - Trigger pour updated_at
-- ================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Appliquer le trigger à toutes les tables avec updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_learners_updated_at BEFORE UPDATE ON public.learners
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_formations_updated_at BEFORE UPDATE ON public.formations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_veille_updated_at BEFORE UPDATE ON public.veille
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bpf_updated_at BEFORE UPDATE ON public.bpf
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON public.settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================================
-- FUNCTION - Créer un profil automatiquement lors de l'inscription
-- ================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, name, email, role, active)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'name', 'New User'),
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'role', 'client'),
        true
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger pour créer automatiquement un profil
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ================================================
-- DONNÉES INITIALES - Settings par défaut
-- ================================================
INSERT INTO public.settings (key, value) VALUES
    ('company', '{"name": "NJM Conseil", "siret": "", "nda": "", "address": "", "contact": ""}'::jsonb),
    ('theme', '"default"'::jsonb),
    ('logo', '"logo-njm.png"'::jsonb),
    ('cgv', '""'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ================================================
-- TERMINÉ!
-- ================================================
-- Le schéma de base de données est maintenant prêt.
-- Prochaines étapes:
-- 1. Créer un utilisateur admin via Supabase Auth
-- 2. Migrer les données existantes du localStorage
-- 3. Tester les connexions et permissions
