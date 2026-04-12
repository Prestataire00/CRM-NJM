-- Mise à jour du template de relance préalable avec la variable {{dirigeant}}
INSERT INTO email_templates (id, name, subject, body, variables) VALUES
('prealable_reminder',
 'Relance préalable',
 'Rappel — Merci de renseigner vos apprenants pour la formation {{formation}}',
 E'Bonjour {{dirigeant}},\n\nNous vous rappelons que nous attendons les informations sur vos apprenants pour la formation "{{formation}}".\n\nMerci de vous connecter à votre espace client pour remplir le questionnaire préalable.\n\nCordialement,\nNathalie JOULIE-MORAND\nNJM Conseil',
 '{{formation}}, {{dirigeant}}')
ON CONFLICT (id) DO UPDATE SET
    subject = EXCLUDED.subject,
    body = EXCLUDED.body,
    variables = EXCLUDED.variables,
    updated_at = NOW();
