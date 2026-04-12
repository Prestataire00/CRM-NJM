/**
 * generate-fiche-pedagogique-template.js
 *
 * Generates fiche_pedagogique_template.docx using the `docx` npm library.
 * The layout reproduces the jsPDF generatePedagogicalSheet() from pdf-generator.js,
 * but with {{variable}} placeholders for docxtemplater/PizZip replacement.
 *
 * Usage:  node generate-fiche-pedagogique-template.js
 */

const fs = require("fs");
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  VerticalAlign,
  HeadingLevel,
  convertInchesToTwip,
  UnderlineType,
  TableLayoutType,
  ShadingType,
} = require("docx");

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Colors (hex, no #)
const DARK_GRAY = "333333";
const TABLE_ORANGE = "E36A3A";
const HEADER_BG = "FDF5F0"; // light warm background for header row

// Font sizes in half-points
const TITLE_SIZE = 22; // 11pt
const BODY_SIZE = 18; // 9pt
const TABLE_HEADER_SIZE = 15; // 7.5pt
const TABLE_BODY_SIZE = 14; // 7pt

// Column widths – proportional to the jsPDF values [20, 40, 65, 55] = 180 total
// We express them in DXA (twentieths of a point).  A4 = 11906 DXA wide.
// With 20mm margins each side the usable width is ~170mm = 9639 DXA.
// We distribute proportionally.
const COL_RATIOS = [20, 40, 65, 55];
const TOTAL_RATIO = COL_RATIOS.reduce((a, b) => a + b, 0);
const USABLE_WIDTH_DXA = 9639;
const COL_WIDTHS = COL_RATIOS.map((r) =>
  Math.round((r / TOTAL_RATIO) * USABLE_WIDTH_DXA)
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a standard orange border definition for table cells.
 */
function orangeBorder() {
  return {
    style: BorderStyle.SINGLE,
    size: 4, // ~0.5pt
    color: TABLE_ORANGE,
  };
}

function cellBorders() {
  return {
    top: orangeBorder(),
    bottom: orangeBorder(),
    left: orangeBorder(),
    right: orangeBorder(),
  };
}

/**
 * Build a header cell (bold, small font, warm background).
 */
function headerCell(text, widthDxa) {
  // Split text on \n so multi-line headers render correctly
  const lines = text.split("\n");
  return new TableCell({
    width: { size: widthDxa, type: WidthType.DXA },
    borders: cellBorders(),
    shading: { type: ShadingType.CLEAR, fill: HEADER_BG },
    verticalAlign: VerticalAlign.TOP,
    children: lines.map(
      (line) =>
        new Paragraph({
          spacing: { before: 20, after: 20 },
          children: [
            new TextRun({
              text: line,
              bold: true,
              size: TABLE_HEADER_SIZE,
              font: "Helvetica",
              color: DARK_GRAY,
            }),
          ],
        })
    ),
  });
}

/**
 * Build a body cell with a placeholder (normal weight).
 */
function bodyCell(text, widthDxa) {
  const lines = text.split("\n");
  return new TableCell({
    width: { size: widthDxa, type: WidthType.DXA },
    borders: cellBorders(),
    verticalAlign: VerticalAlign.TOP,
    children: lines.map(
      (line) =>
        new Paragraph({
          spacing: { before: 20, after: 20 },
          children: [
            new TextRun({
              text: line,
              size: TABLE_BODY_SIZE,
              font: "Helvetica",
              color: DARK_GRAY,
            }),
          ],
        })
    ),
  });
}

// ---------------------------------------------------------------------------
// Document construction
// ---------------------------------------------------------------------------

function buildDocument() {
  // --- Title ---
  const titleParagraph = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: [
      new TextRun({
        text: "FICHE PEDAGOGIQUE : {{formation_name}}",
        bold: true,
        underline: { type: UnderlineType.SINGLE },
        size: TITLE_SIZE,
        font: "Helvetica",
        color: DARK_GRAY,
      }),
    ],
  });

  // --- Public ---
  const publicParagraph = new Paragraph({
    spacing: { after: 80 },
    children: [
      new TextRun({
        text: "Public : {{target_audience}}",
        bold: true,
        size: BODY_SIZE,
        font: "Helvetica",
        color: DARK_GRAY,
      }),
    ],
  });

  // --- Pre requis ---
  const prerequisitesParagraph = new Paragraph({
    spacing: { after: 140 },
    children: [
      new TextRun({
        text: "Pre requis : {{prerequisites}}",
        bold: true,
        size: BODY_SIZE,
        font: "Helvetica",
        color: DARK_GRAY,
      }),
    ],
  });

  // --- Table ---
  const headers = [
    "Duree\n(en heures)",
    "Objectifs pedagogiques mesurables\n(aptitudes et competences)",
    "Contenu pedagogique\npar module",
    "Methodes, moyens et outils\npedagogiques",
  ];

  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((h, i) => headerCell(h, COL_WIDTHS[i])),
  });

  const bodyTexts = [
    "{{duration}}h\n{{number_of_days}} jour(s)",
    "{{objectives}}",
    "{{module_content}}",
    "{{methods}}",
  ];

  const dataRow = new TableRow({
    children: bodyTexts.map((t, i) => bodyCell(t, COL_WIDTHS[i])),
  });

  const table = new Table({
    rows: [headerRow, dataRow],
    width: { size: USABLE_WIDTH_DXA, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
  });

  // --- Post-table paragraphs ---

  // Methodologie d'evaluation
  const evalParagraph = new Paragraph({
    spacing: { before: 100, after: 120 },
    children: [
      new TextRun({
        text: "Methodologie d'evaluation : ",
        bold: true,
        size: BODY_SIZE,
        font: "Helvetica",
        color: DARK_GRAY,
      }),
      new TextRun({
        text: "{{evaluation_methodology}}",
        size: BODY_SIZE,
        font: "Helvetica",
        color: DARK_GRAY,
      }),
    ],
  });

  // Le + apporte
  const plusParagraph = new Paragraph({
    spacing: { after: 120 },
    children: [
      new TextRun({
        text: "Le + apporte : ",
        bold: true,
        size: BODY_SIZE,
        font: "Helvetica",
        color: DARK_GRAY,
      }),
      new TextRun({
        text: "{{added_value}}",
        size: BODY_SIZE,
        font: "Helvetica",
        color: DARK_GRAY,
      }),
    ],
  });

  // Delais d'acces
  const delaisParagraph = new Paragraph({
    spacing: { after: 120 },
    children: [
      new TextRun({
        text: "Delais d'acces : {{access_delays}}",
        size: BODY_SIZE,
        font: "Helvetica",
        color: DARK_GRAY,
      }),
    ],
  });

  // --- Assemble document ---
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(0.59), // ~15mm
              bottom: convertInchesToTwip(0.79), // ~20mm
              left: convertInchesToTwip(0.79), // ~20mm
              right: convertInchesToTwip(0.79), // ~20mm
            },
          },
        },
        children: [
          titleParagraph,
          publicParagraph,
          prerequisitesParagraph,
          table,
          evalParagraph,
          plusParagraph,
          delaisParagraph,
        ],
      },
    ],
  });

  return doc;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const doc = buildDocument();
  const buffer = await Packer.toBuffer(doc);
  const outputPath = "fiche_pedagogique_template.docx";
  fs.writeFileSync(outputPath, buffer);
  console.log(`Template written to ${outputPath}`);
}

main().catch((err) => {
  console.error("Error generating template:", err);
  process.exit(1);
});
