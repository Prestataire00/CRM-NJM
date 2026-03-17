-- 🔧 Script de correction des RLS Policies
-- Ce script corrige le problème de récursion infinie dans les policies

-- ========================================
-- 1. SUPPRIMER LES ANCIENNES POLICIES
-- ========================================

-- Suppression des policies récursives sur profiles
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON profiles;

-- ========================================
-- 2. CRÉER DE NOUVELLES POLICIES SIMPLES
-- ========================================

-- Policy 1 : Lecture - Tous les utilisateurs authentifiés peuvent lire tous les profils
CREATE POLICY "Allow read access to all authenticated users"
    ON profiles FOR SELECT
    TO authenticated
    USING (true);

-- Policy 2 : Modification - Chaque utilisateur peut modifier son propre profil
CREATE POLICY "Allow users to update own profile"
    ON profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Policy 3 : Insertion - Permettre l'auto-création de profil
CREATE POLICY "Allow profile creation"
    ON profiles FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- ========================================
-- 3. VÉRIFIER QUE LE PROFIL EXISTE
-- ========================================

-- Vérifier si un profil existe pour votre email
SELECT id, name, email, role, active
FROM profiles
WHERE email = 'isma.lepennec@gmail.com';

-- Si rien n'est retourné ci-dessus, créer le profil manuellement :
-- (Décommentez et exécutez seulement si la requête ci-dessus retourne 0 lignes)

/*
INSERT INTO profiles (id, name, email, role, active, must_change_password)
SELECT
    id,
    'Admin',
    email,
    'admin',
    true,
    false
FROM auth.users
WHERE email = 'isma.lepennec@gmail.com'
ON CONFLICT (id) DO NOTHING;
*/

-- ========================================
-- 4. VÉRIFICATION FINALE
-- ========================================

-- Cette requête doit maintenant fonctionner sans erreur de récursion
SELECT * FROM profiles WHERE email = 'isma.lepennec@gmail.com';
