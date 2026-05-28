/**
 * @file extraPayments.js
 * @description Simulador de abonos extraordinarios a capital.
 *
 *              Responde la pregunta: "¿Qué pasa si hago un abono extra
 *              de $X millones en el mes Y?"
 *
 *              Soporta dos modos (Ley 546 de 1999):
 *
 *              - 'reduceTerm'    → Cuota igual, termina antes.
 *                                  El ahorro se ve en meses y en intereses.
 *
 *              - 'reducePayment' → Mismo plazo, cuota más baja.
 *                                  El ahorro mensual se distribuye en el tiempo.
 *
 *              Reducción de plazo es financieramente superior en la mayoría
 *              de escenarios — pero la UI deja al usuario elegir.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DEPENDENCIAS:
 *   calculators/amortization.js → calcAmortizationTable, calcMonthlyRate
 *
 * @version 1.0.0
 * @updated 2026-05-26
 * @author  Arquitecto — calculavivienda.com.co
 */

import { calcAmortizationTable, calcMonthlyRate } from './amortization.js';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES INTERNAS
// ─────────────────────────────────────────────────────────────────────────────

/** Umbral para considerar saldo liquidado (1 centavo en COP) */
const BALANCE_EPSILON = 0.01;

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS (JSDoc)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {'reduceTerm' | 'reducePayment'} ExtraPaymentMode
 */

/**
 * @typedef {Object} ExtraPaymentEntry
 * @property {number} month  - Mes en que se hace el abono (1-based)
 * @property {number} amount - Monto del abono en COP (debe ser > 0)
 */

/**
 * @typedef {Object} ExtraPaymentRow
 * @property {number}  month               - Número de cuota (1-based)
 * @property {number}  payment             - Cuota regular pagada ese mes
 * @property {number}  interest            - Porción de intereses
 * @property {number}  principal           - Porción de capital (cuota regular)
 * @property {number}  extraPayment        - Abono extraordinario ese mes (0 si no hay)
 * @property {number}  balance             - Saldo tras cuota regular y abono
 * @property {number}  cumulativeInterest  - Interés acumulado hasta este mes
 * @property {number}  cumulativePrincipal - Capital total amortizado (regular + extras)
 * @property {boolean} hasExtraPayment     - true si hubo abono extraordinario
 */

/**
 * @typedef {Object} ExtraPaymentResult
 * @property {ExtraPaymentRow[]} rows                  - Tabla mes a mes modificada
 * @property {ExtraPaymentMode}  mode                  - Modo aplicado
 * @property {number}            basePayment            - Cuota original sin abonos
 * @property {number}            currentPayment         - Cuota vigente tras últimos abonos
 * @property {number}            originalTermMonths     - Plazo original en meses
 * @property {number}            newTermMonths          - Plazo resultante tras abonos
 * @property {number}            monthsSaved            - Meses ahorrados (0 en reducePayment)
 * @property {number}            originalTotalInterest  - Intereses sin abonos
 * @property {number}            newTotalInterest       - Intereses con abonos
 * @property {number}            interestSaved          - Ahorro en intereses
 * @property {number}            originalTotalPaid      - Total pagado sin abonos
 * @property {number}            newTotalPaid           - Total pagado con abonos (incluye extras)
 * @property {number}            totalExtraPayments     - Suma total de abonos extraordinarios
 */

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS PRIVADOS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Valida los parámetros base compartidos por todas las funciones públicas.
 * @param {number} principal
 * @param {number} annualRate
 * @param {number} termMonths
 * @returns {string | null} Mensaje de error o null si son válidos
 */
function _validateBase(principal, annualRate, termMonths) {
  if (typeof principal !== 'number' || principal < 1_000_000) {
    return 'El capital debe ser mayor a $1.000.000 COP.';
  }
  if (typeof annualRate !== 'number' || annualRate < 0.1 || annualRate > 40) {
    return 'La tasa EA debe estar entre 0.1% y 40%.';
  }
  if (!Number.isInteger(termMonths) || termMonths < 12 || termMonths > 480) {
    return 'El plazo debe estar entre 12 y 480 meses.';
  }
  return null;
}

/**
 * Normaliza y filtra la lista de abonos extraordinarios:
 * - Descarta montos ≤ 0 o meses fuera de rango
 * - Agrupa múltiples abonos en el mismo mes
 * - Ordena por mes ascendente
 *
 * @param {ExtraPaymentEntry[]} extraPayments
 * @param {number} termMonths
 * @returns {Map<number, number>} mapa mes → monto total de abono
 */
function _buildExtraMap(extraPayments, termMonths) {
  const map = new Map();
  for (const ep of extraPayments) {
    if (typeof ep.month !== 'number' || ep.month < 1 || ep.month > termMonths) continue;
    if (typeof ep.amount !== 'number' || ep.amount <= 0) continue;
    const month = Math.round(ep.month);
    map.set(month, (map.get(month) ?? 0) + ep.amount);
  }
  return map;
}

