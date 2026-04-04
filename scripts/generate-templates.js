/**
 * scripts/generate-templates.js
 * Genere les 5 templates DOCX NJM avec variables {{}} pour PizZip
 * Fidele aux PDFs generes par pdf-generator.js
 * Usage: node scripts/generate-templates.js
 */

const {
    Document, Packer, Paragraph, TextRun, AlignmentType,
    Table, TableRow, TableCell, BorderStyle, WidthType,
    VerticalAlign, ImageRun, Footer,
    SectionType, convertMillimetersToTwip,
    UnderlineType, TabStopType, TableLayoutType
} = require('docx');
const fs = require('fs');
const path = require('path');

// ==================== COULEURS ====================
const ORANGE = 'E36A3A';
const DARK_GRAY = '333333';
const PINK = 'E91E8C';
const PURPLE = '7B3F9E';
const GREEN = 'B8C944';
const GRAY = '6B7280';

// ==================== ASSETS ====================
const logoPath = path.join(__dirname, '..', 'logo-njm.png');
const logoBuffer = fs.readFileSync(logoPath);
const cachetPath = path.join(__dirname, '..', 'cachet-njm.png');
const cachetBuffer = fs.existsSync(cachetPath) ? fs.readFileSync(cachetPath) : null;

// ==================== HELPERS (tailles en demi-points, 18 = 9pt) ====================
function bold(text, opts = {}) {
    return new TextRun({ text, bold: true, size: opts.size || 18, font: 'Helvetica', color: opts.color || DARK_GRAY, ...opts });
}
function normal(text, opts = {}) {
    return new TextRun({ text, size: opts.size || 18, font: 'Helvetica', color: opts.color || DARK_GRAY, ...opts });
}
function orangeBold(text, opts = {}) {
    return new TextRun({ text, bold: true, size: opts.size || 18, font: 'Helvetica', color: ORANGE, ...opts });
}
function emptyLine(after = 100) {
    return new Paragraph({ spacing: { after } });
}

// Header NJM : logo a gauche + activites a droite
function njmHeader() {
    return [
        new Paragraph({
            children: [
                new ImageRun({ data: logoBuffer, transformation: { width: 100, height: 58 }, type: 'png' }),
            ],
        }),
        new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { before: 0 }, children: [bold('MARKETING', { size: 13, color: ORANGE })] }),
        new Paragraph({ alignment: AlignmentType.RIGHT, children: [bold('WEB MARKETING', { size: 13, color: ORANGE })] }),
        new Paragraph({ alignment: AlignmentType.RIGHT, children: [bold('COMMERCIAL', { size: 13, color: ORANGE })] }),
        new Paragraph({ alignment: AlignmentType.RIGHT, children: [bold('COMMUNICATION', { size: 13, color: ORANGE })] }),
        new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 150 }, children: [bold('COACHING', { size: 13, color: ORANGE })] }),
    ];
}

// Footer NJM avec ligne multicolore simulee + infos
function njmFooter() {
    return new Footer({
        children: [
            // Ligne multicolore simulee via bordure de paragraphe
            new Paragraph({
                spacing: { before: 80 },
                border: {
                    top: { style: BorderStyle.SINGLE, size: 6, color: PINK, space: 4 },
                },
                alignment: AlignmentType.CENTER,
                children: [
                    bold('NJM Conseil - NATHALIE JOULIE MORAND - LE CASSAN - 12330 CLAIRVAUX D\'AVEYRON - 06 88 10 40 67 - njm.conseil@orange.fr', { size: 12, color: PURPLE }),
                ],
            }),
            new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                    normal('www.njm-conseil.fr SAS NJM Conseil au capital social de 3 000\u20AC N\u00B0RCS Rodez 534 935 473 NAF 7022Z N\u00B0 Activit\u00E9 : 73120063512', { size: 11, color: GRAY }),
                ],
            }),
            new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [normal('Qualiopi C2-5 V2 16-11-2020', { size: 11, color: GRAY })],
            }),
        ],
    });
}

function pageProps() {
    return {
        page: {
            margin: {
                top: convertMillimetersToTwip(15),
                bottom: convertMillimetersToTwip(25),
                left: convertMillimetersToTwip(20),
                right: convertMillimetersToTwip(20),
            },
        },
    };
}

// Cachet image run (reuse)
function cachetImage(w, h) {
    if (!cachetBuffer) return null;
    return new ImageRun({ data: cachetBuffer, transformation: { width: w || 120, height: h || 85 }, type: 'png' });
}

// Bullet: cercle orange + label orange bold + valeur
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

function dashItem(text) {
    return new Paragraph({
        spacing: { after: 20 },
        indent: { left: convertMillimetersToTwip(3) },
        children: [normal('-   ' + text)],
    });
}

function articleTitle(text) {
    return new Paragraph({
        spacing: { before: 200, after: 80 },
        children: [
            new TextRun({ text, bold: true, underline: { type: UnderlineType.SINGLE }, size: 18, font: 'Helvetica', color: DARK_GRAY }),
        ],
    });
}

function alinea(letter, text) {
    return new Paragraph({
        spacing: { after: 40 },
        indent: { left: convertMillimetersToTwip(8) },
        children: [normal(`${letter}) ${text}`)],
    });
}

