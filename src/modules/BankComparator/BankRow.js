/**
 * @file BankComparator/BankRow.js
 * @description Genera el HTML de una fila del comparador multi-banco.
 *              Función pura: mismos inputs → mismo HTML. Sin estado, sin DOM.
 *
 * @version 1.0.0
 * @updated 2026-05-26
 */

import { formatCOP, formatMillions, formatRate } from '../../utils/formatters.js';

/**
 * Genera el HTML de una fila del comparador de bancos.
 *
 * @param {Object}  bank           - Objeto banco de banks.js
 * @param {Object}  summary        - Resultado de calcAmortizationSummary()
 * @param {Object}  opts
 * @param {boolean} opts.isSelected  - Fila del banco actualmente seleccionado
 * @param {boolean} opts.isCheapest  - Banco con tasa más baja (resaltado especial)
 * @param {number}  opts.savingVsCurrent - Diferencia de cuota vs banco seleccionado (COP)
 * @returns {string} HTML de la fila <tr>
 */
export function renderBankRow(bank, summary, { isSelected = false, isCheapest = false, savingVsCurrent = 0 } = {}) {
  const cssSelected  = isSelected  ? ' bcp-row--selected'  : '';
  const cssCheapest  = isCheapest  ? ' bcp-row--cheapest'  : '';

  const savingLabel = !isSelected && Math.abs(savingVsCurrent) > 100
    ? savingVsCurrent > 0
      ? `<span class="bcp-saving bcp-saving--expensive">+${formatCOP(savingVsCurrent)}/mes</span>`
      : `<span class="bcp-saving bcp-saving--cheaper">${formatCOP(savingVsCurrent)}/mes</span>`
    : '';

  const badge = isCheapest
    ? '<span class="bcp-badge bcp-badge--cheapest">Mejor tasa</span>'
    : isSelected
      ? '<span class="bcp-badge bcp-badge--selected">Seleccionado</span>'
      : '';

  return `
    <tr class="bcp-row${cssSelected}${cssCheapest}"
        data-bank-id="${bank.id}"
        role="button"
        tabindex="0"
        aria-label="Seleccionar ${bank.name}">
      <td class="bcp-cell bcp-cell--bank">
        <span class="bcp-dot" style="background:${bank.color}"></span>
        <span class="bcp-bank-name">${bank.shortName}</span>
        ${badge}
        <small class="bcp-bank-note">${bank.requirements?.notes?.[0] ?? ''}</small>
      </td>
      <td class="bcp-cell bcp-cell--rate">
        <strong>${formatRate(bank.rateNoVIS.reference)}</strong>
      </td>
      <td class="bcp-cell bcp-cell--payment">
        <strong>${formatCOP(summary.payment)}</strong>
        ${savingLabel}
      </td>
      <td class="bcp-cell bcp-cell--interest">
        ${formatMillions(summary.totalInterest)}
      </td>
      <td class="bcp-cell bcp-cell--total">
        ${formatMillions(summary.totalPaid)}
      </td>
    </tr>`.trim();
}