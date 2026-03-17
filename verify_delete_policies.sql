-- Vérifier et corriger les politiques de suppression pour formation_documents et conventions

-- ==================== FORMATION_DOCUMENTS ====================

-- Supprimer l'ancienne politique si elle existe
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.formation_documents;

-- Créer une nouvelle politique de suppression permissive
CREATE POLICY "Enable delete for authenticated users"
ON public.formation_documents
AS PERMISSIVE
FOR DELETE
TO authenticated
USING (true);

-- ==================== CONVENTIONS ====================

-- Supprimer l'ancienne politique si elle existe
DROP POLICY IF EXISTS "Enable delete for creators" ON public.conventions;

-- Créer une politique de suppression plus permissive (tous les utilisateurs authentifiés)
CREATE POLICY "Enable delete for authenticated users on conventions"
ON public.conventions
AS PERMISSIVE
FOR DELETE
TO authenticated
USING (true);

-- ==================== VÉRIFICATION ====================

-- Afficher toutes les politiques pour formation_documents
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'formation_documents';

-- Afficher toutes les politiques pour conventions
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'conventions';
