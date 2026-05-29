/**
 * @file CapacityCalc/index.js
 * @description Módulo "¿Cuánto puedo pedir?" — calculadora inversa de capacidad.
 *              Dos modos: calcular el inmueble máximo dado un ingreso, o verificar
 *              si el usuario califica para un inmueble específico.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * USO
 * ─────────────────────────────────────────────────────────────────────────────
 *   import { initCapacityCalc } from './modules/CapacityCalc/index.js';
 *
 *   const cap = initCapacityCalc(document.getElementById('capacidad'), {
 *     annualRate: 11.0,   // se actualiza cuando el usuario elige banco
 *   });
 *
 *   // Cuando el usuario elige banco en BankComparator:
 *   document.addEventListener('bcp:bankSelected', e => {
 *     cap.update({ annualRate: e.detail.bank.rateNoVIS.reference });
 *   });
 *
 *   // Cuando el usuario pulsa "Ver simulación completa":
 *   container.addEventListener('cap:simulate', e => {
 *     amtTable.update({ principal: e.detail.principal, annualRate: e.detail.annualRate });
 *     comparator.update({ propertyValueCOP: e.detail.propertyValueCOP });
 *   });
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * EVENTOS EMITIDOS
 * ─────────────────────────────────────────────────────────────────────────────
 *   'cap:simulate'    → { principal, annualRate, termMonths, propertyValueCOP,
 *                         downPaymentPct, housingType }
 *   'cap:modeChanged' → { mode: 'capacity'|'qualify' }
 *
 * @version 1.0.0
 * @updated 2026-05-26
 * @author  Arquitecto — calculavivienda.com.co
 */

import {
  calcAffordability,
  calcQualification,
}                                from '../../calculators/capacity.js';
import {
  formatCOP, formatMillions,
  formatPct, formatMonths,
}                                from '../../utils/formatters.js';
import { classifyPropertyType }  from '../../utils/validators.js';
import {
  SMMLV, VIS_MAX_COP, VIP_MAX_COP,
  MAX_DEBT_RATIO, TERM_OPTIONS_YEARS,
  INCOME_MIN_COP, INCOME_MAX_COP,
}                                from '../../config/constants.js';
import { getCheapestBank }       from '../../config/banks.js';

// ─────────────────────────────────────────────────────────────────────────────
// CSS
// ─────────────────────────────────────────────────────────────────────────────

const CSS_ID = 'cap-styles';

