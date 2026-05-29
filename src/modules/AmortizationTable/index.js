/**
 * @file AmortizationTable/index.js
 * @description Módulo de tabla de amortización completa.
 *              El diferenciador principal del sitio: 360 filas descargables en PDF.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * USO
 * ─────────────────────────────────────────────────────────────────────────────
 *   import { initAmortizationTable } from './modules/AmortizationTable/index.js';
 *
 *   const amtTable = initAmortizationTable(
 *     document.getElementById('tabla-amortizacion'), {
 *       principal:   210_000_000,
 *       annualRate:  11.0,
 *       termMonths:  240,
 *       selectedBank: bancolombia,     // objeto Bank de banks.js (opcional, para PDF)
 *       propertyValueCOP: 300_000_000, // para PDF
 *       downPaymentPct:   0.30,        // para PDF
 *     }
 *   );
 *
 *   // Actualizar cuando cambia de banco (escucha el evento del BankComparator)
 *   document.addEventListener('bcp:bankSelected', e => {
 *     amtTable.update({
 *       annualRate:   e.detail.bank.rateNoVIS.reference,
 *       selectedBank: e.detail.bank,
 *     });
 *   });
 *
 *   amtTable.destroy();
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * EVENTOS EMITIDOS
 * ─────────────────────────────────────────────────────────────────────────────
 *   'amt:viewChanged'  → { view: 'annual'|'monthly' }
 *   'amt:pageChanged'  → { page: number, year: number }
 *   'amt:pdfGenerated' → { success: boolean, error?: string }
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DEPENDENCIAS
 * ─────────────────────────────────────────────────────────────────────────────
 *   calculators/amortization.js → calcAmortizationTable, calcAnnualSummary
 *   utils/formatters.js         → formatCOP, formatMonths
 *   utils/pdfExport.js          → generateAmortizationPDF, buildPDFContent
 *   modules/AmortizationTable/AnnualView.js
 *   modules/AmortizationTable/MonthlyView.js
 *
 * @version 1.0.0
 * @updated 2026-05-26
 * @author  Arquitecto — calculavivienda.com.co
 */

import { calcAmortizationTable, calcAnnualSummary } from '../../calculators/amortization.js';
import { formatCOP, formatMillions, formatMonths }  from '../../utils/formatters.js';
import { generateAmortizationPDF, buildPDFContent, isPDFReady } from '../../utils/pdfExport.js';
import { getAllBanks }                               from '../../config/banks.js';
import { calcAmortizationSummary }                  from '../../calculators/amortization.js';
import { renderAnnualView }                         from './AnnualView.js';
import { renderMonthlyView, ROWS_PER_PAGE }         from './MonthlyView.js';

// ─────────────────────────────────────────────────────────────────────────────
// CSS
// ─────────────────────────────────────────────────────────────────────────────

const CSS_ID = 'amt-styles';

