/**
 * @file capacity.js
 * @description Calculadora inversa de capacidad hipotecaria.
 *              Responde dos preguntas centrales del simulador:
 *
 *              1. "¿Cuánto puedo pedir?" — dado un ingreso, calcula el
 *                 crédito y valor de inmueble máximos.
 *
 *              2. "¿Cuánto necesito ganar?" — dado un inmueble objetivo,
 *                 calcula el ingreso mínimo para calificar.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * FÓRMULA INVERSA — Sistema francés:
 *
 *   Directa : C = P × r / (1 − (1+r)^−n)      → cuota dado el capital
 *   Inversa : P = C × (1 − (1+r)^−n) / r       → capital dado la cuota
 *
 *   Donde C_max = ingreso × MAX_DEBT_RATIO (30% — Ley 546 de 1999)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DEPENDENCIAS:
 *   calculators/amortization.js → calcMonthlyRate  (conversión EA → mensual)
 *   config/constants.js         → límites legales y regulatorios
 *
 * @version 1.0.0
 * @updated 2026-05-26
 * @author  Arquitecto — calculavivienda.com.co
 */

import { calcMonthlyRate } from './amortization.js';
import {
  MAX_DEBT_RATIO,
  MAX_DOWN_PCT,
  MIN_TERM_MONTHS,
  MAX_TERM_MONTHS,
  VIS_MAX_COP,
  VIP_MAX_COP,
  SMMLV,
} from '../config/constants.js';

// ─────────────────────────────────────────────────────────────────────────────
// LÍMITES DE VALIDACIÓN INTERNOS
// ─────────────────────────────────────────────────────────────────────────────

