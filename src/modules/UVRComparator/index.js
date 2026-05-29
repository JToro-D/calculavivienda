/**
 * @file UVRComparator/index.js
 * @description Módulo comparador Pesos vs UVR — explica la diferencia entre
 *              tomar el crédito con cuota fija (pesos) o indexada al IPC (UVR).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CONCEPTO
 * ─────────────────────────────────────────────────────────────────────────────
 * Pesos : cuota fija durante todo el plazo, tasa EA más alta (~11%)
 * UVR   : cuota fija en UVR (sube con el IPC), tasa EA más baja (~7.5%)
 *
 * La UVR es mejor cuando la inflación proyectada < (tasa_pesos − tasa_UVR).
 * El break-even es exactamente esa diferencia.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * USO
 * ─────────────────────────────────────────────────────────────────────────────
 *   import { initUVRComparator } from './modules/UVRComparator/index.js';
 *
 *   const uvr = initUVRComparator(document.getElementById('uvr'), {
 *     loanCOP:   210_000_000,
 *     pesosRate: 11.0,
 *     uvrRate:   7.5,
 *     termMonths: 240,
 *   });
 *
 *   // Actualizar cuando el usuario cambia de banco (pesos rate):
 *   document.addEventListener('bcp:bankSelected', e => {
 *     uvr.update({ pesosRate: e.detail.bank.rateNoVIS.reference });
 *   });
 *
 * @version 1.0.0
 * @updated 2026-05-26
 * @author  Arquitecto — calculavivienda.com.co
 */

import {
  compareUVRvsPesos,
  fetchCurrentUVR,
  getFallbackUVR,
  projectUVRValue,
}                              from '../../calculators/uvr.js';
import {
  formatCOP, formatMillions,
  formatPct, formatRate, formatMonths,
}                              from '../../utils/formatters.js';
import { INFLATION_TARGET_PCT } from '../../config/constants.js';

// ─────────────────────────────────────────────────────────────────────────────
// CSS
// ─────────────────────────────────────────────────────────────────────────────

const CSS_ID = 'uvr-styles';

