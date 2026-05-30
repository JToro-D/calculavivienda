/**
 * @file components/Slider.js
 * @description Componente slider interactivo con valor en tiempo real.
 *              Usado en CapacityCalc, UVRComparator y Subsidies para
 *              sliders de ingreso, inflación y otros valores continuos.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DOS MODOS DE USO
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * 1. FUNCIÓN PURA — HTML string (testeable en Node.js):
 *
 *    import { renderSlider } from './components/Slider.js';
 *
 *    container.innerHTML = renderSlider({
 *      id:        'ingreso',
 *      label:     'Ingresos mensuales',
 *      min:       1_750_905,
 *      max:       30_000_000,
 *      step:      250_000,
 *      value:     5_000_000,
 *      formatter: (v) => `$${v.toLocaleString('es-CO')}`,
 *      subtext:   '2.9 SMMLV',
 *    });
 *
 * 2. COMPONENTE MONTADO — actualiza gradiente sin re-render completo:
 *
 *    import { initSlider } from './components/Slider.js';
 *
 *    const slider = initSlider(container, {
 *      id:        'inflacion',
 *      label:     'Proyección IPC anual',
 *      min:       0, max: 20, step: 0.5, value: 5,
 *      formatter: (v) => `${v.toFixed(1)}%`,
 *    });
 *
 *    container.addEventListener('sl:input',  e => console.log(e.detail.value));
 *    container.addEventListener('sl:change', e => console.log(e.detail.value));
 *
 *    slider.getValue();       // → número actual
 *    slider.setValue(8.0);    // → actualiza sin re-render completo
 *    slider.update({ max: 15 }); // → re-render con nuevo max
 *    slider.destroy();
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * EVENTOS EMITIDOS (en el contenedor)
 * ─────────────────────────────────────────────────────────────────────────────
 *   'sl:input'  → { value: number, id: string }  — mientras arrastra
 *   'sl:change' → { value: number, id: string }  — al soltar
 *
 * @version 1.0.0
 * @updated 2026-05-26
 * @author  Arquitecto — calculavivienda.com.co
 */

// ─────────────────────────────────────────────────────────────────────────────
// CSS — inyectado una sola vez globalmente
// ─────────────────────────────────────────────────────────────────────────────

const CSS_ID = 'sl-styles';

function injectCSS() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(CSS_ID)) return;
  const style = document.createElement('style');
  style.id    = CSS_ID;
  style.textContent = `
    /* ── Contenedor ─────────────────────────────────────────────────────── */
    .sl-wrapper {
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-family: var(--font-sans, system-ui, sans-serif);
    }
    .sl-wrapper--disabled { opacity: .5; pointer-events: none; }

    /* ── Fila superior: label + valor ────────────────────────────────────── */
    .sl-top {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 8px;
    }
    .sl-label {
      font-size: 12px;
      font-weight: 500;
      color: #6B7280;
      text-transform: uppercase;
      letter-spacing: .04em;
    }
    .sl-value-wrap { text-align: right; }
    .sl-value {
      font-size: 20px;
      font-weight: 600;
      color: var(--color-secondary, #0A2540);
      line-height: 1;
      display: block;
    }
    .sl-subtext {
      font-size: 11px;
      color: #9CA3AF;
      display: block;
      margin-top: 2px;
    }

    /* ── Track del slider ────────────────────────────────────────────────── */
    .sl-track-wrap {
      position: relative;
      padding: 4px 0;
    }
    .sl-input {
      -webkit-appearance: none;
      appearance: none;
      width: 100%;
      height: 6px;
      border-radius: 3px;
      background: linear-gradient(
        to right,
        var(--color-primary, #006241) 0%,
        var(--color-primary, #006241) var(--sl-fill, 0%),
        #E5E7EB var(--sl-fill, 0%),
        #E5E7EB 100%
      );
      outline: none;
      cursor: pointer;
      display: block;
    }
    .sl-input::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: var(--color-primary, #006241);
      cursor: pointer;
      border: 3px solid #fff;
      box-shadow: 0 1px 6px rgba(0,98,65,.35);
      transition: transform .1s, box-shadow .1s;
    }
    .sl-input:hover::-webkit-slider-thumb,
    .sl-input:focus::-webkit-slider-thumb {
      transform: scale(1.15);
      box-shadow: 0 2px 10px rgba(0,98,65,.4);
    }
    .sl-input::-moz-range-thumb {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: var(--color-primary, #006241);
      cursor: pointer;
      border: 3px solid #fff;
      box-shadow: 0 1px 6px rgba(0,98,65,.35);
    }
    .sl-input::-moz-range-track {
      height: 6px;
      border-radius: 3px;
      background: #E5E7EB;
    }

    /* ── Etiquetas min/max ───────────────────────────────────────────────── */
    .sl-labels {
      display: flex;
      justify-content: space-between;
      margin-top: 2px;
    }
    .sl-label-min,
    .sl-label-max {
      font-size: 10px;
      color: #9CA3AF;
    }
  `;
  document.head.appendChild(style);
}

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS (JSDoc)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} SliderConfig
 * @property {string}           [id]        - ID único del slider (para los eventos)
 * @property {string}           [label]     - Etiqueta visible sobre el slider
 * @property {number}           min         - Valor mínimo
 * @property {number}           max         - Valor máximo
 * @property {number}           [step=1]    - Paso de incremento
 * @property {number}           value       - Valor actual
 * @property {function(number): string} [formatter] - Cómo formatear el valor
 * @property {string}           [subtext]   - Texto secundario bajo el valor
 * @property {string}           [minLabel]  - Etiqueta en el extremo izquierdo
 * @property {string}           [maxLabel]  - Etiqueta en el extremo derecho
 * @property {boolean}          [disabled]  - Si el slider está desactivado
 */

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calcula el porcentaje de relleno del track dado un valor.
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {string} '42.3%'
 */
