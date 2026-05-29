/**
 * @file uvr.js
 * @description Calculadora de créditos indexados a UVR (Unidad de Valor Real).
 *
 *              La UVR es la unidad de cuenta usada en Colombia para créditos
 *              hipotecarios indexados al IPC. A diferencia de los créditos en
 *              pesos (cuota fija en COP), los créditos UVR tienen:
 *
 *              ✓ Tasa de interés más baja (≈ 4–5 pp menos que en pesos)
 *              ✗ Cuota en COP que crece con la inflación cada mes
 *              ✗ Saldo en COP que puede crecer si la inflación supera la cuota
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * FÓRMULA UVR — Sistema francés en unidades UVR:
 *
 *   loanUVR     = loanCOP / UVR_0             ← capital en UVR
 *   r_uvr       = (1 + EA_uvr/100)^(1/12) − 1 ← tasa mensual UVR
 *   cuotaUVR    = loanUVR × r_uvr / (1 − (1+r_uvr)^−n)  ← FIJA en UVR
 *   UVR(t)      = UVR_0 × (1 + IPC/100)^(t/12)           ← proyección
 *   cuotaCOP(t) = cuotaUVR × UVR(t)                       ← sube con IPC
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * FETCH DEL VALOR UVR — Arquitectura con Cloudflare Worker:
 *
 *   El Banco de la República NO expone una API JSON con CORS permisivo.
 *   La solución es un Cloudflare Worker en /api/uvr que actúa de proxy:
 *
 *   Navegador → GET /api/uvr → Worker → Banrep → Worker (parsea) → JSON → Navegador
 *
 *   El Worker vive en: functions/api/uvr.js (raíz del proyecto)
 *   Si el Worker no está disponible, se usa el valor de FALLBACK_UVR.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DEPENDENCIAS:
 *   calculators/amortization.js → calcMonthlyRate, calcAmortizationTable
 *   config/constants.js         → UVR_CACHE_TTL_MS, INFLATION_TARGET_PCT
 *
 * @version 1.0.0
 * @updated 2026-05-26
 * @author  Arquitecto — calculavivienda.com.co
 */

import { calcMonthlyRate, calcAmortizationTable } from './amortization.js';
import { UVR_CACHE_TTL_MS, INFLATION_TARGET_PCT } from '../config/constants.js';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Endpoint del Cloudflare Worker que expone el UVR como JSON.
 * El Worker debe retornar: { value: number, date: string, source: string }
 * Ver: functions/api/uvr.js en la raíz del proyecto.
 */
const WORKER_URL = '/api/uvr';

/** Claves de sessionStorage para el caché del UVR */
const CACHE_KEY    = 'cvda_uvr_value';
const CACHE_TS_KEY = 'cvda_uvr_timestamp';

/**
 * Valor de respaldo del UVR — actualizado manualmente cada mes.
 * Fuente: Boletín 13 de 2026 de la Junta Directiva del Banco de la República.
 * Próxima actualización: 15 de junio de 2026.
 *
 * IMPORTANTE: Este valor es el último recurso cuando la API no responde.
 * Actualizar este objeto mensualmente junto con config/banks.js.
 */
const FALLBACK_UVR = {
  value:  410.5604,
  date:   '2026-05-15',
  source: 'fallback',
};

/** Tolerancia para comparar saldos UVR (centésimas de UVR) */
const UVR_EPSILON = 0.0001;

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS (JSDoc)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} UVRValue
 * @property {number} value  - Valor de la UVR en COP (ej: 410.5604)
 * @property {string} date   - Fecha de vigencia (YYYY-MM-DD)
 * @property {string} source - 'api' | 'cache' | 'fallback'
 */

