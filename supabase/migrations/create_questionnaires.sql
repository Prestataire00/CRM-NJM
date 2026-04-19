-- ============================================================
-- Migration: Bibliothèque Questionnaires + Attribution formations
-- ============================================================

-- Table principale des questionnaires Google Forms
CREATE TABLE IF NOT EXISTS questionnaires (
    id BIGSERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('amont', 'satisfaction', 'evaluation_acquis', 'froid_dirigeant', 'froid_apprenant', 'autre')),
    formation_type TEXT,
    url TEXT NOT NULL,
    description TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table de liaison formation <-> questionnaires
CREATE TABLE IF NOT EXISTS formation_questionnaires (
    id BIGSERIAL PRIMARY KEY,
    formation_id BIGINT REFERENCES formations(id) ON DELETE CASCADE,
    questionnaire_id BIGINT REFERENCES questionnaires(id) ON DELETE CASCADE,
    sent_to_learners BOOLEAN DEFAULT FALSE,
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(formation_id, questionnaire_id)
);

-- Activer RLS
ALTER TABLE questionnaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE formation_questionnaires ENABLE ROW LEVEL SECURITY;

-- Policies questionnaires
CREATE POLICY "Admins manage questionnaires" ON questionnaires FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Formateurs read questionnaires" ON questionnaires FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('formateur', 'admin')));
CREATE POLICY "Clients read active questionnaires" ON questionnaires FOR SELECT
  USING (active = TRUE);

-- Policies formation_questionnaires
CREATE POLICY "Admins manage formation_questionnaires" ON formation_questionnaires FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'formateur')));
CREATE POLICY "Clients read own formation_questionnaires" ON formation_questionnaires FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM formations f
    JOIN profile_clients pc ON pc.client_id = f.client_id
    WHERE f.id = formation_id AND pc.profile_id = auth.uid()
  ));

-- Seed : les 6 questionnaires Google Forms existants
INSERT INTO questionnaires (title, category, formation_type, url) VALUES
('Techniques de vente 1', 'amont', 'techniques_vente', 'https://docs.google.com/forms/d/1U4DVl8HIrSE1KXBjOhr0sEIYl6gNLefz0HR4bJg871w'),
('Techniques de vente 2', 'amont', 'techniques_vente', 'https://docs.google.com/forms/d/10HEK5pAdmcvJVuaXoXQnIXXdgFvnISkScALcKYVes4A'),
('Techniques de vente 3', 'amont', 'techniques_vente', 'https://docs.google.com/forms/d/1o3kUgM3pGaPSEYSXlIvESUSLpMa5754VzB8yZ3SyqN8'),
('Techniques de vente 4', 'amont', 'techniques_vente', 'https://docs.google.com/forms/d/1_l3VjROXs1Bp_O6L4_mU_tZoYunqdlm_s_PMyXu0DBU'),
('Management 1', 'amont', 'management', 'https://docs.google.com/forms/d/1Xh4ry2rzIlkxIsmXNm9BJl6R08SO5hsJbpYsJHzxYQI'),
('Manager commercial', 'amont', 'manager_commercial', 'https://docs.google.com/forms/d/1hF8egxucpogO3V5mx5-LV-B2_jaeC0S_76WMJ9IGlyg')
ON CONFLICT DO NOTHING;
