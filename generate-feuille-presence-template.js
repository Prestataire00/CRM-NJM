/**
 * generate-feuille-presence-template.js
 * Genere feuille_presence_template.docx avec variables {{}}
 * Usage: node generate-feuille-presence-template.js
 */
const {
    Document, Packer, Paragraph, TextRun, AlignmentType,
    Table, TableRow, TableCell, TableBorders, BorderStyle,
    WidthType, convertMillimetersToTwip, VerticalAlign
} = require('docx');
const fs = require('fs');

const ORANGE = 'E36A3A';
const PINK = 'E91E8C';
const DARK_GRAY = '333333';

function normal(text, opts = {}) {
    return new TextRun({ text, size: opts.size || 16, font: 'Helvetica', color: opts.color || DARK_GRAY, ...opts });
}
function bold(text, opts = {}) {
    return new TextRun({ text, bold: true, size: opts.size || 16, font: 'Helvetica', color: opts.color || DARK_GRAY, ...opts });
}

const pinkBorder = {
    top: { style: BorderStyle.SINGLE, size: 4, color: PINK },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: PINK },
    left: { style: BorderStyle.SINGLE, size: 4, color: PINK },
    right: { style: BorderStyle.SINGLE, size: 4, color: PINK },
};

function headerCell(text, width) {
    return new TableCell({
        width: { size: width, type: WidthType.DXA },
        borders: pinkBorder,
        verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({
            children: [bold(text, { size: 16 })],
        })],
    });
}

function emptyCell(width) {
    return new TableCell({
        width: { size: width, type: WidthType.DXA },
        borders: pinkBorder,
        verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({ children: [normal(' ')] })],
    });
}

function learnerRow(name, hours) {
    const w = [2550, 1985, 1985, 2550];
    return new TableRow({
        height: { value: convertMillimetersToTwip(14), rule: 'atLeast' },
        children: [
            new TableCell({
                width: { size: w[0], type: WidthType.DXA },
                borders: pinkBorder,
                verticalAlign: VerticalAlign.CENTER,
                children: [new Paragraph({ children: [normal(name)] })],
            }),
            emptyCell(w[1]),
            emptyCell(w[2]),
            new TableCell({
                width: { size: w[3], type: WidthType.DXA },
                borders: pinkBorder,
                verticalAlign: VerticalAlign.CENTER,
                children: [new Paragraph({ children: [normal(hours)] })],
            }),
        ],
    });
}

async function generate() {
    const colW = [2550, 1985, 1985, 2550];
    const totalW = colW.reduce((a, b) => a + b, 0);

    const table = new Table({
        width: { size: totalW, type: WidthType.DXA },
        rows: [
            // Header row
            new TableRow({
                height: { value: convertMillimetersToTwip(12), rule: 'atLeast' },
                children: [
                    headerCell('NOM et prenom de\nl\'apprenant', colW[0]),
                    headerCell('Matin\n9h00 a 12h30', colW[1]),
                    headerCell('Apres-midi\n14h00 a 17h30', colW[2]),
                    headerCell('Nombre d\'heures par\napprenant', colW[3]),
                ],
            }),
            // Learner rows — {{learners_rows}} will be replaced by the CRM
            // For the template, put placeholder rows
            learnerRow('{{learner_1}}', '{{hours_1}}'),
            learnerRow('{{learner_2}}', '{{hours_2}}'),
            learnerRow('{{learner_3}}', '{{hours_3}}'),
            learnerRow('{{learner_4}}', '{{hours_4}}'),
            learnerRow('{{learner_5}}', '{{hours_5}}'),
            learnerRow('{{learner_6}}', '{{hours_6}}'),
            // Signature row
            new TableRow({
                height: { value: convertMillimetersToTwip(30), rule: 'atLeast' },
                children: [
                    new TableCell({
                        width: { size: totalW, type: WidthType.DXA },
                        columnSpan: 4,
                        borders: pinkBorder,
                        children: [
                            new Paragraph({ spacing: { before: 60 }, children: [bold('Nathalie JOULIE-MORAND')] }),
                            new Paragraph({ children: [bold('Formatrice')] }),
                        ],
                    }),
                ],
            }),
        ],
    });

    const doc = new Document({
        sections: [{
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
                // Title
                new Paragraph({
                    spacing: { before: 400, after: 300 },
                    alignment: AlignmentType.CENTER,
                    children: [bold('FORMATION : {{formation_name}}', { size: 26, color: ORANGE })],
                }),

                // Date + Lieu
                new Paragraph({
                    spacing: { after: 60 },
                    children: [normal('Feuille de presence- Date {{attendance_date}}', { size: 20 })],
                }),
                new Paragraph({
                    spacing: { after: 120 },
                    children: [normal('Lieu de la formation : {{training_location}}', { size: 20 })],
                }),

                // Table
                table,

                // Reglement interieur
                new Paragraph({
                    spacing: { before: 200 },
                    children: [normal('J\'atteste avoir pris connaissance du reglement interieur de NJM Conseil.', { size: 16 })],
                }),
            ],
        }],
    });

    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync('feuille_presence_template.docx', buffer);
    console.log('feuille_presence_template.docx genere !');
    console.log('Variables: {{formation_name}}, {{attendance_date}}, {{training_location}}');
    console.log('  {{learner_1}}..{{learner_6}}, {{hours_1}}..{{hours_6}}');
}

generate().catch(err => { console.error(err); process.exit(1); });