/**
 * @typedef {Object} UVRAmortizationRow
 * @property {number} month          - Número de cuota (1-based)
 * @property {number} uvrValue       - Valor proyectado de la UVR ese mes
 * @property {number} paymentUVR     - Cuota fija en UVR
 * @property {number} paymentCOP     - Cuota en COP (= paymentUVR × uvrValue)
 * @property {number} interestUVR    - Intereses en UVR
 * @property {number} interestCOP    - Intereses en COP
 * @property {number} principalUVR   - Capital amortizado en UVR
 * @property {number} principalCOP   - Capital amortizado en COP
 * @property {number} balanceUVR     - Saldo restante en UVR
 * @property {number} balanceCOP     - Saldo restante en COP (puede subir al inicio)
 */

/**
 * @typedef {Object} UVRComparisonResult
 * @property {Object}  uvr                - Estadísticas del crédito en UVR
 * @property {Object}  pesos              - Estadísticas del crédito en pesos
 * @property {number}  breakEvenInflation - Inflación en la que ambos son equivalentes
 * @property {boolean} uvrIsBetterAt      - true si UVR es mejor a la inflación proyectada
 * @property {number}  interestDifference - Diferencia de intereses (positivo = UVR más barato)
 */

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS PRIVADOS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Valida los parámetros de un crédito UVR.
 * @returns {string | null} Error o null si son válidos
 */
function _validateParams(loanCOP, currentUVR, annualUVRRate, termMonths, annualInflation) {
  if (typeof loanCOP !== 'number' || loanCOP < 1_000_000) {
    return 'El monto del crédito debe ser mayor a $1.000.000 COP.';
  }
  if (typeof currentUVR !== 'number' || currentUVR <= 0) {
    return 'El valor de la UVR debe ser mayor a cero.';
  }
  if (typeof annualUVRRate !== 'number' || annualUVRRate < 0.1 || annualUVRRate > 30) {
    return 'La tasa UVR EA debe estar entre 0.1% y 30%.';
  }
  if (!Number.isInteger(termMonths) || termMonths < 12 || termMonths > 480) {
    return 'El plazo debe estar entre 12 y 480 meses.';
  }
  if (typeof annualInflation !== 'number' || annualInflation < 0 || annualInflation > 50) {
    return 'La proyección de inflación debe estar entre 0% y 50%.';
  }
  return null;
}

/**
 * Proyecta el valor de la UVR en un mes futuro.
 * Usa capitalización mensual de la tasa anual de inflación.
 *
 * @param {number} currentUVR      - Valor UVR hoy
 * @param {number} monthsAhead     - Meses en el futuro (0 = hoy)
 * @param {number} annualInflation - Inflación anual proyectada en %
 * @returns {number}
 */
function _projectUVR(currentUVR, monthsAhead, annualInflation) {
  if (monthsAhead === 0) return currentUVR;
  return currentUVR * Math.pow(1 + annualInflation / 100, monthsAhead / 12);
}

// ─────────────────────────────────────────────────────────────────────────────
// CONVERSIÓN COP ↔ UVR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convierte un monto en COP a unidades UVR.
 *
 * @param {number} amountCOP - Monto en pesos colombianos
 * @param {number} uvrValue  - Valor actual de la UVR en COP
 * @returns {number | null}
 *
 * @example
 * convertCOPtoUVR(200_000_000, 410.5604); // → ~486.946 UVR
 */
export function convertCOPtoUVR(amountCOP, uvrValue) {
  if (typeof amountCOP !== 'number' || typeof uvrValue !== 'number' || uvrValue <= 0) {
    return null;
  }
  return amountCOP / uvrValue;
}

/**
 * Convierte un monto en UVR a pesos colombianos.
 *
 * @param {number} amountUVR - Monto en unidades UVR
 * @param {number} uvrValue  - Valor de la UVR en COP (actual o proyectado)
 * @returns {number | null}
 *
 * @example
 * convertUVRtoCOP(486946, 410.5604); // → ~$200.000.000 COP
 */
export function convertUVRtoCOP(amountUVR, uvrValue) {
  if (typeof amountUVR !== 'number' || amountUVR < 0 ||
      typeof uvrValue !== 'number'  || uvrValue <= 0) {
    return null;
  }
  return amountUVR * uvrValue;
}

