/**
 * @file components/DataTable.js
 * @description Componente reutilizable de tabla con paginación opcional.
 *              Usado por cualquier módulo que necesite mostrar datos tabulares
 *              sin reescribir la lógica de paginación y estilos cada vez.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DOS MODOS DE USO
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * 1. FUNCIÓN PURA — devuelve HTML string (testeable en Node.js):
 *
 *    import { renderDataTable } from './components/DataTable.js';
 *
 *    container.innerHTML = renderDataTable({
 *      headers: ['Banco', 'Tasa', 'Cuota'],
 *      rows:    [['FNA', '9.30%', '$1.800.000'], ...],
 *      options: { highlightRow: 0, alignments: ['left','right','right'] },
 *    });
 *
 * 2. COMPONENTE MONTADO — estado interno + re-render automático:
 *
 *    import { initDataTable } from './components/DataTable.js';
 *
 *    const table = initDataTable(container, {
 *      headers:  ['Año', 'Intereses', 'Capital', 'Saldo'],
 *      rows:     annualRows,
 *      options:  { pageSize: 10 },
 *    });
 *
 *    table.update({ rows: newRows });   // Re-renderiza con nuevos datos
 *    table.goToPage(3);                 // Salta a una página
 *    table.destroy();                   // Limpia el contenedor
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DEPENDENCIAS: ninguna (componente completamente independiente)
 *
 * @version 1.0.0
 * @updated 2026-05-26
 * @author  Arquitecto — calculavivienda.com.co
 */

// ─────────────────────────────────────────────────────────────────────────────
// CSS — inyectado una sola vez globalmente
// ─────────────────────────────────────────────────────────────────────────────

const CSS_ID = 'dt-styles';

function injectCSS() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(CSS_ID)) return;

  const style = document.createElement('style');
  style.id    = CSS_ID;
  style.textContent = `
    /* ── Contenedor ──────────────────────────────────────────────────────── */
    .dt-wrapper {
      font-family: var(--font-sans, system-ui, sans-serif);
      overflow-x: auto;
      border-radius: var(--radius-lg, 12px);
      border: 1px solid var(--color-border, #E5E7EB);
    }

    /* ── Tabla ───────────────────────────────────────────────────────────── */
    .dt-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }

    /* Encabezado */
    .dt-thead tr {
      background: var(--color-secondary, #0A2540);
    }
    .dt-th {
      padding: 10px 12px;
      font-size: 11px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: .04em;
      color: rgba(255,255,255,.85);
      white-space: nowrap;
      border: none;
    }
    .dt-th--left   { text-align: left;   }
    .dt-th--right  { text-align: right;  }
    .dt-th--center { text-align: center; }

    /* Filas de datos */
    .dt-row {
      border-bottom: 1px solid var(--color-border, #E5E7EB);
      transition: background .1s;
    }
    .dt-row:last-child { border-bottom: none; }
    .dt-row--alt { background: #FAFAFA; }
    .dt-row--highlight {
      background: #EEF9F4 !important;
      font-weight: 500;
    }
    .dt-row--clickable { cursor: pointer; }
    .dt-row--clickable:hover { background: #F0F7FF !important; }

    /* Celdas */
    .dt-td {
      padding: 9px 12px;
      color: var(--color-text, #111827);
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
      vertical-align: middle;
    }
    .dt-td--left   { text-align: left;   }
    .dt-td--right  { text-align: right;  }
    .dt-td--center { text-align: center; }

    /* Fila de totales (tfoot) */
    .dt-tfoot tr { background: var(--color-secondary, #0A2540); }
    .dt-tfoot .dt-td {
      color: #fff;
      font-weight: 600;
      border-top: 2px solid rgba(255,255,255,.1);
    }

    /* Estado vacío */
    .dt-empty {
      padding: 24px;
      text-align: center;
      color: #9CA3AF;
      font-size: 13px;
    }

    /* ── Paginación ──────────────────────────────────────────────────────── */
    .dt-pagination {
      padding: 10px 12px;
      border-top: 1px solid var(--color-border, #E5E7EB);
      background: #F9FAFB;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      flex-wrap: wrap;
    }

    .dt-page-info {
      font-size: 12px;
      color: #6B7280;
    }
    .dt-page-info strong { color: #111827; }

    .dt-page-btns { display: flex; gap: 4px; flex-wrap: wrap; }

    .dt-nav-btn {
      padding: 5px 12px;
      border-radius: 6px;
      border: 1px solid var(--color-border, #E5E7EB);
      background: #fff;
      font-size: 12px;
      color: #374151;
      cursor: pointer;
      transition: background .12s;
    }
    .dt-nav-btn:hover:not(:disabled) { background: #EEF9F4; }
    .dt-nav-btn:disabled { opacity: .4; cursor: not-allowed; }

    .dt-page-num {
      width: 30px;
      height: 30px;
      border-radius: 6px;
      border: 1px solid var(--color-border, #E5E7EB);
      background: #fff;
      font-size: 12px;
      color: #374151;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all .12s;
    }
    .dt-page-num:hover:not(:disabled) { background: #EEF9F4; border-color: #6EE7B7; }
    .dt-page-num--active {
      background: var(--color-primary, #006241);
      color: #fff;
      border-color: transparent;
      font-weight: 600;
      cursor: default;
    }
    .dt-page-num:disabled { opacity: .4; cursor: not-allowed; }

    /* Máximo 7 botones de página visibles */
    .dt-page-num:nth-child(n+8) { display: none; }
  `;
  document.head.appendChild(style);
}

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS (JSDoc)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {'left'|'right'|'center'} ColumnAlignment
 */

