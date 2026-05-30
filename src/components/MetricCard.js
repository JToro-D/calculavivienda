/**
 * @file components/MetricCard.js
 * @description Componente reutilizable para mostrar una métrica con etiqueta,
 *              valor principal, subvalor opcional e indicador de variante.
 *
 *              Usado en AmortizationTable, CapacityCalc, ExtraPayments y
 *              UVRComparator para mostrar cuota mensual, intereses, plazo, etc.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * VARIANTES VISUALES
 * ─────────────────────────────────────────────────────────────────────────────
 *   'default'   → fondo blanco, borde estándar
 *   'highlight' → tinte verde suave (métricas positivas)
 *   'success'   → verde (confirmación)
 *   'warning'   → ámbar (atención)
 *   'danger'    → rojo (costo/riesgo)
 *   'dark'      → fondo navy (para headers)
 *   'neutral'   → fondo gris claro
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TAMAÑOS
 * ─────────────────────────────────────────────────────────────────────────────
 *   'sm' → compacto, para grids densos
 *   'md' → estándar (default)
 *   'lg' → prominente, métrica principal
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DOS MODOS DE USO
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * 1. FUNCIÓN PURA:
 *
 *    import { renderMetricCard, renderMetricGrid } from './components/MetricCard.js';
 *
 *    container.innerHTML = renderMetricCard({
 *      label:   'Cuota mensual',
 *      value:   '$2.055.532',
 *      sub:     'fija todo el plazo',
 *      variant: 'highlight',
 *      size:    'lg',
 *    });
 *
 *    // Grid de múltiples métricas:
 *    container.innerHTML = renderMetricGrid([
 *      { label: 'Cuota mensual',  value: '$2.055.532', variant: 'highlight' },
 *      { label: 'Total intereses',value: '$283M',       variant: 'danger'    },
 *      { label: 'Total pagado',   value: '$493M'                             },
 *      { label: 'Plazo',          value: '20 años'                          },
 *    ], { columns: 2 });
 *
 * 2. COMPONENTE MONTADO:
 *
 *    import { initMetricCard } from './components/MetricCard.js';
 *
 *    const card = initMetricCard(container, {
 *      label: 'Meses ahorrados',
 *      value: '33 meses',
 *      variant: 'success',
 *    });
 *
 *    card.update({ value: '41 meses', sub: '+8 vs abono anterior' });
 *    card.destroy();
 *
 * @version 1.0.0
 * @updated 2026-05-26
 * @author  Arquitecto — calculavivienda.com.co
 */

// ─────────────────────────────────────────────────────────────────────────────
// CSS
// ─────────────────────────────────────────────────────────────────────────────

const CSS_ID = 'mc-styles';