/**
 * Proyecta el valor de la UVR en un mes futuro.
 * Expuesto públicamente para uso en la UI (gráficas de proyección).
 *
 * @param {number} currentUVR      - Valor UVR actual
 * @param {number} monthsAhead     - Meses en el futuro
 * @param {number} [annualInflation=INFLATION_TARGET_PCT]
 * @returns {number | null}
 *
 * @example
 * projectUVRValue(410.5604, 12, 5.0); // → UVR estimada en 12 meses
 */
export function projectUVRValue(currentUVR, monthsAhead, annualInflation = INFLATION_TARGET_PCT) {
  if (typeof currentUVR !== 'number' || currentUVR <= 0) return null;
  if (typeof monthsAhead !== 'number' || monthsAhead < 0) return null;
  return _projectUVR(currentUVR, monthsAhead, annualInflation);
}

// ─────────────────────────────────────────────────────────────────────────────
// TABLA DE AMORTIZACIÓN UVR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Genera la tabla de amortización completa para un crédito indexado a UVR.
 *
 * Diferencia clave vs amortization.js:
 * - La cuota es FIJA en UVR, pero variable en COP (crece con inflación)
 * - El saldo en COP puede CRECER al inicio si IPC > tasa UVR
 * - Cada fila muestra tanto valores en UVR como en COP
 *
 * @param {number} loanCOP          - Capital del crédito en COP
 * @param {number} currentUVR       - Valor UVR actual (del Banrep)
 * @param {number} annualUVRRate    - Tasa EA del crédito UVR (ej: 7.5)
 * @param {number} termMonths       - Plazo en meses
 * @param {number} [annualInflation=INFLATION_TARGET_PCT] - Proyección IPC anual
 * @returns {{ rows: UVRAmortizationRow[], summary: Object } | null}
 *
 * @example
 * const result = calcUVRAmortizationTable(200_000_000, 410.5604, 7.5, 240, 4.0);
 * result.rows[0].paymentCOP;   // → Cuota mes 1 en COP
 * result.rows[239].paymentCOP; // → Cuota mes 240 (mayor que mes 1)
 */
