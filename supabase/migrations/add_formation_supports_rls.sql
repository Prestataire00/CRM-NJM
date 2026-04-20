-- ============================================================
-- Migration: RLS formateur sur formation_supports
-- Permet au formateur de lire les supports des formations où il est staffé
-- ============================================================

-- S'assurer que RLS est activé
ALTER TABLE formation_supports ENABLE ROW LEVEL SECURITY;

-- Policy : les formateurs peuvent lire les supports de leurs formations
CREATE POLICY "Formateurs read own formation_supports" ON formation_supports FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM formations f
        JOIN profiles p ON p.subcontractor_id = f.subcontractor_id
        WHERE f.id = formation_id AND p.id = auth.uid()
    )
    OR EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
);
