/**
 * @file hooks/useAmortization.js
 * @description Hook de estado para el simulador hipotecario principal.
 *
 *              Encapsula todos los cálculos de amortización y expone
 *              una API de lectura/escritura con notificación reactiva
 *              a suscriptores. Los módulos de UI lo usan en lugar de
 *              llamar directamente a los calculadores.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PATRÓN
 * ─────────────────────────────────────────────────────────────────────────────
 *   const sim = useAmortization({ propertyValueCOP: 300_000_000 });
 *
 *   // Leer estado actual (cálculos ya hechos)
 *   const { summary, table, annual, isValid } = sim.getState();
 *
 *   // Actualizar un input → recalcula y notifica
 *   sim.setInput('termMonths', 180);
 *   sim.setInputs({ annualRate: 9.3, selectedBankId: 'fna' });
 *
 *   // Suscribirse a cambios
 *   const unsub = sim.subscribe(state => {
 *     renderAmortizationTable(state.table);
 *   });
 *   unsub(); // cancelar suscripción
 *
 *   sim.destroy(); // limpiar todo
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ESTADO COMPUTADO
 * ─────────────────────────────────────────────────────────────────────────────
 *   state.inputs     → inputs brutos del usuario
 *   state.derived    → valores calculados de los inputs (principal, housingType)
 *   state.table      → tabla de amortización completa (360 filas)
 *   state.annual     → resumen anual (hasta 30 filas)
 *   state.summary    → métricas clave (payment, totalInterest, totalPaid)
 *   state.isValid    → si los inputs son válidos para calcular
 *   state.validation → resultado detallado de la validación
 *
 * @version 1.0.0
 * @updated 2026-05-26
 * @author  Arquitecto — calculavivienda.com.co
 */

import {
  calcAmortizationTable,
  calcAnnualSummary,
}                                from '../calculators/amortization.js';
import { getReferenceRate }      from '../config/banks.js';
import {
  validateSimulatorInputs,
  classifyPropertyType,
}                                from '../utils/validators.js';
import {
  DEFAULT_PROPERTY_VALUE_COP,
  DEFAULT_DOWN_PCT,
  DEFAULT_TERM_MONTHS,
}                                from '../config/constants.js';

// ─────────────────────────────────────────────────────────────────────────────
// INPUTS POR DEFECTO
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_INPUTS = Object.freeze({
  propertyValueCOP: DEFAULT_PROPERTY_VALUE_COP,
  downPaymentPct:   DEFAULT_DOWN_PCT,
  termMonths:       DEFAULT_TERM_MONTHS,
  annualRate:       11.0,
  selectedBankId:   'bancolombia',
});

// ─────────────────────────────────────────────────────────────────────────────
// HOOK PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Crea un estado reactivo para la simulación hipotecaria.
 *
 * @param {Partial<typeof DEFAULT_INPUTS>} [initialInputs={}]
 * @returns {{
 *   getState:    () => object,
 *   setInput:    (key: string, value: any) => void,
 *   setInputs:   (partial: object) => void,
 *   syncBankRate:(bankId: string, housingType?: string) => void,
 *   subscribe:   (fn: Function) => (() => void),
 *   reset:       () => void,
 *   destroy:     () => void,
 * }}
 */
export function useAmortization(initialInputs = {}) {
  let inputs      = { ...DEFAULT_INPUTS, ...initialInputs };
  let cache       = null;
  let cacheKey    = null;
  let subscribers = new Set();

  // ── Caché ──────────────────────────────────────────────────────────────────

  function getCacheKey() {
    return `${inputs.propertyValueCOP}|${inputs.downPaymentPct}|${inputs.termMonths}|${inputs.annualRate}`;
  }

  function compute() {
    const newKey = getCacheKey();
    if (cache && cacheKey === newKey) return cache;

    const validation = validateSimulatorInputs({
      propertyValue:  inputs.propertyValueCOP,
      downPaymentPct: inputs.downPaymentPct,
      termMonths:     inputs.termMonths,
      annualRate:     inputs.annualRate,
    });

    if (!validation.valid) {
      cache    = { inputs: { ...inputs }, derived: null, table: null,
                   annual: null, summary: null, validation, isValid: false,
                   lastUpdated: Date.now() };
      cacheKey = newKey;
      return cache;
    }

    const principal   = Math.round(inputs.propertyValueCOP * (1 - inputs.downPaymentPct));
    const downPayment = Math.round(inputs.propertyValueCOP * inputs.downPaymentPct);
    const housing     = classifyPropertyType(inputs.propertyValueCOP);

    const table  = calcAmortizationTable(principal, inputs.annualRate, inputs.termMonths);
    const annual = table ? calcAnnualSummary(table) : null;

    const summary = table ? {
      payment:        table.payment,
      totalInterest:  table.totalInterest,
      totalPaid:      table.totalPaid,
      totalPrincipal: table.totalPrincipal,
      monthlyRate:    table.monthlyRate,
    } : null;

    cache = {
      inputs:  { ...inputs },
      derived: { principal, downPayment, housingType: housing.type },
      table,
      annual,
      summary,
      validation,
      isValid: true,
      lastUpdated: Date.now(),
    };
    cacheKey = newKey;
    return cache;
  }

  function notify() {
    const state = compute();
    subscribers.forEach(fn => {
      try { fn(state); } catch (err) {
        console.error('[useAmortization] Error en suscriptor:', err);
      }
    });
  }

  // ── API pública ────────────────────────────────────────────────────────────

  function getState() { return compute(); }

  function setInput(key, value) {
    if (!(key in DEFAULT_INPUTS)) {
      console.warn(`[useAmortization] Input desconocido: "${key}"`); return;
    }
    if (inputs[key] === value) return;
    inputs = { ...inputs, [key]: value };
    cache  = null;
    notify();
  }

  function setInputs(partial) {
    let changed = false;
    const updated = { ...inputs };
    for (const [key, value] of Object.entries(partial)) {
      if (!(key in DEFAULT_INPUTS)) {
        console.warn(`[useAmortization] Input desconocido: "${key}"`); continue;
      }
      if (updated[key] !== value) { updated[key] = value; changed = true; }
    }
    if (!changed) return;
    inputs = updated;
    cache  = null;
    notify();
  }

  function syncBankRate(bankId, housingType = 'NoVIS') {
    const rate = getReferenceRate(bankId, housingType);
    if (rate === null) {
      console.warn(`[useAmortization] Banco no encontrado: "${bankId}"`); return;
    }
    setInputs({ selectedBankId: bankId, annualRate: rate });
  }

  function subscribe(fn) {
    if (typeof fn !== 'function') {
      console.error('[useAmortization] subscribe requiere una función.'); return () => {};
    }
    subscribers.add(fn);
    return () => subscribers.delete(fn);
  }

  function reset() {
    inputs = { ...DEFAULT_INPUTS };
    cache  = null;
    notify();
  }

  function destroy() {
    subscribers.clear();
    cache = null; cacheKey = null;
  }

  compute(); // cálculo inicial
  return { getState, setInput, setInputs, syncBankRate, subscribe, reset, destroy };
}