const LIMITS = {
  monthlyIncome: {
    min: SMMLV,        // Mínimo: 1 SMMLV — ingreso formal mínimo legal
    max: 100_000_000,  // Máximo: $100M/mes — rango razonable del simulador
  },
  annualRate: {
    min: 0.1,
    max: 40,
  },
  termMonths: {
    min: MIN_TERM_MONTHS, // 60 meses — Ley 546/99
    max: MAX_TERM_MONTHS, // 360 meses — Ley 546/99
  },
  downPct: {
    min: 0,            // 0% — FNA financia el 100% en VIS desde 2026
    max: MAX_DOWN_PCT, // 50% — límite razonable del simulador
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS (JSDoc)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {'VIP' | 'VIS' | 'NoVIS'} HousingType
 */

/**
 * @typedef {Object} AffordabilityResult
 * @property {number}      maxPayment          - Cuota mensual máxima (ingreso × debtRatio)
 * @property {number}      maxCredit           - Monto máximo del crédito en COP
 * @property {number}      maxPropertyValue    - Valor máximo del inmueble en COP
 * @property {number}      requiredDownPayment - Cuota inicial en COP
 * @property {HousingType} housingType         - Categoría VIP / VIS / NoVIS
 * @property {boolean}     qualifiesVIS        - El inmueble máximo está dentro del tope VIS
 * @property {boolean}     qualifiesVIP        - El inmueble máximo está dentro del tope VIP
 * @property {number}      monthlyRate         - Tasa mensual equivalente (decimal)
 * @property {number}      debtRatioUsed       - Ratio de endeudamiento aplicado
 */

/**
 * @typedef {Object} QualificationResult
 * @property {boolean}     qualifies        - true si el ingreso alcanza para el crédito
 * @property {number}      actualPayment    - Cuota real del crédito solicitado
 * @property {number}      actualDebtRatio  - Porcentaje real de endeudamiento
 * @property {number}      requiredIncome   - Ingreso mínimo para calificar
 * @property {number}      incomeShortfall  - Cuánto falta (0 si ya califica)
 * @property {HousingType} housingType      - Categoría del inmueble objetivo
 */

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS PRIVADOS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Valida los inputs estándar de capacidad. Retorna primer error o null.
 * @param {number} monthlyIncome
 * @param {number} annualRate
 * @param {number} termMonths
 * @param {number} downPct
 * @returns {{ field: string, error: string } | null}
 */
function _validateInputs(monthlyIncome, annualRate, termMonths, downPct) {
  if (typeof monthlyIncome !== 'number' || isNaN(monthlyIncome) ||
      monthlyIncome < LIMITS.monthlyIncome.min ||
      monthlyIncome > LIMITS.monthlyIncome.max) {
    return {
      field: 'monthlyIncome',
      error: `El ingreso mensual debe estar entre $${LIMITS.monthlyIncome.min.toLocaleString('es-CO')} y $${LIMITS.monthlyIncome.max.toLocaleString('es-CO')} COP.`,
    };
  }
  if (typeof annualRate !== 'number' || isNaN(annualRate) ||
      annualRate < LIMITS.annualRate.min || annualRate > LIMITS.annualRate.max) {
    return {
      field: 'annualRate',
      error: `La tasa EA debe estar entre ${LIMITS.annualRate.min}% y ${LIMITS.annualRate.max}%.`,
    };
  }
  if (!Number.isInteger(termMonths) ||
      termMonths < LIMITS.termMonths.min || termMonths > LIMITS.termMonths.max) {
    return {
      field: 'termMonths',
      error: `El plazo debe estar entre ${LIMITS.termMonths.min} y ${LIMITS.termMonths.max} meses.`,
    };
  }
  if (typeof downPct !== 'number' || isNaN(downPct) ||
      downPct < LIMITS.downPct.min || downPct > LIMITS.downPct.max) {
    return {
      field: 'downPct',
      error: `La cuota inicial debe estar entre ${LIMITS.downPct.min * 100}% y ${LIMITS.downPct.max * 100}%.`,
    };
  }
  return null;
}

/**
 * Clasifica un inmueble en VIP / VIS / NoVIS según su precio.
 * @param {number} propertyCOP
 * @returns {HousingType}
 */
function _classifyHousing(propertyCOP) {
  if (propertyCOP <= VIP_MAX_COP) return 'VIP';
  if (propertyCOP <= VIS_MAX_COP) return 'VIS';
  return 'NoVIS';
}

/**
 * Núcleo de la fórmula inversa — capital máximo dada una cuota mensual.
 * Centralizado aquí para evitar duplicación entre funciones públicas.
 *
 * @param {number} maxPayment - Cuota mensual máxima en COP
 * @param {number} r          - Tasa mensual en decimal
 * @param {number} n          - Plazo en meses
 * @returns {number}
 */
function _inverseFormula(maxPayment, r, n) {
  if (r === 0) return maxPayment * n;
  return maxPayment * (1 - Math.pow(1 + r, -n)) / r;
}

// ─────────────────────────────────────────────────────────────────────────────
// API PÚBLICA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calcula el monto máximo de crédito según la regla del 30%.
 *
 * Fórmula: P = (ingreso × debtRatio) × (1 − (1+r)^−n) / r
 *
 * @param {number} monthlyIncome              - Ingreso mensual en COP
 * @param {number} annualRate                 - Tasa EA en porcentaje
 * @param {number} termMonths                 - Plazo en meses
 * @param {number} [debtRatio=MAX_DEBT_RATIO] - Porcentaje de endeudamiento (0–1)
 * @returns {number | null}
 *
 * @example
 * calcMaxCredit(5_000_000, 11.5, 240);
 * // Con cuota máx de $1.500.000 → ~$163.800.000 COP
 */
export function calcMaxCredit(
  monthlyIncome,
  annualRate,
  termMonths,
  debtRatio = MAX_DEBT_RATIO,
) {
  const err = _validateInputs(monthlyIncome, annualRate, termMonths, 0);
  if (err) return null;

  const r = calcMonthlyRate(annualRate);
  return _inverseFormula(monthlyIncome * debtRatio, r, termMonths);
}

/**
 * Calcula el valor máximo del inmueble dado el porcentaje de cuota inicial.
 *
 * Relación: valorInmueble = creditoMaximo / (1 − cuotaInicial%)
 *
 * @param {number} monthlyIncome
 * @param {number} annualRate
 * @param {number} termMonths
 * @param {number} downPct       - Cuota inicial como decimal (ej: 0.30)
 * @param {number} [debtRatio=MAX_DEBT_RATIO]
 * @returns {number | null}
 *
 * @example
 * calcMaxPropertyValue(5_000_000, 11.5, 240, 0.30);
 * // → ~$234.000.000 COP
 */
export function calcMaxPropertyValue(
  monthlyIncome,
  annualRate,
  termMonths,
  downPct,
  debtRatio = MAX_DEBT_RATIO,
) {
  const err = _validateInputs(monthlyIncome, annualRate, termMonths, downPct);
  if (err) return null;

  const maxCredit = calcMaxCredit(monthlyIncome, annualRate, termMonths, debtRatio);
  if (maxCredit === null) return null;

  if (downPct === 0) return maxCredit; // FNA 100% — inmueble = crédito
  return maxCredit / (1 - downPct);
}

/**
 * Calcula el ingreso mensual mínimo para calificar a un crédito específico.
 *
 * Fórmula: ingresoMinimo = cuotaMensual(loanAmount, r, n) / debtRatio
 *
 * @param {number} propertyValue              - Valor del inmueble objetivo en COP
 * @param {number} downPct                    - Cuota inicial como decimal
 * @param {number} annualRate                 - Tasa EA en porcentaje
 * @param {number} termMonths                 - Plazo en meses
 * @param {number} [debtRatio=MAX_DEBT_RATIO]
 * @returns {number | null}
 *
 * @example
 * calcRequiredIncome(300_000_000, 0.30, 11.5, 240);
 * // Crédito de $210M → cuota ~$2.16M → ingreso mínimo ~$7.2M/mes
 */
export function calcRequiredIncome(
  propertyValue,
  downPct,
  annualRate,
  termMonths,
  debtRatio = MAX_DEBT_RATIO,
) {
  if (typeof propertyValue !== 'number' || propertyValue <= 0) return null;
  if (typeof downPct !== 'number' || downPct < 0 || downPct >= 1) return null;
  if (typeof annualRate !== 'number' ||
      annualRate < LIMITS.annualRate.min || annualRate > LIMITS.annualRate.max) return null;
  if (!Number.isInteger(termMonths) ||
      termMonths < MIN_TERM_MONTHS || termMonths > MAX_TERM_MONTHS) return null;

  const loanAmount = propertyValue * (1 - downPct);
  const r          = calcMonthlyRate(annualRate);
  const payment    = r === 0
    ? loanAmount / termMonths
    : (loanAmount * r) / (1 - Math.pow(1 + r, -termMonths));

  return payment / debtRatio;
}

/**
 * Resultado completo de capacidad de endeudamiento.
 * Función principal del módulo — CapacityCalc solo necesita esta llamada.
 *
 * @param {number} monthlyIncome
 * @param {number} annualRate
 * @param {number} termMonths
 * @param {number} downPct
 * @param {number} [debtRatio=MAX_DEBT_RATIO]
 * @returns {AffordabilityResult | null}
 *
 * @example
 * const r = calcAffordability(5_000_000, 11.5, 240, 0.30);
 * r.maxPropertyValue; // → ~$234M
 * r.housingType;      // → 'VIS'
 * r.qualifiesVIS;     // → true
 */
export function calcAffordability(
  monthlyIncome,
  annualRate,
  termMonths,
  downPct,
  debtRatio = MAX_DEBT_RATIO,
) {
  const err = _validateInputs(monthlyIncome, annualRate, termMonths, downPct);
  if (err) return null;

  const r                = calcMonthlyRate(annualRate);
  const maxPayment       = monthlyIncome * debtRatio;
  const maxCredit        = _inverseFormula(maxPayment, r, termMonths);
  const maxPropertyValue = downPct === 0 ? maxCredit : maxCredit / (1 - downPct);
  const requiredDownPayment = maxPropertyValue * downPct;

  return {
    maxPayment,
    maxCredit,
    maxPropertyValue,
    requiredDownPayment,
    housingType:     _classifyHousing(maxPropertyValue),
    qualifiesVIS:    maxPropertyValue <= VIS_MAX_COP,
    qualifiesVIP:    maxPropertyValue <= VIP_MAX_COP,
    monthlyRate:     r,
    debtRatioUsed:   debtRatio,
  };
}

/**
 * Verifica si un usuario califica para un inmueble específico con su ingreso actual.
 * Complemento de calcAffordability para el modo "tengo un inmueble en mente".
 *
 * @param {number} propertyValue  - Inmueble objetivo en COP
 * @param {number} downPct        - Cuota inicial disponible como decimal
 * @param {number} annualRate     - Tasa EA en porcentaje
 * @param {number} termMonths     - Plazo en meses
 * @param {number} monthlyIncome  - Ingreso mensual actual en COP
 * @param {number} [debtRatio=MAX_DEBT_RATIO]
 * @returns {QualificationResult | null}
 *
 * @example
 * calcQualification(300_000_000, 0.30, 11.5, 240, 4_500_000);
 * // → { qualifies: false, requiredIncome: ~7.2M, incomeShortfall: ~2.7M }
 */
export function calcQualification(
  propertyValue,
  downPct,
  annualRate,
  termMonths,
  monthlyIncome,
  debtRatio = MAX_DEBT_RATIO,
) {
  const requiredIncome = calcRequiredIncome(
    propertyValue, downPct, annualRate, termMonths, debtRatio,
  );
  if (requiredIncome === null) return null;

  const loanAmount     = propertyValue * (1 - downPct);
  const r              = calcMonthlyRate(annualRate);
  const actualPayment  = r === 0
    ? loanAmount / termMonths
    : (loanAmount * r) / (1 - Math.pow(1 + r, -termMonths));

  const qualifies       = monthlyIncome >= requiredIncome;
  const actualDebtRatio = monthlyIncome > 0 ? actualPayment / monthlyIncome : Infinity;

  return {
    qualifies,
    actualPayment,
    actualDebtRatio,
    requiredIncome,
    incomeShortfall: qualifies ? 0 : requiredIncome - monthlyIncome,
    housingType:     _classifyHousing(propertyValue),
  };
}

/**
 * Valida los inputs sin ejecutar cálculos. Para validación en tiempo real en la UI.
 *
 * @param {number} monthlyIncome
 * @param {number} annualRate
 * @param {number} termMonths
 * @param {number} downPct
 * @returns {{ valid: boolean, error?: string, field?: string }}
 */
export function validateCapacityInputs(monthlyIncome, annualRate, termMonths, downPct) {
  const err = _validateInputs(monthlyIncome, annualRate, termMonths, downPct);
  if (err) return { valid: false, ...err };
  return { valid: true };
}

/**
 * Retorna los límites para configurar sliders y campos de la UI.
 * @returns {typeof LIMITS}
 */
export function getCapacityLimits() {
  return LIMITS;
}