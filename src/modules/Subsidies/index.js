/**
 * @file Subsidies/index.js
 * @description Módulo de subsidios de vivienda vigentes en Colombia 2026.
 *              Verifica elegibilidad, calcula el monto del subsidio y muestra
 *              el impacto real sobre el crédito hipotecario.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ESTADO DE PROGRAMAS EN 2026
 * ─────────────────────────────────────────────────────────────────────────────
 *   ✅ Cajas de Compensación Familiar — activo
 *   ⛔ Mi Casa Ya (Gobierno Nacional) — suspendido sin nuevas inscripciones
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * USO
 * ─────────────────────────────────────────────────────────────────────────────
 *   import { initSubsidies } from './modules/Subsidies/index.js';
 *
 *   const sub = initSubsidies(document.getElementById('subsidios'), {
 *     monthlyIncomeCOP: 3_000_000,
 *     propertyValueCOP: 200_000_000,
 *   });
 *
 *   // Cuando el usuario aplica el subsidio a su simulación:
 *   container.addEventListener('sub:subsidyApplied', e => {
 *     amtTable.update({ principal: e.detail.newLoanCOP });
 *   });
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * EVENTOS EMITIDOS
 * ─────────────────────────────────────────────────────────────────────────────
 *   'sub:subsidyApplied' → { subsidyAmountCOP, newLoanCOP, originalLoanCOP }
 *
 * @version 1.0.0
 * @updated 2026-05-26
 * @author  Arquitecto — calculavivienda.com.co
 */

import {
  checkSubsidyEligibility,
  calcSubsidyImpact,
  getDistrictPrograms,
  getCajasRangesInCOP,
  MI_CASA_YA_STATUS,
  CAJAS_REQUIREMENTS,
}                              from '../../config/subsidios.js';
import {
  formatCOP, formatMillions, formatPct,
}                              from '../../utils/formatters.js';
import { classifyPropertyType } from '../../utils/validators.js';
import {
  SMMLV, VIS_MAX_COP, VIP_MAX_COP,
  INCOME_MIN_COP, INCOME_MAX_COP,
}                              from '../../config/constants.js';

// ─────────────────────────────────────────────────────────────────────────────
// CSS
// ─────────────────────────────────────────────────────────────────────────────

const CSS_ID = 'sub-styles';

