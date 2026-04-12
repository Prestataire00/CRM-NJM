/**
 * generate-certificat-template.js
 *
 * Genere un certificat_template.docx propre avec variables {{...}}
 * compatible docxtemplater. Template pour UN apprenant (2 pages) :
 *   - Page 1 : Certificat de realisation
 *   - Page 2 : Attestation de fin de formation
 *
 * Le CRM gere la boucle sur les apprenants.
 *
 * Usage : node generate-certificat-template.js
 */

const {
    Document, Packer, Paragraph, TextRun, AlignmentType,
    BorderStyle, SectionType, convertMillimetersToTwip
} = require('docx');
const fs = require('fs');

// Couleurs
const ORANGE = 'E36A3A';
const DARK_GRAY = '333333';
const GRAY = '6B7280';

// Helpers
function bold(text, options = {}) {
    return new TextRun({ text, bold: true, size: options.size || 18, font: 'Helvetica', color: options.color || DARK_GRAY, ...options });
}

function normal(text, options = {}) {
    return new TextRun({ text, size: options.size || 18, font: 'Helvetica', color: options.color || DARK_GRAY, ...options });
}

function orangeBold(text, options = {}) {
    return new TextRun({ text, bold: true, size: options.size || 18, font: 'Helvetica', color: ORANGE, ...options });
}

function emptyLine(after = 100) {
    return new Paragraph({ spacing: { after } });
}

// Page margins common to both pages
const PAGE_MARGINS = {
    top: convertMillimetersToTwip(15),
    bottom: convertMillimetersToTwip(20),
    left: convertMillimetersToTwip(20),
    right: convertMillimetersToTwip(20),
};

// =========================================================================
// PAGE 1 — CERTIFICAT DE REALISATION
// =========================================================================
function buildPage1() {
    return {
        properties: {
            page: { margin: PAGE_MARGINS },
        },
        children: [
            // Titre
            new Paragraph({
                spacing: { before: 400, after: 300 },
                alignment: AlignmentType.CENTER,
                children: [bold('CERTIFICAT DE REALISATION', { size: 26, color: DARK_GRAY })],
            }),

            // Intro soussignee
            new Paragraph({
                spacing: { after: 120 },
                children: [
                    normal('Je soussignee, '),
                    bold('Mme Nathalie JOULIE-MORAND'),
                    normal(', agissant en qualite de directrice de '),
                    bold('NJM Conseil'),
                    normal(', formatrice independante sous le numero SIRET '),
                    bold('534 935 473 000 15'),
                    normal(' et sous le numero de formateur '),
                    bold('73 12 00 635 12'),
                    normal(' atteste que :'),
                ],
            }),

            // Suivi de la formation
            new Paragraph({
                spacing: { after: 200 },
                children: [
                    bold('{{learner_name}}'),
                    normal(', salarie(e) de l\'entreprise '),
                    bold('{{company_name}}'),
                    normal(' a suivi la formation '),
                    bold('{{formation_name}}'),
                    normal(', qui s\'est deroulee {{dates_prefix}} '),
                    bold('{{dates}}'),
                    normal(', pour une duree de '),
                    bold('{{duration}}h'),
                    normal('.'),
                ],
            }),

            // Assiduite
            new Paragraph({
                spacing: { after: 60 },
                children: [bold('Assiduite du stagiaire :')],
            }),

            new Paragraph({
                spacing: { after: 200 },
                children: [
                    normal('Duree effectivement suivie par le/la stagiaire : '),
                    bold('{{duration}}h'),
                    normal(', soit un taux de realisation de '),
                    bold('100%'),
                    normal('.'),
                ],
            }),

            // Nature de l'action
            new Paragraph({
                spacing: { after: 100 },
                children: [bold('Nature de l\'action concourant au developpement des competences :')],
            }),

            // Checkbox cochee — Action de formation
            new Paragraph({
                spacing: { after: 40 },
                indent: { left: convertMillimetersToTwip(5) },
                children: [
                    normal('[X] ', { bold: true }),
                    normal('Action de formation'),
                ],
            }),

            // Checkbox non cochee — Bilan de competences
            new Paragraph({
                spacing: { after: 200 },
                indent: { left: convertMillimetersToTwip(5) },
                children: [
                    normal('[  ] ', { bold: true }),
                    normal('Bilan de competences'),
                ],
            }),

            // Paragraphe conservation
            new Paragraph({
                spacing: { after: 200 },
                children: [
                    normal('Ce document doit etre conserve par l\'employeur et le salarie pendant une duree de 3 ans a compter de la fin de la formation. Il est susceptible d\'etre demande en cas de controle par les services de l\'Etat.'),
                ],
            }),

            // Fait a Rodez — aligne a droite
            new Paragraph({
                spacing: { after: 300 },
                alignment: AlignmentType.RIGHT,
                children: [normal('Fait a Rodez, {{signature_date}}')],
            }),

            // Cachet et signature
            new Paragraph({
                spacing: { after: 60 },
                alignment: AlignmentType.CENTER,
                children: [normal('Cachet et signature de la responsable de l\'organisme de formation NJM Conseil', { size: 16, color: GRAY })],
            }),

            emptyLine(200),

            new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [bold('Nathalie JOULIE MORAND')],
            }),
        ],
    };
}

