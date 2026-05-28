/**
 * @file formatters.js
 * @description Funciones puras de formato para valores monetarios, porcentajes,
 *              plazos y fechas. Usadas por todos los módulos del proyecto.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PRINCIPIO CENTRAL
 * ─────────────────────────────────────────────────────────────────────────────
 * Este es el ÚNICO archivo donde se define cómo se presentan los números al
 * usuario. Ningún módulo, componente ni calculador formatea valores directamente.
 *
 * Convención numérica colombiana (locale es-CO):
 *   Separador de miles  →  .  (punto)     ej: 2.055.532
 *   Separador decimal   →  ,  (coma)      ej: 11,50%
 *   Símbolo de moneda   →  $  (prefijo)   ej: $2.055.532
 *
 * NOTA TÉCNICA: Se usa Intl.NumberFormat con style:'decimal' + prefijo '$'
 * manual en lugar de style:'currency'. Razón: la implementación de ICU en
 * Node.js agrega un espacio após el símbolo ($·2.055.532) que los navegadores
 * no incluyen. El approach manual garantiza output idéntico en ambos entornos.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * @version 1.0.0
 * @updated 2026-05-26
 * @author  Arquitecto — calculavivienda.com.co
 */

// ─────────────────────────────────────────────────────────────────────────────
// INSTANCIAS Intl — SE CREAN UNA SOLA VEZ AL CARGAR EL MÓDULO
// Crear instancias de Intl es costoso (~1ms). Reutilizarlas es gratis.
// ─────────────────────────────────────────────────────────────────────────────

const LOCALE = 'es-CO';

