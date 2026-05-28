/**
 * @file amortization.js
 * @description Matemáticas puras del sistema de amortización francés (cuota fija).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PRINCIPIOS DE DISEÑO
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. Funciones puras: mismo input → mismo output. Sin estado, sin DOM, sin efectos.
 * 2. Nunca redondea internamente. El redondeo es responsabilidad de formatters.js.
 *    Excepción: la última cuota ajusta el saldo a cero exacto (corrección flotante).
 * 3. Inputs inválidos retornan null con un mensaje — no lanzan excepciones.
 *    La UI decide cómo manejar el null (mostrar error al usuario).
 * 4. No importa de config/ ni de otros calculators/. Dependencias cero.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * FÓRMULA BASE — Sistema francés (cuota fija):
 *
 *   r        = (1 + EA/100)^(1/12) − 1          ← tasa mensual equivalente
 *   C        = P × r / (1 − (1+r)^−n)            ← cuota mensual fija
 *   Interés  = Saldo × r                          ← porción intereses cada mes
 *   Capital  = C − Interés                        ← porción capital cada mes
 *   Saldo    = Saldo anterior − Capital            ← saldo restante
 *
 * Donde:
 *   P = capital prestado
 *   n = número de cuotas (meses)
 *   EA = tasa efectiva anual en porcentaje (ej: 11.5)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * @version 1.0.0
 * @updated 2026-05-26
 * @author  Arquitecto — calculavivienda.com.co
 */

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES INTERNAS
// ─────────────────────────────────────────────────────────────────────────────

/** Tolerancia para considerar el saldo como cero (errores de punto flotante) */
const BALANCE_EPSILON = 0.01; // 1 centavo en COP

/** Límites de validación de inputs */
const LIMITS = {
  principal:  { min: 1_000_000,    max: 10_000_000_000 }, // $1M a $10B COP
  annualRate: { min: 0.1,          max: 40 },              // 0.1% a 40% EA
  termMonths: { min: 12,           max: 480 },             // 1 año a 40 años
};

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS (JSDoc)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} AmortizationRow
 * @property {number} month               - Número de cuota (inicia en 1)
 * @property {number} payment             - Valor de la cuota en COP
 * @property {number} interest            - Porción de intereses de esta cuota
 * @property {number} principal           - Porción de capital amortizado
 * @property {number} balance             - Saldo restante después de esta cuota
 * @property {number} cumulativeInterest  - Intereses acumulados hasta este mes
 * @property {number} cumulativePrincipal - Capital amortizado acumulado hasta este mes
 */

/**
 * @typedef {Object} AmortizationTable
 * @property {number}             payment        - Cuota mensual fija
 * @property {number}             totalPaid      - Total pagado en todo el plazo
 * @property {number}             totalInterest  - Total pagado en intereses
 * @property {number}             totalPrincipal - Capital original (igual al principal)
 * @property {number}             monthlyRate    - Tasa mensual equivalente (decimal)
 * @property {AmortizationRow[]} rows           - Tabla mes a mes (length === termMonths)
 */

/**
 * @typedef {Object} AmortizationSummary
 * @property {number} payment        - Cuota mensual fija en COP
 * @property {number} totalPaid      - Total pagado en todo el plazo
 * @property {number} totalInterest  - Total pagado en intereses
 * @property {number} totalPrincipal - Capital original
 * @property {number} monthlyRate    - Tasa mensual equivalente (decimal)
 */

/**
 * @typedef {Object} AnnualSummaryRow
 * @property {number} year            - Año del crédito (inicia en 1)
 * @property {number} totalPayment    - Total pagado en el año (12 cuotas)
 * @property {number} totalInterest   - Total intereses pagados en el año
 * @property {number} totalPrincipal  - Total capital amortizado en el año
 * @property {number} endingBalance   - Saldo al finalizar el año
 * @property {number} interestPct     - Porcentaje de interés sobre el pago anual (0-100)
 */

