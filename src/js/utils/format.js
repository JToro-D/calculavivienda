/**
 * format.js — Utilidades de formato frontend para CalculaVivienda.co
 * Wrappers ligeros que re-exportan desde utils/formatters.js del backend
 * más helpers específicos de la UI del frontend.
 */

export {
  formatCOP,
  formatMillions,
  formatDiff,
  formatPct,
  formatRate,
  formatMonthlyRate,
  formatMonths,
  formatMonthsShort,
  formatDate,
  formatShortDate,
  parseCOPInput,
  formatInstallment,
  formatDisclaimer,
} from '../../utils/formatters.js';

/**
 * Formatea un número SMMLV a texto legible.
 * @param {number} smmlv
 * @param {number} smmlvValue - Valor actual del SMMLV en COP
 * @returns {string}
 * @example formatSMMLV(2, 1750905) → "2 SMMLV ($3.501.810)"
 */
export function formatSMMLV(smmlv, smmlvValue) {
  const cop = smmlv * smmlvValue;
  return `${smmlv} SMMLV ($${Math.round(cop).toLocaleString('es-CO')})`;
}

/**
 * Devuelve la clase CSS de color según el ratio de deuda.
 * @param {number} ratio - Ratio decimal (ej: 0.28)
 * @returns {'ok' | 'warning' | 'danger'}
 */
export function getDebtRatioClass(ratio) {
  if (ratio <= 0.25) return 'ok';
  if (ratio <= 0.30) return 'warning';
  return 'danger';
}

/**
 * Formatea millones con precisión variable según el monto.
 * @param {number} value - COP
 * @returns {string}
 */
export function formatCOPCompact(value) {
  if (!isFinite(value) || isNaN(value)) return '$0';
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1).replace('.', ',')}B`;
  if (abs >= 1_000_000)     return `$${(value / 1_000_000).toFixed(1).replace('.', ',')}M`;
  return `$${Math.round(value).toLocaleString('es-CO')}`;
}

/**
 * Formatea un porcentaje de progreso de slider.
 * @param {number} value - Valor actual
 * @param {number} min   - Mínimo del slider
 * @param {number} max   - Máximo del slider
 * @returns {string} porcentaje CSS para --fill-pct
 */
export function sliderFillPercent(value, min, max) {
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  return `${pct.toFixed(1)}%`;
}