// ==================== 1. CONVENTION ====================
async function generateConvention() {
    const doc = new Document({
        sections: [
            {
                properties: pageProps(),
                footers: { default: njmFooter() },
                children: [
                    ...njmHeader(),
                    new Paragraph({ spacing: { before: 200, after: 200 }, alignment: AlignmentType.CENTER, children: [bold('CONVENTION DE FORMATION PROFESSIONNELLE', { size: 28 })] }),
                    new Paragraph({ spacing: { after: 80 }, children: [bold('Entre les soussign\u00E9s :')] }),
                    new Paragraph({ children: [normal('L\'organisme de formation :')] }),
                    new Paragraph({ indent: { left: convertMillimetersToTwip(15) }, children: [bold('SAS NJM Conseil')] }),
                    new Paragraph({ indent: { left: convertMillimetersToTwip(15) }, children: [bold('Le Cassan')] }),
                    new Paragraph({ indent: { left: convertMillimetersToTwip(15) }, children: [bold('12330 Clairvaux d\'Aveyron')] }),
                    new Paragraph({ indent: { left: convertMillimetersToTwip(15) }, spacing: { after: 60 }, children: [bold('N\u00B0 activit\u00E9 : 73120063512')] }),
                    new Paragraph({ spacing: { after: 40 }, children: [normal('Repr\u00E9sent\u00E9e par Mme JOULIE-MORAND Nathalie agissant en qualit\u00E9 de g\u00E9rante')] }),
                    new Paragraph({ spacing: { after: 100 }, children: [normal('Ci-apr\u00E8s d\u00E9sign\u00E9 "l\'organisme de formation", NJM Conseil')] }),
                    new Paragraph({ children: [normal('Et')] }),
                    new Paragraph({ spacing: { after: 60 }, children: [normal('Le client :')] }),
                    new Paragraph({ indent: { left: convertMillimetersToTwip(15) }, children: [bold('{{company_name}}')] }),
                    new Paragraph({ indent: { left: convertMillimetersToTwip(15) }, children: [bold('{{company_address}}')] }),
                    new Paragraph({ indent: { left: convertMillimetersToTwip(15) }, spacing: { after: 60 }, children: [bold('{{company_postal_city}}')] }),
                    new Paragraph({ spacing: { after: 40 }, children: [normal('Repr\u00E9sent\u00E9 par {{contact_title}} {{contact_name}} agissant en qualit\u00E9 de {{contact_role}}')] }),
                    new Paragraph({ spacing: { after: 100 }, children: [normal('Ci-apr\u00E8s d\u00E9sign\u00E9 "le Client",')] }),
                    new Paragraph({ spacing: { after: 80 }, children: [normal('Est conclue la convention suivante, en application des dispositions de la sixi\u00E8me partie du Code du Travail portant sur l\'organisation de la formation professionnelle tout au long de la vie.')] }),
                    articleTitle('Article 1- Objet de la convention :'),
                    new Paragraph({ spacing: { after: 60 }, children: [normal('En ex\u00E9cution de la pr\u00E9sente convention, l\'organisme de formation s\'engage \u00E0 organiser l\'action de formation intitul\u00E9e :')] }),
                    new Paragraph({ spacing: { before: 60, after: 100 }, alignment: AlignmentType.CENTER, children: [bold('Convention de formation : {{formation_name}}', { size: 22 })] }),
                    bulletPoint('Objectifs:', '{{objectives}}'),
                    bulletPoint('Type d\'action de formation', '(au sens de l\'article L. 900-2 du Code du travail): Acquisition et entretien des connaissances et mise en parall\u00E8le avec l\'activit\u00E9.'),
                    bulletPoint('Contenus:', '{{content_summary}}'),
                    bulletPoint('M\u00E9thodes et moyens p\u00E9dagogiques:', '{{methods}}'),
                    bulletPoint('Formateur:', '{{trainer}}'),
                    bulletPoint('Date(s):', '{{dates}}'),
                    bulletPoint('Dur\u00E9e:', '{{duration}} heures.'),
                    bulletPoint('Lieu:', '{{training_location}}'),
                    bulletPoint('Effectif form\u00E9:', '{{learner_count}} personne(s), {{learners}}'),
                    bulletPoint('Modalit\u00E9s de suivi et appr\u00E9ciation des r\u00E9sultats:', 'fiche de pr\u00E9sence \u00E9marg\u00E9e, accompagnement rectificatif et \u00E9valuation des productions de l\'apprenant.'),
                ],
            },
            {
                properties: { ...pageProps(), type: SectionType.NEXT_PAGE },
                footers: { default: njmFooter() },
                children: [
                    articleTitle('Article 2- Description de la formation:'),
                    new Paragraph({ spacing: { after: 40 }, children: [normal('Objectifs :', { underline: { type: UnderlineType.SINGLE } })] }),
                    dashItem('{{objectives}}'),
                    emptyLine(40),
                    new Paragraph({ spacing: { after: 40 }, children: [normal('Contenus :', { underline: { type: UnderlineType.SINGLE } })] }),
                    dashItem('{{module_content}}'),
                    emptyLine(40),
                    new Paragraph({ spacing: { after: 40 }, children: [normal('Modalit\u00E9s :', { underline: { type: UnderlineType.SINGLE } })] }),
                    dashItem('{{methods}}'),
                    emptyLine(40),
                    new Paragraph({ spacing: { after: 40 }, children: [normal('Mode d\'\u00E9valuation des acquis :', { underline: { type: UnderlineType.SINGLE } })] }),
                    dashItem('Questionnaire individuel en ligne en fin de formation'),
                    emptyLine(40),
                    articleTitle('Article 3- Dispositions financi\u00E8res :'),
                    alinea('a', 'Le client, en contrepartie des actions de formation r\u00E9alis\u00E9es, s\'engage \u00E0 verser \u00E0 l\'organisme de formation, une somme correspondant aux frais de formation de : {{price}} \u20AC nets. S\'y ajoutent des frais de d\u00E9placement.'),
                    alinea('b', 'L\'organisme de formation, en contrepartie des sommes re\u00E7ues, s\'engage \u00E0 r\u00E9aliser toutes les actions pr\u00E9vues dans le cadre de la pr\u00E9sente convention ainsi qu\'\u00E0 fournir tout document et pi\u00E8ce de nature \u00E0 justifier la r\u00E9alit\u00E9 et la validit\u00E9 des d\u00E9penses de formation engag\u00E9es \u00E0 ce titre.'),
                    alinea('c', 'Modalit\u00E9s de r\u00E8glement : la facture est r\u00E9glable \u00E0 l\'issue de la formation par ch\u00E8que \u00E0 l\'ordre de la SAS NJM Conseil.'),
                    emptyLine(40),
                    articleTitle('Article 4- D\u00E9dit ou abandon :'),
                    alinea('a', 'En cas de r\u00E9siliation de la pr\u00E9sente convention par le client \u00E0 moins de 10 jours francs avant le d\u00E9but d\'une des actions mentionn\u00E9es \u00E0 l\'annexe, l\'organisme de formation retiendra sur le co\u00FBt total 10 % de la somme, au titre de d\u00E9dommagement.'),
                    alinea('b', 'En cas de r\u00E9alisation partielle de l\'action du fait du client, seule sera factur\u00E9e au client la partie effectivement r\u00E9alis\u00E9e de l\'action, selon le prorata suivant : nombre d\'heures r\u00E9alis\u00E9es/nombre d\'heures pr\u00E9vues. En outre, l\'organisme de formation retiendra sur le co\u00FBt correspondant \u00E0 la partie non-r\u00E9alis\u00E9e un pourcentage de 10 %, au titre de d\u00E9dommagement.'),
                    alinea('c', 'Les montants vers\u00E9s par le client au titre de d\u00E9dommagement ne pourront pas \u00EAtre imput\u00E9s par le client sur son obligation d\u00E9finie \u00E0 l\'article L6331-1 du code du travail ni faire l\'objet d\'une demande de remboursement ou de prise en charge par un OPCO.'),
                    alinea('d', 'En cas de modification unilat\u00E9rale par l\'organisme de formation de l\'un des \u00E9l\u00E9ments fix\u00E9s \u00E0 l\'article 1, le client se r\u00E9serve le droit de mettre fin \u00E0 la pr\u00E9sente convention. Le d\u00E9lai d\'annulation \u00E9tant toutefois limit\u00E9 \u00E0 30 jours francs avant la date pr\u00E9vue de commencement de l\'une des actions mentionn\u00E9es \u00E0 la pr\u00E9sente convention, il sera, dans ce cas, proc\u00E9d\u00E9 \u00E0 une r\u00E9sorption anticip\u00E9e de la convention.'),
                    emptyLine(40),
                    articleTitle('Article 5- Date d\'effet et dur\u00E9e de la convention :'),
                    new Paragraph({ spacing: { after: 80 }, children: [normal('La pr\u00E9sente convention prend effet \u00E0 compter de la date de signature de la pr\u00E9sente convention pour s\'achever \u00E0 la fin de la p\u00E9riode de formation objet de la pr\u00E9sente convention.')] }),
                    articleTitle('Article 6- Diff\u00E9rends \u00E9ventuels :'),
                    new Paragraph({ spacing: { after: 200 }, children: [normal('Si une contestation ou un diff\u00E9rend ne peuvent \u00EAtre r\u00E9gl\u00E9s \u00E0 l\'amiable, le Tribunal de commerce du lieu de r\u00E9sidence du client sera seul comp\u00E9tent pour se prononcer sur le litige.')] }),
                    new Paragraph({ spacing: { after: 200 }, alignment: AlignmentType.RIGHT, children: [normal('Fait en double exemplaire, \u00E0 Rodez, le {{signature_date}}')] }),
                    new Paragraph({
                        spacing: { after: 40 },
                        tabStops: [{ type: TabStopType.LEFT, position: convertMillimetersToTwip(100) }],
                        children: [normal('Pour le client,'), new TextRun({ text: '\t', size: 18, font: 'Helvetica' }), normal('Pour l\'organisme de formation,')],
                    }),
                    new Paragraph({
                        spacing: { after: 40 },
                        tabStops: [{ type: TabStopType.LEFT, position: convertMillimetersToTwip(100) }],
                        children: [normal('{{contact_name}}'), new TextRun({ text: '\t', size: 18, font: 'Helvetica' }), normal('Nathalie JOULIE MORAND, g\u00E9rante')],
                    }),
                    new Paragraph({ children: [normal('{{company_name}}')] }),
                    // Cachet sous la signature NJM
                    ...(cachetBuffer ? [new Paragraph({
                        spacing: { before: 60 },
                        indent: { left: convertMillimetersToTwip(100) },
                        children: [cachetImage(100, 70)],
                    })] : []),
                ],
            },
        ],
    });
    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(path.join(__dirname, '..', 'templates', 'convention_template.docx'), buffer);
    console.log('  convention_template.docx');
}