function fillPct(value, min, max) {
  if (max === min) return '0%';
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  return `${pct.toFixed(2)}%`;
}

/**
 * Formateador por defecto: muestra el número con separadores de miles.
 * @param {number} v
 * @returns {string}
 */
function defaultFormatter(v) {
  return typeof v === 'number' ? v.toLocaleString('es-CO') : String(v);
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNCIÓN PURA — renderSlider
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Genera el HTML de un slider interactivo.
 * Función pura: no accede al DOM, no escucha eventos.
 *
 * @param {SliderConfig} config
 * @returns {string} HTML string
 *
 * @example
 * container.innerHTML = renderSlider({
 *   id:        'ingreso',
 *   label:     'Ingresos mensuales',
 *   min:       1_750_905,
 *   max:       30_000_000,
 *   step:      250_000,
 *   value:     5_000_000,
 *   formatter: v => `$${v.toLocaleString('es-CO')}`,
 *   subtext:   '2.9 SMMLV',
 * });
 */
export function renderSlider(config) {
  const {
    id         = 'slider',
    label      = '',
    min        = 0,
    max        = 100,
    step       = 1,
    value      = min,
    formatter  = defaultFormatter,
    subtext    = '',
    minLabel   = '',
    maxLabel   = '',
    disabled   = false,
  } = config;

  const safeValue   = Math.max(min, Math.min(max, value));
  const displayVal  = formatter(safeValue);
  const fill        = fillPct(safeValue, min, max);
  const disabledCss = disabled ? ' sl-wrapper--disabled' : '';
  const disabledAttr= disabled ? ' disabled' : '';

  const labelsHTML = (minLabel || maxLabel)
    ? `<div class="sl-labels">
         <span class="sl-label-min">${minLabel}</span>
         <span class="sl-label-max">${maxLabel}</span>
       </div>`
    : '';

  return `
    <div class="sl-wrapper${disabledCss}" data-sl-id="${id}">
      <div class="sl-top">
        ${label ? `<span class="sl-label">${label}</span>` : ''}
        <div class="sl-value-wrap">
          <span class="sl-value" data-sl-display>${displayVal}</span>
          ${subtext ? `<span class="sl-subtext" data-sl-subtext>${subtext}</span>` : ''}
        </div>
      </div>
      <div class="sl-track-wrap">
        <input
          class="sl-input"
          type="range"
          id="${id}"
          name="${id}"
          min="${min}"
          max="${max}"
          step="${step}"
          value="${safeValue}"
          style="--sl-fill:${fill}"
          ${disabledAttr}
          aria-label="${label || id}"
          aria-valuemin="${min}"
          aria-valuemax="${max}"
          aria-valuenow="${safeValue}"
          aria-valuetext="${displayVal}"
        />
      </div>
      ${labelsHTML}
    </div>`.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE MONTADO — initSlider
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Monta un slider interactivo con actualización de gradiente sin re-render.
 * Emite 'sl:input' y 'sl:change' en el contenedor.
 *
 * Optimización clave: mover el thumb sólo actualiza el CSS custom property
 * --sl-fill y el texto del valor — sin re-renderizar el HTML completo.
 *
 * @param {HTMLElement}  container
 * @param {SliderConfig} config
 * @returns {{
 *   getValue:  () => number,
 *   setValue:  (v: number, silent?: boolean) => void,
 *   update:    (newConfig: Partial<SliderConfig>) => void,
 *   destroy:   () => void,
 *   getConfig: () => SliderConfig,
 * } | null}
 */
export function initSlider(container, config = {}) {
  if (!container) {
    console.error('[Slider] Se requiere un elemento contenedor.');
    return null;
  }

  injectCSS();

  let cfg = {
    id:        'slider',
    label:     '',
    min:       0,
    max:       100,
    step:      1,
    value:     0,
    formatter: defaultFormatter,
    subtext:   '',
    minLabel:  '',
    maxLabel:  '',
    disabled:  false,
    ...config,
  };

  // ── Render inicial completo ────────────────────────────────────────────────

  function render() {
    container.innerHTML = renderSlider(cfg);
    bindEvents();
  }

  // ── Actualización ligera — sin re-render completo ──────────────────────────
  // Solo actualiza display, gradiente y aria al mover el thumb.

  function updateDisplay(rawValue) {
    const v = Math.max(cfg.min, Math.min(cfg.max, rawValue));
    cfg.value = v;

    const fill = fillPct(v, cfg.min, cfg.max);

    // Input: actualizar gradiente via CSS variable
    const input = container.querySelector('.sl-input');
    if (input) {
      input.value = v;
      input.style.setProperty('--sl-fill', fill);
      input.setAttribute('aria-valuenow', v);
      input.setAttribute('aria-valuetext', cfg.formatter(v));
    }

    // Display de valor formateado
    const display = container.querySelector('[data-sl-display]');
    if (display) display.textContent = cfg.formatter(v);
  }

  // ── Event binding ──────────────────────────────────────────────────────────

  function bindEvents() {
    const input = container.querySelector('.sl-input');
    if (!input) return;

    // sl:input — dispara en cada movimiento (alta frecuencia)
    input.addEventListener('input', () => {
      const v = parseFloat(input.value);
      updateDisplay(v);
      container.dispatchEvent(new CustomEvent('sl:input', {
        bubbles: true,
        detail:  { value: v, id: cfg.id },
      }));
    });

    // sl:change — dispara al soltar el thumb (baja frecuencia)
    input.addEventListener('change', () => {
      const v = parseFloat(input.value);
      container.dispatchEvent(new CustomEvent('sl:change', {
        bubbles: true,
        detail:  { value: v, id: cfg.id },
      }));
    });
  }

  // ── API pública ────────────────────────────────────────────────────────────

  /** Retorna el valor actual. */
  function getValue() { return cfg.value; }

  /**
   * Establece un nuevo valor.
   * @param {number}  v         - Nuevo valor (se clampea a [min, max])
   * @param {boolean} [silent]  - Si true, no emite 'sl:change'
   */
  function setValue(v, silent = false) {
    const clamped = Math.max(cfg.min, Math.min(cfg.max, v));
    updateDisplay(clamped);
    if (!silent) {
      container.dispatchEvent(new CustomEvent('sl:change', {
        bubbles: true,
        detail:  { value: clamped, id: cfg.id },
      }));
    }
  }

  /**
   * Actualiza la configuración del slider.
   * Si cambian min/max/step/label/formatter → re-render completo.
   * Si solo cambia value → actualización ligera.
   *
   * @param {Partial<SliderConfig>} newConfig
   */
  function update(newConfig) {
    const structuralKeys = ['min', 'max', 'step', 'label', 'formatter',
                            'minLabel', 'maxLabel', 'disabled', 'subtext', 'id'];
    const needsRerender  = structuralKeys.some(k => k in newConfig && newConfig[k] !== cfg[k]);

    cfg = { ...cfg, ...newConfig };

    if (needsRerender) {
      render(); // Re-render completo
    } else if ('value' in newConfig) {
      updateDisplay(cfg.value); // Solo actualizar display y gradiente
    }
  }

  /** Limpia el contenedor. */
  function destroy() { container.innerHTML = ''; }

  /** Retorna una copia de la configuración actual. */
  function getConfig() { return { ...cfg }; }

  render();
  return { getValue, setValue, update, destroy, getConfig };
}