/**
 * @typedef {Object} ValidationError
 * @property {null}   result  - Siempre null cuando hay error
 * @property {string} error   - Descripción del error para mostrar al usuario
 * @property {string} field   - Campo que causó el error ('principal'|'annualRate'|'termMonths')
 */

// ─────────────────────────────────────────────────────────────────────────────
// FUNCIONES PRIVADAS (prefijo _)
// No exportar. Solo para uso interno de este módulo.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Valida los tres inputs base de todos los cálculos.
 * @param {number} principal
 * @param {number} annualRate
 * @param {number} termMonths
 * @returns {ValidationError | null} null si son válidos, objeto de error si no.
 */
function _validateInputs(principal, annualRate, termMonths) {
  if (typeof principal !== 'number' || isNaN(principal)) {
    return { result: null, error: 'El capital debe ser un número válido.', field: 'principal' };
  }
  if (principal < LIMITS.principal.min || principal > LIMITS.principal.max) {
    return {
      result: null,
      error: `El capital debe estar entre $${LIMITS.principal.min.toLocaleString('es-CO')} y $${LIMITS.principal.max.toLocaleString('es-CO')} COP.`,
      field: 'principal',
    };
  }
  if (typeof annualRate !== 'number' || isNaN(annualRate)) {
    return { result: null, error: 'La tasa debe ser un número válido.', field: 'annualRate' };
  }
  if (annualRate < LIMITS.annualRate.min || annualRate > LIMITS.annualRate.max) {
    return {
      result: null,
      error: `La tasa EA debe estar entre ${LIMITS.annualRate.min}% y ${LIMITS.annualRate.max}%.`,
      field: 'annualRate',
    };
  }
  if (!Number.isInteger(termMonths) || termMonths < LIMITS.termMonths.min || termMonths > LIMITS.termMonths.max) {
    return {
      result: null,
      error: `El plazo debe estar entre ${LIMITS.termMonths.min} y ${LIMITS.termMonths.max} meses.`,
      field: 'termMonths',
    };
  }
  return null; // Todo válido
}

// ─────────────────────────────────────────────────────────────────────────────
// API PÚBLICA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convierte tasa Efectiva Anual (EA%) a tasa mensual equivalente (decimal).
 *
 * Es la base matemática de todos los demás cálculos.
 * Fórmula: r = (1 + EA/100)^(1/12) − 1
 *
 * @param {number} annualRatePercent - Tasa EA en porcentaje (ej: 11.5 para 11.5%)
 * @returns {number} Tasa mensual en decimal (ej: 0.009124... para 11.5% EA)
 *
 * @example
 * calcMonthlyRate(11.5); // → 0.009124...
 * calcMonthlyRate(0);    // → 0
 */
export function calcMonthlyRate(annualRatePercent) {
  if (annualRatePercent === 0) return 0;
  return Math.pow(1 + annualRatePercent / 100, 1 / 12) - 1;
}

/**
 * Calcula la cuota mensual fija del sistema francés.
 *
 * Fórmula: C = P × r / (1 − (1+r)^−n)
 * Caso especial tasa 0: C = P / n (distribución lineal)
 *
 * @param {number} principal  - Capital prestado en COP
 * @param {number} annualRate - Tasa EA en porcentaje
 * @param {number} termMonths - Plazo en meses
 * @returns {number | null} Cuota mensual en COP, o null si los inputs son inválidos
 *
 * @example
 * calcMonthlyPayment(100_000_000, 11.5, 240); // → ~1.048.xxx COP
 */
export function calcMonthlyPayment(principal, annualRate, termMonths) {
  const validationError = _validateInputs(principal, annualRate, termMonths);
  if (validationError) return null;

  const r = calcMonthlyRate(annualRate);
  if (r === 0) return principal / termMonths;

  return (principal * r) / (1 - Math.pow(1 + r, -termMonths));
}