// ==================== 2. ATTESTATION + CERTIFICAT ====================
async function generateAttestation() {
    const doc = new Document({
        sections: [
            // PAGE 1: CERTIFICAT DE REALISATION
            {
                properties: pageProps(),
                footers: { default: njmFooter() },
                children: [
                    ...njmHeader(),
                    new Paragraph({ spacing: { before: 150, after: 150 }, alignment: AlignmentType.CENTER, children: [bold('CERTIFICAT DE REALISATION', { size: 26 })] }),
                    new Paragraph({ spacing: { after: 60 }, children: [normal('Je soussign\u00E9e, Mme Nathalie JOULIE-MORAND, agissant en qualit\u00E9 de directrice de NJM Conseil, formatrice ind\u00E9pendante sous le num\u00E9ro SIRET 534 935 473 000 15 et sous le num\u00E9ro de formateur 73 12 00 635 12 atteste que :')] }),
                    new Paragraph({ spacing: { after: 60 }, children: [normal('{{learner_name}}, salari\u00E9(e) de l\'entreprise {{company_name}} a suivi la formation {{formation_name}}, qui s\'est d\u00E9roul\u00E9e {{dates}}, pour une dur\u00E9e de {{duration}}h.')] }),
                    new Paragraph({ spacing: { after: 30 }, children: [bold('Assiduit\u00E9 du stagiaire :')] }),
                    new Paragraph({ spacing: { after: 60 }, children: [normal('Dur\u00E9e effectivement suivie par le/la stagiaire : {{duration}}h, soit un taux de r\u00E9alisation de 100%.')] }),
                    new Paragraph({ spacing: { after: 30 }, children: [normal('Nature de l\'action concourant au d\u00E9veloppement des comp\u00E9tences :')] }),
                    new Paragraph({ indent: { left: convertMillimetersToTwip(5) }, spacing: { after: 15 }, children: [normal('\u2611 Action de formation')] }),
                    new Paragraph({ indent: { left: convertMillimetersToTwip(5) }, spacing: { after: 60 }, children: [normal('\u2610 Bilan de comp\u00E9tences')] }),
                    new Paragraph({ spacing: { after: 30 }, children: [normal('Sans pr\u00E9judice des d\u00E9lais impos\u00E9s par les r\u00E8gles fiscales, comptables ou commerciales, je m\'engage \u00E0 conserver l\'ensemble des pi\u00E8ces justificatives qui ont permis d\'\u00E9tablir le pr\u00E9sent certificat, pendant une dur\u00E9e de 3 ans \u00E0 compter de la fin de l\'ann\u00E9e du dernier paiement.')] }),
                    new Paragraph({ spacing: { after: 100 }, children: [normal('En cas de cofinancement des fonds europ\u00E9ens, la dur\u00E9e de conservation est \u00E9tendue conform\u00E9ment aux obligations conventionnelles sp\u00E9cifiques.')] }),
                    new Paragraph({ spacing: { after: 100 }, alignment: AlignmentType.RIGHT, children: [normal('Fait \u00E0 Rodez, {{signature_date}}')] }),
                    new Paragraph({ spacing: { after: 30 }, alignment: AlignmentType.CENTER, children: [normal('Cachet et signature de la responsable de l\'organisme de formation NJM Conseil')] }),
                    new Paragraph({ spacing: { after: 10 }, alignment: AlignmentType.CENTER, children: [normal('Nathalie JOULIE MORAND')] }),
                    ...(cachetBuffer ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [cachetImage(100, 70)] })] : []),
                ],
            },
            // PAGE 2: ATTESTATION DE FIN DE FORMATION
            {
                properties: { ...pageProps(), type: SectionType.NEXT_PAGE },
                footers: { default: njmFooter() },
                children: [
                    ...njmHeader(),
                    new Paragraph({ spacing: { before: 150, after: 40 }, alignment: AlignmentType.CENTER, children: [bold('ATTESTATION DE FIN DE FORMATION', { size: 26, color: ORANGE })] }),
                    new Paragraph({ spacing: { after: 80 }, alignment: AlignmentType.CENTER, children: [normal('Article .6353-1 du Code du Travail', { size: 16, color: GRAY })] }),
                    new Paragraph({ spacing: { after: 40 }, children: [normal('Je soussign\u00E9e, Mme Nathalie JOULIE-MORAND, agissant en qualit\u00E9 de directrice de NJM Conseil, formatrice ind\u00E9pendante sous le num\u00E9ro SIRET 534 935 473 000 15 et sous le num\u00E9ro de formateur 73 12 00 635 12 atteste que :')] }),
                    new Paragraph({ spacing: { after: 40 }, children: [normal('Le salari\u00E9 de l\'entreprise : {{learner_name}} pour {{company_name}}.')] }),
                    new Paragraph({ spacing: { after: 40 }, children: [normal('A suivi dans le cadre d\'une action de formation professionnelle continue, relevant de l\'article L 6313-1 du code du travail, la formation suivante :')] }),
                    // Titre formation avec bordure orange
                    new Paragraph({
                        spacing: { before: 40, after: 80 },
                        alignment: AlignmentType.CENTER,
                        border: {
                            top: { style: BorderStyle.SINGLE, size: 6, color: ORANGE, space: 4 },
                            bottom: { style: BorderStyle.SINGLE, size: 6, color: ORANGE, space: 4 },
                            left: { style: BorderStyle.SINGLE, size: 6, color: ORANGE, space: 6 },
                            right: { style: BorderStyle.SINGLE, size: 6, color: ORANGE, space: 6 },
                        },
                        children: [bold('Formation : {{formation_name}}', { size: 22, color: ORANGE })],
                    }),
                    new Paragraph({ spacing: { after: 15 }, children: [new TextRun({ text: '\u25CF ', size: 18, color: DARK_GRAY }), normal('Nature de l\'action (article L.6313-1 du Code du Travail)')] }),
                    dashItem('Action d\'acquisition, d\'entretien ou de perfectionnement des connaissances'),
                    emptyLine(30),
                    new Paragraph({ spacing: { after: 15 }, children: [new TextRun({ text: '\u25CF ', size: 18, color: DARK_GRAY }), normal('Rappel des objectifs p\u00E9dagogiques')] }),
                    new Paragraph({ indent: { left: convertMillimetersToTwip(5) }, spacing: { after: 15 }, children: [normal('A l\'issue de la formation, le stagiaire sera en capacit\u00E9 d\' :')] }),
                    new Paragraph({ indent: { left: convertMillimetersToTwip(5) }, spacing: { after: 30 }, children: [normal('{{objectives}}')] }),
                    new Paragraph({ spacing: { after: 15 }, children: [new TextRun({ text: '\u25CF ', size: 18, color: DARK_GRAY }), normal('L\'action s\'est d\u00E9roul\u00E9e \u00E0 {{training_location}}, {{dates}},')] }),
                    dashItem('dur\u00E9e de la formation : {{duration}} heures'),
                    dashItem('dur\u00E9e suivie par le stagiaire : {{duration}} heures/stagiaire'),
                    emptyLine(30),
                    new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: '\u25CF ', size: 18, color: DARK_GRAY }), normal('R\u00E9sultats de l\'\u00E9valuation des acquis au regard des objectifs de la formation :')] }),
                    new Paragraph({ indent: { left: convertMillimetersToTwip(5) }, spacing: { after: 60 }, children: [normal('{{objectives}}')] }),
                    new Paragraph({ spacing: { after: 80 }, alignment: AlignmentType.RIGHT, children: [normal('Fait \u00E0 Rodez, le {{signature_date}}')] }),
                    new Paragraph({ children: [normal('La formatrice et directrice de')] }),
                    new Paragraph({ children: [normal('NJM Conseil')] }),
                    ...(cachetBuffer ? [new Paragraph({ spacing: { before: 30 }, children: [cachetImage(100, 70)] })] : []),
                    new Paragraph({ spacing: { before: 10 }, children: [normal('Nathalie Jouli\u00E9 Morand')] }),
                    // Notice rose en bas
                    new Paragraph({
                        spacing: { before: 200 },
                        alignment: AlignmentType.CENTER,
                        children: [new TextRun({ text: 'Document \u00E0 conserver par le stagiaire. Aucun duplicata ne sera d\u00E9livr\u00E9.', bold: true, italics: true, size: 14, font: 'Helvetica', color: PINK })],
                    }),
                ],
            },
        ],
    });
    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(path.join(__dirname, '..', 'templates', 'attestation_template.docx'), buffer);
    console.log('  attestation_template.docx');
}

