-- Table des templates d'emails éditables par l'admin
CREATE TABLE IF NOT EXISTS email_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    variables TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insertion des templates existants (contenu repris du code JS)
INSERT INTO email_templates (id, name, subject, body, variables) VALUES

('prealable_reminder',
 'Relance préalable',
 'Rappel — Merci de renseigner vos apprenants',
 E'Bonjour,\n\nNous vous rappelons qu''il est nécessaire de renseigner les apprenants participant à la formation "{{formation}}" avant son démarrage.\n\nVeuillez vous connecter à votre espace client pour compléter le questionnaire préalable.\n\nCordialement,\nNJM Conseil',
 '{{formation}}'),

('contrat_sous_traitance',
 'Contrat sous-traitance',
 'Contrat de sous-traitance — {{formation}} — {{client}}',
 E'Bonjour {{formateur}},\n\nVeuillez trouver ci-joint ou dans votre espace formateur le contrat de sous-traitance pour la formation "{{formation}}" (client : {{client}}).\n\nJe vous invite à vous connecter à votre espace formateur pour consulter l''ensemble des documents relatifs à cette mission.\n\nCordialement,\nNathalie JOULIE MORAND\nNJM Conseil',
 '{{formation}}, {{client}}, {{formateur}}'),

('acces_client',
 'Accès espace client',
 'Votre espace formation NJM Conseil — {{formation}}',
 E'Bonjour {{dirigeant}},\n\nJ''ai créé pour vous un espace confidentiel où vous retrouverez tous les documents relatifs à la formation.\n\nAccès : {{url}}\nIdentifiant : {{email}}\nMot de passe : {{password}}\n\nMerci de compléter le questionnaire préalable depuis l''onglet "Préalable" de votre espace.\n\nCordialement,\nNathalie Joulie-Morand',
 '{{formation}}, {{dirigeant}}, {{email}}, {{password}}, {{url}}'),

('relance_convention',
 'Relance convention',
 'Convention de formation - {{formation}} - {{client}}',
 E'Bonjour {{dirigeant}},\n\nVous allez bien ?\n\nJe me permets de revenir vers vous au sujet de la formation à venir.\nSauf erreur de ma part, je n''ai pas reçu la convention signée. Pouvez-vous me la transmettre au plus tôt ?\n\nDésolée pour ce côté administratif mais la démarche qualité Qualiopi exige ce document signé des deux parties.\n\nEn vous remerciant par avance.\n\nNathalie Joulie-Morand',
 '{{formation}}, {{client}}, {{dirigeant}}'),

('fin_formation',
 'Mail fin de formation',
 'Suite formation "{{formation}}" - Documents et questionnaires',
 E'Bonjour,\n\nTout va bien pour vous? J''espère que l''équipe est satisfaite de la formation.\n\nJe transmets ici plusieurs éléments relatifs à la démarche qualité de la formation.\nC''est important que ce soit complété par chaque personne qui a suivi la formation :\n-un questionnaire de satisfaction :\n\n-un questionnaire d''évaluation des acquis :\n\nPar ailleurs, je vous transmets à nouveau le lien et le mot de passe de votre espace confidentiel NJM Conseil.\nLien : {{url}}\nMot de passe : {{password}}\nVous y trouverez tous les documents pour l''OPCO : feuilles de présence, certificats de fin de formation.\nVous pourrez aussi y récupérer :\n-pour vous : le bilan de la formation\n-pour les apprenants : le support pédagogique, les grilles d''évaluation\n\nAutre chose, ce serait sympa de prendre 1 minute pour déposer un avis sincère sur Google. Cela me donnera plus de visibilité sur le net. Merci d''aller sur:\nhttps://g.page/r/CTDsPUbHjCnREB0/review\n\nDésolée, cela fait de la paperasse mais c''est indispensable par rapport à la prise en charge de la formation.\n\nMerci encore à vous et à toute l''équipe pour la gentillesse de votre accueil.\n\nCordialement\n\nNathalie JOULIÉ MORAND',
 '{{formation}}, {{url}}, {{password}}')

ON CONFLICT (id) DO NOTHING;