/**
 * @typedef {Object} DataTableOptions
 * @property {number}             [pageSize=0]       - Filas por página (0 = sin paginación)
 * @property {number}             [currentPage=0]    - Página actual (0-based)
 * @property {ColumnAlignment[]}  [alignments]       - Alineación de cada columna
 * @property {number}             [highlightRow]     - Índice de fila a resaltar
 * @property {string[]}           [totalsRow]        - Fila de totales en el pie
 * @property {boolean}            [clickableRows]    - Si las filas son clickeables
 * @property {string}             [emptyMessage]     - Mensaje cuando no hay filas
 * @property {boolean}            [showPageNumbers]  - Mostrar botones de número de página
 */

/**
 * @typedef {Object} DataTableConfig
 * @property {string[]}          headers  - Encabezados de columna
 * @property {string[][]}        rows     - Filas de datos (array de arrays de strings)
 * @property {DataTableOptions}  [options]
 */

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS INTERNOS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Determina la alineación de una columna.
 * Por defecto: primera columna → left, resto → right.
 * @param {ColumnAlignment[]|undefined} alignments
 * @param {number} colIndex
 * @returns {ColumnAlignment}
 */
function getAlign(alignments, colIndex) {
  if (alignments?.[colIndex]) return alignments[colIndex];
  return colIndex === 0 ? 'left' : 'right';
}

/**
 * Genera el HTML de la paginación.
 * @param {number} currentPage - 0-based
 * @param {number} totalPages
 * @param {number} totalRows
 * @param {number} pageSize
 * @param {boolean} showPageNumbers
 * @returns {string}
 */