/**
 * Genera la tabla de amortización completa mes a mes.
 *
 * La última cuota ajusta el pago para liquidar exactamente el saldo
 * (absorbe errores de punto flotante acumulados). Esta es la práctica
 * estándar en sistemas bancarios.
 *
 * @param {number} principal  - Capital prestado en COP
 * @param {number} annualRate - Tasa EA en porcentaje
 * @param {number} termMonths - Plazo en meses
 * @returns {AmortizationTable | null} Tabla completa, o null si los inputs son inválidos
 *
 * @example
 * const table = calcAmortizationTable(200_000_000, 10.5, 240);
 * table.rows.length;          // → 240
 * table.rows[0].payment;      // → cuota mes 1
 * table.rows[239].balance;    // → 0 (o muy cercano a 0)
 */
export function calcAmortizationTable(principal, annualRate, termMonths) {
  const validationError = _validateInputs(principal, annualRate, termMonths);
  if (validationError) return null;

  const r        = calcMonthlyRate(annualRate);
  const payment  = r === 0 ? principal / termMonths : (principal * r) / (1 - Math.pow(1 + r, -termMonths));

  let balance             = principal;
  let cumulativeInterest  = 0;
  let cumulativePrincipal = 0;

  const rows = new Array(termMonths);

  for (let i = 0; i < termMonths; i++) {
    const month    = i + 1;
    const interest = balance * r;
    const isLast   = month === termMonths;

    // Última cuota: liquida el saldo exacto para evitar residuos flotantes
    const principalPortion = isLast
      ? balance
      : payment - interest;

    // Protección contra saldos negativos por flotante en cuotas intermedias
    balance = isLast ? 0 : Math.max(0, balance - principalPortion);

    cumulativeInterest  += interest;
    cumulativePrincipal += principalPortion;

    rows[i] = {
      month,
      payment:             isLast ? interest + principalPortion : payment,
      interest,
      principal:           principalPortion,
      balance,
      cumulativeInterest,
      cumulativePrincipal,
    };
  }

  const totalPaid = rows.reduce((sum, row) => sum + row.payment, 0);

  return {
    payment,
    totalPaid,
    totalInterest:  totalPaid - principal,
    totalPrincipal: principal,
    monthlyRate:    r,
    rows,
  };
}

/**
 * Calcula un resumen sin generar la tabla completa.
 *
 * Útil para el comparador multi-banco: calcular cuota y totales de 7 bancos
 * es 7 operaciones simples en lugar de construir 7 × 360 filas.
 *
 * @param {number} principal  - Capital prestado en COP
 * @param {number} annualRate - Tasa EA en porcentaje
 * @param {number} termMonths - Plazo en meses
 * @returns {AmortizationSummary | null}
 *
 * @example
 * const summary = calcAmortizationSummary(200_000_000, 10.5, 240);
 * summary.payment;       // → cuota mensual
 * summary.totalInterest; // → total pagado en intereses
 */
export function calcAmortizationSummary(principal, annualRate, termMonths) {
  const validationError = _validateInputs(principal, annualRate, termMonths);
  if (validationError) return null;

  const r       = calcMonthlyRate(annualRate);
  const payment = r === 0
    ? principal / termMonths
    : (principal * r) / (1 - Math.pow(1 + r, -termMonths));

  const totalPaid = payment * termMonths;

  return {
    payment,
    totalPaid,
    totalInterest:  totalPaid - principal,
    totalPrincipal: principal,
    monthlyRate:    r,
  };
}

/**
 * Agrupa una tabla de amortización en resúmenes anuales.
 *
 * Usada por AmortizationTable/AnnualView.js para mostrar 30 filas (una por año)
 * en lugar de 360. Recibe la tabla completa ya calculada para no recalcular.
 *
 * @param {AmortizationTable} table - Resultado de calcAmortizationTable()
 * @returns {AnnualSummaryRow[] | null} null si la tabla es inválida
 *
 * @example
 * const table  = calcAmortizationTable(200_000_000, 10.5, 240);
 * const annual = calcAnnualSummary(table);
 * annual.length;       // → 20 (años)
 * annual[0].year;      // → 1
 * annual[19].endingBalance; // → 0
 */