function injectCSS() {
  if (document.getElementById(CSS_ID)) return;
  const style = document.createElement('style');
  style.id = CSS_ID;
  style.textContent = `
    /* ── Contenedor principal ─────────────────────────────────────────────── */
    .amt-wrapper {
      font-family: var(--font-sans, system-ui, sans-serif);
      border-radius: var(--radius-lg, 12px);
      border: 1px solid var(--color-border, #E5E7EB);
      overflow: hidden;
    }

    /* ── Header con métricas y controles ─────────────────────────────────── */
    .amt-header {
      background: var(--color-secondary, #0A2540);
      padding: 14px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }
    .amt-metrics { display: flex; gap: 20px; flex-wrap: wrap; }
    .amt-metric { display: flex; flex-direction: column; }
    .amt-metric-label { font-size: 11px; color: rgba(255,255,255,.7); text-transform: uppercase; letter-spacing: .04em; }
    .amt-metric-value { font-size: 15px; font-weight: 500; color: #fff; margin-top: 2px; }
    .amt-metric-value--green { color: #6EE7B7; }
    .amt-metric-value--red   { color: #FCA5A5; }

    /* ── Controles: tabs + PDF ────────────────────────────────────────────── */
    .amt-controls { display: flex; align-items: center; gap: 8px; }
    .amt-tab-group { display: flex; gap: 4px; }
    .amt-tab {
      padding: 6px 14px;
      border-radius: 6px;
      border: 1px solid rgba(255,255,255,.25);
      background: transparent;
      color: rgba(255,255,255,.8);
      font-size: 13px;
      cursor: pointer;
      transition: all .15s;
    }
    .amt-tab:hover { background: rgba(255,255,255,.1); }
    .amt-tab--active {
      background: #fff;
      color: var(--color-secondary, #0A2540);
      border-color: transparent;
      font-weight: 500;
    }
    .amt-pdf-btn {
      padding: 6px 14px;
      border-radius: 6px;
      border: none;
      background: var(--color-primary, #006241);
      color: #fff;
      font-size: 13px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 5px;
      transition: opacity .15s;
    }
    .amt-pdf-btn:hover { opacity: .9; }
    .amt-pdf-btn:disabled { opacity: .5; cursor: not-allowed; }

    /* ── Cuerpo de la tabla ───────────────────────────────────────────────── */
    .amt-body { overflow-x: auto; }
    .amt-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }

    .amt-thead tr { background: #F3F4F6; }
    .amt-th {
      padding: 9px 12px;
      font-size: 11px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: .04em;
      color: #6B7280;
      text-align: right;
      white-space: nowrap;
      border-bottom: 2px solid #E5E7EB;
    }
    .amt-th:first-child { text-align: left; }
    .amt-th--pct { text-align: center; min-width: 100px; }

    .amt-row { border-bottom: 1px solid #F3F4F6; }
    .amt-row:last-child { border-bottom: none; }
    .amt-row--alt     { background: #FAFAFA; }
    .amt-row--highlight { background: #EEF9F4; }
    .amt-row--total   { background: #1E3A5F; }
    .amt-row--total .amt-cell { color: #fff; font-size: 13px; }
    .amt-row--last td { border-bottom: none; }

    .amt-cell {
      padding: 8px 12px;
      text-align: right;
      color: var(--color-text, #111827);
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    .amt-cell:first-child     { text-align: left; }
    .amt-cell--interest       { color: #B45309; }
    .amt-cell--capital        { color: #065F46; }
    .amt-cell--pct            { text-align: center; padding: 8px 8px; }
    .amt-cell--month          { font-family: var(--font-mono, monospace); font-size: 12px; color: #6B7280; }

    /* ── Barra de % interés (AnnualView) ─────────────────────────────────── */
    .amt-bar-wrap {
      display: flex;
      align-items: center;
      gap: 6px;
      min-width: 80px;
    }
    .amt-bar {
      height: 6px;
      border-radius: 3px;
      flex: 1;
      transition: width .3s;
    }
    .amt-bar-label { font-size: 11px; color: #6B7280; flex-shrink: 0; min-width: 28px; }

    /* ── Paginación (MonthlyView) ─────────────────────────────────────────── */
    .amt-pagination {
      padding: 10px 12px;
      border-top: 1px solid #E5E7EB;
      background: #F9FAFB;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .amt-pagination-nav {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      flex-wrap: wrap;
    }
    .amt-pagination-info { font-size: 13px; color: #6B7280; text-align: center; }
    .amt-pagination-year { font-size: 12px; color: #9CA3AF; margin-left: 4px; }

    .amt-nav-btn {
      padding: 6px 14px;
      border-radius: 6px;
      border: 1px solid #E5E7EB;
      background: #fff;
      font-size: 13px;
      cursor: pointer;
      color: var(--color-secondary, #0A2540);
      transition: background .12s;
    }
    .amt-nav-btn:hover:not(:disabled) { background: #EEF9F4; }
    .amt-nav-btn:disabled { opacity: .4; cursor: not-allowed; }

    .amt-year-nav {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }
    .amt-year-label { font-size: 12px; color: #9CA3AF; white-space: nowrap; }
    .amt-year-buttons { display: flex; gap: 3px; flex-wrap: wrap; }
    .amt-page-btn {
      width: 28px; height: 28px;
      border-radius: 4px;
      border: 1px solid #E5E7EB;
      background: #fff;
      font-size: 11px;
      cursor: pointer;
      color: #374151;
      transition: all .12s;
    }
    .amt-page-btn:hover:not(:disabled) { background: #EEF9F4; border-color: #6EE7B7; }
    .amt-page-btn--active {
      background: var(--color-primary, #006241);
      color: #fff;
      border-color: transparent;
      font-weight: 500;
    }
    .amt-page-btn:disabled { cursor: default; }

    .amt-monthly-wrap { min-height: 200px; }
    .amt-empty { padding: 24px; text-align: center; color: #9CA3AF; font-size: 14px; }
    .amt-loading { padding: 24px; text-align: center; color: #9CA3AF; font-size: 14px; }
    .amt-error { padding: 12px 16px; background: #FEF2F2; color: #991B1B; font-size: 13px; }
  `;
  document.head.appendChild(style);
}

