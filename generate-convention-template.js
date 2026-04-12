/**
 * generate-convention-template.js
 *
 * Genere un convention_template.docx propre avec variables {{...}}
 * compatible docxtemplater. Fidele au modele CADAUMA VALTRA.
 *
 * Usage : node generate-convention-template.js
 */

const {
    Document, Packer, Paragraph, TextRun, AlignmentType,
    HeadingLevel, UnderlineType, TabStopType, TabStopPosition,
    PageBreak, BorderStyle, ImageRun, Header, Footer,
    SectionType, convertMillimetersToTwip
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

function emptyLine() {
    return new Paragraph({ spacing: { after: 100 } });
}

// Bullet article 1 : cercle orange + label orange bold + valeur normale
function bulletPoint(label, value) {
    return new Paragraph({
        spacing: { after: 40 },
        indent: { left: convertMillimetersToTwip(5) },
        children: [
            new TextRun({ text: '\u25CF ', color: ORANGE, size: 18, font: 'Helvetica' }),
            orangeBold(label + ' '),
            normal(value),
        ],
    });
}

// Tiret pour article 2
function dashItem(text) {
    return new Paragraph({
        spacing: { after: 20 },
        indent: { left: convertMillimetersToTwip(3) },
        children: [normal('-   ' + text)],
    });
}

// Article title (bold + underline)
function articleTitle(text) {
    return new Paragraph({
        spacing: { before: 200, after: 80 },
        children: [
            new TextRun({
                text,
                bold: true,
                underline: { type: UnderlineType.SINGLE },
                size: 18,
                font: 'Helvetica',
                color: DARK_GRAY,
            }),
        ],
    });
}

// Sub-heading within articles (e.g. "Objectifs :")
function subHeading(text) {
    return new Paragraph({
        spacing: { before: 100, after: 40 },
        children: [normal(text, { underline: { type: UnderlineType.SINGLE } })],
    });
}

// Alinea (a), b), c)...)
function alinea(letter, text) {
    return new Paragraph({
        spacing: { after: 40 },
        indent: { left: convertMillimetersToTwip(8) },
        children: [normal(`${letter}) ${text}`)],
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
                        children: [bold('CONVENTION DE FORMATION PROFESSIONNELLE', { size: 28 })],
                    }),

                    // Entre les soussignes
                    new Paragraph({
                        spacing: { after: 80 },
                        children: [bold('Entre les soussignes :')],
                    }),

                    // Organisme de formation
                    new Paragraph({ children: [normal('L\'organisme de formation :')] }),
                    new Paragraph({
                        indent: { left: convertMillimetersToTwip(15) },
                        children: [bold('SAS NJM Conseil')],
                    }),
                    new Paragraph({
                        indent: { left: convertMillimetersToTwip(15) },
                        children: [bold('Le Cassan')],
                    }),
                    new Paragraph({
                        indent: { left: convertMillimetersToTwip(15) },
                        children: [bold('12330 Clairvaux d\'Aveyron')],
                    }),
                    new Paragraph({
                        indent: { left: convertMillimetersToTwip(15) },
                        spacing: { after: 60 },
                        children: [bold('N\u00B0 activite : 73120063512')],
                    }),

                    new Paragraph({
                        spacing: { after: 40 },
                        children: [normal('Representee par Mme JOULIE-MORAND Nathalie agissant en qualite de gerante')],
                    }),
                    new Paragraph({
                        spacing: { after: 120 },
                        children: [normal('Ci-apres designe "l\'organisme de formation", NJM Conseil')],
                    }),

                    // Et / Client
                    new Paragraph({ children: [normal('Et')] }),
                    new Paragraph({
                        spacing: { after: 80 },
                        children: [normal('Le client :')],
                    }),

                    new Paragraph({
                        indent: { left: convertMillimetersToTwip(15) },
                        children: [bold('{{company_name}}')],
                    }),
                    new Paragraph({
                        indent: { left: convertMillimetersToTwip(15) },
                        children: [bold('{{company_address}}')],
                    }),
                    new Paragraph({
                        indent: { left: convertMillimetersToTwip(15) },
                        spacing: { after: 60 },
                        children: [bold('{{company_postal_code}}')],
                    }),

                    new Paragraph({
                        spacing: { after: 40 },
                        children: [normal('Represente par {{company_director_name}} agissant en qualite de {{company_director_title}}')],
                    }),
                    new Paragraph({
                        spacing: { after: 120 },
                        children: [normal('Ci-apres designe "le Client",')],
                    }),

                    // Texte legal
                    new Paragraph({
                        spacing: { after: 80 },
                        children: [normal('Est conclue la convention suivante, en application des dispositions de la sixieme partie du Code du Travail portant sur l\'organisation de la formation professionnelle tout au long de la vie.')],
                    }),

                    // Article 1
                    articleTitle('Article 1- Objet de la convention :'),
                    new Paragraph({
                        spacing: { after: 60 },
                        children: [normal('En execution de la presente convention, l\'organisme de formation s\'engage a organiser l\'action de formation intitulee :')],
                    }),

                    // Titre formation centre
                    new Paragraph({
                        spacing: { before: 80, after: 120 },
                        alignment: AlignmentType.CENTER,
                        children: [bold('Convention de formation : {{formation_name}}', { size: 22 })],
                    }),

                    // Bullets article 1
                    bulletPoint('Objectifs:', '{{objectives}}'),
                    bulletPoint('Type d\'action de formation', '(au sens de l\'article L. 900-2 du Code du travail): Acquisition et entretien des connaissances et mise en parallele avec l\'activite.'),
                    bulletPoint('Contenus:', '{{module_content}}'),
                    bulletPoint('Methodes et moyens pedagogiques:', '{{methods}}'),
                    bulletPoint('Formateur:', '{{trainer}}'),
                    bulletPoint('Date(s):', '{{dates}}'),
                    bulletPoint('Duree:', '{{duration}} heures.'),
                    bulletPoint('Lieu:', '{{training_location}}'),
                    bulletPoint('Effectif forme:', '{{learner_count}} personne(s), {{learners}}'),
                    bulletPoint('Modalites de suivi et appreciation des resultats:', 'fiche de presence emargee, accompagnement rectificatif et evaluation des productions de l\'apprenant.'),
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
                    // Article 2
                    articleTitle('Article 2- Description de la formation:'),

                    subHeading('Objectifs :'),
                    dashItem('{{objectives}}'),
                    emptyLine(),

                    subHeading('Contenus :'),
                    dashItem('{{module_content}}'),
                    emptyLine(),

                    subHeading('Modalites :'),
                    dashItem('{{methods}}'),
                    emptyLine(),

                    subHeading('Mode d\'evaluation des acquis :'),
                    dashItem('Questionnaire individuel en ligne en fin de formation'),
                    emptyLine(),

                    // Article 3
                    articleTitle('Article 3- Dispositions financieres :'),

                    alinea('a', 'Le client, en contrepartie des actions de formation realisees, s\'engage a verser a l\'organisme de formation, une somme correspondant aux frais de formation de : {{total_amount}} \u20AC nets. S\'y ajoutent des frais de deplacement.'),
                    alinea('b', 'L\'organisme de formation, en contrepartie des sommes recues, s\'engage a realiser toutes les actions prevues dans le cadre de la presente convention ainsi qu\'a fournir tout document et piece de nature a justifier la realite et la validite des depenses de formation engagees a ce titre.'),
                    alinea('c', 'Modalites de reglement : la facture est reglable a l\'issue de la formation par cheque a l\'ordre de la SAS NJM Conseil.'),
                    emptyLine(),

                    // Article 4
                    articleTitle('Article 4- Dedit ou abandon :'),

                    alinea('a', 'En cas de resiliation de la presente convention par le client a moins de 10 jours francs avant le debut d\'une des actions mentionnees a l\'annexe, l\'organisme de formation retiendra sur le cout total 10 % de la somme, au titre de dedommagement.'),
                    alinea('b', 'En cas de realisation partielle de l\'action du fait du client, seule sera facturee au client la partie effectivement realisee de l\'action, selon le prorata suivant : nombre d\'heures realisees/nombre d\'heures prevues. En outre, l\'organisme de formation retiendra sur le cout correspondant a la partie non-realisee un pourcentage de 10 %, au titre de dedommagement.'),
                ],
            },

            // ==================== PAGE 3 ====================
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
                    alinea('c', 'Les montants verses par le client au titre de dedommagement ne pourront pas etre imputes par le client sur son obligation definie a l\'article L6331-1 du code du travail ni faire l\'objet d\'une demande de remboursement ou de prise en charge par un OPCO.'),
                    alinea('d', 'En cas de modification unilaterale par l\'organisme de formation de l\'un des elements fixes a l\'article 1, le client se reserve le droit de mettre fin a la presente convention. Le delai d\'annulation etant toutefois limite a 30 jours francs avant la date prevue de commencement de l\'une des actions mentionnees a la presente convention, il sera, dans ce cas, procede a une resorption anticipee de la convention.'),
                    emptyLine(),

                    // Article 5
                    articleTitle('Article 5- Date d\'effet et duree de la convention :'),
                    new Paragraph({
                        spacing: { after: 80 },
                        children: [normal('La presente convention prend effet a compter de la date de signature de la presente convention pour s\'achever a la fin de la periode de formation objet de la presente convention.')],
                    }),

                    // Article 6
                    articleTitle('Article 6- Differends eventuels :'),
                    new Paragraph({
                        spacing: { after: 200 },
                        children: [normal('Si une contestation ou un differend ne peuvent etre regles a l\'amiable, le Tribunal de commerce du lieu de residence du client sera seul competent pour se prononcer sur le litige.')],
                    }),

                    // Fait a...
                    new Paragraph({
                        spacing: { after: 200 },
                        alignment: AlignmentType.RIGHT,
                        children: [normal('Fait en double exemplaire, a Rodez, le {{signature_date}}')],
                    }),

                    // Signatures sur deux colonnes via tabulations
                    new Paragraph({
                        spacing: { after: 60 },
                        tabStops: [{ type: TabStopType.LEFT, position: convertMillimetersToTwip(100) }],
                        children: [
                            normal('Pour le client,'),
                            new TextRun({ text: '\t', size: 18, font: 'Helvetica' }),
                            normal('Pour l\'organisme de formation,'),
                        ],
                    }),
                    new Paragraph({
                        spacing: { after: 40 },
                        tabStops: [{ type: TabStopType.LEFT, position: convertMillimetersToTwip(100) }],
                        children: [
                            normal('{{company_director_name}}'),
                            new TextRun({ text: '\t', size: 18, font: 'Helvetica' }),
                            normal('Nathalie JOULIE MORAND, gerante'),
                        ],
                    }),
                    new Paragraph({
                        spacing: { after: 200 },
                        children: [normal('{{company_name}}')],
                    }),
                ],
            },
        ],
    });

    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync('convention_template.docx', buffer);
    console.log('convention_template.docx genere avec succes !');
    console.log('Variables disponibles :');
    console.log('  {{company_name}}, {{company_address}}, {{company_postal_code}}');
    console.log('  {{company_director_name}}, {{company_director_title}}');
    console.log('  {{formation_name}}, {{objectives}}, {{module_content}}, {{methods}}');
    console.log('  {{trainer}}, {{dates}}, {{duration}}, {{training_location}}');
    console.log('  {{learner_count}}, {{learners}}, {{total_amount}}, {{signature_date}}');
}

generate().catch(err => {
    console.error('Erreur:', err);
    process.exit(1);
});