// =========================================================================
// PAGE 2 — ATTESTATION DE FIN DE FORMATION
// =========================================================================
function buildPage2() {
    return {
        properties: {
            type: SectionType.NEXT_PAGE,
            page: { margin: PAGE_MARGINS },
        },
        children: [
            // Titre orange
            new Paragraph({
                spacing: { before: 400, after: 80 },
                alignment: AlignmentType.CENTER,
                children: [orangeBold('ATTESTATION DE FIN DE FORMATION', { size: 26 })],
            }),

            // Sous-titre article
            new Paragraph({
                spacing: { after: 300 },
                alignment: AlignmentType.CENTER,
                children: [normal('Article L.6353-1 du Code du Travail', { size: 16, color: GRAY })],
            }),

            // Intro soussignee (repris page 1)
            new Paragraph({
                spacing: { after: 120 },
                children: [
                    normal('Je soussignee, '),
                    bold('Mme Nathalie JOULIE-MORAND'),
                    normal(', agissant en qualite de directrice de '),
                    bold('NJM Conseil'),
                    normal(', formatrice independante sous le numero SIRET '),
                    bold('534 935 473 000 15'),
                    normal(' et sous le numero de formateur '),
                    bold('73 12 00 635 12'),
                    normal(' atteste que :'),
                ],
            }),

            // Salarie
            new Paragraph({
                spacing: { after: 200 },
                children: [
                    normal('Le salarie de l\'entreprise : '),
                    bold('{{learner_name}}'),
                    normal(' pour '),
                    bold('{{company_name}}'),
                    normal('.'),
                ],
            }),

            // Texte article L 6313-1
            new Paragraph({
                spacing: { after: 120 },
                children: [
                    normal('a suivi avec assiduite et a satisfait aux epreuves d\'evaluation prevues, conformement aux dispositions de l\'article L. 6313-1 du Code du Travail, l\'action de formation ci-dessous :'),
                ],
            }),

            // Encadre formation
            new Paragraph({
                spacing: { before: 120, after: 120 },
                alignment: AlignmentType.CENTER,
                border: {
                    top: { style: BorderStyle.SINGLE, size: 1, color: ORANGE },
                    bottom: { style: BorderStyle.SINGLE, size: 1, color: ORANGE },
                    left: { style: BorderStyle.SINGLE, size: 1, color: ORANGE },
                    right: { style: BorderStyle.SINGLE, size: 1, color: ORANGE },
                },
                children: [
                    orangeBold('Formation : {{formation_name}}', { size: 20 }),
                ],
            }),

            emptyLine(80),

            // --- Nature de l'action ---
            new Paragraph({
                spacing: { after: 40 },
                children: [bold('Nature de l\'action (article L.6313-1 du Code du Travail)')],
            }),
            new Paragraph({
                spacing: { after: 120 },
                indent: { left: convertMillimetersToTwip(5) },
                children: [normal('- Action d\'acquisition, d\'entretien ou de perfectionnement des connaissances')],
            }),

            // --- Rappel des objectifs ---
            new Paragraph({
                spacing: { after: 40 },
                children: [bold('Rappel des objectifs pedagogiques')],
            }),
            new Paragraph({
                spacing: { after: 40 },
                indent: { left: convertMillimetersToTwip(5) },
                children: [normal('A l\'issue de la formation, le stagiaire sera en capacite d\' :')],
            }),
            new Paragraph({
                spacing: { after: 120 },
                indent: { left: convertMillimetersToTwip(5) },
                children: [normal('{{objectives}}')],
            }),

            // --- Deroulement ---
            new Paragraph({
                spacing: { after: 40 },
                children: [
                    bold('L\'action s\'est deroulee a '),
                    bold('{{training_location}}'),
                    normal(', les '),
                    bold('{{dates}}'),
                    normal(' :'),
                ],
            }),
            new Paragraph({
                spacing: { after: 40 },
                indent: { left: convertMillimetersToTwip(5) },
                children: [
                    normal('- duree de la formation : '),
                    bold('{{duration}}'),
                    normal(' heures'),
                ],
            }),
            new Paragraph({
                spacing: { after: 120 },
                indent: { left: convertMillimetersToTwip(5) },
                children: [
                    normal('- duree suivie par le stagiaire : '),
                    bold('{{duration}}'),
                    normal(' heures/stagiaire'),
                ],
            }),

            // --- Resultats evaluation ---
            new Paragraph({
                spacing: { after: 40 },
                children: [bold('Resultats de l\'evaluation des acquis au regard des objectifs de la formation :')],
            }),
            new Paragraph({
                spacing: { after: 200 },
                indent: { left: convertMillimetersToTwip(5) },
                children: [normal('{{objectives}}')],
            }),

            // Fait a Rodez
            new Paragraph({
                spacing: { after: 300 },
                alignment: AlignmentType.RIGHT,
                children: [normal('Fait a Rodez, le {{signature_date}}')],
            }),

            emptyLine(200),

            // Signature
            new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [bold('Nathalie JOULIE MORAND, gerante')],
            }),
            new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [bold('NJM Conseil')],
            }),
        ],
    };
}

// =========================================================================
// GENERATION
// =========================================================================
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
            buildPage1(),
            buildPage2(),
        ],
    });

    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync('certificat_template.docx', buffer);
    console.log('certificat_template.docx genere avec succes !');
    console.log('Variables disponibles :');
    console.log('  {{learner_name}}, {{company_name}}, {{formation_name}}');
    console.log('  {{dates}}, {{dates_prefix}}');
    console.log('  {{duration}}, {{training_location}}, {{objectives}}');
    console.log('  {{signature_date}}');
}

generate().catch(err => {
    console.error('Erreur:', err);
    process.exit(1);
});
