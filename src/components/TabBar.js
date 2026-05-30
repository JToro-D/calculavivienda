/**
 * @file components/TabBar.js
 * @description Componente reutilizable de barra de pestañas.
 *              Usado en AmortizationTable (anual/mensual), CapacityCalc
 *              (¿cuánto puedo?/¿califico?) y cualquier otro módulo que
 *              necesite cambiar entre vistas sin cambiar de página.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * VARIANTES VISUALES
 * ─────────────────────────────────────────────────────────────────────────────
 *   'underline' → tabs con línea inferior activa (estilo clásico)
 *   'pill'      → botones pill redondeados (estilo control)
 *   'button'    → botones con borde (estilo opción)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DOS MODOS DE USO
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * 1. FUNCIÓN PURA:
 *
 *    import { renderTabBar } from './components/TabBar.js';
 *
 *    container.innerHTML = renderTabBar({
 *      tabs:     [{ id:'annual', label:'Por año' }, { id:'monthly', label:'Por mes' }],
 *      activeId: 'annual',
 *      variant:  'pill',
 *    });
 *
 * 2. COMPONENTE MONTADO:
 *
 *    import { initTabBar } from './components/TabBar.js';
 *
 *    const tabs = initTabBar(container, {
 *      tabs:     [{ id:'capacity', label:'¿Cuánto puedo?' }, { id:'qualify', label:'¿Califico?' }],
 *      activeId: 'capacity',
 *    });
 *
 *    container.addEventListener('tb:change', e => {
 *      console.log(e.detail.activeId, e.detail.prevId);
 *    });
 *
 *    tabs.setActive('qualify');
 *    tabs.getActiveId(); // → 'qualify'
 *    tabs.destroy();
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * EVENTOS EMITIDOS
 * ─────────────────────────────────────────────────────────────────────────────
 *   'tb:change' → { activeId: string, prevId: string }
 *
 * @version 1.0.0
 * @updated 2026-05-26
 * @author  Arquitecto — calculavivienda.com.co
 */

// ─────────────────────────────────────────────────────────────────────────────
// CSS
// ─────────────────────────────────────────────────────────────────────────────

const CSS_ID = 'tb-styles';

