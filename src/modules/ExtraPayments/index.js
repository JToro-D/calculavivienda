/**
 * @file ExtraPayments/index.js
 * @description Módulo simulador de abonos extraordinarios a capital.
 *              Responde: "¿Cuánto me ahorro si abono $X millones en el mes Y?"
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * USO
 * ─────────────────────────────────────────────────────────────────────────────
 *   import { initExtraPayments } from './modules/ExtraPayments/index.js';
 *
 *   const ep = initExtraPayments(document.getElementById('abonos'), {
 *     principal:  210_000_000,
 *     annualRate: 11.0,
 *     termMonths: 240,
 *   });
 *
 *   // Actualizar cuando el usuario cambia de banco:
 *   document.addEventListener('bcp:bankSelected', e => {
 *     ep.update({ annualRate: e.detail.bank.rateNoVIS.reference });
 *   });
 *
 *   // Actualizar cuando CapacityCalc emite un crédito:
 *   document.addEventListener('cap:simulate', e => {
 *     ep.update({ principal: e.detail.principal, termMonths: e.detail.termMonths });
 *   });
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * EVENTOS EMITIDOS
 * ─────────────────────────────────────────────────────────────────────────────
 *   'ep:resultReady' → { monthsSaved, interestSaved, totalExtra, mode }
 *
 * @version 1.0.0
 * @updated 2026-05-26
 * @author  Arquitecto — calculavivienda.com.co
 */

import {
  calcWithMultipleExtraPayments,
  compareExtraPaymentModes,
  validateExtraPaymentInputs,
}                              from '../../calculators/extraPayments.js';
import {
  formatCOP, formatMillions,
  formatMonths, formatPct,
}                              from '../../utils/formatters.js';

// ─────────────────────────────────────────────────────────────────────────────
// CSS
// ─────────────────────────────────────────────────────────────────────────────

const CSS_ID = 'ep-styles';