export function calcUVRAmortizationTable(
  loanCOP,
  currentUVR,
  annualUVRRate,
  termMonths,
  annualInflation = INFLATION_TARGET_PCT,
) {
  const err = _validateParams(loanCOP, currentUVR, annualUVRRate, termMonths, annualInflation);
  if (err) return null;

  const loanUVR    = loanCOP / currentUVR;
  const r          = calcMonthlyRate(annualUVRRate);
  const paymentUVR = r === 0
    ? loanUVR / termMonths
    : (loanUVR * r) / (1 - Math.pow(1 + r, -termMonths));

  let   balanceUVR           = loanUVR;
  let   cumInterestUVR       = 0;
  let   cumPrincipalUVR      = 0;
  let   totalPaidCOP         = 0;
  let   totalInterestCOP     = 0;

  const rows = new Array(termMonths);

  for (let i = 0; i < termMonths; i++) {
    const month       = i + 1;
    const uvrAtMonth  = _projectUVR(currentUVR, month, annualInflation);
    const isLast      = month === termMonths;

    const interestUVR   = balanceUVR * r;
    const principalUVR  = isLast ? balanceUVR : paymentUVR - interestUVR;
    const actualPayUVR  = interestUVR + principalUVR;

    balanceUVR     = Math.max(0, balanceUVR - principalUVR);
    cumInterestUVR  += interestUVR;
    cumPrincipalUVR += principalUVR;

    // Convertir a COP usando UVR proyectada del mes
    const paymentCOP   = actualPayUVR  * uvrAtMonth;
    const interestCOP  = interestUVR   * uvrAtMonth;
    const principalCOP = principalUVR  * uvrAtMonth;
    const balanceCOP   = balanceUVR    * uvrAtMonth;

    totalPaidCOP     += paymentCOP;
    totalInterestCOP += interestCOP;

    rows[i] = {
      month,
      uvrValue:     uvrAtMonth,
      paymentUVR:   actualPayUVR,
      paymentCOP,
      interestUVR,
      interestCOP,
      principalUVR,
      principalCOP,
      balanceUVR:   Math.max(0, balanceUVR),
      balanceCOP,
    };
  }

  return {
    rows,
    summary: {
      loanCOP,
      loanUVR,
      currentUVR,
      annualUVRRate,
      annualInflation,
      paymentUVR,                           // Cuota fija en UVR
      initialPaymentCOP: rows[0].paymentCOP, // Cuota mes 1 en COP
      finalPaymentCOP:   rows[termMonths - 1].paymentCOP, // Cuota último mes
      totalPaidCOP,
      totalInterestCOP,
      totalPrincipalCOP: loanCOP,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPARACIÓN UVR vs PESOS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compara lado a lado un crédito en UVR vs el mismo en pesos.
 * Genera la data que necesita el módulo UVRComparator para sus gráficas.
 *
 * La comparación es función de la inflación proyectada:
 * - Si IPC < (pesosRate − uvrRate): UVR sale más barato
 * - Si IPC > (pesosRate − uvrRate): pesos sale más barato
 *
 * @param {number} loanCOP         - Capital del crédito en COP
 * @param {number} currentUVR      - Valor UVR actual
 * @param {number} uvrRate         - Tasa EA del crédito UVR (ej: 7.5)
 * @param {number} pesosRate       - Tasa EA del crédito en pesos (ej: 11.5)
 * @param {number} termMonths      - Plazo en meses
 * @param {number} [annualInflation=INFLATION_TARGET_PCT]
 * @returns {UVRComparisonResult | null}
 *
 * @example
 * const cmp = compareUVRvsPesos(200_000_000, 410.56, 7.5, 11.5, 240, 5.0);
 * cmp.uvrIsBetterAt;          // → false (IPC 5% > diferencia de tasas 4%)
 * cmp.breakEvenInflation;     // → ~4.0%
 * cmp.interestDifference;     // → diferencia en COP
 */
export function compareUVRvsPesos(
  loanCOP,
  currentUVR,
  uvrRate,
  pesosRate,
  termMonths,
  annualInflation = INFLATION_TARGET_PCT,
) {
  const errUVR = _validateParams(loanCOP, currentUVR, uvrRate, termMonths, annualInflation);
  if (errUVR) return null;

  const uvrResult   = calcUVRAmortizationTable(loanCOP, currentUVR, uvrRate, termMonths, annualInflation);
  const pesosResult = calcAmortizationTable(loanCOP, pesosRate, termMonths);

  if (!uvrResult || !pesosResult) return null;

  const uvrSummary   = uvrResult.summary;
  const pesosSummary = {
    payment:          pesosResult.payment,
    totalPaidCOP:     pesosResult.totalPaid,
    totalInterestCOP: pesosResult.totalInterest,
  };

  // Punto de equilibrio: inflación en la que los intereses totales son iguales.
  // Aproximación: la diferencia de tasas es el punto de quiebre teórico.
  // Para IPC < breakEven → UVR gana. Para IPC > breakEven → pesos gana.
  const breakEvenInflation = Math.max(0, pesosRate - uvrRate);

  const interestDifference = pesosSummary.totalInterestCOP - uvrSummary.totalInterestCOP;

  // Resúmenes anuales para gráficas (cuota COP año 1, 5, 10, 15, 20)
  const uvrAnnualPayments = [1, 5, 10, 15, 20]
    .filter(y => y * 12 <= termMonths)
    .map(y => ({
      year:       y,
      paymentCOP: uvrResult.rows[(y * 12) - 1]?.paymentCOP ?? null,
    }));

  return {
    uvr: {
      annualRate:        uvrRate,
      annualInflation,
      paymentUVR:        uvrSummary.paymentUVR,
      initialPaymentCOP: uvrSummary.initialPaymentCOP,
      finalPaymentCOP:   uvrSummary.finalPaymentCOP,
      totalPaidCOP:      uvrSummary.totalPaidCOP,
      totalInterestCOP:  uvrSummary.totalInterestCOP,
      annualPayments:    uvrAnnualPayments,
      rows:              uvrResult.rows,
    },
    pesos: {
      annualRate:       pesosRate,
      payment:          pesosSummary.payment,
      totalPaidCOP:     pesosSummary.totalPaidCOP,
      totalInterestCOP: pesosSummary.totalInterestCOP,
      rows:             pesosResult.rows,
    },
    breakEvenInflation,
    uvrIsBetterAt:     annualInflation < breakEvenInflation,
    interestDifference,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// FETCH DEL VALOR UVR (BROWSER ONLY)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Obtiene el valor actual de la UVR.
 *
 * Estrategia de 3 capas:
 *   1. sessionStorage: si hay un valor en caché dentro del TTL, lo usa.
 *   2. Cloudflare Worker (/api/uvr): proxy que consulta el Banrep y retorna JSON.
 *   3. FALLBACK_UVR: valor hardcodeado, actualizado mensualmente por el dev.
 *
 * IMPORTANTE: Esta función es exclusiva del navegador.
 * No llamar desde Node.js (no existe sessionStorage ni fetch en este contexto).
 *
 * @returns {Promise<UVRValue>} Siempre resuelve — nunca lanza excepción.
 *
 * @example
 * const uvr = await fetchCurrentUVR();
 * uvr.value;   // → 410.5604
 * uvr.source;  // → 'cache' | 'api' | 'fallback'
 */
export async function fetchCurrentUVR() {
  // 1. Intentar caché en sessionStorage
  try {
    const cachedValue = sessionStorage.getItem(CACHE_KEY);
    const cachedTS    = sessionStorage.getItem(CACHE_TS_KEY);

    if (cachedValue && cachedTS) {
      const age = Date.now() - parseInt(cachedTS, 10);
      if (age < UVR_CACHE_TTL_MS) {
        return { value: parseFloat(cachedValue), date: 'cached', source: 'cache' };
      }
    }
  } catch {
    // sessionStorage no disponible (modo privado extremo, SSR, etc.)
  }

  // 2. Intentar Cloudflare Worker
  try {
    const res  = await fetch(WORKER_URL, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const data = await res.json();
      if (typeof data.value === 'number' && data.value > 0) {
        try {
          sessionStorage.setItem(CACHE_KEY, String(data.value));
          sessionStorage.setItem(CACHE_TS_KEY, String(Date.now()));
        } catch { /* sessionStorage no disponible */ }

        return { value: data.value, date: data.date ?? 'unknown', source: 'api' };
      }
    }
  } catch {
    // Worker no disponible, red caída, o timeout — continuar al fallback
  }

  // 3. Fallback — valor hardcodeado actualizado mensualmente
  console.warn(
    '[uvr.js] No se pudo obtener el UVR desde la API. ' +
    `Usando valor de respaldo del ${FALLBACK_UVR.date}: $${FALLBACK_UVR.value}. ` +
    'Verifique que el Cloudflare Worker /api/uvr esté desplegado.'
  );
  return FALLBACK_UVR;
}

// ─────────────────────────────────────────────────────────────────────────────
// VALIDACIÓN PÚBLICA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Valida los inputs de un crédito UVR sin ejecutar cálculos.
 *
 * @param {number} loanCOP
 * @param {number} currentUVR
 * @param {number} annualUVRRate
 * @param {number} termMonths
 * @param {number} annualInflation
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateUVRInputs(loanCOP, currentUVR, annualUVRRate, termMonths, annualInflation) {
  const err = _validateParams(loanCOP, currentUVR, annualUVRRate, termMonths, annualInflation);
  if (err) return { valid: false, error: err };
  return { valid: true };
}

/**
 * Retorna el valor de respaldo del UVR (útil para mostrar en la UI cuando la API falla).
 * @returns {UVRValue}
 */
export function getFallbackUVR() {
  return { ...FALLBACK_UVR };
}