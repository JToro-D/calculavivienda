/**
 * @file components/ExportPDF.js
 * @description Botón de exportación a PDF con estados de carga, éxito y error.
 *              Envuelve la lógica de utils/pdfExport.js en un componente
 *              reutilizable que puede colocarse en cualquier módulo.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * RESPONSABILIDAD
 * ─────────────────────────────────────────────────────────────────────────────
 *   utils/pdfExport.js  → genera el PDF (matemáticas + jsPDF)
 *   ExportPDF.js        → botón, estados UI, feedback al usuario
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DOS MODOS DE USO
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * 1. FUNCIÓN PURA — solo el HTML del botón (sin lógica de clic):
 *
 *    import { renderExportPDFButton } from './components/ExportPDF.js';
 *
 *    container.innerHTML = renderExportPDFButton({
 *      label:   'Descargar PDF',
 *      variant: 'primary',
 *      size:    'md',
 *    });
 *
 * 2. COMPONENTE MONTADO — botón con manejo completo de estados:
 *
 *    import { initExportPDF } from './components/ExportPDF.js';
 *
 *    const btn = initExportPDF(container, {
 *      label:  'Descargar tabla',
 *      getPDFParams: () => ({
 *        simulatorInputs:   myInputs,
 *        amortizationTable: myTable,
 *        annualSummary:     myAnnual,
 *        bankComparisons:   myBanks,
 *      }),
 *    });
 *
 *    container.addEventListener('pdfe:generated', e => {
 *      if (e.detail.success) console.log('PDF listo');
 *    });
 *
 *    btn.setDisabled(true);
 *    btn.destroy();
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * EVENTOS EMITIDOS
 * ─────────────────────────────────────────────────────────────────────────────
 *   'pdfe:click'      → {}                    — antes de generar
 *   'pdfe:generated'  → { success, error? }   — tras intentar generar
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ESTADOS DEL BOTÓN
 * ─────────────────────────────────────────────────────────────────────────────
 *   idle        → listo para hacer clic
 *   loading     → generando PDF (deshabilita el botón)
 *   success     → descarga iniciada (flash verde 2s, luego vuelve a idle)
 *   error       → muestra mensaje de error (5s, luego vuelve a idle)
 *   unavailable → jsPDF no está cargado (botón deshabilitado con aviso)
 *
 * @version 1.0.0
 * @updated 2026-05-26
 * @author  Arquitecto — calculavivienda.com.co
 */

import {
  generateAmortizationPDF,
  isPDFReady,
}                        from '../utils/pdfExport.js';

// ─────────────────────────────────────────────────────────────────────────────
// CSS
// ─────────────────────────────────────────────────────────────────────────────

const CSS_ID = 'pdfe-styles';