function injectCSS() {
  if (document.getElementById(CSS_ID)) return;
  const style = document.createElement('style');
  style.id = CSS_ID;
  style.textContent = `
    .cap-wrapper {
      font-family: var(--font-sans, system-ui, sans-serif);
      border-radius: var(--radius-lg, 12px);
      border: 1px solid var(--color-border, #E5E7EB);
      overflow: hidden;
    }

    /* ── Tabs de modo ──────────────────────────────────────────────────────── */
    .cap-tabs {
      display: flex;
      background: var(--color-secondary, #0A2540);
    }
    .cap-tab {
      flex: 1;
      padding: 12px 16px;
      border: none;
      background: transparent;
      color: rgba(255,255,255,.65);
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all .15s;
      border-bottom: 2px solid transparent;
    }
    .cap-tab:hover { color: #fff; }
    .cap-tab--active {
      color: #fff;
      border-bottom-color: var(--color-primary, #006241);
    }

    /* ── Inputs ────────────────────────────────────────────────────────────── */
    .cap-inputs {
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      background: var(--color-bg, #F7F8FA);
      border-bottom: 1px solid var(--color-border, #E5E7EB);
    }
    .cap-field { display: flex; flex-direction: column; gap: 6px; }
    .cap-label {
      font-size: 12px;
      font-weight: 500;
      color: #6B7280;
      text-transform: uppercase;
      letter-spacing: .04em;
    }
    .cap-value-display {
      font-size: 22px;
      font-weight: 500;
      color: var(--color-secondary, #0A2540);
      line-height: 1;
    }
    .cap-value-sub {
      font-size: 12px;
      color: #9CA3AF;
      margin-top: 2px;
    }

    /* Slider de ingreso */
    .cap-slider {
      -webkit-appearance: none;
      appearance: none;
      width: 100%;
      height: 6px;
      border-radius: 3px;
      background: #E5E7EB;
      outline: none;
      cursor: pointer;
    }
    .cap-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 20px; height: 20px;
      border-radius: 50%;
      background: var(--color-primary, #006241);
      cursor: pointer;
      border: 2px solid #fff;
      box-shadow: 0 1px 4px rgba(0,0,0,.2);
    }

    /* Botones de opción (plazo, cuota inicial) */
    .cap-option-group { display: flex; gap: 4px; flex-wrap: wrap; }
    .cap-option {
      padding: 5px 12px;
      border-radius: 6px;
      border: 1px solid #E5E7EB;
      background: #fff;
      font-size: 13px;
      cursor: pointer;
      color: #374151;
      transition: all .12s;
    }
    .cap-option:hover { border-color: var(--color-primary, #006241); }
    .cap-option--active {
      background: var(--color-primary, #006241);
      color: #fff;
      border-color: transparent;
      font-weight: 500;
    }

    /* Input de inmueble objetivo (modo qualify) */
    .cap-input-cop {
      padding: 10px 12px;
      border-radius: 8px;
      border: 1px solid #E5E7EB;
      font-size: 16px;
      font-weight: 500;
      color: var(--color-secondary, #0A2540);
      background: #fff;
      width: 100%;
      box-sizing: border-box;
    }
    .cap-input-cop:focus {
      outline: none;
      border-color: var(--color-primary, #006241);
      box-shadow: 0 0 0 3px rgba(0,98,65,.1);
    }
    .cap-input-error {
      font-size: 12px;
      color: #DC2626;
      margin-top: 3px;
    }

    /* ── Resultados ────────────────────────────────────────────────────────── */
    .cap-results { padding: 16px; }

    .cap-result-main {
      background: linear-gradient(135deg, #EEF9F4, #F0FFF4);
      border: 1px solid #6EE7B7;
      border-radius: 10px;
      padding: 16px;
      margin-bottom: 12px;
    }
    .cap-result-main--qualify-ok  { background: linear-gradient(135deg, #EEF9F4, #F0FFF4); border-color: #6EE7B7; }
    .cap-result-main--qualify-no  { background: linear-gradient(135deg, #FEF2F2, #FFF5F5); border-color: #FCA5A5; }
    .cap-result-label { font-size: 12px; color: #6B7280; text-transform: uppercase; letter-spacing: .04em; }
    .cap-result-amount {
      font-size: 28px;
      font-weight: 600;
      color: var(--color-secondary, #0A2540);
      margin: 4px 0;
      line-height: 1.1;
    }
    .cap-result-amount--qualify-ok { color: #065F46; }
    .cap-result-amount--qualify-no { color: #991B1B; }

    .cap-result-badges { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px; }
    .cap-badge {
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 20px;
      font-weight: 500;
    }
    .cap-badge--vis     { background: #D1FAE5; color: #065F46; }
    .cap-badge--vip     { background: #DBEAFE; color: #1E40AF; }
    .cap-badge--novis   { background: #F3F4F6; color: #374151; }
    .cap-badge--ok      { background: #D1FAE5; color: #065F46; }
    .cap-badge--no      { background: #FEE2E2; color: #991B1B; }

    /* Grid de métricas secundarias */
    .cap-metrics {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
      margin-bottom: 12px;
    }
    .cap-metric {
      background: #fff;
      border: 1px solid #E5E7EB;
      border-radius: 8px;
      padding: 10px 12px;
    }
    .cap-metric-label { font-size: 11px; color: #9CA3AF; margin-bottom: 3px; }
    .cap-metric-value { font-size: 14px; font-weight: 500; color: var(--color-secondary, #0A2540); }
    .cap-metric-value--warn { color: #D97706; }
    .cap-metric-value--ok   { color: #065F46; }

    /* Barra de endeudamiento */
    .cap-debt-bar-wrap {
      margin-bottom: 12px;
      background: #F3F4F6;
      border-radius: 8px;
      padding: 10px 12px;
    }
    .cap-debt-label { font-size: 12px; color: #6B7280; margin-bottom: 6px; display: flex; justify-content: space-between; }
    .cap-debt-bar-bg { height: 8px; background: #E5E7EB; border-radius: 4px; overflow: hidden; }
    .cap-debt-bar-fill { height: 100%; border-radius: 4px; transition: width .3s; }

    /* Botón CTA */
    .cap-cta {
      width: 100%;
      padding: 12px;
      border-radius: 8px;
      border: none;
      background: var(--color-secondary, #0A2540);
      color: #fff;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: opacity .15s;
    }
    .cap-cta:hover { opacity: .9; }

    .cap-placeholder {
      padding: 24px;
      text-align: center;
      color: #9CA3AF;
      font-size: 14px;
    }
    .cap-note {
      font-size: 11px;
      color: #9CA3AF;
      margin-top: 8px;
      line-height: 1.5;
    }
  `;
  document.head.appendChild(style);
}

// ─────────────────────────────────────────────────────────────────────────────
// ESTADO INICIAL
// ─────────────────────────────────────────────────────────────────────────────