// ─────────────────────────────────────────────────────────────────────────────
// ESTADO INICIAL
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_STATE = {
  principal:        210_000_000,
  annualRate:       11.0,
  termMonths:       240,
  view:             'annual',     // 'annual' | 'monthly'
  currentPage:      0,            // 0-based, para monthly view
  // Opcionales para PDF
  selectedBank:     null,
  propertyValueCOP: null,
  downPaymentPct:   null,
};

// ─────────────────────────────────────────────────────────────────────────────
// MÓDULO PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Inicializa la tabla de amortización en el contenedor dado.
 *
 * @param {HTMLElement} container
 * @param {Partial<typeof DEFAULT_STATE>} [initialState]
 * @returns {{ update: Function, destroy: Function, getState: Function } | null}
 */
export function initAmortizationTable(container, initialState = {}) {
  if (!container) {
    console.error('[AmortizationTable] Se requiere un elemento contenedor.');
    return null;
  }

  injectCSS();

  let state = { ...DEFAULT_STATE, ...initialState };

  // Caché de cálculos — solo recalcula si principal/rate/term cambian
  let _cache = { table: null, annual: null, key: null };

  // ── Cálculo con caché ─────────────────────────────────────────────────────

  function getCalculated() {
    const key = `${state.principal}-${state.annualRate}-${state.termMonths}`;
    if (_cache.key === key && _cache.table) return _cache;

    const table  = calcAmortizationTable(state.principal, state.annualRate, state.termMonths);
    const annual = table ? calcAnnualSummary(table) : null;

    _cache = { table, annual, key };
    return _cache;
  }

  // ── Render del header (métricas + controles) ──────────────────────────────

  function renderHeader(table) {
    if (!table) return '<div class="amt-header"><span style="color:#FCA5A5">Error en los cálculos.</span></div>';

    const pdfBtnDisabled = isPDFReady() ? '' : ' disabled title="Cargando jsPDF..."';
    const pdfIcon = '⬇';

    return `
      <div class="amt-header">
        <div class="amt-metrics">
          <div class="amt-metric">
            <span class="amt-metric-label">Cuota mensual</span>
            <span class="amt-metric-value amt-metric-value--green">${formatCOP(table.payment)}</span>
          </div>
          <div class="amt-metric">
            <span class="amt-metric-label">Total intereses</span>
            <span class="amt-metric-value amt-metric-value--red">${formatMillions(table.totalInterest)}</span>
          </div>
          <div class="amt-metric">
            <span class="amt-metric-label">Total pagado</span>
            <span class="amt-metric-value">${formatMillions(table.totalPaid)}</span>
          </div>
          <div class="amt-metric">
            <span class="amt-metric-label">Plazo</span>
            <span class="amt-metric-value">${formatMonths(state.termMonths)}</span>
          </div>
        </div>
        <div class="amt-controls">
          <div class="amt-tab-group" role="tablist">
            <button class="amt-tab${state.view === 'annual' ? ' amt-tab--active' : ''}"
                    data-view="annual" role="tab"
                    aria-selected="${state.view === 'annual'}">
              Por año
            </button>
            <button class="amt-tab${state.view === 'monthly' ? ' amt-tab--active' : ''}"
                    data-view="monthly" role="tab"
                    aria-selected="${state.view === 'monthly'}">
              Por mes
            </button>
          </div>
          <button class="amt-pdf-btn" data-action="pdf"${pdfBtnDisabled}
                  aria-label="Descargar tabla en PDF">
            ${pdfIcon} PDF
          </button>
        </div>
      </div>`.trim();
  }

  // ── Render principal ──────────────────────────────────────────────────────

  function render() {
    const { table, annual } = getCalculated();

    if (!table) {
      container.innerHTML = `<div class="amt-wrapper"><div class="amt-error">
        No se pudo calcular la tabla. Verifica el capital, la tasa y el plazo.
      </div></div>`;
      return;
    }

    let bodyHTML;
    if (state.view === 'annual') {
      bodyHTML = renderAnnualView(annual, {});
    } else {
      const totalPages = Math.ceil(state.termMonths / ROWS_PER_PAGE);
      const page       = Math.max(0, Math.min(state.currentPage, totalPages - 1));
      const pageRows   = table.rows.slice(page * ROWS_PER_PAGE, (page + 1) * ROWS_PER_PAGE);
      bodyHTML = renderMonthlyView(pageRows, {
        currentPage:  page,
        totalPages,
        totalMonths:  state.termMonths,
      });
    }

    container.innerHTML = `
      <div class="amt-wrapper">
        ${renderHeader(table)}
        <div class="amt-body" role="tabpanel">${bodyHTML}</div>
      </div>`.trim();

    bindEvents();
  }

  // ── Event binding ─────────────────────────────────────────────────────────

  function bindEvents() {
    // Tabs de vista
    container.querySelectorAll('.amt-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        if (view === state.view) return;
        state.view        = view;
        state.currentPage = 0;
        render();
        container.dispatchEvent(new CustomEvent('amt:viewChanged', {
          bubbles: true, detail: { view },
        }));
      });
    });

    // Botón PDF
    const pdfBtn = container.querySelector('[data-action="pdf"]');
    if (pdfBtn) {
      pdfBtn.addEventListener('click', handlePDFDownload);
    }

    // Navegación mensual (prev/next)
    container.querySelectorAll('[data-action="prev"], [data-action="next"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const totalPages = Math.ceil(state.termMonths / ROWS_PER_PAGE);
        const delta = btn.dataset.action === 'prev' ? -1 : 1;
        const newPage = Math.max(0, Math.min(state.currentPage + delta, totalPages - 1));
        if (newPage === state.currentPage) return;
        state.currentPage = newPage;
        render();
        container.dispatchEvent(new CustomEvent('amt:pageChanged', {
          bubbles: true, detail: { page: newPage, year: newPage + 1 },
        }));
      });
    });

    // Salto a página por año
    container.querySelectorAll('.amt-page-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const page = parseInt(btn.dataset.page, 10);
        if (isNaN(page) || page === state.currentPage) return;
        state.currentPage = page;
        render();
        container.dispatchEvent(new CustomEvent('amt:pageChanged', {
          bubbles: true, detail: { page, year: page + 1 },
        }));
      });
    });
  }

  // ── PDF export ────────────────────────────────────────────────────────────

  function handlePDFDownload() {
    const { table, annual } = getCalculated();
    if (!table || !annual) return;

    const banks          = getAllBanks('NoVIS');
    const principal      = state.principal;
    const bankComparisons = banks.map(b => ({
      bank:    b,
      summary: calcAmortizationSummary(principal, b.rateNoVIS.reference, state.termMonths),
    }));

    const simulatorInputs = {
      propertyValueCOP: state.propertyValueCOP ?? principal / 0.70,
      downPaymentPct:   state.downPaymentPct   ?? 0.30,
      termMonths:       state.termMonths,
      selectedBank:     state.selectedBank,
    };

    const result = generateAmortizationPDF({
      simulatorInputs,
      amortizationTable: table,
      annualSummary:     annual,
      bankComparisons,
      generatedAt: new Date().toISOString().split('T')[0],
    });

    container.dispatchEvent(new CustomEvent('amt:pdfGenerated', {
      bubbles: true, detail: result,
    }));

    if (!result.success) {
      console.warn('[AmortizationTable] PDF error:', result.error);
    }
  }

  // ── API pública ───────────────────────────────────────────────────────────

  function update(newState) {
    const prev    = { ...state };
    state         = { ...state, ...newState };

    // Si cambia el rate u otros parámetros de cálculo → resetear página
    const calcChanged = ['principal', 'annualRate', 'termMonths'].some(k => newState[k] !== prev[k]);
    if (calcChanged) state.currentPage = 0;

    const changed = Object.keys(newState).some(k => newState[k] !== prev[k]);
    if (changed) render();
  }

  function destroy() {
    container.innerHTML = '';
    _cache = { table: null, annual: null, key: null };
  }

  function getState() {
    return { ...state };
  }

  // Render inicial
  render();

  return { update, destroy, getState };
}