function injectCSS() {
  if (document.getElementById(CSS_ID)) return;
  const style = document.createElement('style');
  style.id    = CSS_ID;
  style.textContent = `
    .sub-wrapper {
      font-family: var(--font-sans, system-ui, sans-serif);
      border-radius: var(--radius-lg, 12px);
      border: 1px solid var(--color-border, #E5E7EB);
      overflow: hidden;
    }

    /* ── Header ─────────────────────────────────────────────────────────── */
    .sub-header {
      background: var(--color-secondary, #0A2540);
      padding: 12px 16px;
    }
    .sub-header-title { color: #fff; font-size: 14px; font-weight: 500; }
    .sub-header-sub   { color: rgba(255,255,255,.6); font-size: 12px; margin-top: 2px; }

    /* ── Banner Mi Casa Ya suspendido ────────────────────────────────────── */
    .sub-mi-casa-ya {
      padding: 10px 16px;
      background: #FFFBEB;
      border-bottom: 1px solid #FDE68A;
      display: flex;
      align-items: flex-start;
      gap: 10px;
    }
    .sub-mcy-icon { font-size: 16px; flex-shrink: 0; margin-top: 1px; }
    .sub-mcy-content { flex: 1; }
    .sub-mcy-title {
      font-size: 13px;
      font-weight: 600;
      color: #92400E;
      margin-bottom: 2px;
    }
    .sub-mcy-body { font-size: 12px; color: #78350F; line-height: 1.5; }
    .sub-mcy-link {
      display: inline-block;
      margin-top: 4px;
      font-size: 12px;
      color: #B45309;
      text-decoration: underline;
    }

    /* ── Inputs ──────────────────────────────────────────────────────────── */
    .sub-inputs {
      padding: 14px 16px;
      background: var(--color-bg, #F7F8FA);
      border-bottom: 1px solid var(--color-border, #E5E7EB);
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .sub-field { display: flex; flex-direction: column; gap: 6px; }
    .sub-label {
      font-size: 12px;
      font-weight: 500;
      color: #6B7280;
      text-transform: uppercase;
      letter-spacing: .04em;
    }
    .sub-value-display { font-size: 20px; font-weight: 500; color: var(--color-secondary, #0A2540); }
    .sub-value-sub     { font-size: 12px; color: #9CA3AF; margin-top: 1px; }

    .sub-slider {
      -webkit-appearance: none;
      appearance: none;
      width: 100%;
      height: 6px;
      border-radius: 3px;
      background: #E5E7EB;
      outline: none;
      cursor: pointer;
    }
    .sub-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 20px; height: 20px;
      border-radius: 50%;
      background: var(--color-primary, #006241);
      cursor: pointer;
      border: 2px solid #fff;
      box-shadow: 0 1px 4px rgba(0,0,0,.2);
    }

    .sub-input-cop {
      padding: 8px 12px;
      border-radius: 8px;
      border: 1px solid #E5E7EB;
      font-size: 15px;
      font-weight: 500;
      color: var(--color-secondary, #0A2540);
      background: #fff;
      width: 100%;
      box-sizing: border-box;
    }
    .sub-input-cop:focus {
      outline: none;
      border-color: var(--color-primary, #006241);
      box-shadow: 0 0 0 3px rgba(0,98,65,.1);
    }

    /* Toggle vivienda nueva */
    .sub-toggle { display: flex; gap: 4px; }
    .sub-toggle-btn {
      flex: 1;
      padding: 7px 12px;
      border-radius: 6px;
      border: 1px solid #E5E7EB;
      background: #fff;
      font-size: 13px;
      color: #374151;
      cursor: pointer;
      transition: all .12s;
      text-align: center;
    }
    .sub-toggle-btn--active {
      background: var(--color-primary, #006241);
      color: #fff;
      border-color: transparent;
      font-weight: 500;
    }

    /* ── Resultado ───────────────────────────────────────────────────────── */
    .sub-result { padding: 14px 16px; border-bottom: 1px solid #E5E7EB; }

    .sub-result-card {
      border-radius: 10px;
      padding: 14px;
      border: 1px solid;
      margin-bottom: 12px;
    }
    .sub-result-card--eligible { background: #EEF9F4; border-color: #6EE7B7; }
    .sub-result-card--novis    { background: #FEF9F0; border-color: #FCD34D; }
    .sub-result-card--used     { background: #FEF2F2; border-color: #FCA5A5; }
    .sub-result-card--notnew   { background: #F3F4F6; border-color: #E5E7EB; }

    .sub-result-icon { font-size: 18px; margin-bottom: 4px; }
    .sub-result-title {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 4px;
    }
    .sub-result-title--green { color: #065F46; }
    .sub-result-title--amber { color: #92400E; }
    .sub-result-title--red   { color: #991B1B; }
    .sub-result-title--gray  { color: #374151; }
    .sub-result-body { font-size: 13px; color: #6B7280; line-height: 1.6; }
    .sub-result-body strong { color: #111827; }

    /* Subsidy amount highlight */
    .sub-amount {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #D1FAE5;
      border-radius: 6px;
      padding: 4px 10px;
      margin: 6px 0;
    }
    .sub-amount-value { font-size: 18px; font-weight: 600; color: #065F46; }
    .sub-amount-label { font-size: 12px; color: #047857; }

    /* Impacto en el crédito */
    .sub-impact {
      background: #fff;
      border: 1px solid #E5E7EB;
      border-radius: 8px;
      padding: 10px 12px;
      margin-top: 8px;
    }
    .sub-impact-title { font-size: 11px; font-weight: 500; color: #6B7280; text-transform: uppercase; letter-spacing: .04em; margin-bottom: 8px; }
    .sub-impact-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
    .sub-impact-item { }
    .sub-impact-label { font-size: 11px; color: #9CA3AF; margin-bottom: 2px; }
    .sub-impact-value { font-size: 13px; font-weight: 500; color: #111827; }
    .sub-impact-value--green { color: #065F46; }
    .sub-impact-value--line  { text-decoration: line-through; color: #9CA3AF; }

    .sub-apply-btn {
      width: 100%;
      margin-top: 10px;
      padding: 10px;
      border-radius: 8px;
      border: none;
      background: var(--color-primary, #006241);
      color: #fff;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: opacity .15s;
    }
    .sub-apply-btn:hover { opacity: .9; }

    /* ── Programas distritales ───────────────────────────────────────────── */
    .sub-district { padding: 12px 16px; border-bottom: 1px solid #E5E7EB; }
    .sub-district-title {
      font-size: 12px;
      font-weight: 500;
      color: #6B7280;
      text-transform: uppercase;
      letter-spacing: .04em;
      margin-bottom: 8px;
    }
    .sub-district-cards { display: flex; flex-direction: column; gap: 6px; }
    .sub-district-card {
      background: #fff;
      border: 1px solid #E5E7EB;
      border-radius: 8px;
      padding: 10px 12px;
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 8px;
    }
    .sub-district-card-city {
      font-size: 11px;
      font-weight: 500;
      color: #fff;
      background: var(--color-secondary, #0A2540);
      padding: 2px 7px;
      border-radius: 4px;
      flex-shrink: 0;
    }
    .sub-district-card-name { font-size: 13px; font-weight: 500; color: #111827; }
    .sub-district-card-amount { font-size: 13px; font-weight: 600; color: #065F46; flex-shrink: 0; }
    .sub-district-card-desc { font-size: 12px; color: #6B7280; margin-top: 2px; line-height: 1.5; }
    .sub-district-card-link { font-size: 11px; color: #6B7280; text-decoration: underline; }

    /* ── Requisitos ──────────────────────────────────────────────────────── */
    .sub-requirements { padding: 10px 16px; }
    .sub-req-toggle {
      width: 100%;
      padding: 8px 12px;
      border-radius: 6px;
      border: 1px solid #E5E7EB;
      background: #F9FAFB;
      font-size: 13px;
      color: #374151;
      cursor: pointer;
      text-align: left;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .sub-req-toggle:hover { background: #F3F4F6; }
    .sub-req-list {
      margin-top: 8px;
      padding: 10px 12px;
      background: #F9FAFB;
      border-radius: 6px;
      border: 1px solid #E5E7EB;
    }
    .sub-req-item {
      font-size: 12px;
      color: #6B7280;
      padding: 4px 0;
      border-bottom: 1px solid #F3F4F6;
      line-height: 1.5;
      display: flex;
      gap: 6px;
    }
    .sub-req-item:last-child { border-bottom: none; }
    .sub-req-bullet { color: var(--color-primary, #006241); flex-shrink: 0; }

    /* ── Rangos de Cajas ─────────────────────────────────────────────────── */
    .sub-ranges {
      padding: 12px 16px;
      border-top: 1px solid #E5E7EB;
    }
    .sub-ranges-title {
      font-size: 12px;
      font-weight: 500;
      color: #6B7280;
      text-transform: uppercase;
      letter-spacing: .04em;
      margin-bottom: 8px;
    }
    .sub-range-row {
      display: flex;
      align-items: center;
      padding: 7px 0;
      border-bottom: 1px solid #F3F4F6;
      gap: 10px;
      font-size: 13px;
    }
    .sub-range-row:last-child { border-bottom: none; }
    .sub-range-income { flex: 1; color: #6B7280; }
    .sub-range-subsidy { font-weight: 500; color: #065F46; }
  `;
  document.head.appendChild(style);
}