function injectCSS() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(CSS_ID)) return;
  const style = document.createElement('style');
  style.id    = CSS_ID;
  style.textContent = `
    /* ── Card base ───────────────────────────────────────────────────────── */
    .mc-card {
      border-radius: var(--radius-md, 8px);
      border: 1px solid var(--color-border, #E5E7EB);
      padding: 12px 14px;
      background: #fff;
      display: flex;
      flex-direction: column;
      gap: 3px;
      font-family: var(--font-sans, system-ui, sans-serif);
      transition: box-shadow .15s;
    }

    /* ── Variantes ───────────────────────────────────────────────────────── */
    .mc-card--default   { background: #fff;    border-color: #E5E7EB; }
    .mc-card--highlight { background: #EEF9F4; border-color: #6EE7B7; }
    .mc-card--success   { background: #F0FDF4; border-color: #86EFAC; }
    .mc-card--warning   { background: #FFFBEB; border-color: #FDE68A; }
    .mc-card--danger    { background: #FEF9F0; border-color: #FCD34D; }
    .mc-card--dark      { background: var(--color-secondary, #0A2540); border-color: transparent; }
    .mc-card--neutral   { background: #F9FAFB; border-color: #E5E7EB; }

    /* ── Tamaños ─────────────────────────────────────────────────────────── */
    .mc-card--sm { padding: 8px 10px; }
    .mc-card--lg { padding: 16px 18px; }

    /* ── Cabecera: icono + label + badge ─────────────────────────────────── */
    .mc-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      margin-bottom: 2px;
    }
    .mc-label-group { display: flex; align-items: center; gap: 5px; }
    .mc-icon { font-size: 14px; flex-shrink: 0; }
    .mc-label {
      font-size: 11px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: .04em;
      color: #9CA3AF;
      line-height: 1;
    }
    .mc-card--dark .mc-label { color: rgba(255,255,255,.6); }

    .mc-badge {
      display: inline-block;
      padding: 1px 7px;
      border-radius: 10px;
      font-size: 10px;
      font-weight: 600;
      background: #E5E7EB;
      color: #374151;
    }
    .mc-card--highlight .mc-badge { background: #D1FAE5; color: #065F46; }
    .mc-card--success   .mc-badge { background: #BBF7D0; color: #065F46; }
    .mc-card--warning   .mc-badge { background: #FEF3C7; color: #92400E; }
    .mc-card--danger    .mc-badge { background: #FEE2E2; color: #991B1B; }
    .mc-card--dark      .mc-badge { background: rgba(255,255,255,.15); color: #fff; }

    /* ── Valor principal ─────────────────────────────────────────────────── */
    .mc-value {
      font-size: 18px;
      font-weight: 600;
      color: var(--color-secondary, #0A2540);
      line-height: 1.1;
      font-variant-numeric: tabular-nums;
    }
    .mc-card--sm .mc-value { font-size: 15px; }
    .mc-card--lg .mc-value { font-size: 24px; }
    .mc-card--dark      .mc-value { color: #fff; }
    .mc-card--highlight .mc-value { color: #065F46; }
    .mc-card--success   .mc-value { color: #15803D; }
    .mc-card--warning   .mc-value { color: #92400E; }
    .mc-card--danger    .mc-value { color: #B45309; }

    /* ── Subvalor ────────────────────────────────────────────────────────── */
    .mc-sub {
      font-size: 11px;
      color: #9CA3AF;
      line-height: 1.4;
    }
    .mc-card--dark .mc-sub { color: rgba(255,255,255,.5); }

    /* ── Tendencia ───────────────────────────────────────────────────────── */
    .mc-trend {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      font-size: 11px;
      font-weight: 500;
      margin-top: 3px;
    }
    .mc-trend--up   { color: #16A34A; }
    .mc-trend--down { color: #DC2626; }
    .mc-trend--flat { color: #6B7280; }
    .mc-trend-arrow { font-size: 12px; }

    /* ── Grid de métricas ────────────────────────────────────────────────── */
    .mc-grid {
      display: grid;
      gap: 8px;
    }
    .mc-grid--cols-1 { grid-template-columns: 1fr; }
    .mc-grid--cols-2 { grid-template-columns: repeat(2, 1fr); }
    .mc-grid--cols-3 { grid-template-columns: repeat(3, 1fr); }
    .mc-grid--cols-4 { grid-template-columns: repeat(4, 1fr); }

    @media (max-width: 480px) {
      .mc-grid--cols-3,
      .mc-grid--cols-4 { grid-template-columns: repeat(2, 1fr); }
    }
  `;
  document.head.appendChild(style);
}

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS (JSDoc)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {'default'|'highlight'|'success'|'warning'|'danger'|'dark'|'neutral'} CardVariant
 * @typedef {'sm'|'md'|'lg'} CardSize
 * @typedef {'up'|'down'|'flat'} TrendDirection
 */

/**
 * @typedef {Object} MetricCardConfig
 * @property {string}         label       - Etiqueta de la métrica (ej: "Cuota mensual")
 * @property {string}         value       - Valor principal (ej: "$2.055.532")
 * @property {string}         [sub]       - Texto secundario bajo el valor
 * @property {CardVariant}    [variant='default']
 * @property {CardSize}       [size='md']
 * @property {string}         [icon]      - Emoji o ícono antes del label
 * @property {string}         [badge]     - Etiqueta pequeña junto al label
 * @property {Object}         [trend]     - Indicador de tendencia
 * @property {TrendDirection} [trend.direction] - 'up'|'down'|'flat'
 * @property {string}         [trend.label]     - Texto de la tendencia
 */

// ─────────────────────────────────────────────────────────────────────────────
// FUNCIÓN PURA — renderMetricCard
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Genera el HTML de una tarjeta de métrica.
 * @param {MetricCardConfig} config
 * @returns {string}
 *
 * @example
 * container.innerHTML = renderMetricCard({
 *   label:   'Cuota mensual',
 *   value:   '$2.055.532',
 *   sub:     'fija todo el plazo',
 *   variant: 'highlight',
 *   size:    'lg',
 * });
 */