function injectCSS() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(CSS_ID)) return;
  const style = document.createElement('style');
  style.id    = CSS_ID;
  style.textContent = `
    /* ── Botón ───────────────────────────────────────────────────────────── */
    .pdfe-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 7px;
      border: none;
      border-radius: 8px;
      font-family: var(--font-sans, system-ui, sans-serif);
      font-weight: 500;
      cursor: pointer;
      transition: opacity .15s, transform .1s, background .15s;
      white-space: nowrap;
      line-height: 1;
    }
    .pdfe-btn:active:not(:disabled) { transform: scale(.98); }
    .pdfe-btn:disabled { opacity: .5; cursor: not-allowed; }

    /* Tamaños */
    .pdfe-btn--sm  { font-size: 12px; padding: 6px 12px;  }
    .pdfe-btn--md  { font-size: 13px; padding: 8px 16px;  }
    .pdfe-btn--lg  { font-size: 14px; padding: 11px 20px; }

    /* Variantes */
    .pdfe-btn--primary {
      background: var(--color-primary, #006241);
      color: #fff;
    }
    .pdfe-btn--primary:hover:not(:disabled) { opacity: .9; }

    .pdfe-btn--secondary {
      background: var(--color-secondary, #0A2540);
      color: #fff;
    }
    .pdfe-btn--secondary:hover:not(:disabled) { opacity: .88; }

    .pdfe-btn--ghost {
      background: transparent;
      color: var(--color-primary, #006241);
      border: 1px solid var(--color-primary, #006241);
    }
    .pdfe-btn--ghost:hover:not(:disabled) {
      background: rgba(0,98,65,.06);
    }

    .pdfe-btn--dark {
      background: rgba(255,255,255,.15);
      color: #fff;
      border: 1px solid rgba(255,255,255,.3);
    }
    .pdfe-btn--dark:hover:not(:disabled) { background: rgba(255,255,255,.22); }

    /* Estados */
    .pdfe-btn--loading  { opacity: .7; cursor: wait; }
    .pdfe-btn--success  { background: #15803D !important; color: #fff !important; }
    .pdfe-btn--error    { background: #B91C1C !important; color: #fff !important; }
    .pdfe-btn--unavailable { opacity: .5; cursor: not-allowed; }

    /* Spinner de carga */
    .pdfe-spinner {
      width: 13px; height: 13px;
      border: 2px solid rgba(255,255,255,.35);
      border-top-color: #fff;
      border-radius: 50%;
      animation: pdfe-spin .65s linear infinite;
      flex-shrink: 0;
    }
    .pdfe-btn--ghost .pdfe-spinner,
    .pdfe-btn--dark  .pdfe-spinner {
      border-color: rgba(0,98,65,.25);
      border-top-color: var(--color-primary, #006241);
    }
    @keyframes pdfe-spin { to { transform: rotate(360deg); } }

    /* Ícono */
    .pdfe-icon { font-size: 14px; flex-shrink: 0; }

    /* Mensaje de error inline */
    .pdfe-error-msg {
      margin-top: 6px;
      font-size: 11px;
      color: #DC2626;
      line-height: 1.5;
    }

    /* Aviso de jsPDF no disponible */
    .pdfe-unavailable-msg {
      margin-top: 6px;
      font-size: 11px;
      color: #92400E;
      line-height: 1.5;
    }

    /* Wrapper del botón + mensajes */
    .pdfe-wrapper { display: inline-flex; flex-direction: column; }
    .pdfe-wrapper--block { display: flex; }
    .pdfe-wrapper--block .pdfe-btn { width: 100%; }
  `;
  document.head.appendChild(style);
}

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS (JSDoc)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {'primary'|'secondary'|'ghost'|'dark'} ButtonVariant
 * @typedef {'sm'|'md'|'lg'}                        ButtonSize
 * @typedef {'idle'|'loading'|'success'|'error'|'unavailable'} ButtonState
 */

/**
 * @typedef {Object} ExportPDFConfig
 * @property {string}         [label='Descargar PDF']  - Texto del botón en estado idle
 * @property {string}         [labelLoading]           - Texto mientras genera
 * @property {string}         [labelSuccess]           - Texto tras éxito
 * @property {ButtonVariant}  [variant='primary']
 * @property {ButtonSize}     [size='md']
 * @property {boolean}        [block=false]            - Si ocupa el 100% del ancho
 * @property {boolean}        [disabled=false]
 * @property {string}         [icon='⬇']              - Ícono del botón
 * @property {Function}       [getPDFParams]           - () => params para generateAmortizationPDF
 */

// ─────────────────────────────────────────────────────────────────────────────
// FUNCIÓN PURA — renderExportPDFButton
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Genera el HTML del botón de exportación PDF.
 * Solo el botón — sin lógica de clic ni estados dinámicos.
 *
 * @param {Partial<ExportPDFConfig>} config
 * @param {ButtonState} [state='idle']
 * @param {string}      [errorMsg]
 * @returns {string}
 *
 * @example
 * container.innerHTML = renderExportPDFButton({ label:'Descargar tabla', variant:'ghost' });
 */