function injectCSS() {
  if (document.getElementById(CSS_ID)) return;
  const style = document.createElement('style');
  style.id    = CSS_ID;
  style.textContent = `
    .uvr-wrapper {
      font-family: var(--font-sans, system-ui, sans-serif);
      border-radius: var(--radius-lg, 12px);
      border: 1px solid var(--color-border, #E5E7EB);
      overflow: hidden;
    }

    /* ── Header ─────────────────────────────────────────────────────────── */
    .uvr-header {
      background: var(--color-secondary, #0A2540);
      padding: 12px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 8px;
    }
    .uvr-header-title { color: #fff; font-size: 14px; font-weight: 500; }
    .uvr-uvr-badge {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
    }
    .uvr-uvr-label { color: rgba(255,255,255,.6); }
    .uvr-uvr-value { color: #6EE7B7; font-weight: 600; font-size: 14px; }
    .uvr-uvr-source {
      font-size: 10px;
      padding: 1px 6px;
      border-radius: 10px;
      background: rgba(255,255,255,.1);
      color: rgba(255,255,255,.6);
    }
    .uvr-uvr-source--fallback { background: rgba(251,191,36,.2); color: #FCD34D; }
    .uvr-loading-dot {
      width: 8px; height: 8px;
      border-radius: 50%;
      background: #6EE7B7;
      animation: uvr-pulse 1.2s ease-in-out infinite;
      display: inline-block;
      margin-right: 4px;
    }
    @keyframes uvr-pulse { 0%,100%{opacity:1} 50%{opacity:.3} }

    /* ── Control de inflación ────────────────────────────────────────────── */
    .uvr-inflation {
      padding: 14px 16px;
      background: var(--color-bg, #F7F8FA);
      border-bottom: 1px solid var(--color-border, #E5E7EB);
    }
    .uvr-inflation-label {
      font-size: 12px;
      font-weight: 500;
      color: #6B7280;
      text-transform: uppercase;
      letter-spacing: .04em;
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    .uvr-inflation-value {
      font-size: 18px;
      font-weight: 600;
      color: var(--color-secondary, #0A2540);
    }
    .uvr-slider {
      -webkit-appearance: none;
      appearance: none;
      width: 100%;
      height: 6px;
      border-radius: 3px;
      background: #E5E7EB;
      outline: none;
      cursor: pointer;
      margin-bottom: 8px;
    }
    .uvr-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 20px; height: 20px;
      border-radius: 50%;
      background: var(--color-secondary, #0A2540);
      cursor: pointer;
      border: 2px solid #fff;
      box-shadow: 0 1px 4px rgba(0,0,0,.2);
    }
    .uvr-presets { display: flex; gap: 4px; flex-wrap: wrap; }
    .uvr-preset {
      padding: 3px 10px;
      border-radius: 20px;
      border: 1px solid #E5E7EB;
      background: #fff;
      font-size: 12px;
      color: #6B7280;
      cursor: pointer;
      transition: all .12s;
    }
    .uvr-preset--active {
      background: var(--color-secondary, #0A2540);
      color: #fff;
      border-color: transparent;
    }
    .uvr-preset:hover:not(.uvr-preset--active) { border-color: #9CA3AF; }

    /* ── Columnas de comparación ─────────────────────────────────────────── */
    .uvr-columns {
      display: grid;
      grid-template-columns: 1fr 1fr;
      border-bottom: 1px solid var(--color-border, #E5E7EB);
    }
    .uvr-col {
      padding: 14px 16px;
      border-right: 1px solid var(--color-border, #E5E7EB);
    }
    .uvr-col:last-child { border-right: none; }
    .uvr-col--winner { background: #EEF9F4; }
    .uvr-col--loser  { background: #FEF9F0; }

    .uvr-col-title {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: .04em;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .uvr-col-title--pesos  { color: var(--color-secondary, #0A2540); }
    .uvr-col-title--uvr    { color: #1E40AF; }
    .uvr-crown { font-size: 14px; }

    .uvr-stat { margin-bottom: 8px; }
    .uvr-stat-label { font-size: 11px; color: #9CA3AF; margin-bottom: 2px; }
    .uvr-stat-value { font-size: 14px; font-weight: 500; color: var(--color-secondary, #0A2540); }
    .uvr-stat-value--green { color: #065F46; }
    .uvr-stat-value--red   { color: #991B1B; }
    .uvr-stat-value--blue  { color: #1E40AF; }
    .uvr-stat-sub { font-size: 11px; color: #9CA3AF; }

    /* ── Tabla de cuotas por año ─────────────────────────────────────────── */
    .uvr-table-wrap { padding: 14px 16px; border-bottom: 1px solid #E5E7EB; }
    .uvr-table-title {
      font-size: 12px;
      font-weight: 500;
      color: #6B7280;
      text-transform: uppercase;
      letter-spacing: .04em;
      margin-bottom: 10px;
    }
    .uvr-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .uvr-th {
      padding: 7px 10px;
      text-align: right;
      font-size: 11px;
      font-weight: 500;
      color: #9CA3AF;
      text-transform: uppercase;
      letter-spacing: .04em;
      background: #F9FAFB;
      border-bottom: 1px solid #E5E7EB;
    }
    .uvr-th:first-child { text-align: left; }
    .uvr-td {
      padding: 8px 10px;
      text-align: right;
      border-bottom: 1px solid #F3F4F6;
      color: var(--color-secondary, #0A2540);
    }
    .uvr-td:first-child { text-align: left; color: #6B7280; font-size: 12px; }
    .uvr-td--cheaper { color: #065F46; font-weight: 500; }
    .uvr-td--pricier { color: #9CA3AF; }
    .uvr-td--diff    { color: #9CA3AF; font-size: 12px; }

    /* ── Recomendación ───────────────────────────────────────────────────── */
    .uvr-recommendation {
      padding: 14px 16px;
    }
    .uvr-rec-card {
      border-radius: 10px;
      padding: 14px 16px;
      border: 1px solid;
    }
    .uvr-rec-card--pesos {
      background: linear-gradient(135deg, #EEF9F4, #F0FFF4);
      border-color: #6EE7B7;
    }
    .uvr-rec-card--uvr {
      background: linear-gradient(135deg, #EFF6FF, #F0F7FF);
      border-color: #93C5FD;
    }
    .uvr-rec-card--neutral {
      background: #F9FAFB;
      border-color: #E5E7EB;
    }
    .uvr-rec-title {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 6px;
    }
    .uvr-rec-title--pesos   { color: #065F46; }
    .uvr-rec-title--uvr     { color: #1E40AF; }
    .uvr-rec-title--neutral { color: #374151; }
    .uvr-rec-body { font-size: 13px; color: #6B7280; line-height: 1.6; }
    .uvr-rec-body strong { color: #111827; }

    .uvr-breakeven {
      margin-top: 10px;
      padding: 10px 12px;
      background: #F3F4F6;
      border-radius: 8px;
      font-size: 12px;
      color: #6B7280;
      line-height: 1.6;
    }
    .uvr-breakeven strong { color: #111827; }

    .uvr-disclaimer {
      font-size: 11px;
      color: #9CA3AF;
      margin-top: 10px;
      line-height: 1.5;
    }
  `;
  document.head.appendChild(style);
}