export function renderMetricCard({
  label   = '',
  value   = '',
  sub     = '',
  variant = 'default',
  size    = 'md',
  icon    = '',
  badge   = '',
  trend,
} = {}) {
  const sizeClass = size !== 'md' ? ` mc-card--${size}` : '';

  const iconHTML  = icon  ? `<span class="mc-icon" aria-hidden="true">${icon}</span>` : '';
  const badgeHTML = badge ? `<span class="mc-badge">${badge}</span>` : '';

  const trendArrow = trend
    ? trend.direction === 'up'   ? '↑'
    : trend.direction === 'down' ? '↓'
    : '→'
    : '';
  const trendHTML = trend
    ? `<span class="mc-trend mc-trend--${trend.direction ?? 'flat'}">
         <span class="mc-trend-arrow">${trendArrow}</span>
         ${trend.label ?? ''}
       </span>`
    : '';

  return `
    <div class="mc-card mc-card--${variant}${sizeClass}" role="group" aria-label="${label}">
      <div class="mc-header">
        <div class="mc-label-group">
          ${iconHTML}
          <span class="mc-label">${label}</span>
        </div>
        ${badgeHTML}
      </div>
      <span class="mc-value">${value}</span>
      ${sub    ? `<span class="mc-sub">${sub}</span>`  : ''}
      ${trendHTML}
    </div>`.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNCIÓN PURA — renderMetricGrid
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Genera un grid de múltiples tarjetas de métricas.
 * Equivale a llamar renderMetricCard() por cada elemento y envolverlos
 * en un grid CSS responsive.
 *
 * @param {MetricCardConfig[]} cards    - Array de configuraciones de tarjetas
 * @param {Object}   [opts]
 * @param {1|2|3|4}  [opts.columns=2]  - Número de columnas del grid
 * @param {string}   [opts.gap]        - Override del gap CSS (ej: '12px')
 * @returns {string}
 *
 * @example
 * container.innerHTML = renderMetricGrid([
 *   { label: 'Cuota mensual',   value: '$2.055.532', variant: 'highlight' },
 *   { label: 'Total intereses', value: '$283M',       variant: 'danger'   },
 *   { label: 'Total pagado',    value: '$493M'                            },
 *   { label: 'Plazo',           value: '20 años'                         },
 * ], { columns: 2 });
 */
export function renderMetricGrid(cards = [], { columns = 2, gap } = {}) {
  if (!cards.length) return '';

  const gapStyle = gap ? ` style="gap:${gap}"` : '';
  const cardsHTML = cards.map(card => renderMetricCard(card)).join('');

  return `
    <div class="mc-grid mc-grid--cols-${columns}"${gapStyle}>
      ${cardsHTML}
    </div>`.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE MONTADO — initMetricCard
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Monta una tarjeta de métrica con estado interno.
 * Permite actualizar el valor sin re-montar el HTML completo
 * cuando solo cambia el valor o el sub.
 *
 * @param {HTMLElement}      container
 * @param {MetricCardConfig} config
 * @returns {{
 *   update:    (newConfig: Partial<MetricCardConfig>) => void,
 *   destroy:   () => void,
 *   getConfig: () => MetricCardConfig,
 * } | null}
 */
export function initMetricCard(container, config = {}) {
  if (!container) {
    console.error('[MetricCard] Se requiere un elemento contenedor.');
    return null;
  }

  injectCSS();

  let state = {
    label:   '',
    value:   '',
    sub:     '',
    variant: 'default',
    size:    'md',
    icon:    '',
    badge:   '',
    trend:   undefined,
    ...config,
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  function render() {
    container.innerHTML = renderMetricCard(state);
  }

  // ── Actualización ligera — solo value/sub/trend ────────────────────────────
  // Evita re-crear el DOM completo cuando solo cambia el valor mostrado.

  function lightUpdate(newState) {
    if ('value' in newState) {
      const el = container.querySelector('.mc-value');
      if (el) el.textContent = newState.value;
    }
    if ('sub' in newState) {
      const el = container.querySelector('.mc-sub');
      if (el) {
        el.textContent = newState.sub;
      } else if (newState.sub) {
        // sub no existía → re-render completo necesario
        return false;
      }
    }
    if ('badge' in newState) {
      const el = container.querySelector('.mc-badge');
      if (el) {
        el.textContent = newState.badge;
      } else if (newState.badge) {
        return false; // badge nuevo → re-render
      }
    }
    return true;
  }

  // ── API pública ────────────────────────────────────────────────────────────

  /**
   * Actualiza la configuración de la tarjeta.
   * Si solo cambia value/sub/badge → actualización ligera (sin re-render).
   * Si cambia variant/size/icon/trend/label → re-render completo.
   *
   * @param {Partial<MetricCardConfig>} newConfig
   */
  function update(newConfig) {
    const structuralKeys = ['label', 'variant', 'size', 'icon', 'trend'];
    const needsRerender  = structuralKeys.some(k => k in newConfig && newConfig[k] !== state[k]);

    state = { ...state, ...newConfig };

    if (needsRerender) {
      render();
    } else {
      // Intenta actualización ligera; si falla, re-render
      if (!lightUpdate(newConfig)) render();
    }
  }

  function destroy()   { container.innerHTML = ''; }
  function getConfig() { return { ...state }; }

  render();
  return { update, destroy, getConfig };
}