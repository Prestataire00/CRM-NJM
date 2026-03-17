-- 🔧 Script de correction du profil utilisateur
-- Ce script met à jour le rôle en "admin" et vérifie l'utilisateur

-- ========================================
-- 1. METTRE À JOUR LE RÔLE EN ADMIN
-- ========================================

UPDATE profiles
SET
    role = 'admin',
    name = 'Administrateur'
WHERE email = 'isma.lepennec@gmail.com';

-- ========================================
-- 2. VÉRIFIER L'UTILISATEUR DANS AUTH.USERS
-- ========================================

-- Cette requête montre l'état de l'utilisateur dans auth.users
SELECT
    id,
    email,
    email_confirmed_at,
    created_at,
    last_sign_in_at
FROM auth.users
WHERE email = 'isma.lepennec@gmail.com';

-- ========================================
-- 3. VÉRIFIER QUE LE PROFIL EST BIEN À JOUR
-- ========================================

SELECT id, name, email, role, active
FROM profiles
WHERE email = 'isma.lepennec@gmail.com';
