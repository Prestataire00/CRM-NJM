-- =================================================================
-- SCRIPT DE RÉPARATION COMPLET (SCHEMA + RLS + PERMISSIONS)
-- =================================================================
-- Exécutez ce script entier dans Supabase > SQL Editor
-- Il corrige :
-- 1. Les colonnes manquantes dans la table formations
-- 2. Les problèmes de permissions (RLS) qui empêchent la suppression
-- 3. Le rôle administrateur de votre compte
-- =================================================================

-- 1. AJOUT DES COLONNES MANQUANTES (Si elles n'existent pas déjà)
ALTER TABLE public.formations ADD COLUMN IF NOT EXISTS formation_name TEXT;
ALTER TABLE public.formations ADD COLUMN IF NOT EXISTS formation_type TEXT;
ALTER TABLE public.formations ADD COLUMN IF NOT EXISTS collaboration_mode TEXT;
ALTER TABLE public.formations ADD COLUMN IF NOT EXISTS client_name TEXT;
ALTER TABLE public.formations ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE public.formations ADD COLUMN IF NOT EXISTS company_address TEXT;
ALTER TABLE public.formations ADD COLUMN IF NOT EXISTS company_postal_code TEXT;
ALTER TABLE public.formations ADD COLUMN IF NOT EXISTS company_director_name TEXT;
ALTER TABLE public.formations ADD COLUMN IF NOT EXISTS training_location TEXT;
ALTER TABLE public.formations ADD COLUMN IF NOT EXISTS number_of_days INTEGER;
ALTER TABLE public.formations ADD COLUMN IF NOT EXISTS hours_per_day DECIMAL(4,2);
ALTER TABLE public.formations ADD COLUMN IF NOT EXISTS hours_per_learner DECIMAL(4,2);
ALTER TABLE public.formations ADD COLUMN IF NOT EXISTS total_amount DECIMAL(10,2);
ALTER TABLE public.formations ADD COLUMN IF NOT EXISTS target_audience TEXT;
ALTER TABLE public.formations ADD COLUMN IF NOT EXISTS prerequisites TEXT;
ALTER TABLE public.formations ADD COLUMN IF NOT EXISTS objectives TEXT;
ALTER TABLE public.formations ADD COLUMN IF NOT EXISTS module_1 TEXT;
ALTER TABLE public.formations ADD COLUMN IF NOT EXISTS methods_tools TEXT;
ALTER TABLE public.formations ADD COLUMN IF NOT EXISTS access_delays TEXT;
ALTER TABLE public.formations ADD COLUMN IF NOT EXISTS attendance_sheets JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.formations ADD COLUMN IF NOT EXISTS learners_data JSONB DEFAULT '[]'::jsonb;

-- 2. CORRECTION DES POLICIES RLS (Permissions de sécurité)
-- D'abord, on nettoie les anciennes règles qui posent problème
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON profiles;

-- On recrée des règles propres et non-bloquantes
CREATE POLICY "Allow read access to all authenticated users"
    ON profiles FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow users to update own profile"
    ON profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Allow profile creation"
    ON profiles FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- 3. FORCER LE RÔLE ADMIN
-- S'assure que vous avez bien le droit de supprimer
UPDATE profiles
SET role = 'admin', active = true
WHERE email = 'isma.lepennec@gmail.com';

-- 4. VÉRIFICATION
SELECT email, role, active FROM profiles WHERE email = 'isma.lepennec@gmail.com';

-- 5. PERMETTRE LA SUPPRESSION (Admin + Formateur)
DROP POLICY IF EXISTS "Admins can delete formations" ON formations;
DROP POLICY IF EXISTS "Admins and trainers can delete formations" ON formations;

CREATE POLICY "Admins and trainers can delete formations"
    ON public.formations FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('admin', 'formateur')
        )
    );
