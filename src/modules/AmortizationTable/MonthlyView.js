/**
 * @file AmortizationTable/MonthlyView.js
 * @description Vista mensual detallada de la tabla de amortización.
 *              Muestra 12 filas por página (1 año) con paginación completa.
 *              Función pura — sin estado, sin DOM.
 *
 * @version 1.0.0
 * @updated 2026-05-26
 */

import { formatCOP, formatInstallment } from '../../utils/formatters.js';

/** Filas visibles por página (1 año = 12 meses) */
export const ROWS_PER_PAGE = 12;

/**
 * Genera el HTML de una página de la vista mensual.
 *
 * @param {import('../../calculators/amortization.js').AmortizationRow[]} pageRows
 *        Las 12 filas (o menos en la última página) de esta página
 * @param {Object} pagination
 * @param {number} pagination.currentPage  - Página actual (0-based)
 * @param {number} pagination.totalPages   - Total de páginas
 * @param {number} pagination.totalMonths  - Total de meses del crédito
 * @returns {string} HTML completo de la vista mensual para esta página
 */
export function renderMonthlyView(pageRows, pagination) {
  if (!pageRows?.length) {
    return '<p class="amt-empty">No hay datos disponibles para esta página.</p>';
  }

  const { currentPage, totalPages, totalMonths } = pagination;
  const firstMonth = currentPage * ROWS_PER_PAGE + 1;
  const lastMonth  = Math.min(firstMonth + pageRows.length - 1, totalMonths);

  // Filas de la tabla
  const rows = pageRows.map((row, i) => {
    const isAlternate = i % 2 === 1;
    const isLast      = row.month === totalMonths;
    const cssRow      = `amt-row${isAlternate ? ' amt-row--alt' : ''}${isLast ? ' amt-row--last' : ''}`;

    return `
      <tr class="${cssRow}" data-month="${row.month}">
        <td class="amt-cell amt-cell--month">
          ${formatInstallment(row.month, totalMonths)}
        </td>
        <td class="amt-cell amt-cell--num">${formatCOP(row.payment)}</td>
        <td class="amt-cell amt-cell--num amt-cell--interest">${formatCOP(row.interest)}</td>
        <td class="amt-cell amt-cell--num amt-cell--capital">${formatCOP(row.principal)}</td>
        <td class="amt-cell amt-cell--num amt-cell--balance">${formatCOP(row.balance)}</td>
      </tr>`.trim();
  }).join('');

  // Controles de paginación
  const prevDisabled = currentPage === 0 ? ' disabled' : '';
  const nextDisabled = currentPage >= totalPages - 1 ? ' disabled' : '';

  // Botones de salto por año
  const yearButtons = Array.from({ length: totalPages }, (_, i) => {
    const year    = i + 1;
    const isCurrent = i === currentPage;
    return `<button class="amt-page-btn${isCurrent ? ' amt-page-btn--active' : ''}"
              data-page="${i}"
              aria-label="Ir al año ${year}"
              aria-current="${isCurrent ? 'true' : 'false'}"
              ${isCurrent ? 'disabled' : ''}>
              ${year}
            </button>`;
  }).join('');

  return `
    <div class="amt-monthly-wrap">
      <table class="amt-table" role="grid" aria-label="Tabla de amortización mensual">
        <thead class="amt-thead">
          <tr>
            <th class="amt-th">Cuota #</th>
            <th class="amt-th amt-th--num">Cuota fija</th>
            <th class="amt-th amt-th--num">Intereses</th>
            <th class="amt-th amt-th--num">Capital</th>
            <th class="amt-th amt-th--num">Saldo</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <div class="amt-pagination" role="navigation" aria-label="Paginación de la tabla">
        <div class="amt-pagination-nav">
          <button class="amt-nav-btn"
                  data-action="prev"
                  aria-label="Año anterior"
                  ${prevDisabled}>← Año anterior</button>

          <span class="amt-pagination-info">
            Cuotas <strong>${firstMonth}–${lastMonth}</strong> de ${totalMonths}
            <span class="amt-pagination-year">(Año ${currentPage + 1} de ${totalPages})</span>
          </span>

          <button class="amt-nav-btn"
                  data-action="next"
                  aria-label="Año siguiente"
                  ${nextDisabled}>Año siguiente →</button>
        </div>

        <div class="amt-year-nav" role="group" aria-label="Saltar al año">
          <span class="amt-year-label">Ir al año:</span>
          <div class="amt-year-buttons">${yearButtons}</div>
        </div>
      </div>
    </div>`.trim();
}