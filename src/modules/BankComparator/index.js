/**
 * @file BankComparator/index.js
 * @description Módulo comparador multi-banco: muestra todos los bancos
 *              con sus cuotas calculadas para los inputs del usuario.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * USO
 * ─────────────────────────────────────────────────────────────────────────────
 *   import { initBankComparator } from './modules/BankComparator/index.js';
 *
 *   const comparator = initBankComparator(document.getElementById('comparador'), {
 *     propertyValueCOP: 300_000_000,
 *     downPaymentPct:   0.30,
 *     termMonths:       240,
 *     selectedBankId:   'bancolombia',
 *     housingType:      'NoVIS',
 *   });
 *
 *   // Actualizar cuando cambian los inputs del simulador
 *   comparator.update({ propertyValueCOP: 350_000_000 });
 *
 *   // Escuchar selección de banco
 *   container.addEventListener('bcp:bankSelected', e => {
 *     console.log('Banco seleccionado:', e.detail.bankId);
 *   });
 *
 *   // Limpiar al desmontar
 *   comparator.destroy();
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * EVENTOS EMITIDOS
 * ─────────────────────────────────────────────────────────────────────────────
 *   'bcp:bankSelected'  → { bankId, bank, summary }
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DEPENDENCIAS
 * ─────────────────────────────────────────────────────────────────────────────
 *   config/banks.js              → getAllBanks, getCheapestBank
 *   calculators/amortization.js  → calcAmortizationSummary
 *   utils/formatters.js          → formatCOP, formatMillions
 *   modules/BankComparator/BankRow.js → renderBankRow
 *
 * @version 1.0.0
 * @updated 2026-05-26
 * @author  Arquitecto — calculavivienda.com.co
 */

import { getAllBanks, getCheapestBank } from '../../config/banks.js';
import { calcAmortizationSummary }       from '../../calculators/amortization.js';
import { formatCOP, formatMillions, formatMonths } from '../../utils/formatters.js';
import { renderBankRow }                 from './BankRow.js';

// ─────────────────────────────────────────────────────────────────────────────
// CSS — inyectado una sola vez al primer init()
// ─────────────────────────────────────────────────────────────────────────────

const CSS_ID = 'bcp-styles';

function injectCSS() {
  if (document.getElementById(CSS_ID)) return;
  const style = document.createElement('style');
  style.id = CSS_ID;
  style.textContent = `
    .bcp-wrapper {
      font-family: var(--font-sans, system-ui, sans-serif);
      overflow-x: auto;
      border-radius: var(--radius-lg, 12px);
      border: 1px solid var(--color-border, #E5E7EB);
    }

    .bcp-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }

    /* Encabezado */
    .bcp-thead tr { background: var(--color-secondary, #0A2540); }
    .bcp-th {
      padding: 10px 12px;
      text-align: right;
      color: #fff;
      font-weight: 500;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      white-space: nowrap;
    }
    .bcp-th:first-child { text-align: left; }

    /* Filas */
    .bcp-row {
      cursor: pointer;
      transition: background 0.12s;
      border-bottom: 1px solid var(--color-border, #E5E7EB);
    }
    .bcp-row:last-child { border-bottom: none; }
    .bcp-row:hover { background: #F0F7FF; }
    .bcp-row:focus-visible { outline: 2px solid var(--color-primary, #006241); outline-offset: -2px; }

    .bcp-row--selected { background: #EEF9F4 !important; }
    .bcp-row--cheapest .bcp-cell--rate strong { color: var(--color-primary, #006241); }

    /* Celdas */
    .bcp-cell {
      padding: 10px 12px;
      text-align: right;
      color: var(--color-text, #111827);
      vertical-align: middle;
    }
    .bcp-cell:first-child { text-align: left; }

    /* Banco — primera columna */
    .bcp-cell--bank {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      flex-direction: column;
      padding: 10px 12px;
      min-width: 160px;
    }
    .bcp-dot {
      display: inline-block;
      width: 10px; height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
      margin-top: 3px;
      float: left;
      margin-right: 6px;
    }
    .bcp-bank-name { font-weight: 500; }
    .bcp-bank-note {
      display: block;
      font-size: 11px;
      color: var(--color-text-muted, #6B7280);
      margin-top: 2px;
    }

    /* Badges */
    .bcp-badge {
      display: inline-block;
      font-size: 10px;
      padding: 1px 6px;
      border-radius: 20px;
      font-weight: 500;
      margin-left: 4px;
    }
    .bcp-badge--cheapest { background: #D1FAE5; color: #065F46; }
    .bcp-badge--selected { background: #DBEAFE; color: #1E40AF; }

    /* Ahorros/diferencias */
    .bcp-saving {
      display: block;
      font-size: 11px;
      margin-top: 2px;
    }
    .bcp-saving--cheaper  { color: #065F46; }
    .bcp-saving--expensive { color: #991B1B; }

    /* Summary footer */
    .bcp-footer {
      padding: 10px 12px;
      font-size: 12px;
      color: var(--color-text-muted, #6B7280);
      border-top: 1px solid var(--color-border, #E5E7EB);
      background: var(--color-bg, #F7F8FA);
    }
    .bcp-footer strong { color: var(--color-text, #111827); }

    /* Estado de carga / error */
    .bcp-placeholder {
      padding: 24px;
      text-align: center;
      color: var(--color-text-muted, #6B7280);
      font-size: 14px;
    }
    .bcp-error {
      padding: 12px;
      background: #FEF2F2;
      color: #991B1B;
      border-radius: 8px;
      font-size: 13px;
    }
  `;
  document.head.appendChild(style);
}