function injectCSS() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(CSS_ID)) return;
  const style = document.createElement('style');
  style.id    = CSS_ID;
  style.textContent = `
    /* ── Base ───────────────────────────────────────────────────────────── */
    .tb-bar {
      display: flex;
      font-family: var(--font-sans, system-ui, sans-serif);
    }
    .tb-bar--disabled { opacity: .5; pointer-events: none; }

    /* ── Variante: underline ─────────────────────────────────────────────── */
    .tb-bar--underline {
      border-bottom: 2px solid var(--color-border, #E5E7EB);
      gap: 0;
    }
    .tb-bar--underline .tb-tab {
      padding: 10px 16px;
      border: none;
      border-bottom: 2px solid transparent;
      background: transparent;
      font-size: 14px;
      font-weight: 500;
      color: #6B7280;
      cursor: pointer;
      margin-bottom: -2px;
      transition: color .15s, border-color .15s;
      white-space: nowrap;
    }
    .tb-bar--underline .tb-tab:hover { color: var(--color-secondary, #0A2540); }
    .tb-bar--underline .tb-tab--active {
      color: var(--color-secondary, #0A2540);
      border-bottom-color: var(--color-primary, #006241);
    }

    /* ── Variante: pill ─────────────────────────────────────────────────── */
    .tb-bar--pill {
      gap: 6px;
      flex-wrap: wrap;
    }
    .tb-bar--pill .tb-tab {
      padding: 7px 16px;
      border-radius: 20px;
      border: 1px solid var(--color-border, #E5E7EB);
      background: #fff;
      font-size: 13px;
      font-weight: 400;
      color: #6B7280;
      cursor: pointer;
      transition: all .12s;
      white-space: nowrap;
    }
    .tb-bar--pill .tb-tab:hover { border-color: #9CA3AF; color: #374151; }
    .tb-bar--pill .tb-tab--active {
      background: var(--color-secondary, #0A2540);
      color: #fff;
      border-color: transparent;
      font-weight: 500;
    }

    /* ── Variante: button ───────────────────────────────────────────────── */
    .tb-bar--button {
      gap: 4px;
      flex-wrap: wrap;
    }
    .tb-bar--button .tb-tab {
      padding: 7px 14px;
      border-radius: 6px;
      border: 1px solid var(--color-border, #E5E7EB);
      background: #fff;
      font-size: 13px;
      color: #374151;
      cursor: pointer;
      transition: all .12s;
      white-space: nowrap;
    }
    .tb-bar--button .tb-tab:hover {
      border-color: var(--color-primary, #006241);
      color: var(--color-primary, #006241);
    }
    .tb-bar--button .tb-tab--active {
      background: var(--color-primary, #006241);
      color: #fff;
      border-color: transparent;
      font-weight: 500;
    }

    /* ── Variante: dark (fondo oscuro — para headers de módulo) ─────────── */
    .tb-bar--dark {
      gap: 4px;
    }
    .tb-bar--dark .tb-tab {
      padding: 6px 14px;
      border-radius: 6px;
      border: 1px solid rgba(255,255,255,.25);
      background: transparent;
      font-size: 13px;
      color: rgba(255,255,255,.7);
      cursor: pointer;
      transition: all .15s;
      white-space: nowrap;
    }
    .tb-bar--dark .tb-tab:hover { color: #fff; }
    .tb-bar--dark .tb-tab--active {
      background: rgba(255,255,255,.15);
      color: #fff;
      border-color: rgba(255,255,255,.5);
      font-weight: 500;
    }

    /* ── Badge en tab ────────────────────────────────────────────────────── */
    .tb-badge {
      display: inline-block;
      min-width: 18px;
      height: 18px;
      padding: 0 5px;
      border-radius: 9px;
      background: #E5E7EB;
      color: #374151;
      font-size: 11px;
      font-weight: 600;
      line-height: 18px;
      text-align: center;
      margin-left: 5px;
      vertical-align: middle;
    }
    .tb-tab--active .tb-badge {
      background: rgba(255,255,255,.25);
      color: #fff;
    }
    .tb-bar--underline .tb-tab--active .tb-badge {
      background: var(--color-primary, #006241);
      color: #fff;
    }
  `;
  document.head.appendChild(style);
}

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS (JSDoc)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {'underline'|'pill'|'button'|'dark'} TabVariant
 */

/**
 * @typedef {Object} Tab
 * @property {string}  id      - Identificador único de la pestaña
 * @property {string}  label   - Texto visible de la pestaña
 * @property {number}  [badge] - Número opcional en la pestaña
 * @property {boolean} [disabled] - Si esta pestaña está desactivada
 */

/**
 * @typedef {Object} TabBarConfig
 * @property {Tab[]}       tabs      - Lista de pestañas
 * @property {string}      [activeId]  - ID de la pestaña activa
 * @property {TabVariant}  [variant='underline'] - Estilo visual
 * @property {boolean}     [disabled]  - Si toda la barra está desactivada
 */

// ─────────────────────────────────────────────────────────────────────────────
// FUNCIÓN PURA — renderTabBar
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Genera el HTML de una barra de pestañas.
 * @param {TabBarConfig} config
 * @returns {string}
 *
 * @example
 * container.innerHTML = renderTabBar({
 *   tabs:     [{ id:'a', label:'Vista A' }, { id:'b', label:'Vista B', badge:3 }],
 *   activeId: 'a',
 *   variant:  'underline',
 * });
 */
