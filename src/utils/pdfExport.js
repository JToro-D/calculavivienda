/**
 * @file pdfExport.js
 * @description Exportación de la simulación hipotecaria a PDF.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ARQUITECTURA
 * ─────────────────────────────────────────────────────────────────────────────
 * Dos capas bien separadas:
 *
 *   1. DATOS (puras, testeables en Node.js)
 *      buildPDFContent(params) → objeto con todo el contenido formateado
 *      formatSummaryRows(...)  → filas del resumen
 *      formatBankRows(...)     → filas de la tabla de bancos
 *      formatAnnualRows(...)   → filas de la tabla de amortización
 *
 *   2. GENERACIÓN (browser-only, requiere jsPDF del CDN)
 *      generateAmortizationPDF(params) → descarga el archivo .pdf
 *      isPDFReady()            → verifica que jsPDF esté disponible
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SETUP REQUERIDO EN index.html
 * ─────────────────────────────────────────────────────────────────────────────
 * Agregar antes de app.js:
 *
 *   <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js">
 *   </script>
 *
 * jsPDF UMD expone: window.jspdf.jsPDF
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CONTENIDO DEL PDF
 * ─────────────────────────────────────────────────────────────────────────────
 *   Página 1: Encabezado + Resumen del crédito + Comparación de bancos
 *   Página 2+: Tabla de amortización anual (30 filas, una por año)
 *   Última línea: Disclaimer legal
 *
 * @version 1.0.0
 * @updated 2026-05-26
 * @author  Arquitecto — calculavivienda.com.co
 */

import {
  formatCOP, formatMillions, formatRate, formatMonths,
  formatDate, formatPct, formatMonthlyRate,
} from './formatters.js';
import { PROJECT } from '../config/constants.js';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES DE LAYOUT (milímetros, A4 portrait)
// ─────────────────────────────────────────────────────────────────────────────

const PAGE = Object.freeze({ W: 210, H: 297 });
const M    = Object.freeze({ T: 18, B: 18, L: 14, R: 14 });
const CW   = PAGE.W - M.L - M.R; // Content Width: 182mm

/** Alturas de fila en mm */
const ROW_H = Object.freeze({ HEADER: 7, DATA: 5.5, SUMMARY: 6 });

/** Colores RGB */
const COLOR = Object.freeze({
  NAVY:       [10, 37, 64],
  GREEN:      [0, 98, 65],
  GREEN_LIGHT:[0, 130, 85],
  GRAY_DARK:  [80, 80, 80],
  GRAY_MED:   [160, 160, 160],
  GRAY_LIGHT: [240, 242, 244],
  GRAY_ROWS:  [250, 251, 252],
  WHITE:      [255, 255, 255],
  BLACK:      [0, 0, 0],
  RED_SOFT:   [180, 50, 50],
});

/** Anchos de columna para la tabla de bancos (suma = CW = 182mm) */
const BANK_COLS = [42, 22, 38, 40, 40]; // Banco, Tasa, Cuota, Intereses, Total

/** Anchos de columna para la tabla de amortización anual (suma = CW = 182mm) */
const AMORT_COLS = [14, 42, 42, 42, 42]; // Año, Cuotas, Intereses, Capital, Saldo

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS (JSDoc)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} PDFContent
 * @property {string}   title         - Título del documento
 * @property {string}   generatedAt   - Fecha de generación formateada
 * @property {Array}    summaryRows   - Filas del resumen del crédito
 * @property {Object}   bankTable     - Datos de la tabla de bancos
 * @property {Object}   amortTable    - Datos de la tabla de amortización
 * @property {string}   disclaimer    - Texto del disclaimer legal
 * @property {string}   filename      - Nombre sugerido del archivo
 */

// ─────────────────────────────────────────────────────────────────────────────
// CAPA 1 — PREPARACIÓN DE DATOS (puras, testeables)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Construye el objeto de contenido del PDF.
 * Función pura: no accede a jsPDF ni al DOM. Totalmente testeable en Node.js.
 *
 * @param {Object}  params
 * @param {Object}  params.simulatorInputs       - Inputs del usuario
 * @param {number}  params.simulatorInputs.propertyValueCOP
 * @param {number}  params.simulatorInputs.downPaymentPct  - Decimal (ej: 0.30)
 * @param {number}  params.simulatorInputs.termMonths
 * @param {Object}  params.simulatorInputs.selectedBank    - Objeto banco de banks.js
 * @param {Object}  params.amortizationTable - Resultado de calcAmortizationTable()
 * @param {Array}   params.annualSummary     - Resultado de calcAnnualSummary()
 * @param {Array}   [params.bankComparisons] - [{bank, summary}] para el comparador
 * @param {string}  [params.generatedAt]     - Fecha ISO (default: hoy)
 * @returns {PDFContent | null}
 */