export function calcAnnualSummary(table) {
  if (!table || !Array.isArray(table.rows) || table.rows.length === 0) return null;

  const years   = Math.ceil(table.rows.length / 12);
  const summary = new Array(years);

  for (let y = 0; y < years; y++) {
    const start    = y * 12;
    const yearRows = table.rows.slice(start, start + 12);

    const totalPayment   = yearRows.reduce((s, r) => s + r.payment,   0);
    const totalInterest  = yearRows.reduce((s, r) => s + r.interest,  0);
    const totalPrincipal = yearRows.reduce((s, r) => s + r.principal, 0);
    const endingBalance  = yearRows.at(-1).balance;

    summary[y] = {
      year:           y + 1,
      totalPayment,
      totalInterest,
      totalPrincipal,
      endingBalance,
      interestPct:    totalPayment > 0 ? (totalInterest / totalPayment) * 100 : 0,
    };
  }

  return summary;
}

/**
 * Calcula el mes en que la porción de capital supera a la de intereses.
 *
 * En cuotas iniciales, la mayor parte va a intereses. Este punto de cruce
 * es útil para mostrar al usuario "a partir del mes X empiezas a pagar
 * más capital que intereses".
 *
 * @param {number} annualRate  - Tasa EA en porcentaje
 * @param {number} termMonths  - Plazo en meses
 * @returns {number | null} Mes del cruce (1-based), o null si los inputs son inválidos
 *
 * @example
 * calcBreakEvenMonth(11.5, 240); // → ~mes 180 aprox.
 */
export function calcBreakEvenMonth(annualRate, termMonths) {
  // Usamos principal ficticio: el resultado es independiente del capital
  const validationError = _validateInputs(1_000_000, annualRate, termMonths);
  if (validationError) return null;

  const r = calcMonthlyRate(annualRate);
  if (r === 0) return 1; // Sin intereses, toda la cuota es capital desde el mes 1

  // Derivación analítica: el cruce ocurre cuando Capital_m = Interés_m
  // Capital_m = C − Saldo_{m-1} × r
  // Saldo_{m-1} = P × ((1+r)^n − (1+r)^(m-1)) / ((1+r)^n − 1)
  // Igualando: C/2 = Saldo_{m-1} × r → Saldo_{m-1} = C / (2r)
  // Despejando m: m = n − ln(2) / ln(1+r) + 1
  const crossover = termMonths - Math.log(2) / Math.log(1 + r) + 1;
  return Math.max(1, Math.min(Math.round(crossover), termMonths));
}

/**
 * Retorna el objeto de validación de los inputs sin calcular nada.
 *
 * Útil para que la UI valide los campos antes de llamar al cálculo
 * y muestre mensajes de error específicos por campo.
 *
 * @param {number} principal
 * @param {number} annualRate
 * @param {number} termMonths
 * @returns {{ valid: boolean, error?: string, field?: string }}
 *
 * @example
 * const check = validateAmortizationInputs(50_000_000, 250, 240);
 * check.valid; // → false
 * check.field; // → 'annualRate'
 * check.error; // → 'La tasa EA debe estar entre 0.1% y 40%.'
 */
export function validateAmortizationInputs(principal, annualRate, termMonths) {
  const err = _validateInputs(principal, annualRate, termMonths);
  if (err) return { valid: false, error: err.error, field: err.field };
  return { valid: true };
}

/**
 * Retorna los límites de validación usados internamente.
 * Permite que la UI configure sliders y campos de texto con los mismos límites.
 *
 * @returns {typeof LIMITS}
 *
 * @example
 * import { getAmortizationLimits } from './calculators/amortization.js';
 * const { principal, termMonths } = getAmortizationLimits();
 * // Usar principal.min y principal.max para configurar el slider
 */
export function getAmortizationLimits() {
  return LIMITS;
}