/**
 * Motor de simulación con abonos.
 * Recibe el mapa de abonos ya validado y ejecuta la amortización modificada.
 *
 * @param {number}              principal
 * @param {number}              annualRate
 * @param {number}              termMonths
 * @param {Map<number, number>} extraMap
 * @param {ExtraPaymentMode}    mode
 * @param {number}              basePayment - Cuota mensual original sin abonos
 * @returns {{ rows: ExtraPaymentRow[], totalExtraPayments: number, currentPayment: number }}
 */
function _simulate(principal, annualRate, termMonths, extraMap, mode, basePayment) {
  const r = calcMonthlyRate(annualRate);

  let balance             = principal;
  let cumulativeInterest  = 0;
  let cumulativePrincipal = 0;
  let totalExtraPayments  = 0;
  let currentPayment      = basePayment;

  const rows = [];

  for (let month = 1; month <= termMonths; month++) {
    if (balance <= BALANCE_EPSILON) break;

    // ── Cuota regular del mes ──────────────────────────────────────────────
    const interest         = balance * r;
    // La cuota no puede exceder el saldo + intereses (última cuota parcial)
    const actualPayment    = Math.min(currentPayment, balance + interest);
    const regularPrincipal = actualPayment - interest;

    balance = Math.max(0, balance - regularPrincipal);

    cumulativeInterest  += interest;
    cumulativePrincipal += regularPrincipal;

    // ── Abono extraordinario del mes (si existe) ───────────────────────────
    const extraAmount = extraMap.get(month) ?? 0;
    // El abono no puede exceder el saldo restante
    const actualExtra = Math.min(extraAmount, balance);

    if (actualExtra > 0) {
      balance             = Math.max(0, balance - actualExtra);
      totalExtraPayments += actualExtra;
      cumulativePrincipal += actualExtra;

      // En modo reducePayment, recalcular la cuota para los meses restantes
      if (mode === 'reducePayment' && balance > BALANCE_EPSILON) {
        const remainingMonths = termMonths - month;
        if (remainingMonths > 0) {
          currentPayment = r === 0
            ? balance / remainingMonths
            : (balance * r) / (1 - Math.pow(1 + r, -remainingMonths));
        }
      }
    }

    rows.push({
      month,
      payment:            actualPayment,
      interest,
      principal:          regularPrincipal,
      extraPayment:       actualExtra,
      balance:            Math.max(0, balance),
      cumulativeInterest,
      cumulativePrincipal,
      hasExtraPayment:    actualExtra > 0,
    });

    if (balance <= BALANCE_EPSILON) break;
  }

  return { rows, totalExtraPayments, currentPayment };
}

// ─────────────────────────────────────────────────────────────────────────────
// API PÚBLICA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Simula múltiples abonos extraordinarios en meses específicos.
 * Función central del módulo — las demás son conveniencias sobre esta.
 *
 * @param {number}               principal     - Capital prestado en COP
 * @param {number}               annualRate    - Tasa EA en porcentaje
 * @param {number}               termMonths    - Plazo original en meses
 * @param {ExtraPaymentEntry[]}  extraPayments - Lista de abonos { month, amount }
 * @param {ExtraPaymentMode}     [mode='reduceTerm']
 * @returns {ExtraPaymentResult | null}
 *
 * @example
 * // Abono de $5M en el mes 12 y otro de $10M en el mes 60
 * calcWithMultipleExtraPayments(200_000_000, 11.5, 240, [
 *   { month: 12, amount: 5_000_000 },
 *   { month: 60, amount: 10_000_000 },
 * ], 'reduceTerm');
 */
export function calcWithMultipleExtraPayments(
  principal,
  annualRate,
  termMonths,
  extraPayments = [],
  mode = 'reduceTerm',
) {
  const baseError = _validateBase(principal, annualRate, termMonths);
  if (baseError) return null;
  if (!Array.isArray(extraPayments) || extraPayments.length === 0) return null;
  if (mode !== 'reduceTerm' && mode !== 'reducePayment') return null;

  // Línea de base — necesaria para calcular el ahorro
  const baseline = calcAmortizationTable(principal, annualRate, termMonths);
  if (!baseline) return null;

  const extraMap = _buildExtraMap(extraPayments, termMonths);
  if (extraMap.size === 0) return null; // Todos los abonos eran inválidos

  const { rows, totalExtraPayments, currentPayment } = _simulate(
    principal, annualRate, termMonths, extraMap, mode, baseline.payment,
  );

  const newTotalInterest = rows.reduce((s, r) => s + r.interest, 0);
  const newTotalPaid     = rows.reduce((s, r) => s + r.payment, 0) + totalExtraPayments;
  const newTermMonths    = rows.length;

  return {
    rows,
    mode,
    basePayment:           baseline.payment,
    currentPayment,
    originalTermMonths:    termMonths,
    newTermMonths,
    monthsSaved:           termMonths - newTermMonths,
    originalTotalInterest: baseline.totalInterest,
    newTotalInterest,
    interestSaved:         baseline.totalInterest - newTotalInterest,
    originalTotalPaid:     baseline.totalPaid,
    newTotalPaid,
    totalExtraPayments,
  };
}