export function renderTabBar({
  tabs     = [],
  activeId = tabs[0]?.id,
  variant  = 'underline',
  disabled = false,
} = {}) {
  if (!tabs.length) return '';

  const disabledCss = disabled ? ' tb-bar--disabled' : '';

  const tabsHTML = tabs.map(tab => {
    const isActive   = tab.id === activeId;
    const isDisabled = tab.disabled ?? false;
    const badge      = tab.badge != null
      ? `<span class="tb-badge">${tab.badge}</span>`
      : '';

    return `
      <button
        class="tb-tab${isActive ? ' tb-tab--active' : ''}"
        data-tab-id="${tab.id}"
        role="tab"
        aria-selected="${isActive}"
        aria-controls="tb-panel-${tab.id}"
        ${isDisabled ? 'disabled aria-disabled="true"' : ''}
      >${tab.label}${badge}</button>`.trim();
  }).join('');

  return `
    <div class="tb-bar tb-bar--${variant}${disabledCss}"
         role="tablist"
         data-tb-variant="${variant}">
      ${tabsHTML}
    </div>`.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE MONTADO — initTabBar
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Monta una barra de pestañas con estado interno y manejo de eventos.
 *
 * @param {HTMLElement}  container
 * @param {TabBarConfig} config
 * @returns {{
 *   getActiveId: () => string,
 *   setActive:   (id: string, silent?: boolean) => void,
 *   update:      (newConfig: Partial<TabBarConfig>) => void,
 *   destroy:     () => void,
 *   getConfig:   () => TabBarConfig,
 * } | null}
 */
export function initTabBar(container, config = {}) {
  if (!container) {
    console.error('[TabBar] Se requiere un elemento contenedor.');
    return null;
  }

  injectCSS();

  let state = {
    tabs:     config.tabs     ?? [],
    activeId: config.activeId ?? config.tabs?.[0]?.id ?? '',
    variant:  config.variant  ?? 'underline',
    disabled: config.disabled ?? false,
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  function render() {
    container.innerHTML = renderTabBar(state);
    bindEvents();
  }

  // ── Actualización ligera ───────────────────────────────────────────────────
  // Solo cambia las clases --active sin re-renderizar todo el HTML.

  function updateActiveClass(newId) {
    container.querySelectorAll('.tb-tab').forEach(btn => {
      const isActive = btn.dataset.tabId === newId;
      btn.classList.toggle('tb-tab--active', isActive);
      btn.setAttribute('aria-selected', String(isActive));
    });
  }

  // ── Event binding ──────────────────────────────────────────────────────────

  function bindEvents() {
    container.querySelectorAll('.tb-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.tabId;
        if (!id || id === state.activeId || btn.disabled) return;

        const prevId     = state.activeId;
        state.activeId   = id;

        // Actualización ligera — sin re-render completo
        updateActiveClass(id);

        container.dispatchEvent(new CustomEvent('tb:change', {
          bubbles: true,
          detail:  { activeId: id, prevId },
        }));
      });

      // Soporte de teclado: flechas navegan entre tabs
      btn.addEventListener('keydown', e => {
        const btns   = [...container.querySelectorAll('.tb-tab:not([disabled])')];
        const idx    = btns.indexOf(btn);
        let   target = null;

        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          target = btns[(idx + 1) % btns.length];
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          target = btns[(idx - 1 + btns.length) % btns.length];
        } else if (e.key === 'Home') {
          target = btns[0];
        } else if (e.key === 'End') {
          target = btns[btns.length - 1];
        }

        if (target) { e.preventDefault(); target.focus(); target.click(); }
      });
    });
  }

  // ── API pública ────────────────────────────────────────────────────────────

  /** Retorna el ID de la pestaña activa. */
  function getActiveId() { return state.activeId; }

  /**
   * Activa una pestaña por ID.
   * @param {string}  id
   * @param {boolean} [silent=false] - Si true, no emite 'tb:change'
   */
  function setActive(id, silent = false) {
    const exists = state.tabs.some(t => t.id === id);
    if (!exists || id === state.activeId) return;

    const prevId   = state.activeId;
    state.activeId = id;
    updateActiveClass(id);

    if (!silent) {
      container.dispatchEvent(new CustomEvent('tb:change', {
        bubbles: true,
        detail:  { activeId: id, prevId },
      }));
    }
  }

  /**
   * Actualiza la configuración.
   * Si cambian las tabs o la variante → re-render completo.
   * Si solo cambia activeId → actualización ligera.
   *
   * @param {Partial<TabBarConfig>} newConfig
   */
  function update(newConfig) {
    const needsRerender = 'tabs' in newConfig || 'variant' in newConfig || 'disabled' in newConfig;

    state = { ...state, ...newConfig };

    if (needsRerender) {
      render();
    } else if ('activeId' in newConfig) {
      updateActiveClass(state.activeId);
    }
  }

  /** Limpia el contenedor. */
  function destroy() { container.innerHTML = ''; }

  /** Retorna una copia de la configuración actual. */
  function getConfig() { return { ...state, tabs: [...state.tabs] }; }

  render();
  return { getActiveId, setActive, update, destroy, getConfig };
}