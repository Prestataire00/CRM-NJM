/**
 * generate-contrat-sous-traitance-template.js
 *
 * Genere un contrat_sous_traitance_template.docx propre avec variables {{...}}
 * compatible docxtemplater. Fidele au modele jsPDF generateContratSousTraitance().
 *
 * Usage : node generate-contrat-sous-traitance-template.js
 */

const {
    Document, Packer, Paragraph, TextRun, AlignmentType,
    TabStopType, SectionType, convertMillimetersToTwip
} = require('docx');
const fs = require('fs');

// Couleurs
const ORANGE = 'E36A3A';
const DARK_GRAY = '333333';

// Helpers
function bold(text, options = {}) {
    return new TextRun({ text, bold: true, size: options.size || 18, font: 'Helvetica', color: options.color || DARK_GRAY, ...options });
}

function normal(text, options = {}) {
    return new TextRun({ text, size: options.size || 18, font: 'Helvetica', color: options.color || DARK_GRAY, ...options });
}

function emptyLine() {
    return new Paragraph({ spacing: { after: 100 } });
}

// Tiret pour les obligations
function dashItem(text) {
    return new Paragraph({
        spacing: { after: 20 },
        indent: { left: convertMillimetersToTwip(3) },
        children: [normal('- ' + text)],
    });
}

// Article title (bold, no underline — matches jsPDF layout)
function articleTitle(text) {
    return new Paragraph({
        spacing: { before: 160, after: 80 },
        children: [bold(text)],
    });
}