// ==================== 3. FEUILLE DE PRESENCE ====================
async function generateFeuillePresence() {
    const pinkBorder = {
        top: { style: BorderStyle.SINGLE, size: 4, color: PINK },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: PINK },
        left: { style: BorderStyle.SINGLE, size: 4, color: PINK },
        right: { style: BorderStyle.SINGLE, size: 4, color: PINK },
    };
    function hdrCell(text, w) {
        return new TableCell({ width: { size: w, type: WidthType.DXA }, borders: pinkBorder, verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ children: [bold(text, { size: 16 })] })] });
    }
    function lrnRow(idx) {
        const w = [2600, 2000, 2000, 2600];
        return new TableRow({
            height: { value: 500, rule: 'atLeast' },
            children: [
                new TableCell({ width: { size: w[0], type: WidthType.DXA }, borders: pinkBorder, verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ children: [normal(`{{learner_${idx}}}`)] })] }),
                new TableCell({ width: { size: w[1], type: WidthType.DXA }, borders: pinkBorder, verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ children: [normal(' ')] })] }),
                new TableCell({ width: { size: w[2], type: WidthType.DXA }, borders: pinkBorder, verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ children: [normal(' ')] })] }),
                new TableCell({ width: { size: w[3], type: WidthType.DXA }, borders: pinkBorder, verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ children: [normal(`{{hours_${idx}}}`)] })] }),
            ],
        });
    }
    const colW = [2600, 2000, 2000, 2600];
    const totalW = colW.reduce((a, b) => a + b, 0);

    // Signature row avec cachet dans Matin et Apres-midi
    const sigChildren = [
        new Paragraph({ spacing: { before: 40 }, children: [bold('Nathalie JOULIE-MORAND', { size: 16 })] }),
        new Paragraph({ children: [bold('Formatrice', { size: 16 })] }),
    ];
    const sigCellMatin = cachetBuffer
        ? [new Paragraph({ children: [cachetImage(80, 56)] })]
        : [new Paragraph({ children: [normal(' ')] })];
    const sigCellAprem = cachetBuffer
        ? [new Paragraph({ children: [cachetImage(80, 56)] })]
        : [new Paragraph({ children: [normal(' ')] })];

    const table = new Table({
        width: { size: totalW, type: WidthType.DXA },
        layout: TableLayoutType.FIXED,
        rows: [
            new TableRow({
                height: { value: 400, rule: 'atLeast' },
                children: [
                    hdrCell('NOM et pr\u00E9nom de\nl\'apprenant', colW[0]),
                    hdrCell('Matin\n9h00 \u00E0 12h30', colW[1]),
                    hdrCell('Apr\u00E8s-midi\n14h00 \u00E0 17h30', colW[2]),
                    hdrCell('Nombre d\'heures par\napprenant', colW[3]),
                ],
            }),
            ...Array.from({ length: 20 }, (_, i) => lrnRow(i + 1)),
            // Signature row with columns
            new TableRow({
                height: { value: 1000, rule: 'atLeast' },
                children: [
                    new TableCell({ width: { size: colW[0], type: WidthType.DXA }, borders: pinkBorder, children: sigChildren }),
                    new TableCell({ width: { size: colW[1], type: WidthType.DXA }, borders: pinkBorder, verticalAlign: VerticalAlign.CENTER, children: sigCellMatin }),
                    new TableCell({ width: { size: colW[2], type: WidthType.DXA }, borders: pinkBorder, verticalAlign: VerticalAlign.CENTER, children: sigCellAprem }),
                    new TableCell({ width: { size: colW[3], type: WidthType.DXA }, borders: pinkBorder, children: [new Paragraph({ children: [normal(' ')] })] }),
                ],
            }),
        ],
    });

    const doc = new Document({
        sections: [{
            properties: pageProps(),
            footers: { default: njmFooter() },
            children: [
                ...njmHeader(),
                new Paragraph({ spacing: { before: 150, after: 200 }, alignment: AlignmentType.CENTER, children: [bold('FORMATION : {{formation_name}}', { size: 26, color: ORANGE })] }),
                new Paragraph({ spacing: { after: 40 }, children: [normal('Feuille de pr\u00E9sence - Date {{date}}')] }),
                new Paragraph({ spacing: { after: 80 }, children: [normal('Lieu de la formation : {{training_location}}')] }),
                table,
                new Paragraph({ spacing: { before: 100 }, children: [normal('J\'atteste avoir pris connaissance du r\u00E8glement int\u00E9rieur de NJM Conseil.', { size: 16 })] }),
            ],
        }],
    });
    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(path.join(__dirname, '..', 'templates', 'feuille_presence_template.docx'), buffer);
    console.log('  feuille_presence_template.docx');
}