export function renderExportPDFButton(config = {}, state = 'idle', errorMsg = '') {
  const {
    label         = 'Descargar PDF',
    labelLoading  = 'Generando...',
    labelSuccess  = '✓ Descargado',
    variant       = 'primary',
    size          = 'md',
    block         = false,
    disabled      = false,
    icon          = '⬇',
  } = config;

  const pdfReady   = isPDFReady();
  const realState  = !pdfReady ? 'unavailable' : state;
  const isDisabled = disabled || realState === 'loading' || realState === 'unavailable';

  // Label según estado
  const displayLabel =
    realState === 'loading' ? labelLoading :
    realState === 'success' ? labelSuccess :
    realState === 'error'   ? '✗ Error' :
    label;

  // Ícono según estado
  const displayIcon =
    realState === 'loading'
      ? '<span class="pdfe-spinner"></span>'
      : realState === 'success'
        ? ''
        : `<span class="pdfe-icon" aria-hidden="true">${icon}</span>`;

  const stateClass   = realState !== 'idle' ? ` pdfe-btn--${realState}` : '';
  const blockClass   = block ? ' pdfe-wrapper--block' : '';
  const disabledAttr = isDisabled ? ' disabled' : '';

  const errorHTML = realState === 'error' && errorMsg
    ? `<span class="pdfe-error-msg">${errorMsg}</span>`
    : '';

  const unavailableHTML = realState === 'unavailable'
    ? `<span class="pdfe-unavailable-msg">
         Cargando jsPDF… Si el botón no se activa, verifica que el script
         esté incluido en el <code>&lt;head&gt;</code> del HTML.
       </span>`
    : '';

  return `
    <div class="pdfe-wrapper${blockClass}">
      <button
        class="pdfe-btn pdfe-btn--${variant} pdfe-btn--${size}${stateClass}"
        data-pdfe-btn
        aria-label="${displayLabel}"
        aria-live="polite"
        ${disabledAttr}
      >
        ${displayIcon}
        <span>${displayLabel}</span>
      </button>
      ${errorHTML}
      ${unavailableHTML}
    </div>`.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE MONTADO — initExportPDF
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Monta un botón de exportación PDF con manejo completo de estados.
 *
 * @param {HTMLElement}      container
 * @param {ExportPDFConfig}  config
 * @returns {{
 *   setDisabled: (v: boolean) => void,
 *   update:      (newConfig: Partial<ExportPDFConfig>) => void,
 *   destroy:     () => void,
 *   getState:    () => ButtonState,
 * } | null}
 */
export function initExportPDF(container, config = {}) {
  if (!container) {
    console.error('[ExportPDF] Se requiere un elemento contenedor.');
    return null;
  }

  injectCSS();

  let cfg = {
    label:        'Descargar PDF',
    labelLoading: 'Generando...',
    labelSuccess: '✓ Descargado',
    variant:      'primary',
    size:         'md',
    block:        false,
    disabled:     false,
    icon:         '⬇',
    getPDFParams: null,
    ...config,
  };

  let btnState  = 'idle';
  let errorMsg  = '';
  let resetTimer = null;

  // ── Render ─────────────────────────────────────────────────────────────────

  function render() {
    container.innerHTML = renderExportPDFButton(cfg, btnState, errorMsg);
    bindEvents();
  }

  // ── Click handler ──────────────────────────────────────────────────────────

  function handleClick() {
    if (btnState === 'loading' || cfg.disabled) return;
    if (!isPDFReady()) return;

    container.dispatchEvent(new CustomEvent('pdfe:click', { bubbles: true, detail: {} }));

    // Obtener params para el PDF
    const params = typeof cfg.getPDFParams === 'function'
      ? cfg.getPDFParams()
      : null;

    if (!params) {
      console.warn('[ExportPDF] getPDFParams no está configurado.');
      return;
    }

    // Estado: loading
    btnState = 'loading';
    render();

    // Defer un tick para que el browser pinte el spinner antes del trabajo síncrono
    setTimeout(() => {
      const result = generateAmortizationPDF(params);

      if (result.success) {
        btnState = 'success';
        errorMsg = '';
        render();

        // Volver a idle en 2 segundos
        clearTimeout(resetTimer);
        resetTimer = setTimeout(() => {
          btnState = 'idle';
          render();
        }, 2000);

      } else {
        btnState = 'error';
        errorMsg = result.error ?? 'No se pudo generar el PDF.';
        render();

        // Volver a idle en 5 segundos
        clearTimeout(resetTimer);
        resetTimer = setTimeout(() => {
          btnState = 'idle';
          errorMsg = '';
          render();
        }, 5000);
      }

      container.dispatchEvent(new CustomEvent('pdfe:generated', {
        bubbles: true,
        detail:  { success: result.success, error: result.error },
      }));
    }, 0);
  }

  // ── Event binding ──────────────────────────────────────────────────────────

  function bindEvents() {
    const btn = container.querySelector('[data-pdfe-btn]');
    if (btn) btn.addEventListener('click', handleClick);
  }

  // ── API pública ────────────────────────────────────────────────────────────

  /**
   * Habilita o deshabilita el botón externamente.
   * @param {boolean} value
   */
  function setDisabled(value) {
    if (cfg.disabled === value) return;
    cfg.disabled = value;
    if (btnState === 'idle') render();
  }

  /**
   * Actualiza la configuración y re-renderiza.
   * @param {Partial<ExportPDFConfig>} newConfig
   */
  function update(newConfig) {
    const prev = { ...cfg };
    cfg = { ...cfg, ...newConfig };
    const changed = Object.keys(newConfig).some(k => newConfig[k] !== prev[k]);
    if (changed) render();
  }

  function destroy() {
    clearTimeout(resetTimer);
    container.innerHTML = '';
  }

  function getState() { return btnState; }

  render();
  return { setDisabled, update, destroy, getState };
}