function renderPagination(currentPage, totalPages, totalRows, pageSize, showPageNumbers) {
  if (totalPages <= 1) return '';

  const firstRow = currentPage * pageSize + 1;
  const lastRow  = Math.min((currentPage + 1) * pageSize, totalRows);

  const prevDisabled = currentPage === 0             ? ' disabled' : '';
  const nextDisabled = currentPage >= totalPages - 1 ? ' disabled' : '';

  const pageNums = showPageNumbers
    ? Array.from({ length: totalPages }, (_, i) => {
        const isActive = i === currentPage;
        return `<button
          class="dt-page-num${isActive ? ' dt-page-num--active' : ''}"
          data-page="${i}"
          aria-label="Página ${i + 1}"
          aria-current="${isActive}"
          ${isActive ? 'disabled' : ''}>
          ${i + 1}
        </button>`;
      }).join('')
    : '';

  return `
    <div class="dt-pagination" role="navigation" aria-label="Paginación">
      <span class="dt-page-info">
        Filas <strong>${firstRow}–${lastRow}</strong> de ${totalRows}
      </span>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        ${showPageNumbers && pageNums ? `<div class="dt-page-btns">${pageNums}</div>` : ''}
        <div style="display:flex;gap:4px">
          <button class="dt-nav-btn" data-action="prev"
                  aria-label="Página anterior"${prevDisabled}>← Anterior</button>
          <button class="dt-nav-btn" data-action="next"
                  aria-label="Página siguiente"${nextDisabled}>Siguiente →</button>
        </div>
      </div>
    </div>`.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNCIÓN PURA — renderDataTable
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Genera el HTML completo de una tabla de datos.
 * Función pura: no accede al DOM, no tiene efectos secundarios.
 * Testeable en Node.js.
 *
 * @param {DataTableConfig} config
 * @returns {string} HTML string listo para insertar en innerHTML
 *
 * @example
 * container.innerHTML = renderDataTable({
 *   headers: ['Banco', 'Tasa EA', 'Cuota/mes'],
 *   rows: [
 *     ['FNA',         '9,30% EA', '$1.843.222'],
 *     ['Bancolombia', '11,00% EA','$2.055.532'],
 *   ],
 *   options: {
 *     highlightRow:  0,
 *     alignments:    ['left', 'right', 'right'],
 *     totalsRow:     ['', '', 'Diferencia: $212.310'],
 *   },
 * });
 */
export function renderDataTable({ headers = [], rows = [], options = {} }) {
  const {
    pageSize        = 0,
    currentPage     = 0,
    alignments,
    highlightRow,
    totalsRow,
    clickableRows   = false,
    emptyMessage    = 'Sin datos disponibles.',
    showPageNumbers = true,
  } = options;

  // Paginación
  const usePagination  = pageSize > 0 && rows.length > pageSize;
  const totalPages     = usePagination ? Math.ceil(rows.length / pageSize) : 1;
  const safePage       = Math.max(0, Math.min(currentPage, totalPages - 1));
  const visibleRows    = usePagination
    ? rows.slice(safePage * pageSize, (safePage + 1) * pageSize)
    : rows;

  // Encabezados
  const theadHTML = headers.length > 0 ? `
    <thead class="dt-thead">
      <tr>
        ${headers.map((h, i) => `
          <th class="dt-th dt-th--${getAlign(alignments, i)}">${h}</th>
        `).join('')}
      </tr>
    </thead>`.trim() : '';

  // Cuerpo
  let tbodyHTML;
  if (visibleRows.length === 0) {
    tbodyHTML = `
      <tbody>
        <tr>
          <td class="dt-empty" colspan="${headers.length || 1}">${emptyMessage}</td>
        </tr>
      </tbody>`.trim();
  } else {
    const rowsHTML = visibleRows.map((row, pageRowIdx) => {
      const absoluteIdx = safePage * (pageSize || rows.length) + pageRowIdx;
      const isHighlight = absoluteIdx === highlightRow;
      const isAlt       = pageRowIdx % 2 === 1;
      const clickClass  = clickableRows ? ' dt-row--clickable' : '';
      const altClass    = isAlt && !isHighlight ? ' dt-row--alt' : '';
      const hlClass     = isHighlight ? ' dt-row--highlight' : '';

      const cells = row.map((cell, i) => `
        <td class="dt-td dt-td--${getAlign(alignments, i)}">${cell ?? ''}</td>
      `).join('');

      return `
        <tr class="dt-row${altClass}${hlClass}${clickClass}"
            data-row-index="${absoluteIdx}"
            ${clickableRows ? `role="button" tabindex="0"` : ''}>
          ${cells}
        </tr>`.trim();
    }).join('');

    tbodyHTML = `<tbody>${rowsHTML}</tbody>`;
  }

  // Pie con totales
  const tfootHTML = totalsRow?.length
    ? `<tfoot class="dt-tfoot"><tr>${
        totalsRow.map((cell, i) => `
          <td class="dt-td dt-td--${getAlign(alignments, i)}">${cell ?? ''}</td>
        `).join('')
      }</tr></tfoot>`
    : '';

  // Paginación
  const paginationHTML = usePagination
    ? renderPagination(safePage, totalPages, rows.length, pageSize, showPageNumbers)
    : '';

  return `
    <div class="dt-wrapper">
      <table class="dt-table" role="grid">
        ${theadHTML}
        ${tbodyHTML}
        ${tfootHTML}
      </table>
      ${paginationHTML}
    </div>`.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE MONTADO — initDataTable
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Monta una tabla de datos en un contenedor DOM con estado interno.
 * Maneja paginación, eventos de clic y re-renders automáticamente.
 *
 * @param {HTMLElement}    container - Elemento DOM donde se monta la tabla
 * @param {DataTableConfig} config  - Configuración inicial
 * @returns {{
 *   update:    (newConfig: Partial<DataTableConfig>) => void,
 *   goToPage:  (page: number) => void,
 *   destroy:   () => void,
 *   getState:  () => { currentPage: number, totalPages: number },
 * } | null}
 *
 * @example
 * const table = initDataTable(document.getElementById('mi-tabla'), {
 *   headers: ['Año', 'Intereses', 'Capital', 'Saldo'],
 *   rows:    annualRows,
 *   options: { pageSize: 10, showPageNumbers: true },
 * });
 * table.update({ rows: newRows });
 * table.goToPage(2);
 */
export function initDataTable(container, config = {}) {
  if (!container) {
    console.error('[DataTable] Se requiere un elemento contenedor.');
    return null;
  }

  injectCSS();

  // Estado interno
  let state = {
    headers:  config.headers  ?? [],
    rows:     config.rows     ?? [],
    options:  { ...config.options, currentPage: config.options?.currentPage ?? 0 },
  };

  // ── Render ──────────────────────────────────────────────────────────────

  function render() {
    container.innerHTML = renderDataTable({
      headers: state.headers,
      rows:    state.rows,
      options: state.options,
    });
    bindEvents();
  }

  // ── Event binding ────────────────────────────────────────────────────────

  function bindEvents() {
    const { pageSize = 0, clickableRows } = state.options;

    // Botones prev/next
    container.querySelectorAll('[data-action="prev"],[data-action="next"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const totalPages = pageSize > 0 ? Math.ceil(state.rows.length / pageSize) : 1;
        const delta      = btn.dataset.action === 'prev' ? -1 : 1;
        const newPage    = Math.max(0, Math.min(
          (state.options.currentPage ?? 0) + delta,
          totalPages - 1,
        ));
        state.options = { ...state.options, currentPage: newPage };
        render();
      });
    });

    // Botones de número de página
    container.querySelectorAll('[data-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        const page = parseInt(btn.dataset.page, 10);
        if (isNaN(page)) return;
        state.options = { ...state.options, currentPage: page };
        render();
      });
    });

    // Filas clickeables
    if (clickableRows && typeof state.options.onRowClick === 'function') {
      container.querySelectorAll('.dt-row--clickable').forEach(row => {
        const handler = () => {
          const idx     = parseInt(row.dataset.rowIndex, 10);
          const rowData = state.rows[idx];
          state.options.onRowClick(idx, rowData);
        };
        row.addEventListener('click', handler);
        row.addEventListener('keydown', e => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handler(); }
        });
      });
    }
  }

  // ── API pública ──────────────────────────────────────────────────────────

  /**
   * Actualiza la configuración y re-renderiza si algo cambió.
   * @param {Partial<DataTableConfig>} newConfig
   */
  function update(newConfig) {
    const prev = JSON.stringify(state);

    if (newConfig.headers !== undefined) state.headers = newConfig.headers;
    if (newConfig.rows    !== undefined) {
      state.rows = newConfig.rows;
      // Si cambian las filas, volver a la primera página
      state.options = { ...state.options, currentPage: 0 };
    }
    if (newConfig.options !== undefined) {
      state.options = { ...state.options, ...newConfig.options };
    }

    if (JSON.stringify(state) !== prev) render();
  }

  /** Salta a una página específica (0-based). */
  function goToPage(page) {
    const pageSize   = state.options.pageSize ?? 0;
    const totalPages = pageSize > 0 ? Math.ceil(state.rows.length / pageSize) : 1;
    const safePage   = Math.max(0, Math.min(page, totalPages - 1));
    state.options    = { ...state.options, currentPage: safePage };
    render();
  }

  /** Limpia el contenedor. */
  function destroy() { container.innerHTML = ''; }

  /** Retorna una copia del estado actual. */
  function getState() {
    const pageSize   = state.options.pageSize ?? 0;
    const totalPages = pageSize > 0 ? Math.ceil(state.rows.length / pageSize) : 1;
    return {
      currentPage: state.options.currentPage ?? 0,
      totalPages,
      totalRows:   state.rows.length,
    };
  }

  render();
  return { update, goToPage, destroy, getState };
}