// ─────────────────────────────────────────────────────────────────────────────
// ESTADO INICIAL
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_STATE = {
  monthlyIncomeCOP: 3_000_000,
  propertyValueCOP: 200_000_000,
  downPaymentPct:   0.20,
  isNewHousing:     true,
  showRequirements: false,
};

// ─────────────────────────────────────────────────────────────────────────────
// MÓDULO PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

export function initSubsidies(container, initialState = {}) {
  if (!container) {
    console.error('[Subsidies] Se requiere un elemento contenedor.');
    return null;
  }

  injectCSS();

  let state = { ...DEFAULT_STATE, ...initialState };

  // ── Helpers de render ─────────────────────────────────────────────────────

  function renderEligibilityResult(eligibility, impact) {
    if (!eligibility) {
      return `<div class="sub-result-card sub-result-card--novis">
        <div class="sub-result-title sub-result-title--gray">Ingresa tus datos para verificar</div>
      </div>`;
    }

    const housing = classifyPropertyType(state.propertyValueCOP);

    // Inmueble no VIS
    if (!eligibility.eligible && eligibility.notes?.some(n => n.includes('VIS'))) {
      return `<div class="sub-result-card sub-result-card--novis">
        <div class="sub-result-icon">🏢</div>
        <div class="sub-result-title sub-result-title--amber">Inmueble No VIS — sin subsidio</div>
        <div class="sub-result-body">
          El inmueble (<strong>${formatCOP(state.propertyValueCOP)}</strong>) supera el tope VIS
          de <strong>${formatCOP(VIS_MAX_COP)}</strong>. Los subsidios de vivienda aplican
          exclusivamente para VIS (hasta <strong>${formatCOP(VIS_MAX_COP)}</strong>) y VIP
          (hasta <strong>${formatCOP(VIP_MAX_COP)}</strong>).
        </div>
      </div>`;
    }

    // Vivienda no nueva
    if (!eligibility.eligible && eligibility.notes?.some(n => n.includes('vivienda nueva'))) {
      return `<div class="sub-result-card sub-result-card--notnew">
        <div class="sub-result-icon">🏠</div>
        <div class="sub-result-title sub-result-title--gray">Vivienda usada — sin subsidio de Caja</div>
        <div class="sub-result-body">
          Los subsidios de Cajas de Compensación aplican solo para vivienda nueva.
          Si el inmueble es VIS nuevo, selecciona "Vivienda nueva" para verificar.
        </div>
      </div>`;
    }

    // Ingreso alto
    if (!eligibility.eligible) {
      return `<div class="sub-result-card sub-result-card--used">
        <div class="sub-result-icon">ℹ️</div>
        <div class="sub-result-title sub-result-title--red">Sin subsidio por nivel de ingresos</div>
        <div class="sub-result-body">
          Con ingresos de <strong>${formatCOP(state.monthlyIncomeCOP)}</strong> el hogar
          supera el límite de 4 SMMLV (<strong>${formatCOP(4 * SMMLV)}</strong>) para
          acceder a subsidios de Caja de Compensación.
        </div>
      </div>`;
    }

    // Elegible
    const sub = eligibility.subsidies[0];
    const impactHTML = impact ? `
      <div class="sub-impact">
        <div class="sub-impact-title">Impacto en el crédito</div>
        <div class="sub-impact-grid">
          <div class="sub-impact-item">
            <div class="sub-impact-label">Crédito original</div>
            <div class="sub-impact-value sub-impact-value--line">${formatCOP(impact.originalLoan)}</div>
          </div>
          <div class="sub-impact-item">
            <div class="sub-impact-label">Con subsidio</div>
            <div class="sub-impact-value sub-impact-value--green">${formatCOP(impact.reducedLoan)}</div>
          </div>
          <div class="sub-impact-item">
            <div class="sub-impact-label">Reducción del crédito</div>
            <div class="sub-impact-value sub-impact-value--green">${formatCOP(impact.loanReduction)}</div>
          </div>
          <div class="sub-impact-item">
            <div class="sub-impact-label">Entrada efectiva</div>
            <div class="sub-impact-value">${formatPct(impact.effectiveDownPct * 100, 1)}</div>
          </div>
        </div>
        <button class="sub-apply-btn" data-action="apply-subsidy"
                data-subsidy="${sub.subsidyAmountCOP}"
                data-new-loan="${impact.reducedLoan}"
                data-original-loan="${impact.originalLoan}">
          Aplicar subsidio a mi simulación →
        </button>
      </div>` : '';

    return `<div class="sub-result-card sub-result-card--eligible">
      <div class="sub-result-icon">✅</div>
      <div class="sub-result-title sub-result-title--green">¡Elegible para subsidio!</div>
      <div class="sub-result-body">
        Con ingresos de <strong>${formatCOP(state.monthlyIncomeCOP)}</strong>,
        puede acceder al subsidio de Caja de Compensación Familiar:
      </div>
      <div class="sub-amount">
        <span class="sub-amount-value">${formatCOP(sub.subsidyAmountCOP)}</span>
        <span class="sub-amount-label">${sub.subsidySMMLV} SMMLV</span>
      </div>
      ${impactHTML}
    </div>`;
  }

  function renderDistrictPrograms() {
    const programs = getDistrictPrograms();
    if (!programs.length) return '';

    const cards = programs.map(p => {
      const amount = p.amountCOP
        ? `<span class="sub-district-card-amount">${formatCOP(p.amountCOP)}</span>`
        : p.amountMaxCOP
          ? `<span class="sub-district-card-amount">hasta ${formatCOP(p.amountMaxCOP)}</span>`
          : '';
      return `
        <div class="sub-district-card">
          <div>
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
              <span class="sub-district-card-city">${p.city}</span>
              <span class="sub-district-card-name">${p.name}</span>
            </div>
            <div class="sub-district-card-desc">${p.description}</div>
            ${p.status === 'verify'
              ? `<a class="sub-district-card-link" href="${p.url}" target="_blank" rel="noopener">Verificar vigencia →</a>`
              : `<a class="sub-district-card-link" href="${p.url}" target="_blank" rel="noopener">Más información →</a>`}
          </div>
          ${amount}
        </div>`.trim();
    }).join('');

    return `
      <div class="sub-district">
        <div class="sub-district-title">Programas distritales</div>
        <div class="sub-district-cards">${cards}</div>
      </div>`.trim();
  }

  function renderRanges() {
    const ranges = getCajasRangesInCOP();
    const rows   = ranges.map(r => `
      <div class="sub-range-row">
        <span class="sub-range-income">
          Ingreso hasta ${formatCOP(r.incomeMaxCOP)}/mes (${r.incomeMaxSMMLV} SMMLV)
        </span>
        <span class="sub-range-subsidy">
          Subsidio hasta ${formatCOP(r.subsidyMaxCOP)}
        </span>
      </div>`).join('');

    return `
      <div class="sub-ranges">
        <div class="sub-ranges-title">Rangos de subsidio — Cajas de Compensación</div>
        ${rows}
      </div>`.trim();
  }

  // ── Render principal ──────────────────────────────────────────────────────

  function render() {
    const incomeSmmlv = (state.monthlyIncomeCOP / SMMLV).toFixed(1);
    const housing     = classifyPropertyType(state.propertyValueCOP);
    const downCOP     = Math.round(state.propertyValueCOP * state.downPaymentPct);

    // Calcular elegibilidad e impacto
    const eligibility = checkSubsidyEligibility(
      state.monthlyIncomeCOP,
      state.propertyValueCOP,
      state.isNewHousing,
    );
    const subsidyAmount = eligibility?.subsidies?.[0]?.subsidyAmountCOP ?? 0;
    const impact = subsidyAmount > 0
      ? calcSubsidyImpact(state.propertyValueCOP, downCOP, subsidyAmount)
      : null;

    // Notas adicionales (Mi Casa Ya, programas distritales)
    const notesHTML = (eligibility?.notes ?? [])
      .filter(n => !n.includes('VIS') && !n.includes('nueva') && !n.includes('ingresos'))
      .map(n => `<p style="font-size:11px;color:#6B7280;margin-top:6px;line-height:1.5">${n}</p>`)
      .join('');

    const reqChevron = state.showRequirements ? '▲' : '▼';
    const reqList    = state.showRequirements
      ? `<div class="sub-req-list">${CAJAS_REQUIREMENTS.map(r =>
          `<div class="sub-req-item"><span class="sub-req-bullet">✓</span>${r}</div>`
        ).join('')}</div>`
      : '';

    container.innerHTML = `
      <div class="sub-wrapper">

        <div class="sub-header">
          <div class="sub-header-title">Subsidios de vivienda — Colombia 2026</div>
          <div class="sub-header-sub">Cajas de Compensación · Programas distritales</div>
        </div>

        <div class="sub-mi-casa-ya">
          <span class="sub-mcy-icon">⚠️</span>
          <div class="sub-mcy-content">
            <div class="sub-mcy-title">Mi Casa Ya — Suspendido en 2026</div>
            <div class="sub-mcy-body">
              El Gobierno Nacional no tiene cupos disponibles para nuevas
              inscripciones al programa Mi Casa Ya en la vigencia actual.
              <a class="sub-mcy-link" href="${MI_CASA_YA_STATUS.checkUrl}"
                 target="_blank" rel="noopener">
                Verificar estado en minvivienda.gov.co →
              </a>
            </div>
          </div>
        </div>

        <div class="sub-inputs">
          <div class="sub-field">
            <label class="sub-label">Ingresos mensuales del hogar</label>
            <div class="sub-value-display">${formatCOP(state.monthlyIncomeCOP)}</div>
            <div class="sub-value-sub">${incomeSmmlv} SMMLV</div>
            <input class="sub-slider" type="range"
                   min="${INCOME_MIN_COP}" max="${INCOME_MAX_COP}"
                   step="250000" value="${state.monthlyIncomeCOP}"
                   aria-label="Ingreso mensual" />
          </div>
          <div class="sub-field">
            <label class="sub-label" for="sub-property">Valor del inmueble</label>
            <input id="sub-property" class="sub-input-cop" type="text"
                   value="${formatCOP(state.propertyValueCOP)}"
                   inputmode="numeric" autocomplete="off" />
            <div class="sub-value-sub">
              Categoría: <strong>${housing.label}</strong>
              ${housing.eligible ? `· Aplica a subsidios VIS/VIP` : '· No aplica a subsidios'}
            </div>
          </div>
          <div class="sub-field">
            <label class="sub-label">Tipo de vivienda</label>
            <div class="sub-toggle">
              <button class="sub-toggle-btn${state.isNewHousing ? ' sub-toggle-btn--active' : ''}"
                      data-housing="true">🏗️ Vivienda nueva</button>
              <button class="sub-toggle-btn${!state.isNewHousing ? ' sub-toggle-btn--active' : ''}"
                      data-housing="false">🏠 Vivienda usada</button>
            </div>
          </div>
        </div>

        <div class="sub-result">
          ${renderEligibilityResult(eligibility, impact)}
          ${notesHTML}
        </div>

        ${renderDistrictPrograms()}
        ${renderRanges()}

        <div class="sub-requirements">
          <button class="sub-req-toggle" data-action="toggle-req">
            <span>Requisitos — Caja de Compensación</span>
            <span>${reqChevron}</span>
          </button>
          ${reqList}
        </div>

      </div>`.trim();

    bindEvents(impact);
  }

  // ── Event binding ─────────────────────────────────────────────────────────

  function bindEvents(impact) {
    // Slider de ingreso
    const slider = container.querySelector('.sub-slider');
    if (slider) {
      slider.addEventListener('input', () => {
        state.monthlyIncomeCOP = parseInt(slider.value, 10);
        render();
      });
    }

    // Input de valor del inmueble
    const propInput = container.querySelector('#sub-property');
    if (propInput) {
      propInput.addEventListener('change', () => {
        const raw = propInput.value.replace(/[\$\.\s]/g, '').replace(',', '.');
        const val = parseFloat(raw);
        if (!isNaN(val) && val > 0) {
          state.propertyValueCOP = val;
          render();
        }
      });
    }

    // Toggle vivienda nueva/usada
    container.querySelectorAll('[data-housing]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.isNewHousing = btn.dataset.housing === 'true';
        render();
      });
    });

    // Toggle requisitos
    const reqBtn = container.querySelector('[data-action="toggle-req"]');
    if (reqBtn) {
      reqBtn.addEventListener('click', () => {
        state.showRequirements = !state.showRequirements;
        render();
      });
    }

    // Aplicar subsidio a la simulación
    const applyBtn = container.querySelector('[data-action="apply-subsidy"]');
    if (applyBtn && impact) {
      applyBtn.addEventListener('click', () => {
        const subsidyAmount = parseFloat(applyBtn.dataset.subsidy);
        const newLoan       = parseFloat(applyBtn.dataset.newLoan);
        const originalLoan  = parseFloat(applyBtn.dataset.originalLoan);

        container.dispatchEvent(new CustomEvent('sub:subsidyApplied', {
          bubbles: true,
          detail: { subsidyAmountCOP: subsidyAmount, newLoanCOP: newLoan, originalLoanCOP: originalLoan },
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

  function destroy() { container.innerHTML = ''; }
  function getState() { return { ...state }; }

  render();
  return { update, destroy, getState };
}