// ==================== 4. FICHE PEDAGOGIQUE ====================
async function generateFichePeda() {
    const orangeBorder = {
        top: { style: BorderStyle.SINGLE, size: 4, color: ORANGE },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: ORANGE },
        left: { style: BorderStyle.SINGLE, size: 4, color: ORANGE },
        right: { style: BorderStyle.SINGLE, size: 4, color: ORANGE },
    };
    function tHead(text, w) {
        return new TableCell({ width: { size: w, type: WidthType.DXA }, borders: orangeBorder, shading: { fill: 'FFF3EC' }, verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ children: [bold(text, { size: 15 })] })] });
    }
    function tCell(text, w) {
        return new TableCell({ width: { size: w, type: WidthType.DXA }, borders: orangeBorder, verticalAlign: VerticalAlign.TOP, children: [new Paragraph({ children: [normal(text, { size: 15 })] })] });
    }
    const colW = [1100, 2200, 3600, 3000];
    const table = new Table({
        width: { size: colW.reduce((a, b) => a + b, 0), type: WidthType.DXA },
        layout: TableLayoutType.FIXED,
        rows: [
            new TableRow({ children: [tHead('Dur\u00E9e\n(en heures)', colW[0]), tHead('Objectifs p\u00E9dagogiques mesurables\n(aptitudes et comp\u00E9tences)', colW[1]), tHead('Contenu p\u00E9dagogique\npar module', colW[2]), tHead('M\u00E9thodes, moyens et outils\np\u00E9dagogiques', colW[3])] }),
            new TableRow({ children: [tCell('{{duration}}h', colW[0]), tCell('{{objectives}}', colW[1]), tCell('{{content}}', colW[2]), tCell('{{methods}}', colW[3])] }),
        ],
    });
    const doc = new Document({
        sections: [{
            properties: pageProps(),
            footers: { default: njmFooter() },
            children: [
                ...njmHeader(),
                new Paragraph({ spacing: { before: 150, after: 150 }, alignment: AlignmentType.CENTER, children: [bold('FICHE PEDAGOGIQUE : {{formation_name}}', { size: 22, underline: { type: UnderlineType.SINGLE } })] }),
                new Paragraph({ spacing: { after: 30 }, children: [bold('Public : {{public}}')] }),
                new Paragraph({ spacing: { after: 80 }, children: [bold('Pr\u00E9 requis : {{prerequisites}}')] }),
                table,
                emptyLine(60),
                new Paragraph({ spacing: { after: 30 }, children: [bold('M\u00E9thodologie d\'\u00E9valuation : '), normal('{{evaluation}}')] }),
                new Paragraph({ spacing: { after: 30 }, children: [bold('Le + apport\u00E9 : '), normal('{{added_value}}')] }),
                new Paragraph({ children: [normal('D\u00E9lais d\'acc\u00E8s : {{access_delays}}')] }),
            ],
        }],
    });
    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(path.join(__dirname, '..', 'templates', 'fiche_peda_template.docx'), buffer);
    console.log('  fiche_peda_template.docx');
}