// ─────────────────────────────────────────────────────────────────────────────
// ESTADO INICIAL
// ─────────────────────────────────────────────────────────────────────────────

const INFLATION_PRESETS = [2, 3, 4, 5, 6, 8, 10];

const DEFAULT_STATE = {
  loanCOP:         210_000_000,
  pesosRate:       11.0,
  uvrRate:         7.5,
  termMonths:      240,
  annualInflation: INFLATION_TARGET_PCT,  // del Banrep (3%)
  currentUVR:      getFallbackUVR().value,
  uvrSource:       'fallback',
  isLoading:       false,
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS DE RENDER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Genera la tabla de cuotas para años seleccionados.
 * Compara pesos vs UVR en los momentos más representativos.
 */
function renderPaymentTable(comparison, termMonths) {
  if (!comparison) return '';

  const checkYears = [1, 3, 5, 10, 15, Math.ceil(termMonths / 12)]
    .filter((y, i, arr) => y * 12 <= termMonths && arr.indexOf(y) === i);

  const rows = checkYears.map(year => {
    const monthIdx  = year * 12 - 1;
    const pesosRow  = comparison.pesos.rows?.[monthIdx];
    const uvrRow    = comparison.uvr.rows?.[monthIdx];
    if (!pesosRow || !uvrRow) return '';

    const pesosPayment = pesosRow.payment;
    const uvrPayment   = uvrRow.paymentCOP;
    const pesosWins    = pesosPayment <= uvrPayment;
    const diff         = Math.abs(pesosPayment - uvrPayment);

    return `
      <tr>
        <td class="uvr-td">Año ${year}</td>
        <td class="uvr-td ${pesosWins ? 'uvr-td--cheaper' : 'uvr-td--pricier'}">
          ${formatCOP(pesosPayment)}
        </td>
        <td class="uvr-td ${!pesosWins ? 'uvr-td--cheaper' : 'uvr-td--pricier'}">
          ${formatCOP(uvrPayment)}
        </td>
        <td class="uvr-td uvr-td--diff">
          ${pesosWins ? '↑' : '↓'} ${formatCOP(diff)}
        </td>
      </tr>`.trim();
  }).join('');

  return `
    <div class="uvr-table-wrap">
      <div class="uvr-table-title">Cuota mensual por año</div>
      <table class="uvr-table">
        <thead>
          <tr>
            <th class="uvr-th">Año</th>
            <th class="uvr-th">Pesos (fija)</th>
            <th class="uvr-th">UVR (variable)</th>
            <th class="uvr-th">Diferencia</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`.trim();
}

/**
 * Genera la tarjeta de recomendación según la inflación proyectada.
 */
function renderRecommendation(comparison) {
  if (!comparison) return '';

  const { breakEvenInflation, uvrIsBetterAt, interestDifference, uvr, pesos } = comparison;
  const absDiff = Math.abs(interestDifference);
  const beRounded = breakEvenInflation.toFixed(1);

  if (Math.abs(interestDifference) < 1_000_000) {
    return `
      <div class="uvr-rec-card uvr-rec-card--neutral">
        <div class="uvr-rec-title uvr-rec-title--neutral">Ambas opciones son similares</div>
        <div class="uvr-rec-body">
          Con la inflación proyectada, la diferencia en intereses totales es mínima.
          El punto de equilibrio está en exactamente <strong>${beRounded}% de IPC anual</strong>.
        </div>
      </div>`;
  }

  if (uvrIsBetterAt) {
    return `
      <div class="uvr-rec-card uvr-rec-card--uvr">
        <div class="uvr-rec-title uvr-rec-title--uvr">Con esta proyección: UVR es mejor</div>
        <div class="uvr-rec-body">
          Con IPC del <strong>${uvr.annualInflation}%</strong>, el crédito UVR pagaría
          <strong>${formatMillions(absDiff)} menos en intereses</strong> que el crédito en pesos.
          La cuota inicial sería menor pero crecería con la inflación cada año.
        </div>
      </div>`;
  }

  return `
    <div class="uvr-rec-card uvr-rec-card--pesos">
      <div class="uvr-rec-title uvr-rec-title--pesos">Con esta proyección: Pesos es mejor</div>
      <div class="uvr-rec-body">
        Con IPC del <strong>${uvr.annualInflation}%</strong>, el crédito en pesos pagaría
        <strong>${formatMillions(absDiff)} menos en intereses</strong> que el crédito UVR.
        La cuota fija es predecible y no depende de la inflación futura.
      </div>
    </div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// MÓDULO PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

export function initUVRComparator(container, initialState = {}) {
  if (!container) {
    console.error('[UVRComparator] Se requiere un elemento contenedor.');
    return null;
  }

  injectCSS();

  let state = { ...DEFAULT_STATE, ...initialState };

  // ── Cálculo ───────────────────────────────────────────────────────────────

  function compute() {
    return compareUVRvsPesos(
      state.loanCOP,
      state.currentUVR,
      state.uvrRate,
      state.pesosRate,
      state.termMonths,
      state.annualInflation,
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  function render() {
    const comparison = compute();

    // Presets de inflación
    const presets = INFLATION_PRESETS.map(pct => {
      const isActive = Math.abs(state.annualInflation - pct) < 0.1;
      return `<button class="uvr-preset${isActive ? ' uvr-preset--active' : ''}"
                data-ipc="${pct}">${pct}%</button>`;
    }).join('');

    // UVR badge
    const sourceLabel = state.isLoading
      ? `<span class="uvr-loading-dot"></span> Cargando...`
      : state.uvrSource === 'fallback'
        ? `<span class="uvr-uvr-source uvr-uvr-source--fallback">respaldo</span>`
        : `<span class="uvr-uvr-source">Banrep</span>`;

    // Columnas de comparación
    const c = comparison;
    let columnsHTML = '<div class="uvr-columns"><div class="uvr-col"><div class="uvr-col-title">Calculando...</div></div></div>';

    if (c) {
      const pesosWins = !c.uvrIsBetterAt;
      const pesosCss  = pesosWins ? 'uvr-col--winner' : 'uvr-col--loser';
      const uvrCss    = !pesosWins ? 'uvr-col--winner' : 'uvr-col--loser';
      const crownP    = pesosWins ? '<span class="uvr-crown">👑</span>' : '';
      const crownU    = !pesosWins ? '<span class="uvr-crown">👑</span>' : '';

      // UVR en año 5 y año 20
      const uvrYear5  = c.uvr.annualPayments?.find(r => r.year === 5)?.paymentCOP;
      const uvrFinal  = c.uvr.annualPayments?.at(-1)?.paymentCOP;

      columnsHTML = `
        <div class="uvr-columns">
          <div class="uvr-col ${pesosCss}">
            <div class="uvr-col-title uvr-col-title--pesos">
              ${crownP} Pesos · ${formatRate(c.pesos.annualRate)}
            </div>
            <div class="uvr-stat">
              <div class="uvr-stat-label">Cuota mensual</div>
              <div class="uvr-stat-value">
                ${formatCOP(c.pesos.payment)}
                <span class="uvr-stat-sub">(fija todo el plazo)</span>
              </div>
            </div>
            <div class="uvr-stat">
              <div class="uvr-stat-label">Total intereses</div>
              <div class="uvr-stat-value uvr-stat-value--red">
                ${formatMillions(c.pesos.totalInterestCOP)}
              </div>
            </div>
            <div class="uvr-stat">
              <div class="uvr-stat-label">Total pagado</div>
              <div class="uvr-stat-value">${formatMillions(c.pesos.totalPaidCOP)}</div>
            </div>
          </div>

          <div class="uvr-col ${uvrCss}">
            <div class="uvr-col-title uvr-col-title--uvr">
              ${crownU} UVR · ${formatRate(c.uvr.annualRate)} + IPC
            </div>
            <div class="uvr-stat">
              <div class="uvr-stat-label">Cuota mes 1</div>
              <div class="uvr-stat-value uvr-stat-value--blue">
                ${formatCOP(c.uvr.initialPaymentCOP)}
              </div>
            </div>
            ${uvrYear5 ? `
            <div class="uvr-stat">
              <div class="uvr-stat-label">Cuota año 5 (IPC ${formatPct(state.annualInflation, 0)} proy.)</div>
              <div class="uvr-stat-value uvr-stat-value--blue">
                ${formatCOP(uvrYear5)}
              </div>
            </div>` : ''}
            <div class="uvr-stat">
              <div class="uvr-stat-label">Total intereses (proyectado)</div>
              <div class="uvr-stat-value uvr-stat-value--red">
                ${formatMillions(c.uvr.totalInterestCOP)}
              </div>
            </div>
            <div class="uvr-stat">
              <div class="uvr-stat-label">Total pagado (proyectado)</div>
              <div class="uvr-stat-value">${formatMillions(c.uvr.totalPaidCOP)}</div>
            </div>
          </div>
        </div>`.trim();
    }

    container.innerHTML = `
      <div class="uvr-wrapper">
        <div class="uvr-header">
          <span class="uvr-header-title">Pesos vs UVR — ¿Cuál conviene más?</span>
          <div class="uvr-uvr-badge">
            <span class="uvr-uvr-label">UVR hoy:</span>
            <span class="uvr-uvr-value">$${state.currentUVR.toFixed(4)}</span>
            ${sourceLabel}
          </div>
        </div>

        <div class="uvr-inflation">
          <div class="uvr-inflation-label">
            <span>Proyección inflación anual (IPC)</span>
            <span class="uvr-inflation-value">${formatPct(state.annualInflation, 1)}</span>
          </div>
          <input class="uvr-slider" type="range"
                 min="0" max="20" step="0.5"
                 value="${state.annualInflation}"
                 aria-label="Proyección de inflación anual" />
          <div class="uvr-presets">${presets}</div>
        </div>

        ${columnsHTML}

        ${comparison ? renderPaymentTable(comparison, state.termMonths) : ''}

        <div class="uvr-recommendation">
          ${comparison ? renderRecommendation(comparison) : ''}
          ${comparison ? `
          <div class="uvr-breakeven">
            <strong>Punto de equilibrio:</strong> si el IPC se mantiene en
            <strong>${comparison.breakEvenInflation.toFixed(1)}%</strong> anual,
            ambas modalidades costarían lo mismo en intereses totales.<br>
            Por encima de ese IPC: pesos es mejor. Por debajo: UVR es mejor.
          </div>` : ''}
          <p class="uvr-disclaimer">
            * La proyección UVR asume un IPC constante del ${formatPct(state.annualInflation, 1)} anual.
            La inflación real varía cada mes. Consulta con tu banco las condiciones definitivas.
          </p>
        </div>
      </div>`.trim();

    bindEvents();
  }

  // ── Fetch async del UVR real ──────────────────────────────────────────────

  async function loadUVRValue() {
    state.isLoading = true;
    render();
    try {
      const result     = await fetchCurrentUVR();
      state.currentUVR = result.value;
      state.uvrSource  = result.source;
    } catch {
      // Mantener el fallback
    }
    state.isLoading = false;
    render();
  }

  // ── Event binding ─────────────────────────────────────────────────────────

  function bindEvents() {
    // Slider de inflación
    const slider = container.querySelector('.uvr-slider');
    if (slider) {
      slider.addEventListener('input', () => {
        state.annualInflation = parseFloat(slider.value);
        render();
      });
    }

    // Presets de inflación
    container.querySelectorAll('[data-ipc]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.annualInflation = parseFloat(btn.dataset.ipc);
        render();
      });
    });
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

  // Render inicial con fallback UVR, luego intenta obtener el valor real
  render();
  loadUVRValue();

  return { update, destroy, getState };
}