function injectCSS() {
  if (document.getElementById(CSS_ID)) return;
  const style = document.createElement('style');
  style.id    = CSS_ID;
  style.textContent = `
    .ep-wrapper {
      font-family: var(--font-sans, system-ui, sans-serif);
      border-radius: var(--radius-lg, 12px);
      border: 1px solid var(--color-border, #E5E7EB);
      overflow: hidden;
    }

    /* ── Header ─────────────────────────────────────────────────────────── */
    .ep-header {
      background: var(--color-secondary, #0A2540);
      padding: 12px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      flex-wrap: wrap;
    }
    .ep-title { color: #fff; font-size: 14px; font-weight: 500; }
    .ep-mode-group { display: flex; gap: 4px; }
    .ep-mode-btn {
      padding: 5px 12px;
      border-radius: 6px;
      border: 1px solid rgba(255,255,255,.3);
      background: transparent;
      color: rgba(255,255,255,.7);
      font-size: 12px;
      cursor: pointer;
      transition: all .15s;
    }
    .ep-mode-btn:hover { color: #fff; }
    .ep-mode-btn--active {
      background: var(--color-primary, #006241);
      color: #fff;
      border-color: transparent;
      font-weight: 500;
    }

    /* ── Formulario de entrada ───────────────────────────────────────────── */
    .ep-form {
      padding: 14px 16px;
      background: var(--color-bg, #F7F8FA);
      border-bottom: 1px solid var(--color-border, #E5E7EB);
    }
    .ep-form-label {
      font-size: 12px;
      font-weight: 500;
      color: #6B7280;
      text-transform: uppercase;
      letter-spacing: .04em;
      margin-bottom: 8px;
      display: block;
    }
    .ep-form-row {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      align-items: flex-end;
    }
    .ep-form-field { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 120px; }
    .ep-form-field label { font-size: 11px; color: #9CA3AF; }
    .ep-input {
      padding: 8px 10px;
      border-radius: 6px;
      border: 1px solid #E5E7EB;
      font-size: 14px;
      color: var(--color-secondary, #0A2540);
      background: #fff;
      width: 100%;
      box-sizing: border-box;
    }
    .ep-input:focus {
      outline: none;
      border-color: var(--color-primary, #006241);
      box-shadow: 0 0 0 3px rgba(0,98,65,.1);
    }
    .ep-input--error { border-color: #DC2626; }
    .ep-field-error { font-size: 11px; color: #DC2626; margin-top: 2px; }

    .ep-add-btn {
      padding: 8px 16px;
      border-radius: 6px;
      border: none;
      background: var(--color-primary, #006241);
      color: #fff;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      white-space: nowrap;
      align-self: flex-end;
      transition: opacity .15s;
      flex-shrink: 0;
    }
    .ep-add-btn:hover { opacity: .9; }

    /* Atajos rápidos */
    .ep-shortcuts {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      margin-top: 8px;
    }
    .ep-shortcut {
      padding: 3px 10px;
      border-radius: 20px;
      border: 1px solid #E5E7EB;
      background: #fff;
      font-size: 11px;
      color: #6B7280;
      cursor: pointer;
      transition: all .12s;
    }
    .ep-shortcut:hover { border-color: var(--color-primary, #006241); color: var(--color-primary, #006241); }

    /* ── Lista de abonos ─────────────────────────────────────────────────── */
    .ep-list {
      padding: 12px 16px;
      border-bottom: 1px solid var(--color-border, #E5E7EB);
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-height: 48px;
    }
    .ep-list-empty {
      font-size: 13px;
      color: #9CA3AF;
      text-align: center;
      padding: 8px 0;
    }
    .ep-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 7px 10px;
      background: #fff;
      border-radius: 6px;
      border: 1px solid #E5E7EB;
      font-size: 13px;
    }
    .ep-item-month {
      font-size: 11px;
      color: #9CA3AF;
      background: #F3F4F6;
      padding: 2px 6px;
      border-radius: 4px;
      white-space: nowrap;
      flex-shrink: 0;
    }
    .ep-item-amount { font-weight: 500; color: var(--color-secondary, #0A2540); flex: 1; }
    .ep-item-remove {
      width: 22px; height: 22px;
      border-radius: 50%;
      border: none;
      background: #FEE2E2;
      color: #DC2626;
      font-size: 13px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: background .12s;
    }
    .ep-item-remove:hover { background: #FECACA; }

    /* ── Resultados ──────────────────────────────────────────────────────── */
    .ep-results { padding: 14px 16px; }

    .ep-results-empty {
      text-align: center;
      color: #9CA3AF;
      font-size: 13px;
      padding: 16px 0;
    }

    .ep-roi-banner {
      background: linear-gradient(135deg, #EEF9F4, #F0FFF4);
      border: 1px solid #6EE7B7;
      border-radius: 10px;
      padding: 12px 14px;
      margin-bottom: 12px;
      text-align: center;
    }
    .ep-roi-label { font-size: 12px; color: #065F46; }
    .ep-roi-value { font-size: 22px; font-weight: 600; color: #065F46; }
    .ep-roi-sub   { font-size: 12px; color: #6B7280; margin-top: 2px; }

    .ep-metrics {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
      margin-bottom: 12px;
    }
    .ep-metric {
      background: #F9FAFB;
      border: 1px solid #E5E7EB;
      border-radius: 8px;
      padding: 10px 12px;
    }
    .ep-metric--highlight { background: #EEF9F4; border-color: #6EE7B7; }
    .ep-metric-label { font-size: 11px; color: #9CA3AF; margin-bottom: 3px; }
    .ep-metric-value { font-size: 15px; font-weight: 500; color: var(--color-secondary, #0A2540); }
    .ep-metric-value--green { color: #065F46; }
    .ep-metric-value--red   { color: #B45309; }
    .ep-metric-sub { font-size: 11px; color: #9CA3AF; margin-top: 2px; }

    /* Comparación de modos */
    .ep-compare {
      background: #F3F4F6;
      border-radius: 8px;
      padding: 10px 12px;
      margin-top: 12px;
    }
    .ep-compare-title {
      font-size: 11px;
      font-weight: 500;
      color: #6B7280;
      text-transform: uppercase;
      letter-spacing: .04em;
      margin-bottom: 8px;
    }
    .ep-compare-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .ep-compare-col { background: #fff; border-radius: 6px; padding: 8px 10px; }
    .ep-compare-col--active { border: 1px solid var(--color-primary, #006241); }
    .ep-compare-col-title {
      font-size: 11px;
      font-weight: 500;
      color: #374151;
      margin-bottom: 4px;
    }
    .ep-compare-stat { font-size: 12px; color: #6B7280; line-height: 1.6; }
    .ep-compare-stat strong { color: #111827; }

    .ep-placeholder {
      padding: 24px;
      text-align: center;
      color: #9CA3AF;
      font-size: 13px;
      line-height: 1.6;
    }
  `;
  document.head.appendChild(style);
}