async function generate() {
    const doc = new Document({
        styles: {
            default: {
                document: {
                    run: { size: 18, font: 'Helvetica', color: DARK_GRAY },
                },
            },
        },
        sections: [
            // ==================== PAGE 1 ====================
            {
                properties: {
                    page: {
                        margin: {
                            top: convertMillimetersToTwip(15),
                            bottom: convertMillimetersToTwip(20),
                            left: convertMillimetersToTwip(20),
                            right: convertMillimetersToTwip(20),
                        },
                    },
                },
                children: [
                    // Titre
                    new Paragraph({
                        spacing: { before: 400, after: 300 },
                        alignment: AlignmentType.CENTER,
                        children: [bold('CONTRAT DE SOUS-TRAITANCE FORMATION', { size: 28 })],
                    }),

                    // Entre les soussignes
                    new Paragraph({
                        spacing: { after: 100 },
                        children: [bold('Entre les soussignes :')],
                    }),

                    // 1 - NJM Conseil
                    new Paragraph({
                        spacing: { after: 40 },
                        children: [normal('1 \u2013 NJM Conseil,  1 Le Cassan 12330 Clairvaux d\'Aveyron, 534 935 473 000 15, organisme de formation enregistre sous le numero 73 12 00 635 12 aupres du Prefet de la region Occitanie,')],
                    }),
                    new Paragraph({
                        spacing: { after: 120 },
                        children: [normal('ci-apres \u00AB le donneur d\'ordre \u00BB')],
                    }),

                    // Et
                    new Paragraph({
                        spacing: { after: 100 },
                        children: [bold('Et')],
                    }),

                    // 2 - Sous-traitant
                    new Paragraph({
                        spacing: { after: 40 },
                        children: [normal('2 \u2013 {{subcontractor_name}}, {{subcontractor_address}}, organisme de formation enregistre sous le numero {{subcontractor_formation_number}} aupres du Prefet de la region Occitanie,')],
                    }),
                    new Paragraph({
                        spacing: { after: 120 },
                        children: [normal('ci-apres \u00AB le sous-traitant \u00BB')],
                    }),

                    // Il a ete convenu
                    new Paragraph({
                        spacing: { after: 100 },
                        children: [normal('Il a ete convenu ce qui suit :')],
                    }),

                    // Article premier
                    articleTitle('Article premier : Nature du contrat'),
                    new Paragraph({
                        spacing: { after: 80 },
                        children: [normal('Le present contrat est conclu dans le cadre d\'une prestation de formation ponctuelle realisee par le sous-traitant au benefice du donneur d\'ordre.')],
                    }),

                    // Article 2
                    articleTitle('Article 2 : Objet du contrat'),
                    new Paragraph({
                        spacing: { after: 40 },
                        children: [normal('La formation, objet du contrat, est la suivante : \u00AB {{formation_name}} \u00BB, pour {{company_name}}')],
                    }),
                    new Paragraph({
                        spacing: { after: 40 },
                        children: [normal('Date(s) : {{dates}}', { color: ORANGE })],
                    }),
                    new Paragraph({
                        spacing: { after: 100 },
                        children: [normal('Heures : {{duration}}h')],
                    }),

                    // Article 3
                    articleTitle('Article 3 : Duree du contrat'),
                    new Paragraph({
                        spacing: { after: 80 },
                        children: [normal('Le present contrat est strictement limite a la prestation de formation visee a l\'article 2. Il cesse de plein droit a son terme.')],
                    }),

                    // Article 4
                    articleTitle('Article 4 : Obligations du sous-traitant'),
                    new Paragraph({
                        spacing: { after: 60 },
                        children: [normal('Le sous-traitant s\'engage a :')],
                    }),

                    dashItem('Communiquer au donneur d\'ordre une copie de son extrait K-bis / de son immatriculation avant le debut de la formation ;'),
                    dashItem('Animer la formation dans le respect des objectifs fixes par le donneur d\'ordre ;'),
                    dashItem('Animer personnellement la formation, sauf en cas de situation exceptionnelle, et uniquement apres accord du donneur d\'ordre ;'),
                    dashItem('Communiquer au donneur d\'ordre ses besoins en materiel (projecteur, tableau, photocopies de supports...) au moins 10 jours avant le debut de la formation ;'),
                    dashItem('Assurer l\'evaluation des stagiaires a l\'issue de l\'action de formation, afin de permettre au donneur d\'ordre d\'etablir les attestations de fin de formation prevues a l\'article L.6353-1 du Code du travail ;'),
                    dashItem('Participer, en tant que de besoin, aux reunions de preparation'),
                    dashItem('Rediger et diffuser les documents Qualiopi aupres du client et les transmettre au donneur d\'ordre.'),
                    dashItem('Respecter la confidentialite et l\'ethique liee a la formation'),
                    dashItem('Respecter la charte de sous traitance signee avec NJM Conseil'),
                    dashItem('Agir avec loyaute vis-a-vis de NJM Conseil'),
                ],
            },

            // ==================== PAGE 2 ====================
            {
                properties: {
                    type: SectionType.NEXT_PAGE,
                    page: {
                        margin: {
                            top: convertMillimetersToTwip(15),
                            bottom: convertMillimetersToTwip(20),
                            left: convertMillimetersToTwip(20),
                            right: convertMillimetersToTwip(20),
                        },
                    },
                },
                children: [
                    // Article 5
                    articleTitle('Article 5 : Obligations du donneur d\'ordre'),
                    new Paragraph({
                        spacing: { after: 60 },
                        children: [normal('Le donneur d\'ordre s\'engage a :')],
                    }),

                    dashItem('Confier au sous-traitant la formation prevue a l\'article 2 ;'),
                    dashItem('Prendre en charge la gestion administrative et logistique de la formation ;'),
                    dashItem('Transmettre au sous-traitant une copie des feuilles de presence a faire signer par les stagiaires ;'),
                    dashItem('Transmettre au sous-traitant une copie des questionnaires de satisfaction a faire remplir par les stagiaires a l\'issue de la formation'),
                    dashItem('Prevenir le sous-traitant au moins 3 jours a l\'avance en cas d\'annulation ou de report de la formation'),
                    emptyLine(),

                    // Article 6
                    articleTitle('Article 6 : Modalites financieres'),
                    new Paragraph({
                        spacing: { after: 40 },
                        children: [normal('Le sous-traitant percevra une remuneration de 600 euros nets par journee de formation (7 heures) et remboursement des frais d\'hebergement, de restauration et de deplacement.')],
                    }),
                    new Paragraph({
                        spacing: { after: 100 },
                        children: [normal('Le paiement sera effectue a reception de la facture.')],
                    }),

                    // Article 7
                    articleTitle('Article 7 : Dispositions diverses'),
                    dashItem('Le present contrat ne cree entre les parties aucun lien de subordination, le sous-traitant demeurant libre et responsable du contenu de la formation ;'),
                    dashItem('Le sous-traitant declare avoir souscrit une police d\'assurance responsabilite civile professionnelle (RCP) ALLIANZ ASSURANCES'),
                    dashItem('Le sous-traitant dispose d\'une propriete intellectuelle et/ou artistique sur le contenu de sa formation. Le donneur d\'ordre s\'engage a ne pas reproduire ni diffuser ce contenu sans l\'accord du sous-traitant.'),
                    dashItem('Le donneur d\'ordre cree et facture les profils Arc En Ciel DISC. Le sous-traitant debriefe les profils Arc En Ciel DISC.'),
                    emptyLine(),

                    // Fait a Cassan, le
                    new Paragraph({
                        spacing: { before: 200, after: 200 },
                        children: [normal('Fait a Cassan, le')],
                    }),

                    // Signatures sur deux colonnes via tabulations
                    new Paragraph({
                        spacing: { after: 60 },
                        tabStops: [{ type: TabStopType.LEFT, position: convertMillimetersToTwip(100) }],
                        children: [
                            normal('Le donneur d\'ordre,'),
                            new TextRun({ text: '\t', size: 18, font: 'Helvetica' }),
                            normal('Le sous-traitant,'),
                        ],
                    }),
                    new Paragraph({
                        spacing: { after: 40 },
                        tabStops: [{ type: TabStopType.LEFT, position: convertMillimetersToTwip(100) }],
                        children: [
                            bold('Nathalie JOULIE MORAND'),
                            new TextRun({ text: '\t', size: 18, font: 'Helvetica' }),
                            bold('{{subcontractor_name}}'),
                        ],
                    }),
                    new Paragraph({
                        spacing: { after: 200 },
                        children: [normal('NJM Conseil')],
                    }),
                ],
            },
        ],
    });

    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync('contrat_sous_traitance_template.docx', buffer);
    console.log('contrat_sous_traitance_template.docx genere avec succes !');
    console.log('Variables disponibles :');
    console.log('  {{subcontractor_name}}, {{subcontractor_address}}, {{subcontractor_formation_number}}');
    console.log('  {{formation_name}}, {{company_name}}, {{dates}}, {{duration}}');
}

generate().catch(err => {
    console.error('Erreur:', err);
    process.exit(1);
});
