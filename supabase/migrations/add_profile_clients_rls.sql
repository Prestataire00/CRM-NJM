-- RLS sur profile_clients : permettre aux users de lire leurs propres liens
-- Indispensable pour que getFormationsByClient puisse résoudre les clients liés

ALTER TABLE profile_clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own links" ON profile_clients;
CREATE POLICY "Users can read own links" ON profile_clients
FOR SELECT USING (auth.uid() = profile_id);

-- Admin/trainers peuvent tout voir et modifier
DROP POLICY IF EXISTS "Admins can manage all links" ON profile_clients;
CREATE POLICY "Admins can manage all links" ON profile_clients
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
          AND profiles.role IN ('admin', 'formateur')
    )
);