// ==================== 5. CONTRAT SOUS-TRAITANCE ====================
async function generateContrat() {
    const doc = new Document({
        sections: [
            {
                properties: pageProps(),
                footers: { default: njmFooter() },
                children: [
                    ...njmHeader(),
                    new Paragraph({ spacing: { before: 150, after: 150 }, alignment: AlignmentType.CENTER, children: [bold('CONTRAT DE SOUS-TRAITANCE FORMATION', { size: 28 })] }),
                    new Paragraph({ spacing: { after: 60 }, children: [bold('Entre les soussign\u00E9s :')] }),
                    new Paragraph({ spacing: { after: 30 }, children: [normal('1 \u2013 NJM Conseil, 1 Le Cassan 12330 Clairvaux d\'Aveyron, 534 935 473 000 15, organisme de formation enregistr\u00E9 sous le num\u00E9ro 73 12 00 635 12 aupr\u00E8s du Pr\u00E9fet de la r\u00E9gion Occitanie,')] }),
                    new Paragraph({ spacing: { after: 60 }, children: [normal('ci-apr\u00E8s \u00AB le donneur d\'ordre \u00BB')] }),
                    new Paragraph({ spacing: { after: 60 }, children: [bold('Et')] }),
                    new Paragraph({ spacing: { after: 30 }, children: [normal('2 \u2013 {{trainer_name}}, {{trainer_address}} {{trainer_siret}}, organisme de formation enregistr\u00E9 sous le num\u00E9ro {{trainer_nda}} aupr\u00E8s du Pr\u00E9fet de la r\u00E9gion Occitanie,')] }),
                    new Paragraph({ spacing: { after: 60 }, children: [normal('ci-apr\u00E8s \u00AB le sous-traitant \u00BB')] }),
                    new Paragraph({ spacing: { after: 80 }, children: [normal('Il a \u00E9t\u00E9 convenu ce qui suit :')] }),
                    new Paragraph({ spacing: { after: 30 }, children: [bold('Article premier : Nature du contrat')] }),
                    new Paragraph({ spacing: { after: 40 }, children: [normal('Le pr\u00E9sent contrat est conclu dans le cadre d\'une prestation de formation ponctuelle r\u00E9alis\u00E9e par le sous-traitant au b\u00E9n\u00E9fice du donneur d\'ordre.')] }),
                    new Paragraph({ spacing: { after: 30 }, children: [bold('Article 2 : Objet du contrat')] }),
                    new Paragraph({ spacing: { after: 15 }, children: [normal('La formation, objet du contrat, est la suivante : \u00AB {{formation_name}} \u00BB')] }),
                    new Paragraph({ spacing: { after: 15 }, children: [normal('Date(s) : {{dates}}')] }),
                    new Paragraph({ spacing: { after: 40 }, children: [normal('Heures : {{duration}}h')] }),
                    new Paragraph({ spacing: { after: 30 }, children: [bold('Article 3 : Dur\u00E9e du contrat')] }),
                    new Paragraph({ spacing: { after: 40 }, children: [normal('Le pr\u00E9sent contrat est strictement limit\u00E9 \u00E0 la prestation de formation vis\u00E9e \u00E0 l\'article 2. Il cesse de plein droit \u00E0 son terme.')] }),
                    new Paragraph({ spacing: { after: 30 }, children: [bold('Article 4 : Obligations du sous-traitant')] }),
                    new Paragraph({ spacing: { after: 15 }, children: [normal('Le sous-traitant s\'engage \u00E0 :')] }),
                    dashItem('Communiquer au donneur d\'ordre une copie de son extrait K-bis / de son immatriculation avant le d\u00E9but de la formation ;'),
                    dashItem('Animer la formation dans le respect des objectifs fix\u00E9s par le donneur d\'ordre ;'),
                    dashItem('Animer personnellement la formation, sauf en cas de situation exceptionnelle, et uniquement apr\u00E8s accord du donneur d\'ordre ;'),
                    dashItem('Communiquer au donneur d\'ordre ses besoins en mat\u00E9riel (projecteur, tableau, photocopies de supports...) au moins 10 jours avant le d\u00E9but de la formation ;'),
                    dashItem('Assurer l\'\u00E9valuation des stagiaires \u00E0 l\'issue de l\'action de formation, afin de permettre au donneur d\'ordre d\'\u00E9tablir les attestations de fin de formation pr\u00E9vues \u00E0 l\'article L.6353-1 du Code du travail ;'),
                    dashItem('Participer, en tant que de besoin, aux r\u00E9unions de pr\u00E9paration'),
                    dashItem('R\u00E9diger et diffuser les documents Qualiopi aupr\u00E8s du client et les transmettre au donneur d\'ordre.'),
                    dashItem('Respecter la confidentialit\u00E9 et l\'\u00E9thique li\u00E9e \u00E0 la formation'),
                    dashItem('Respecter la charte de sous traitance sign\u00E9e avec NJM Conseil'),
                    dashItem('Agir avec loyaut\u00E9 vis-\u00E0-vis de NJM Conseil'),
                ],
            },
            {
                properties: { ...pageProps(), type: SectionType.NEXT_PAGE },
                footers: { default: njmFooter() },
                children: [
                    ...njmHeader(),
                    new Paragraph({ spacing: { after: 30 }, children: [bold('Article 5 : Obligations du donneur d\'ordre')] }),
                    new Paragraph({ spacing: { after: 15 }, children: [normal('Le donneur d\'ordre s\'engage \u00E0 :')] }),
                    dashItem('Confier au sous-traitant la formation pr\u00E9vue \u00E0 l\'article 2 ;'),
                    dashItem('Prendre en charge la gestion administrative et logistique de la formation ;'),
                    dashItem('Transmettre au sous-traitant une copie des feuilles de pr\u00E9sence \u00E0 faire signer par les stagiaires ;'),
                    dashItem('Transmettre au sous-traitant une copie des questionnaires de satisfaction \u00E0 faire remplir par les stagiaires \u00E0 l\'issue de la formation'),
                    dashItem('Pr\u00E9venir le sous-traitant au moins 3 jours \u00E0 l\'avance en cas d\'annulation ou de report de la formation'),
                    emptyLine(40),
                    new Paragraph({ spacing: { after: 30 }, children: [bold('Article 6 : Modalit\u00E9s financi\u00E8res')] }),
                    new Paragraph({ spacing: { after: 15 }, children: [normal('Le sous-traitant percevra une r\u00E9mun\u00E9ration de {{price}} euros nets par journ\u00E9e de formation (7 heures) et remboursement des frais d\'h\u00E9bergement, de restauration et de d\u00E9placement.')] }),
                    new Paragraph({ spacing: { after: 40 }, children: [normal('Le paiement sera effectu\u00E9 \u00E0 r\u00E9ception de la facture.')] }),
                    new Paragraph({ spacing: { after: 30 }, children: [bold('Article 7 : Dispositions diverses')] }),
                    dashItem('Le pr\u00E9sent contrat ne cr\u00E9e entre les parties aucun lien de subordination, le sous-traitant demeurant libre et responsable du contenu de la formation ;'),
                    dashItem('Le sous-traitant d\u00E9clare avoir souscrit une police d\'assurance responsabilit\u00E9 civile professionnelle (RCP)'),
                    dashItem('Le sous-traitant dispose d\'une propri\u00E9t\u00E9 intellectuelle et/ou artistique sur le contenu de sa formation. Le donneur d\'ordre s\'engage \u00E0 ne pas reproduire ni diffuser ce contenu sans l\'accord du sous-traitant.'),
                    dashItem('Le donneur d\'ordre cr\u00E9e et facture les profils Arc En Ciel DISC. Le sous-traitant d\u00E9briefe les profils Arc En Ciel DISC.'),
                    emptyLine(60),
                    new Paragraph({ spacing: { after: 150 }, children: [normal('Fait \u00E0 Cassan, le {{signature_date}}')] }),
                    new Paragraph({
                        spacing: { after: 30 },
                        tabStops: [{ type: TabStopType.LEFT, position: convertMillimetersToTwip(100) }],
                        children: [normal('Le donneur d\'ordre,'), new TextRun({ text: '\t', size: 18, font: 'Helvetica' }), normal('Le sous-traitant,')],
                    }),
                    new Paragraph({
                        spacing: { after: 30 },
                        tabStops: [{ type: TabStopType.LEFT, position: convertMillimetersToTwip(100) }],
                        children: [bold('Nathalie JOULIE MORAND'), new TextRun({ text: '\t', size: 18, font: 'Helvetica' }), bold('{{trainer_name}}')],
                    }),
                    new Paragraph({ children: [normal('NJM Conseil')] }),
                    ...(cachetBuffer ? [new Paragraph({ spacing: { before: 40 }, children: [cachetImage(100, 70)] })] : []),
                ],
            },
        ],
    });
    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(path.join(__dirname, '..', 'templates', 'contrat_sous_traitance_template.docx'), buffer);
    console.log('  contrat_sous_traitance_template.docx');
}

// ==================== MAIN ====================
async function main() {
    console.log('Generation des templates DOCX NJM...');
    console.log('');
    await generateConvention();
    await generateAttestation();
    await generateFeuillePresence();
    await generateFichePeda();
    await generateContrat();
    console.log('');
    console.log('5 templates generes dans templates/');
}

main().catch(err => { console.error('ERREUR:', err); process.exit(1); });