/**
 * Conveniencia — simula un único abono extraordinario.
 *
 * @param {number}           principal   - Capital prestado en COP
 * @param {number}           annualRate  - Tasa EA en porcentaje
 * @param {number}           termMonths  - Plazo original en meses
 * @param {number}           extraAmount - Monto del abono en COP
 * @param {number}           atMonth     - Mes en que se aplica (1-based)
 * @param {ExtraPaymentMode} [mode='reduceTerm']
 * @returns {ExtraPaymentResult | null}
 *
 * @example
 * // Prima de diciembre del año 1 → $5M extra en el mes 12
 * calcWithExtraPayment(200_000_000, 11.5, 240, 5_000_000, 12, 'reduceTerm');
 */
export function calcWithExtraPayment(
  principal,
  annualRate,
  termMonths,
  extraAmount,
  atMonth,
  mode = 'reduceTerm',
) {
  return calcWithMultipleExtraPayments(
    principal,
    annualRate,
    termMonths,
    [{ month: atMonth, amount: extraAmount }],
    mode,
  );
}

/**
 * Conveniencia — simula abonos extraordinarios recurrentes con frecuencia fija.
 *
 * Caso de uso principal: "abono la prima de diciembre todos los años" →
 * frecuencyMonths = 12, startMonth = 12.
 *
 * @param {number}           principal        - Capital prestado en COP
 * @param {number}           annualRate       - Tasa EA en porcentaje
 * @param {number}           termMonths       - Plazo original en meses
 * @param {number}           extraAmount      - Monto de cada abono en COP
 * @param {number}           frequencyMonths  - Cada cuántos meses hacer el abono
 * @param {number}           [startMonth=12]  - Mes del primer abono (1-based)
 * @param {ExtraPaymentMode} [mode='reduceTerm']
 * @returns {ExtraPaymentResult | null}
 *
 * @example
 * // Abonar $3M cada 12 meses a partir del mes 12 (cada diciembre)
 * calcWithRecurringExtraPayment(200_000_000, 11.5, 240, 3_000_000, 12, 12);
 */
export function calcWithRecurringExtraPayment(
  principal,
  annualRate,
  termMonths,
  extraAmount,
  frequencyMonths,
  startMonth = 12,
  mode = 'reduceTerm',
) {
  if (typeof frequencyMonths !== 'number' || frequencyMonths < 1) return null;
  if (typeof startMonth !== 'number' || startMonth < 1 || startMonth > termMonths) return null;
  if (typeof extraAmount !== 'number' || extraAmount <= 0) return null;

  const extraPayments = [];
  for (let month = startMonth; month <= termMonths; month += Math.round(frequencyMonths)) {
    extraPayments.push({ month, amount: extraAmount });
  }

  return calcWithMultipleExtraPayments(
    principal, annualRate, termMonths, extraPayments, mode,
  );
}

/**
 * Compara los dos modos (reduceTerm vs reducePayment) para el mismo abono.
 * Útil para que la UI muestre al usuario cuál conviene más en su caso.
 *
 * @param {number}              principal
 * @param {number}              annualRate
 * @param {number}              termMonths
 * @param {ExtraPaymentEntry[]} extraPayments
 * @returns {{ reduceTerm: ExtraPaymentResult, reducePayment: ExtraPaymentResult } | null}
 *
 * @example
 * const cmp = compareExtraPaymentModes(200_000_000, 11.5, 240, [
 *   { month: 12, amount: 10_000_000 }
 * ]);
 * cmp.reduceTerm.monthsSaved;    // → e.g. 14 meses
 * cmp.reducePayment.interestSaved; // → mismos intereses, cuota más baja
 */
export function compareExtraPaymentModes(
  principal,
  annualRate,
  termMonths,
  extraPayments,
) {
  const reduceTerm    = calcWithMultipleExtraPayments(principal, annualRate, termMonths, extraPayments, 'reduceTerm');
  const reducePayment = calcWithMultipleExtraPayments(principal, annualRate, termMonths, extraPayments, 'reducePayment');

  if (!reduceTerm || !reducePayment) return null;
  return { reduceTerm, reducePayment };
}

/**
 * Valida los inputs de un abono extraordinario sin ejecutar la simulación.
 * Para validación en tiempo real en la UI.
 *
 * @param {number} extraAmount - Monto del abono
 * @param {number} atMonth     - Mes del abono
 * @param {number} termMonths  - Plazo total del crédito
 * @returns {{ valid: boolean, error?: string, field?: string }}
 */
export function validateExtraPaymentInputs(extraAmount, atMonth, termMonths) {
  if (typeof extraAmount !== 'number' || extraAmount <= 0) {
    return { valid: false, field: 'extraAmount', error: 'El monto del abono debe ser mayor a cero.' };
  }
  if (!Number.isInteger(atMonth) || atMonth < 1 || atMonth > termMonths) {
    return {
      valid: false,
      field: 'atMonth',
      error: `El mes del abono debe estar entre 1 y ${termMonths}.`,
    };
  }
  return { valid: true };
}