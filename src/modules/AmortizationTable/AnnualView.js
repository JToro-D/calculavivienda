/**
 * @file AmortizationTable/AnnualView.js
 * @description Vista de resumen anual de la tabla de amortización.
 *              Muestra una fila por año con los totales del período.
 *              Función pura — sin estado, sin DOM.
 *
 * @version 1.0.0
 * @updated 2026-05-26
 */

import { formatCOP, formatPct } from '../../utils/formatters.js';

/**
 * Genera el HTML de la vista de resumen anual.
 *
 * @param {import('../../calculators/amortization.js').AnnualSummaryRow[]} annualSummary
 * @param {Object}  opts
 * @param {number}  [opts.highlightYear]   - Año a resaltar (1-based)
 * @param {boolean} [opts.showInterestBar] - Mostrar barra visual de % interés
 * @returns {string} HTML completo de la tabla anual
 */
export function renderAnnualView(annualSummary, opts = {}) {
  if (!annualSummary?.length) {
    return '<p class="amt-empty">No hay datos de amortización disponibles.</p>';
  }

  const { highlightYear, showInterestBar = true } = opts;

  const rows = annualSummary.map(row => {
    const isHighlight = row.year === highlightYear;
    const barWidth    = Math.min(100, Math.max(0, row.interestPct)).toFixed(1);
    const barColor    = row.interestPct > 60 ? '#DC2626' : row.interestPct > 30 ? '#D97706' : '#16A34A';

    const interestCell = showInterestBar
      ? `<div class="amt-bar-wrap" title="${formatPct(row.interestPct, 1)} va a intereses">
           <div class="amt-bar" style="width:${barWidth}%;background:${barColor}"></div>
           <span class="amt-bar-label">${formatPct(row.interestPct, 0)}</span>
         </div>`
      : formatPct(row.interestPct, 1);

    return `
      <tr class="amt-row${isHighlight ? ' amt-row--highlight' : ''}" data-year="${row.year}">
        <td class="amt-cell amt-cell--year">
          <strong>Año ${row.year}</strong>
        </td>
        <td class="amt-cell amt-cell--num">${formatCOP(row.totalPayment)}</td>
        <td class="amt-cell amt-cell--num amt-cell--interest">${formatCOP(row.totalInterest)}</td>
        <td class="amt-cell amt-cell--num amt-cell--capital">${formatCOP(row.totalPrincipal)}</td>
        <td class="amt-cell amt-cell--num amt-cell--balance">${formatCOP(row.endingBalance)}</td>
        <td class="amt-cell amt-cell--pct">${interestCell}</td>
      </tr>`.trim();
  }).join('');

  // Totales
  const totalPayment   = annualSummary.reduce((s, r) => s + r.totalPayment, 0);
  const totalInterest  = annualSummary.reduce((s, r) => s + r.totalInterest, 0);
  const totalPrincipal = annualSummary.reduce((s, r) => s + r.totalPrincipal, 0);
  const avgInterestPct = totalPayment > 0 ? (totalInterest / totalPayment) * 100 : 0;

  return `
    <table class="amt-table" role="grid" aria-label="Resumen anual de amortización">
      <thead class="amt-thead">
        <tr>
          <th class="amt-th">Año</th>
          <th class="amt-th amt-th--num">Cuotas del año</th>
          <th class="amt-th amt-th--num">Intereses</th>
          <th class="amt-th amt-th--num">Capital</th>
          <th class="amt-th amt-th--num">Saldo restante</th>
          <th class="amt-th amt-th--pct" title="Porcentaje del pago anual que va a intereses">% a interés</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr class="amt-row amt-row--total">
          <td class="amt-cell amt-cell--year"><strong>Total</strong></td>
          <td class="amt-cell amt-cell--num"><strong>${formatCOP(totalPayment)}</strong></td>
          <td class="amt-cell amt-cell--num amt-cell--interest"><strong>${formatCOP(totalInterest)}</strong></td>
          <td class="amt-cell amt-cell--num amt-cell--capital"><strong>${formatCOP(totalPrincipal)}</strong></td>
          <td class="amt-cell amt-cell--num">$0</td>
          <td class="amt-cell amt-cell--pct">${formatPct(avgInterestPct, 0)} prom.</td>
        </tr>
      </tfoot>
    </table>`.trim();
}