function getDefaultRate() {
  try {
    return getCheapestBank('NoVIS')?.rateNoVIS?.reference ?? 11.0;
  } catch { return 11.0; }
}

const DEFAULT_STATE = {
  mode:                'capacity',     // 'capacity' | 'qualify'
  monthlyIncome:       5_000_000,      // COP
  downPaymentPct:      0.30,           // decimal
  termMonths:          240,
  annualRate:          null,           // null = usa la tasa del banco más barato
  targetPropertyValue: 300_000_000,    // solo en modo qualify
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS DE RENDER
// ─────────────────────────────────────────────────────────────────────────────

function housingBadge(type) {
  if (type === 'VIP') return '<span class="cap-badge cap-badge--vip">VIP</span>';
  if (type === 'VIS') return '<span class="cap-badge cap-badge--vis">VIS</span>';
  return '<span class="cap-badge cap-badge--novis">No VIS</span>';
}

function renderCapacityResult(affordability, state) {
  if (!affordability) {
    return '<div class="cap-placeholder">Ingresa tus datos para ver el resultado.</div>';
  }

  const { maxPropertyValue, maxCredit, requiredDownPayment, maxPayment, housingType, monthlyRate } = affordability;
  const housing = classifyPropertyType(maxPropertyValue);
  const debtRatioPct  = (maxPayment / state.monthlyIncome) * 100;
  const limitPct      = MAX_DEBT_RATIO * 100;
  const barWidth      = Math.min(100, debtRatioPct).toFixed(1);
  const barColor      = debtRatioPct > limitPct ? '#DC2626' : debtRatioPct > 25 ? '#D97706' : '#16A34A';

  return `
    <div class="cap-result-main">
      <div class="cap-result-label">Puedes comprar un inmueble de hasta</div>
      <div class="cap-result-amount">${formatMillions(maxPropertyValue)}</div>
      <div class="cap-result-badges">
        ${housingBadge(housingType)}
        <span class="cap-badge cap-badge--ok">Califica</span>
      </div>
    </div>

    <div class="cap-metrics">
      <div class="cap-metric">
        <div class="cap-metric-label">Crédito máximo</div>
        <div class="cap-metric-value">${formatMillions(maxCredit)}</div>
      </div>
      <div class="cap-metric">
        <div class="cap-metric-label">Cuota inicial (${formatPct(state.downPaymentPct * 100, 0)})</div>
        <div class="cap-metric-value">${formatMillions(requiredDownPayment)}</div>
      </div>
      <div class="cap-metric">
        <div class="cap-metric-label">Cuota mensual máx.</div>
        <div class="cap-metric-value cap-metric-value--ok">${formatCOP(maxPayment)}</div>
      </div>
      <div class="cap-metric">
        <div class="cap-metric-label">Plazo</div>
        <div class="cap-metric-value">${formatMonths(state.termMonths)}</div>
      </div>
    </div>

    <div class="cap-debt-bar-wrap">
      <div class="cap-debt-label">
        <span>Nivel de endeudamiento</span>
        <span>${debtRatioPct.toFixed(1)}% de tus ingresos (límite ${limitPct}%)</span>
      </div>
      <div class="cap-debt-bar-bg">
        <div class="cap-debt-bar-fill" style="width:${barWidth}%;background:${barColor}"></div>
      </div>
    </div>

    <button class="cap-cta" data-action="simulate">
      Ver simulación completa con este crédito →
    </button>
    <p class="cap-note">
      * Basado en la regla del 30% (Ley 546/99) con tasa referencial ${formatPct(state.annualRate ?? getDefaultRate(), 2)} EA.
      Los bancos evalúan adicionalmente historial crediticio, estabilidad laboral y deudas actuales.
    </p>`;
}

function renderQualifyResult(qualification, state) {
  if (!qualification) {
    return '<div class="cap-placeholder">Ingresa tus datos para verificar si calificas.</div>';
  }

  const { qualifies, actualPayment, actualDebtRatio, requiredIncome, incomeShortfall } = qualification;
  const housing   = classifyPropertyType(state.targetPropertyValue);
  const ratioPct  = actualDebtRatio * 100;
  const limitPct  = MAX_DEBT_RATIO * 100;
  const barWidth  = Math.min(100, ratioPct).toFixed(1);
  const barColor  = ratioPct > limitPct ? '#DC2626' : '#16A34A';
  const mainCss   = qualifies ? 'cap-result-main--qualify-ok' : 'cap-result-main--qualify-no';
  const amtCss    = qualifies ? 'cap-result-amount--qualify-ok' : 'cap-result-amount--qualify-no';

  const mainContent = qualifies
    ? `<div class="cap-result-label">¡Calificas para este inmueble!</div>
       <div class="cap-result-amount ${amtCss}">${formatCOP(state.targetPropertyValue)}</div>
       <div class="cap-result-badges">
         ${housingBadge(housing.type)}
         <span class="cap-badge cap-badge--ok">✓ Aprobado</span>
       </div>`
    : `<div class="cap-result-label">No calificas actualmente</div>
       <div class="cap-result-amount ${amtCss}">${formatCOP(state.targetPropertyValue)}</div>
       <div class="cap-result-badges">
         ${housingBadge(housing.type)}
         <span class="cap-badge cap-badge--no">✗ Faltan ${formatMillions(incomeShortfall)}/mes</span>
       </div>`;

  return `
    <div class="cap-result-main ${mainCss}">
      ${mainContent}
    </div>

    <div class="cap-metrics">
      <div class="cap-metric">
        <div class="cap-metric-label">Cuota mensual requerida</div>
        <div class="cap-metric-value">${formatCOP(actualPayment)}</div>
      </div>
      <div class="cap-metric">
        <div class="cap-metric-label">Ingreso mínimo necesario</div>
        <div class="cap-metric-value ${qualifies ? 'cap-metric-value--ok' : 'cap-metric-value--warn'}">
          ${formatCOP(requiredIncome)}
        </div>
      </div>
      <div class="cap-metric">
        <div class="cap-metric-label">Tu ingreso mensual</div>
        <div class="cap-metric-value">${formatCOP(state.monthlyIncome)}</div>
      </div>
      <div class="cap-metric">
        <div class="cap-metric-label">${qualifies ? 'Margen disponible' : 'Ingreso adicional necesario'}</div>
        <div class="cap-metric-value ${qualifies ? 'cap-metric-value--ok' : 'cap-metric-value--warn'}">
          ${qualifies
            ? formatCOP(state.monthlyIncome - requiredIncome)
            : formatCOP(incomeShortfall)}
        </div>
      </div>
    </div>

    <div class="cap-debt-bar-wrap">
      <div class="cap-debt-label">
        <span>Nivel de endeudamiento requerido</span>
        <span>${ratioPct.toFixed(1)}% de tus ingresos (límite ${limitPct}%)</span>
      </div>
      <div class="cap-debt-bar-bg">
        <div class="cap-debt-bar-fill" style="width:${barWidth}%;background:${barColor}"></div>
      </div>
    </div>

    ${qualifies ? `<button class="cap-cta" data-action="simulate">
      Ver simulación completa de este crédito →
    </button>` : ''}

    <p class="cap-note">
      * Cálculo referencial con tasa ${formatPct(state.annualRate ?? getDefaultRate(), 2)} EA,
        ${formatMonths(state.termMonths)}, cuota inicial ${formatPct(state.downPaymentPct * 100, 0)}.
    </p>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// MÓDULO PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

export function initCapacityCalc(container, initialState = {}) {
  if (!container) {
    console.error('[CapacityCalc] Se requiere un elemento contenedor.');
    return null;
  }

  injectCSS();

  let state = { ...DEFAULT_STATE, ...initialState };
  if (state.annualRate === null) state.annualRate = getDefaultRate();

  // ── Cálculo ───────────────────────────────────────────────────────────────

  function compute() {
    const { mode, monthlyIncome, annualRate, termMonths, downPaymentPct, targetPropertyValue } = state;

    if (mode === 'capacity') {
      return calcAffordability(monthlyIncome, annualRate, termMonths, downPaymentPct);
    } else {
      return calcQualification(targetPropertyValue, downPaymentPct, annualRate, termMonths, monthlyIncome);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  function render() {
    const result = compute();

    const smmlvCount = (state.monthlyIncome / SMMLV).toFixed(1);
    const incomeSub  = `${smmlvCount} SMMLV`;

    // Tabs
    const tabs = ['capacity', 'qualify'].map(mode => `
      <button class="cap-tab${state.mode === mode ? ' cap-tab--active' : ''}"
              data-mode="${mode}">
        ${mode === 'capacity' ? '¿Cuánto puedo comprar?' : '¿Califico para un inmueble?'}
      </button>`).join('');

    // Opciones de cuota inicial
    const downOptions = [20, 25, 30, 35, 40, 50].map(pct => {
      const decimal = pct / 100;
      const isActive = Math.abs(state.downPaymentPct - decimal) < 0.001;
      return `<button class="cap-option${isActive ? ' cap-option--active' : ''}"
                data-down="${decimal}">${pct}%</button>`;
    }).join('');

    // Opciones de plazo
    const termOptions = TERM_OPTIONS_YEARS.map(y => {
      const m = y * 12;
      return `<button class="cap-option${state.termMonths === m ? ' cap-option--active' : ''}"
                data-term="${m}">${y} años</button>`;
    }).join('');

    // Campo extra en modo qualify
    const qualifyField = state.mode === 'qualify' ? `
      <div class="cap-field">
        <label class="cap-label" for="cap-target">Valor del inmueble objetivo</label>
        <input id="cap-target" class="cap-input-cop" type="text"
               value="${formatCOP(state.targetPropertyValue)}"
               placeholder="$300.000.000"
               inputmode="numeric" autocomplete="off" />
        <span class="cap-input-error" id="cap-target-error"></span>
      </div>` : '';

    // Resultado
    const resultHTML = state.mode === 'capacity'
      ? renderCapacityResult(result, state)
      : renderQualifyResult(result, state);

    container.innerHTML = `
      <div class="cap-wrapper">
        <div class="cap-tabs">${tabs}</div>
        <div class="cap-inputs">
          <div class="cap-field">
            <label class="cap-label">Ingresos mensuales del hogar</label>
            <div class="cap-value-display">${formatCOP(state.monthlyIncome)}</div>
            <div class="cap-value-sub">${incomeSub}</div>
            <input class="cap-slider" type="range"
                   min="${INCOME_MIN_COP}" max="${INCOME_MAX_COP}"
                   step="250000" value="${state.monthlyIncome}"
                   aria-label="Ingreso mensual" />
          </div>
          <div class="cap-field">
            <label class="cap-label">Cuota inicial disponible</label>
            <div class="cap-option-group">${downOptions}</div>
          </div>
          <div class="cap-field">
            <label class="cap-label">Plazo deseado</label>
            <div class="cap-option-group">${termOptions}</div>
          </div>
          ${qualifyField}
        </div>
        <div class="cap-results">${resultHTML}</div>
      </div>`.trim();

    bindEvents(result);
  }

  // ── Event binding ─────────────────────────────────────────────────────────

  function bindEvents(result) {
    // Tabs de modo
    container.querySelectorAll('.cap-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        if (mode === state.mode) return;
        state.mode = mode;
        render();
        container.dispatchEvent(new CustomEvent('cap:modeChanged', {
          bubbles: true, detail: { mode },
        }));
      });
    });

    // Slider de ingreso
    const slider = container.querySelector('.cap-slider');
    if (slider) {
      slider.addEventListener('input', () => {
        state.monthlyIncome = parseInt(slider.value, 10);
        render();
      });
    }

    // Cuota inicial
    container.querySelectorAll('[data-down]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.downPaymentPct = parseFloat(btn.dataset.down);
        render();
      });
    });

    // Plazo
    container.querySelectorAll('[data-term]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.termMonths = parseInt(btn.dataset.term, 10);
        render();
      });
    });

    // Input inmueble objetivo (qualify)
    const targetInput = container.querySelector('#cap-target');
    if (targetInput) {
      targetInput.addEventListener('change', () => {
        const raw = targetInput.value.replace(/\$|\./g, '').replace(',', '.');
        const val = parseFloat(raw);
        if (!isNaN(val) && val > 0) {
          state.targetPropertyValue = val;
          render();
        }
      });
    }

    // Botón CTA: simular
    const ctaBtn = container.querySelector('[data-action="simulate"]');
    if (ctaBtn && result) {
      ctaBtn.addEventListener('click', () => {
        const affordability = state.mode === 'capacity'
          ? result
          : { maxCredit: state.targetPropertyValue * (1 - state.downPaymentPct),
              maxPropertyValue: state.targetPropertyValue,
              housingType: classifyPropertyType(state.targetPropertyValue).type };

        container.dispatchEvent(new CustomEvent('cap:simulate', {
          bubbles: true,
          detail: {
            principal:        Math.round(affordability.maxCredit),
            annualRate:       state.annualRate,
            termMonths:       state.termMonths,
            propertyValueCOP: Math.round(affordability.maxPropertyValue),
            downPaymentPct:   state.downPaymentPct,
            housingType:      affordability.housingType,
          },
        }));
      });
    }
  }

  // ── API pública ───────────────────────────────────────────────────────────

  function update(newState) {
    const prev = { ...state };
    state = { ...state, ...newState };
    const changed = Object.keys(newState).some(k => newState[k] !== prev[k]);
    if (changed) render();
  }

  function destroy() {
    container.innerHTML = '';
  }

  function getState() {
    return { ...state };
  }

  render();
  return { update, destroy, getState };
}