/** Formatea enteros con separador de miles colombiano: 2055532 → "2.055.532" */
const _intFormatter = new Intl.NumberFormat(LOCALE, {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** Formatea decimales con separador colombiano: 2055532.75 → "2.055.532,75" */
const _decFormatter = new Intl.NumberFormat(LOCALE, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Fecha larga: "26 de mayo de 2026" */
const _dateLong = new Intl.DateTimeFormat(LOCALE, {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/** Fecha corta: "26/05/2026" */
const _dateShort = new Intl.DateTimeFormat(LOCALE, {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS PRIVADOS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verifica si un valor es un número finito usable.
 * @param {*} value
 * @returns {boolean}
 */
function _isValidNumber(value) {
  return typeof value === 'number' && isFinite(value) && !isNaN(value);
}

/**
 * Parsea un string de fecha ISO (YYYY-MM-DD) a Date local sin desfase de timezone.
 * new Date('2026-05-26') en UTC puede rendir '25 de mayo' en zonas UTC-5.
 * @param {string} iso
 * @returns {Date | null}
 */
function _parseISODate(iso) {
  if (typeof iso !== 'string') return null;
  const parts = iso.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  return new Date(parts[0], parts[1] - 1, parts[2]); // local time, no UTC shift
}

// ─────────────────────────────────────────────────────────────────────────────
// FORMATO MONETARIO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Formatea un valor como pesos colombianos.
 *
 * Es la función más usada del proyecto — aparece en cada fila de la tabla
 * de amortización, en las tarjetas de métricas y en el PDF exportado.
 *
 * @param {number}  value                    - Valor en COP (puede ser negativo)
 * @param {Object}  [options={}]
 * @param {boolean} [options.showDecimals=false] - Mostrar centavos (,XX)
 * @param {boolean} [options.showSign=false]     - Forzar signo + en positivos
 * @returns {string}
 *
 * @example
 * formatCOP(2055532);                         // → "$2.055.532"
 * formatCOP(2055532.75, { showDecimals: true }); // → "$2.055.532,75"
 * formatCOP(-50000);                          // → "-$50.000"
 * formatCOP(50000, { showSign: true });       // → "+$50.000"
 * formatCOP(null);                            // → "$0"
 * formatCOP(NaN);                             // → "$0"
 */
export function formatCOP(value, options = {}) {
  if (!_isValidNumber(value)) return '$0';

  const { showDecimals = false, showSign = false } = options;

  const abs       = Math.abs(value);
  const formatter = showDecimals ? _decFormatter : _intFormatter;
  const formatted = `$${formatter.format(abs)}`;

  if (value < 0)          return `-${formatted}`;
  if (showSign && value > 0) return `+${formatted}`;
  return formatted;
}

/**
 * Formatea valores grandes en millones para tarjetas de métricas.
 *
 * Por encima de $1.000M muestra el valor completo en millones (no usa
 * "B" para evitar ambigüedad con el "billón" español = 10^12).
 *
 * @param {number} value    - Valor en COP
 * @param {number} [decimals=1] - Decimales para el valor abreviado
 * @returns {string}
 *
 * @example
 * formatMillions(293327617);   // → "$293,3M"
 * formatMillions(1500000000);  // → "$1.500M"
 * formatMillions(50000);       // → "$50.000"  (sin abreviar)
 * formatMillions(-80000000);   // → "-$80M"
 */
export function formatMillions(value, decimals = 1) {
  if (!_isValidNumber(value)) return '$0';

  const abs  = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (abs >= 1_000_000) {
    const millionsValue = abs / 1_000_000;
    const integerPart   = Math.floor(millionsValue);
    // Separador de miles en la parte entera: 1500 → "1.500"
    const intFormatted  = _intFormatter.format(integerPart);
    // Parte decimal: toFixed(1) = "0.0" → slice(1) = ".0" → reemplaza por ","
    const decimalPart   = (millionsValue - integerPart)
      .toFixed(decimals)
      .slice(1)
      .replace('.', ',');
    return `${sign}$${intFormatted}${decimalPart}M`;
  }

  return formatCOP(value);
}

/**
 * Formatea la diferencia entre dos bancos para el comparador.
 *
 * Muestra "+$50.000" si el banco analizado es más caro,
 * o "−$50.000" si es más barato que la referencia.
 *
 * @param {number}             value   - Diferencia en COP (puede ser 0)
 * @param {'cop' | 'millions'} [style='cop']
 * @returns {string}
 *
 * @example
 * formatDiff(-120000, 'cop');     // → "−$120.000"  (ahorro)
 * formatDiff(120000, 'millions'); // → "+$0,1M"     (más caro)
 * formatDiff(0);                  // → "igual"
 */
export function formatDiff(value, style = 'cop') {
  if (!_isValidNumber(value) || Math.abs(value) < 1) return 'igual';

  const abs       = Math.abs(value);
  const formatted = style === 'millions' ? formatMillions(abs) : formatCOP(abs);
  // Usa guión largo (−) para negativo, más estético que el guión corto (-)
  return value < 0 ? `−${formatted}` : `+${formatted}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// FORMATO DE TASAS Y PORCENTAJES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Formatea un valor numérico como porcentaje.
 *
 * @param {number} value    - Valor en porcentaje (ej: 11.5 para 11.5%)
 * @param {number} [decimals=2] - Dígitos decimales a mostrar
 * @returns {string}
 *
 * @example
 * formatPct(11.5);     // → "11,50%"
 * formatPct(88.1, 1);  // → "88,1%"
 * formatPct(100, 0);   // → "100%"
 */
export function formatPct(value, decimals = 2) {
  if (!_isValidNumber(value)) return '0%';
  return `${value.toFixed(decimals).replace('.', ',')}%`;
}

/**
 * Formatea una tasa Efectiva Anual para mostrar en tablas comparativas.
 *
 * @param {number} annualRatePct - Tasa EA en porcentaje (ej: 11.5)
 * @returns {string}
 *
 * @example
 * formatRate(9.3);  // → "9,30% EA"
 * formatRate(11.5); // → "11,50% EA"
 */
export function formatRate(annualRatePct) {
  if (!_isValidNumber(annualRatePct)) return '—% EA';
  return `${formatPct(annualRatePct, 2)} EA`;
}

/**
 * Formatea una tasa mensual en decimal a porcentaje mensual.
 * Útil para mostrar la tasa mensual equivalente en el detalle técnico.
 *
 * @param {number} monthlyRateDecimal - Tasa mensual en decimal (ej: 0.00912)
 * @returns {string}
 *
 * @example
 * formatMonthlyRate(0.009124); // → "0,9124% EM"
 */
export function formatMonthlyRate(monthlyRateDecimal) {
  if (!_isValidNumber(monthlyRateDecimal)) return '—% EM';
  const pct = (monthlyRateDecimal * 100).toFixed(4).replace('.', ',');
  return `${pct}% EM`;
}

// ─────────────────────────────────────────────────────────────────────────────
// FORMATO DE PLAZOS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convierte un número de meses a texto legible en español con gramática correcta.
 *
 * @param {number} months - Número de meses (entero positivo)
 * @returns {string}
 *
 * @example
 * formatMonths(240); // → "20 años"
 * formatMonths(180); // → "15 años"
 * formatMonths(18);  // → "1 año y 6 meses"
 * formatMonths(6);   // → "6 meses"
 * formatMonths(1);   // → "1 mes"
 * formatMonths(0);   // → "0 meses"
 */
export function formatMonths(months) {
  if (!_isValidNumber(months) || months < 0) return '0 meses';

  const m = Math.round(months);
  if (m === 0) return '0 meses';

  const years     = Math.floor(m / 12);
  const remaining = m % 12;

  const yearStr  = years > 0
    ? `${years} ${years === 1 ? 'año' : 'años'}`
    : '';
  const monthStr = remaining > 0
    ? `${remaining} ${remaining === 1 ? 'mes' : 'meses'}`
    : '';

  if (yearStr && monthStr) return `${yearStr} y ${monthStr}`;
  return yearStr || monthStr;
}

/**
 * Versión compacta del plazo para encabezados y badges.
 *
 * @param {number} months - Número de meses
 * @returns {string}
 *
 * @example
 * formatMonthsShort(240); // → "20 años"
 * formatMonthsShort(18);  // → "18 meses"
 * formatMonthsShort(1);   // → "1 mes"
 */
export function formatMonthsShort(months) {
  if (!_isValidNumber(months) || months <= 0) return '0 meses';
  const m = Math.round(months);
  if (m % 12 === 0) {
    const y = m / 12;
    return `${y} ${y === 1 ? 'año' : 'años'}`;
  }
  return `${m} ${m === 1 ? 'mes' : 'meses'}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// FORMATO DE FECHAS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Formatea una fecha ISO a texto largo en español.
 *
 * Usa parsing local (no UTC) para evitar que zonas horarias UTC-5 (Colombia)
 * conviertan '2026-05-26' en '25 de mayo de 2026'.
 *
 * @param {string} isoDateString - Fecha en formato ISO 8601 (YYYY-MM-DD)
 * @returns {string}
 *
 * @example
 * formatDate('2026-05-26'); // → "26 de mayo de 2026"
 * formatDate('2026-01-01'); // → "1 de enero de 2026"
 * formatDate('invalido');   // → ""
 */
export function formatDate(isoDateString) {
  const date = _parseISODate(isoDateString);
  if (!date) return '';
  return _dateLong.format(date);
}

/**
 * Formatea una fecha ISO a formato corto numérico.
 *
 * @param {string} isoDateString - Fecha en formato ISO 8601 (YYYY-MM-DD)
 * @returns {string}
 *
 * @example
 * formatShortDate('2026-05-26'); // → "26/05/2026"
 */
export function formatShortDate(isoDateString) {
  const date = _parseISODate(isoDateString);
  if (!date) return '';
  return _dateShort.format(date);
}

// ─────────────────────────────────────────────────────────────────────────────
// PARSER — USUARIO A NÚMERO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convierte una cadena con formato COP de vuelta a número.
 *
 * Maneja las distintas formas en que un usuario puede escribir un valor:
 * con o sin símbolo $, con puntos de miles, con coma decimal, con espacios.
 *
 * Importante: en es-CO el punto es separador de miles y la coma es decimal.
 * "200.000"   → 200000    (doscientos mil)
 * "200,50"    → 200.5     (doscientos con 50 centavos — poco común en COP)
 * "200.000,50"→ 200000.5  (formato completo)
 *
 * @param {string | number} input - Valor a parsear
 * @returns {number} Número parseado, o NaN si no se puede interpretar
 *
 * @example
 * parseCOPInput("$2.055.532");   // → 2055532
 * parseCOPInput("200.000");      // → 200000
 * parseCOPInput("1.500,75");     // → 1500.75
 * parseCOPInput(200000);         // → 200000  (pass-through)
 * parseCOPInput("abc");          // → NaN
 */
export function parseCOPInput(input) {
  if (typeof input === 'number') return input;
  if (typeof input !== 'string') return NaN;

  const cleaned = input
    .trim()
    .replace(/\$/g, '')           // Quitar símbolo $
    .replace(/\s/g, '')           // Quitar espacios
    .replace(/\./g, '')           // Quitar puntos (miles en es-CO)
    .replace(/,/g, '.');          // Convertir coma decimal a punto

  return parseFloat(cleaned);
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILIDADES DE PRESENTACIÓN
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Formatea el número de cuota para mostrar en la tabla de amortización.
 * Agrega cero a la izquierda para mantener alineación en tablas del PDF.
 *
 * @param {number} month     - Número de cuota (1-based)
 * @param {number} totalMonths - Total de cuotas (para determinar dígitos)
 * @returns {string}
 *
 * @example
 * formatInstallment(1, 240);   // → "001"
 * formatInstallment(12, 240);  // → "012"
 * formatInstallment(240, 240); // → "240"
 */
export function formatInstallment(month, totalMonths) {
  if (!_isValidNumber(month) || !_isValidNumber(totalMonths)) return '—';
  const digits = String(totalMonths).length;
  return String(Math.round(month)).padStart(digits, '0');
}

/**
 * Genera el texto del disclaimer legal que aparece en el pie del simulador
 * y en el PDF, con la fecha de actualización de tasas.
 *
 * @param {string} ratesUpdatedAt - Fecha ISO de última actualización de tasas
 * @returns {string}
 *
 * @example
 * formatDisclaimer('2026-05-26');
 * // → "Tasas verificadas al 26 de mayo de 2026. Los cálculos son referenciales..."
 */
export function formatDisclaimer(ratesUpdatedAt) {
  const dateStr = formatDate(ratesUpdatedAt);
  const prefix  = dateStr ? `Tasas verificadas al ${dateStr}. ` : '';
  return `${prefix}Los cálculos son referenciales y no constituyen una oferta crediticia. ` +
         `Consulte directamente con su entidad financiera para obtener condiciones definitivas.`;
}