// ─────────────────────────────────────────────────────────────────────────────
// ESTADO INICIAL
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_STATE = {
  principal:     210_000_000,
  annualRate:    11.0,
  termMonths:    240,
  mode:          'reduceTerm',   // 'reduceTerm' | 'reducePayment'
  extraPayments: [],             // [{ month, amount }]
  inputAmount:   5_000_000,
  inputMonth:    12,
};

// ─────────────────────────────────────────────────────────────────────────────
// MÓDULO PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

export function initExtraPayments(container, initialState = {}) {
  if (!container) {
    console.error('[ExtraPayments] Se requiere un elemento contenedor.');
    return null;
  }

  injectCSS();

  let state  = { ...DEFAULT_STATE, ...initialState };
  let errors = { amount: null, month: null };

  // ── Render de la sección de resultados ────────────────────────────────────

  function renderResults() {
    if (!state.extraPayments.length) {
      return `<div class="ep-results-empty">
        Agrega al menos un abono para ver el impacto en tu crédito.
      </div>`;
    }

    const result = calcWithMultipleExtraPayments(
      state.principal, state.annualRate, state.termMonths,
      state.extraPayments, state.mode,
    );

    if (!result) {
      return `<div class="ep-results-empty">No se pudo calcular. Verifica los abonos.</div>`;
    }

    const roi = result.totalExtraPayments > 0
      ? (result.interestSaved / result.totalExtraPayments).toFixed(1)
      : 0;

    // Comparación entre modos
    const cmp = compareExtraPaymentModes(
      state.principal, state.annualRate, state.termMonths, state.extraPayments,
    );

    const compareSect = cmp ? `
      <div class="ep-compare">
        <div class="ep-compare-title">Comparación de modos</div>
        <div class="ep-compare-grid">
          <div class="ep-compare-col${state.mode === 'reduceTerm' ? ' ep-compare-col--active' : ''}">
            <div class="ep-compare-col-title">Reducir plazo ↓</div>
            <div class="ep-compare-stat">
              Ahorra <strong>${cmp.reduceTerm.monthsSaved} meses</strong><br>
              Interés ahorrado: <strong>${formatMillions(cmp.reduceTerm.interestSaved)}</strong><br>
              Cuota: igual a la actual
            </div>
          </div>
          <div class="ep-compare-col${state.mode === 'reducePayment' ? ' ep-compare-col--active' : ''}">
            <div class="ep-compare-col-title">Reducir cuota ↓</div>
            <div class="ep-compare-stat">
              Plazo: sin cambio<br>
              Interés ahorrado: <strong>${formatMillions(cmp.reducePayment.interestSaved)}</strong><br>
              Nueva cuota: <strong>${formatCOP(cmp.reducePayment.currentPayment)}</strong>
            </div>
          </div>
        </div>
      </div>` : '';

    // Métricas según el modo activo
    const modeMetric = state.mode === 'reduceTerm'
      ? `<div class="ep-metric ep-metric--highlight">
           <div class="ep-metric-label">Meses ahorrados</div>
           <div class="ep-metric-value ep-metric-value--green">${result.monthsSaved} meses</div>
           <div class="ep-metric-sub">${formatMonths(result.monthsSaved)} menos de deuda</div>
         </div>
         <div class="ep-metric">
           <div class="ep-metric-label">Nuevo plazo</div>
           <div class="ep-metric-value">${formatMonths(result.newTermMonths)}</div>
           <div class="ep-metric-sub">antes: ${formatMonths(result.originalTermMonths)}</div>
         </div>`
      : `<div class="ep-metric ep-metric--highlight">
           <div class="ep-metric-label">Nueva cuota mensual</div>
           <div class="ep-metric-value ep-metric-value--green">${formatCOP(result.currentPayment)}</div>
           <div class="ep-metric-sub">antes: ${formatCOP(result.basePayment)}</div>
         </div>
         <div class="ep-metric">
           <div class="ep-metric-label">Ahorro mensual</div>
           <div class="ep-metric-value ep-metric-value--green">
             ${formatCOP(result.basePayment - result.currentPayment)}/mes
           </div>
         </div>`;

    return `
      <div class="ep-roi-banner">
        <div class="ep-roi-label">Por cada $1 abonado, ahorras</div>
        <div class="ep-roi-value">$${roi} en intereses</div>
        <div class="ep-roi-sub">
          ${formatMillions(result.totalExtraPayments)} abonados →
          ${formatMillions(result.interestSaved)} ahorrados
        </div>
      </div>

      <div class="ep-metrics">
        ${modeMetric}
        <div class="ep-metric">
          <div class="ep-metric-label">Intereses ahorrados</div>
          <div class="ep-metric-value ep-metric-value--green">
            ${formatMillions(result.interestSaved)}
          </div>
          <div class="ep-metric-sub">
            de ${formatMillions(result.originalTotalInterest)} originales
          </div>
        </div>
        <div class="ep-metric">
          <div class="ep-metric-label">Total abonos</div>
          <div class="ep-metric-value ep-metric-value--red">
            ${formatMillions(result.totalExtraPayments)}
          </div>
        </div>
      </div>
      ${compareSect}`;
  }

  // ── Render completo ───────────────────────────────────────────────────────

  function render() {
    // Botones de modo
    const modeBtns = [
      { id: 'reduceTerm',    label: 'Reducir plazo' },
      { id: 'reducePayment', label: 'Reducir cuota' },
    ].map(m => `
      <button class="ep-mode-btn${state.mode === m.id ? ' ep-mode-btn--active' : ''}"
              data-mode="${m.id}">${m.label}</button>`
    ).join('');

    // Lista de abonos
    const listHTML = state.extraPayments.length
      ? state.extraPayments.map((ep, i) => `
          <div class="ep-item" data-index="${i}">
            <span class="ep-item-month">Mes ${ep.month}</span>
            <span class="ep-item-amount">${formatCOP(ep.amount)}</span>
            <button class="ep-item-remove" data-remove="${i}" aria-label="Eliminar abono">✕</button>
          </div>`).join('')
      : '<div class="ep-list-empty">Sin abonos programados</div>';

    // Atajos rápidos
    const basePayment = Math.round(state.principal * 0.00912 / (1 - Math.pow(1.00912, -state.termMonths)));
    const shortcuts = [
      { label: 'Prima dic.',  amount: Math.round(basePayment * 2), month: 12 },
      { label: '$5M mes 12',  amount: 5_000_000,                   month: 12 },
      { label: '$10M mes 24', amount: 10_000_000,                  month: 24 },
    ].map(s => `
      <button class="ep-shortcut"
              data-shortcut-amount="${s.amount}"
              data-shortcut-month="${s.month}">
        ${s.label}
      </button>`).join('');

    container.innerHTML = `
      <div class="ep-wrapper">
        <div class="ep-header">
          <span class="ep-title">Abonos extraordinarios a capital</span>
          <div class="ep-mode-group">${modeBtns}</div>
        </div>

        <div class="ep-form">
          <label class="ep-form-label">Agregar abono</label>
          <div class="ep-form-row">
            <div class="ep-form-field">
              <label for="ep-amount">Monto del abono (COP)</label>
              <input id="ep-amount" class="ep-input${errors.amount ? ' ep-input--error' : ''}"
                     type="text" inputmode="numeric"
                     value="${formatCOP(state.inputAmount)}"
                     placeholder="$5.000.000" autocomplete="off" />
              ${errors.amount ? `<span class="ep-field-error">${errors.amount}</span>` : ''}
            </div>
            <div class="ep-form-field" style="max-width:110px">
              <label for="ep-month">Mes del abono</label>
              <input id="ep-month" class="ep-input${errors.month ? ' ep-input--error' : ''}"
                     type="number" min="1" max="${state.termMonths}"
                     value="${state.inputMonth}" />
              ${errors.month ? `<span class="ep-field-error">${errors.month}</span>` : ''}
            </div>
            <button class="ep-add-btn" data-action="add">+ Agregar</button>
          </div>
          <div class="ep-shortcuts">${shortcuts}</div>
        </div>

        <div class="ep-list">${listHTML}</div>

        <div class="ep-results">${renderResults()}</div>
      </div>`.trim();

    bindEvents();
  }

  // ── Validación y adición de abono ─────────────────────────────────────────

  function addPayment() {
    const amountInput = container.querySelector('#ep-amount');
    const monthInput  = container.querySelector('#ep-month');
    if (!amountInput || !monthInput) return;

    // Parsear monto (acepta formato COP: $5.000.000)
    const rawAmount = amountInput.value.replace(/[\$\s\.]/g, '').replace(',', '.');
    const amount    = parseFloat(rawAmount);
    const month     = parseInt(monthInput.value, 10);

    // Validar
    const vAmount = validateExtraPaymentInputs(amount, month, state.termMonths);
    errors.amount = amount <= 0 || isNaN(amount) ? 'Ingresa un monto válido mayor a cero.' : null;
    errors.month  = !vAmount.valid && vAmount.field === 'atMonth' ? vAmount.error : null;

    if (errors.amount || errors.month) { render(); return; }

    errors = { amount: null, month: null };
    state.inputAmount    = amount;
    state.inputMonth     = month;
    state.extraPayments  = [...state.extraPayments, { month, amount }]
      .sort((a, b) => a.month - b.month);

    render();
    emitResult();
  }

  // ── Emisión de eventos ────────────────────────────────────────────────────

  function emitResult() {
    if (!state.extraPayments.length) return;
    const result = calcWithMultipleExtraPayments(
      state.principal, state.annualRate, state.termMonths,
      state.extraPayments, state.mode,
    );
    if (!result) return;
    container.dispatchEvent(new CustomEvent('ep:resultReady', {
      bubbles: true,
      detail:  {
        monthsSaved:   result.monthsSaved,
        interestSaved: result.interestSaved,
        totalExtra:    result.totalExtraPayments,
        mode:          state.mode,
      },
    }));
  }

  // ── Event binding ─────────────────────────────────────────────────────────

  function bindEvents() {
    // Modo
    container.querySelectorAll('[data-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.dataset.mode === state.mode) return;
        state.mode = btn.dataset.mode;
        render();
        emitResult();
      });
    });

    // Botón agregar
    const addBtn = container.querySelector('[data-action="add"]');
    if (addBtn) addBtn.addEventListener('click', addPayment);

    // Enter en inputs
    ['#ep-amount', '#ep-month'].forEach(sel => {
      const el = container.querySelector(sel);
      if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') addPayment(); });
    });

    // Atajos rápidos
    container.querySelectorAll('[data-shortcut-amount]').forEach(btn => {
      btn.addEventListener('click', () => {
        const amount = parseInt(btn.dataset.shortcutAmount, 10);
        const month  = parseInt(btn.dataset.shortcutMonth, 10);
        if (!isNaN(amount) && !isNaN(month)) {
          state.inputAmount   = amount;
          state.inputMonth    = month;
          errors = { amount: null, month: null };
          state.extraPayments = [...state.extraPayments, { month, amount }]
            .sort((a, b) => a.month - b.month);
          render();
          emitResult();
        }
      });
    });

    // Eliminar abono
    container.querySelectorAll('[data-remove]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.remove, 10);
        state.extraPayments = state.extraPayments.filter((_, i) => i !== idx);
        render();
        emitResult();
      });
    });
  }

  // ── API pública ───────────────────────────────────────────────────────────

  function update(newState) {
    const prev = { ...state };
    state = { ...state, ...newState };
    // Si cambian parámetros del crédito, mantener los abonos pero recalcular
    const changed = Object.keys(newState).some(k => newState[k] !== prev[k]);
    if (changed) render();
  }

  function destroy() {
    container.innerHTML = '';
  }

  function getState() {
    return { ...state, extraPayments: [...state.extraPayments] };
  }

  render();
  return { update, destroy, getState };
}