export function buildPDFContent({
  simulatorInputs,
  amortizationTable,
  annualSummary,
  bankComparisons = [],
  generatedAt,
}) {
  if (!simulatorInputs || !amortizationTable || !annualSummary) return null;

  const {
    propertyValueCOP,
    downPaymentPct,
    termMonths,
    selectedBank,
  } = simulatorInputs;

  const loanAmount   = propertyValueCOP * (1 - downPaymentPct);
  const downPayment  = propertyValueCOP * downPaymentPct;
  const dateStr      = generatedAt
    ? formatDate(generatedAt)
    : formatDate(new Date().toISOString().split('T')[0]);

  // ── Filas del resumen ─────────────────────────────────────────────────────
  const summaryRows = formatSummaryRows({
    propertyValueCOP,
    downPayment,
    downPaymentPct,
    loanAmount,
    termMonths,
    selectedBank,
    amortizationTable,
  });

  // ── Tabla de bancos ───────────────────────────────────────────────────────
  const bankTable = {
    headers: ['Banco', 'Tasa EA', 'Cuota/mes', 'Total intereses', 'Total pagado'],
    rows:    formatBankRows(bankComparisons, loanAmount, termMonths),
    highlightBankId: selectedBank?.id ?? null,
  };

  // ── Tabla de amortización anual ───────────────────────────────────────────
  const amortTable = {
    headers: ['Año', 'Cuotas pagadas', 'Intereses del año', 'Capital del año', 'Saldo restante'],
    rows:    formatAnnualRows(annualSummary),
    totals:  [
      'Total',
      formatCOP(amortizationTable.totalPaid),
      formatCOP(amortizationTable.totalInterest),
      formatCOP(amortizationTable.totalPrincipal),
      '$0',
    ],
  };

  const bankName  = selectedBank?.name ?? 'Seleccionado';
  const termYears = Math.round(termMonths / 12);

  return {
    title:        `${PROJECT.name} — Simulación Hipotecaria`,
    generatedAt:  dateStr,
    summaryRows,
    bankTable,
    amortTable,
    disclaimer:   PROJECT.disclaimer,
    filename:     `simulacion-hipotecaria-${termYears}a-${bankName.toLowerCase().replace(/\s+/g, '-')}.pdf`,
  };
}

/**
 * Formatea las filas del resumen del crédito.
 * @returns {{ label: string, value: string, highlight?: boolean }[]}
 */
export function formatSummaryRows({
  propertyValueCOP,
  downPayment,
  downPaymentPct,
  loanAmount,
  termMonths,
  selectedBank,
  amortizationTable,
}) {
  return [
    { label: 'Valor del inmueble',
      value: formatCOP(propertyValueCOP) },
    { label: `Cuota inicial (${formatPct(downPaymentPct * 100, 0)})`,
      value: formatCOP(downPayment) },
    { label: 'Monto financiado',
      value: formatCOP(loanAmount) },
    { label: 'Banco',
      value: selectedBank?.name ?? '—' },
    { label: 'Tasa efectiva anual',
      value: formatRate(selectedBank?.rateNoVIS?.reference ?? 0) },
    { label: 'Tasa mensual equivalente',
      value: formatMonthlyRate(amortizationTable.monthlyRate) },
    { label: 'Plazo',
      value: formatMonths(termMonths) },
    { label: 'Cuota mensual fija',
      value: formatCOP(amortizationTable.payment),
      highlight: true },
    { label: 'Total intereses',
      value: formatCOP(amortizationTable.totalInterest),
      highlight: true },
    { label: 'Total a pagar',
      value: formatCOP(amortizationTable.totalPaid),
      highlight: true },
  ];
}

/**
 * Formatea las filas de la tabla de comparación de bancos.
 * @param {Array} bankComparisons - [{bank: Bank, summary: AmortizationSummary}]
 * @returns {string[][]}
 */
export function formatBankRows(bankComparisons) {
  if (!Array.isArray(bankComparisons) || bankComparisons.length === 0) return [];

  return bankComparisons.map(({ bank, summary }) => [
    bank.shortName ?? bank.name,
    formatRate(bank.rateNoVIS?.reference ?? 0),
    formatCOP(summary.payment),
    formatMillions(summary.totalInterest),
    formatMillions(summary.totalPaid),
  ]);
}