// ─────────────────────────────────────────────────────────────────────────────
// ESTADO INICIAL POR DEFECTO
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_STATE = {
  propertyValueCOP: 300_000_000,
  downPaymentPct:   0.30,
  termMonths:       240,
  selectedBankId:   'bancolombia',
  housingType:      'NoVIS',
};

// ─────────────────────────────────────────────────────────────────────────────
// MÓDULO PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Inicializa el comparador multi-banco en el contenedor dado.
 *
 * @param {HTMLElement} container - Elemento DOM donde se monta el módulo
 * @param {Partial<typeof DEFAULT_STATE>} [initialState]
 * @returns {{ update: Function, destroy: Function, getState: Function }}
 */
export function initBankComparator(container, initialState = {}) {
  if (!container) {
    console.error('[BankComparator] Se requiere un elemento contenedor.');
    return null;
  }

  injectCSS();

  // Estado privado
  let state = { ...DEFAULT_STATE, ...initialState };

  // Caché de resultados calculados para no recalcular si el estado no cambia
  let _lastResults = null;
  let _lastPrincipal = null;
  let _lastTerm = null;

  // ── Cálculo ──────────────────────────────────────────────────────────────

  function computeResults() {
    const principal = state.propertyValueCOP * (1 - state.downPaymentPct);
    const term      = state.termMonths;

    // Usar caché si los inputs no cambiaron
    if (_lastResults && _lastPrincipal === principal && _lastTerm === term) {
      return _lastResults;
    }

    const banks   = getAllBanks(state.housingType);
    const results = banks.map(bank => ({
      bank,
      summary: calcAmortizationSummary(principal, bank.rateNoVIS.reference, term),
    })).filter(r => r.summary !== null);

    _lastResults  = results;
    _lastPrincipal = principal;
    _lastTerm      = term;
    return results;
  }

  // ── Render ────────────────────────────────────────────────────────────────

  function render() {
    const results = computeResults();

    if (results.length === 0) {
      container.innerHTML = `<div class="bcp-error">No se pudieron calcular los resultados. Verifica los inputs.</div>`;
      return;
    }

    const cheapest      = getCheapestBank(state.housingType);
    const selectedResult = results.find(r => r.bank.id === state.selectedBankId) ?? results[0];
    const selectedPayment = selectedResult?.summary?.payment ?? 0;

    const rows = results.map(({ bank, summary }) =>
      renderBankRow(bank, summary, {
        isSelected:        bank.id === state.selectedBankId,
        isCheapest:        bank.id === cheapest.id,
        savingVsCurrent:   summary.payment - selectedPayment,
      })
    ).join('');

    // Diferencia máxima entre tasa más baja y más alta
    const cheapestSummary = results[0]?.summary;
    const expensiveSummary = results[results.length - 1]?.summary;
    const interestDiff = expensiveSummary && cheapestSummary
      ? expensiveSummary.totalInterest - cheapestSummary.totalInterest
      : 0;

    const principal = state.propertyValueCOP * (1 - state.downPaymentPct);

    container.innerHTML = `
      <div class="bcp-wrapper">
        <table class="bcp-table" role="grid">
          <thead class="bcp-thead">
            <tr>
              <th class="bcp-th">Banco</th>
              <th class="bcp-th">Tasa EA</th>
              <th class="bcp-th">Cuota / mes</th>
              <th class="bcp-th">Total intereses</th>
              <th class="bcp-th">Total pagado</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="bcp-footer">
          Crédito de <strong>${formatCOP(principal)}</strong>
          a <strong>${formatMonths(state.termMonths)}</strong>.
          La diferencia entre la mejor y peor tasa es
          <strong>${formatMillions(interestDiff)}</strong> en intereses totales.
        </div>
      </div>
    `;

    bindEvents();
  }

  // ── Eventos ───────────────────────────────────────────────────────────────

  function bindEvents() {
    const rows = container.querySelectorAll('.bcp-row');

    rows.forEach(row => {
      row.addEventListener('click', handleBankSelect);
      row.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleBankSelect.call(row, e);
        }
      });
    });
  }

  function handleBankSelect(e) {
    const row    = e.currentTarget ?? e.target.closest('.bcp-row');
    const bankId = row?.dataset?.bankId;
    if (!bankId || bankId === state.selectedBankId) return;

    state.selectedBankId = bankId;
    render();

    const results = computeResults();
    const selected = results.find(r => r.bank.id === bankId);
    if (!selected) return;

    // Emitir evento custom para que otros módulos reaccionen
    container.dispatchEvent(new CustomEvent('bcp:bankSelected', {
      bubbles:  true,
      composed: true,
      detail:   {
        bankId,
        bank:    selected.bank,
        summary: selected.summary,
      },
    }));
  }

  // ── API pública ───────────────────────────────────────────────────────────

  /**
   * Actualiza el estado del módulo y re-renderiza.
   * Solo re-renderiza si algo cambió.
   *
   * @param {Partial<typeof DEFAULT_STATE>} newState
   */
  function update(newState) {
    const prevState  = { ...state };
    state = { ...state, ...newState };

    const changed = Object.keys(newState).some(k => newState[k] !== prevState[k]);
    if (changed) render();
  }

  /**
   * Elimina el módulo del DOM y limpia event listeners.
   */
  function destroy() {
    container.innerHTML = '';
    _lastResults  = null;
  }

  /**
   * Retorna una copia del estado actual.
   */
  function getState() {
    return { ...state };
  }

  // Render inicial
  render();

  return { update, destroy, getState };
}