/**
 * Formatea las filas de la tabla de amortización anual.
 * @param {import('../calculators/amortization.js').AnnualSummaryRow[]} annualSummary
 * @returns {string[][]}
 */
export function formatAnnualRows(annualSummary) {
  if (!Array.isArray(annualSummary)) return [];

  return annualSummary.map(row => [
    String(row.year),
    formatCOP(row.totalPayment),
    formatCOP(row.totalInterest),
    formatCOP(row.totalPrincipal),
    formatCOP(row.endingBalance),
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// CAPA 2 — GENERACIÓN PDF (browser-only, requiere jsPDF en window)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Obtiene el constructor jsPDF desde window.
 * jsPDF UMD CDN lo expone en window.jspdf.jsPDF
 * @returns {Function | null}
 */
function _getJsPDF() {
  if (typeof window === 'undefined') return null;
  return window.jspdf?.jsPDF ?? window.jsPDF ?? null;
}

/**
 * Verifica si jsPDF está disponible en el navegador.
 * Llamar antes de mostrar el botón de descarga.
 *
 * @returns {boolean}
 *
 * @example
 * if (!isPDFReady()) {
 *   console.warn('jsPDF no está cargado. Verifica el script en index.html.');
 * }
 */
export function isPDFReady() {
  return _getJsPDF() !== null;
}

// ── Helpers de dibujo (privados) ──────────────────────────────────────────

/**
 * Administra el salto de página automáticamente.
 * Modifica state.y si hay un salto de página.
 */
function _checkPageBreak(doc, state, neededMM) {
  if (state.y + neededMM > PAGE.H - M.B) {
    doc.addPage();
    state.y = M.T;
    state.page += 1;
  }
}

/**
 * Dibuja una celda de tabla con fondo, borde y texto.
 */
function _drawCell(doc, x, y, w, h, text, opts = {}) {
  const {
    fillColor  = COLOR.WHITE,
    textColor  = COLOR.BLACK,
    align      = 'left',
    fontSize   = 8,
    bold       = false,
    borderColor = COLOR.GRAY_MED,
  } = opts;

  doc.setFillColor(...fillColor);
  doc.setDrawColor(...borderColor);
  doc.setLineWidth(0.1);
  doc.rect(x, y, w, h, 'FD');

  doc.setTextColor(...textColor);
  doc.setFontSize(fontSize);
  doc.setFont('helvetica', bold ? 'bold' : 'normal');

  const padding = 1.5;
  let tx = x + padding;
  if (align === 'right')  tx = x + w - padding;
  if (align === 'center') tx = x + w / 2;

  // Clip text to cell width
  const maxWidth = w - padding * 2;
  doc.text(String(text ?? ''), tx, y + h - 1.8, { align, maxWidth });
}

/**
 * Dibuja una fila completa de una tabla dada la definición de columnas.
 */
function _drawRow(doc, startX, y, colWidths, cells, opts = {}) {
  let x = startX;
  cells.forEach((cell, i) => {
    _drawCell(doc, x, y, colWidths[i], opts.rowH ?? ROW_H.DATA, cell, {
      ...opts,
      align: i === 0 ? 'left' : 'right',
    });
    x += colWidths[i];
  });
}

/**
 * Dibuja la cabecera del documento.
 */
function _drawHeader(doc, state) {
  // Barra de color superior
  doc.setFillColor(...COLOR.NAVY);
  doc.rect(0, 0, PAGE.W, 14, 'F');

  doc.setTextColor(...COLOR.WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(PROJECT.name, M.L, 9);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Simulador hipotecario neutral · Colombia 2026', M.L, 13);

  // Fecha generación (derecha)
  doc.setFontSize(7);
  const dateLabel = `Generado el ${state.date}`;
  doc.text(dateLabel, PAGE.W - M.R, 9, { align: 'right' });
  doc.text(PROJECT.domain, PAGE.W - M.R, 13, { align: 'right' });

  state.y = 20;
}

/**
 * Dibuja el título de una sección.
 */
function _drawSectionTitle(doc, state, title) {
  _checkPageBreak(doc, state, 10);

  doc.setFillColor(...COLOR.GREEN);
  doc.rect(M.L, state.y, CW, 6, 'F');
  doc.setTextColor(...COLOR.WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(title, M.L + 2, state.y + 4.2);

  state.y += 6;
}

/**
 * Dibuja la sección de resumen en dos columnas.
 */
function _drawSummary(doc, state, summaryRows) {
  _drawSectionTitle(doc, state, 'RESUMEN DEL CRÉDITO');

  const colW    = CW / 2 - 1;
  const rowH    = ROW_H.SUMMARY;
  const halfLen = Math.ceil(summaryRows.length / 2);

  for (let i = 0; i < halfLen; i++) {
    const leftRow  = summaryRows[i];
    const rightRow = summaryRows[i + halfLen];

    _checkPageBreak(doc, state, rowH);

    // Columna izquierda — etiqueta
    doc.setFillColor(...COLOR.GRAY_LIGHT);
    doc.setDrawColor(...COLOR.GRAY_MED);
    doc.setLineWidth(0.1);
    doc.rect(M.L, state.y, colW * 0.52, rowH, 'FD');
    doc.setTextColor(...COLOR.GRAY_DARK);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(leftRow.label, M.L + 1.5, state.y + rowH - 1.8);

    // Columna izquierda — valor
    doc.setFillColor(...COLOR.WHITE);
    doc.rect(M.L + colW * 0.52, state.y, colW * 0.48, rowH, 'FD');
    doc.setTextColor(leftRow.highlight ? COLOR.GREEN[0] : COLOR.BLACK[0],
                     leftRow.highlight ? COLOR.GREEN[1] : COLOR.BLACK[1],
                     leftRow.highlight ? COLOR.GREEN[2] : COLOR.BLACK[2]);
    doc.setFont('helvetica', leftRow.highlight ? 'bold' : 'normal');
    doc.setFontSize(leftRow.highlight ? 8 : 7.5);
    doc.text(leftRow.value, M.L + colW - 1.5, state.y + rowH - 1.8, { align: 'right' });

    if (rightRow) {
      const rx = M.L + colW + 2;
      // Derecha — etiqueta
      doc.setFillColor(...COLOR.GRAY_LIGHT);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...COLOR.GRAY_DARK);
      doc.rect(rx, state.y, colW * 0.52, rowH, 'FD');
      doc.text(rightRow.label, rx + 1.5, state.y + rowH - 1.8);

      // Derecha — valor
      doc.setFillColor(...COLOR.WHITE);
      doc.rect(rx + colW * 0.52, state.y, colW * 0.48, rowH, 'FD');
      doc.setTextColor(rightRow.highlight ? COLOR.GREEN[0] : COLOR.BLACK[0],
                       rightRow.highlight ? COLOR.GREEN[1] : COLOR.BLACK[1],
                       rightRow.highlight ? COLOR.GREEN[2] : COLOR.BLACK[2]);
      doc.setFont('helvetica', rightRow.highlight ? 'bold' : 'normal');
      doc.setFontSize(rightRow.highlight ? 8 : 7.5);
      doc.text(rightRow.value, rx + colW - 1.5, state.y + rowH - 1.8, { align: 'right' });
    }

    state.y += rowH;
  }
  state.y += 3;
}

/**
 * Dibuja una tabla genérica con encabezado, filas de datos y fila de totales opcional.
 */
function _drawTable(doc, state, { headers, rows, totals, colWidths, highlightRowIndex }) {
  _checkPageBreak(doc, state, ROW_H.HEADER + ROW_H.DATA);

  // Fila de encabezado
  let x = M.L;
  headers.forEach((header, i) => {
    _drawCell(doc, x, state.y, colWidths[i], ROW_H.HEADER, header, {
      fillColor:  COLOR.NAVY,
      textColor:  COLOR.WHITE,
      bold:       true,
      fontSize:   8,
      align:      i === 0 ? 'left' : 'right',
      borderColor: COLOR.NAVY,
    });
    x += colWidths[i];
  });
  state.y += ROW_H.HEADER;

  // Filas de datos
  rows.forEach((row, rowIdx) => {
    _checkPageBreak(doc, state, ROW_H.DATA);

    const isHighlighted = rowIdx === highlightRowIndex;
    const isAlternate   = rowIdx % 2 === 1;
    const fillColor     = isHighlighted ? [235, 248, 241]
                        : isAlternate   ? COLOR.GRAY_ROWS
                        : COLOR.WHITE;

    let rx = M.L;
    row.forEach((cell, i) => {
      _drawCell(doc, rx, state.y, colWidths[i], ROW_H.DATA, cell, {
        fillColor,
        textColor:  isHighlighted && i > 0 ? COLOR.GREEN : COLOR.BLACK,
        bold:       isHighlighted,
        fontSize:   7.5,
        align:      i === 0 ? 'left' : 'right',
      });
      rx += colWidths[i];
    });
    state.y += ROW_H.DATA;
  });

  // Fila de totales
  if (totals && totals.length) {
    _checkPageBreak(doc, state, ROW_H.DATA + 1);
    let tx = M.L;
    totals.forEach((cell, i) => {
      _drawCell(doc, tx, state.y, colWidths[i], ROW_H.DATA + 0.5, cell, {
        fillColor:  COLOR.NAVY,
        textColor:  COLOR.WHITE,
        bold:       true,
        fontSize:   8,
        align:      i === 0 ? 'left' : 'right',
        borderColor: COLOR.NAVY,
      });
      tx += colWidths[i];
    });
    state.y += ROW_H.DATA + 0.5;
  }

  state.y += 3;
}

/**
 * Dibuja el pie de página con número de página y disclaimer.
 */
function _drawPageFooters(doc, totalPages, disclaimer) {
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);

    // Línea separadora
    doc.setDrawColor(...COLOR.GRAY_MED);
    doc.setLineWidth(0.3);
    doc.line(M.L, PAGE.H - M.B + 2, PAGE.W - M.R, PAGE.H - M.B + 2);

    // Número de página
    doc.setTextColor(...COLOR.GRAY_DARK);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(`Página ${p} de ${totalPages}`, PAGE.W - M.R, PAGE.H - M.B + 6, { align: 'right' });

    // Disclaimer (solo en última página)
    if (p === totalPages) {
      doc.setFontSize(6.5);
      doc.setTextColor(...COLOR.GRAY_DARK);
      const lines = doc.splitTextToSize(disclaimer, CW);
      doc.text(lines, M.L, PAGE.H - M.B + 6);
    } else {
      doc.setFontSize(6.5);
      doc.text(PROJECT.domain, M.L, PAGE.H - M.B + 6);
    }
  }
}

/**
 * Genera y descarga el PDF de la simulación hipotecaria.
 *
 * BROWSER ONLY — Requiere jsPDF cargado desde CDN en index.html.
 *
 * @param {Object} params - Mismos parámetros que buildPDFContent()
 * @returns {{ success: boolean, error?: string }}
 *
 * @example
 * const result = await generateAmortizationPDF({
 *   simulatorInputs: { propertyValueCOP: 300e6, downPaymentPct: 0.30,
 *                      termMonths: 240, selectedBank: bancolombia },
 *   amortizationTable: table,
 *   annualSummary: annual,
 *   bankComparisons: comparisons,
 * });
 * if (!result.success) console.error(result.error);
 */
export function generateAmortizationPDF(params) {
  const JsPDF = _getJsPDF();
  if (!JsPDF) {
    return {
      success: false,
      error:   'jsPDF no está disponible. Verifica el script en index.html: ' +
               'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    };
  }

  const content = buildPDFContent(params);
  if (!content) {
    return { success: false, error: 'No se pudo construir el contenido del PDF. Verifica los datos.' };
  }

  try {
    const doc   = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const state = { y: M.T, page: 1, date: content.generatedAt };

    // ── Página 1 ─────────────────────────────────────────────────────────
    _drawHeader(doc, state);
    state.y += 2;

    // Resumen
    _drawSummary(doc, state, content.summaryRows);

    // Tabla de bancos
    if (content.bankTable.rows.length > 0) {
      _drawSectionTitle(doc, state, 'COMPARACIÓN DE BANCOS');

      // Encontrar el banco seleccionado para resaltarlo
      const highlightIdx = content.bankTable.rows.findIndex(
        (_, i) => params.bankComparisons?.[i]?.bank?.id === content.bankTable.highlightBankId
      );

      _drawTable(doc, state, {
        headers:          content.bankTable.headers,
        rows:             content.bankTable.rows,
        colWidths:        BANK_COLS,
        highlightRowIndex: highlightIdx >= 0 ? highlightIdx : undefined,
      });
    }

    // ── Tabla de amortización (puede ocupar múltiples páginas) ────────────
    _drawSectionTitle(doc, state, 'TABLA DE AMORTIZACIÓN ANUAL');
    _drawTable(doc, state, {
      headers:   content.amortTable.headers,
      rows:      content.amortTable.rows,
      totals:    content.amortTable.totals,
      colWidths: AMORT_COLS,
    });

    // ── Pies de página en todas las páginas ───────────────────────────────
    _drawPageFooters(doc, doc.getNumberOfPages(), content.disclaimer);

    // ── Descargar ─────────────────────────────────────────────────────────
    doc.save(content.filename);

    return { success: true };

  } catch (error) {
    return {
      success: false,
      error:   `Error al generar el PDF: ${error.message}. Intenta de nuevo.`,
    };
  }
}