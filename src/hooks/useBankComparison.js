/**
 * @file hooks/useBankComparison.js
 * @description Hook de estado para la comparación multi-banco.
 *
 *              Calcula cuota, total de intereses y total pagado para cada
 *              banco activo usando los inputs actuales del simulador, y expone
 *              el resultado ordenado por tasa con diferencias calculadas.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PATRÓN
 * ─────────────────────────────────────────────────────────────────────────────
 *   const cmp = useBankComparison({
 *     principal:      210_000_000,
 *     termMonths:     240,
 *     housingType:    'NoVIS',
 *     selectedBankId: 'bancolombia',
 *   });
 *
 *   const { results, interestRange, selectedSummary } = cmp.getState();
 *
 *   // results[0] → banco más barato
 *   // results[0].savingsVsSelected → cuánto ahorraría vs el seleccionado
 *
 *   cmp.selectBank('fna');
 *   cmp.setInputs({ principal: 150_000_000, termMonths: 180 });
 *
 *   const unsub = cmp.subscribe(state => renderTable(state.results));
 *   unsub();
 *   cmp.destroy();
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ESTADO COMPUTADO
 * ─────────────────────────────────────────────────────────────────────────────
 *   state.results[]          → un objeto por banco, ordenado por tasa EA
 *     .bank                  → objeto Bank completo de banks.js
 *     .rate                  → tasa EA de referencia usada
 *     .summary               → { payment, totalInterest, totalPaid }
 *     .isCheapest            → true si es el banco con tasa más baja
 *     .isSelected            → true si es el banco seleccionado
 *     .paymentDiff           → diferencia de cuota vs banco seleccionado
 *     .interestDiff          → diferencia de intereses totales vs más barato
 *   state.selectedSummary    → summary del banco seleccionado
 *   state.cheapestBankId     → ID del banco más barato
 *   state.interestRange      → { min, max, diff } de intereses totales
 *   state.isValid            → si hay resultados calculados
 *
 * @version 1.0.0
 * @updated 2026-05-26
 * @author  Arquitecto — calculavivienda.com.co
 */

import { calcAmortizationSummary }      from '../calculators/amortization.js';
import { getAllBanks, getBankById }      from '../config/banks.js';

// ─────────────────────────────────────────────────────────────────────────────
// INPUTS POR DEFECTO
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_INPUTS = Object.freeze({
  principal:      210_000_000,
  termMonths:     240,
  housingType:    'NoVIS',
  selectedBankId: 'bancolombia',
});

// ─────────────────────────────────────────────────────────────────────────────
// HOOK PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {Partial<typeof DEFAULT_INPUTS>} [initialInputs={}]
 * @returns {{
 *   getState:   () => object,
 *   setInputs:  (partial: object) => void,
 *   selectBank: (bankId: string) => void,
 *   subscribe:  (fn: Function) => (() => void),
 *   destroy:    () => void,
 * }}
 */
export function useBankComparison(initialInputs = {}) {
  let inputs      = { ...DEFAULT_INPUTS, ...initialInputs };
  let cache       = null;
  let cacheKey    = null;   // clave solo para cálculos (excluye selectedBankId)
  let subscribers = new Set();

  // ── Caché ──────────────────────────────────────────────────────────────────
  // La clave NO incluye selectedBankId porque cambiar de banco seleccionado
  // no requiere recalcular los pagos — solo actualizar las columnas .isCheapest
  // e .isSelected dentro del resultado ya calculado.

  function getCalcKey() {
    return `${inputs.principal}|${inputs.termMonths}|${inputs.housingType}`;
  }

  function compute() {
    const newCalcKey = getCalcKey();
    const needsCalc  = !cache || cacheKey !== newCalcKey;

    // ── Recálculo de pagos ─────────────────────────────────────────────────
    let rawResults;
    if (needsCalc) {
      if (inputs.principal <= 0 || inputs.termMonths <= 0) {
        cache    = { inputs: { ...inputs }, results: [], selectedSummary: null,
                     cheapestBankId: null, interestRange: null,
                     isValid: false, lastUpdated: Date.now() };
        cacheKey = newCalcKey;
        return cache;
      }

      const rateKey = inputs.housingType === 'VIS' ? 'rateVIS' : 'rateNoVIS';
      const banks   = getAllBanks(inputs.housingType);

      rawResults = banks.map(bank => {
        const rate    = bank[rateKey]?.reference ?? bank.rateNoVIS.reference;
        const summary = calcAmortizationSummary(inputs.principal, rate, inputs.termMonths);
        return summary ? { bank, rate, summary } : null;
      }).filter(Boolean);

      cacheKey = newCalcKey;
    } else {
      // Reusar resultados previos, solo actualizar flags de selección
      rawResults = cache.results.map(r => ({ ...r }));
    }

    if (!rawResults.length) {
      cache = { inputs: { ...inputs }, results: [], selectedSummary: null,
                cheapestBankId: null, interestRange: null,
                isValid: false, lastUpdated: Date.now() };
      return cache;
    }

    // ── Banco seleccionado y más barato ────────────────────────────────────
    const cheapestId  = rawResults[0].bank.id; // getAllBanks ya ordena por tasa
    const selectedRaw = rawResults.find(r => r.bank.id === inputs.selectedBankId)
                     ?? rawResults[0];
    const selectedPayment  = selectedRaw.summary.payment;
    const cheapestInterest = rawResults[0].summary.totalInterest;

    // ── Enriquecer resultados con diffs y flags ────────────────────────────
    const interests = rawResults.map(r => r.summary.totalInterest);
    const minInt    = Math.min(...interests);
    const maxInt    = Math.max(...interests);

    const results = rawResults.map(r => ({
      bank:         r.bank,
      rate:         r.rate,
      summary:      r.summary,
      isCheapest:   r.bank.id === cheapestId,
      isSelected:   r.bank.id === inputs.selectedBankId,
      // Diferencia de cuota mensual respecto al banco seleccionado
      // positivo = más cara, negativo = más barata que la seleccionada
      paymentDiff:  r.summary.payment - selectedPayment,
      // Diferencia de intereses totales respecto al más barato
      interestDiff: r.summary.totalInterest - cheapestInterest,
    }));

    cache = {
      inputs:         { ...inputs },
      results,
      selectedSummary: selectedRaw.summary,
      cheapestBankId: cheapestId,
      interestRange: {
        min:  minInt,
        max:  maxInt,
        diff: maxInt - minInt,
      },
      isValid: true,
      lastUpdated: Date.now(),
    };
    return cache;
  }

  function notify() {
    const state = compute();
    subscribers.forEach(fn => {
      try { fn(state); } catch (err) {
        console.error('[useBankComparison] Error en suscriptor:', err);
      }
    });
  }

  // ── API pública ────────────────────────────────────────────────────────────

  function getState() { return compute(); }

  /**
   * Actualiza inputs de cálculo (principal, termMonths, housingType).
   * Invalida la caché y recalcula todos los bancos.
   *
   * @param {{ principal?: number, termMonths?: number,
   *            housingType?: string, selectedBankId?: string }} partial
   */
  function setInputs(partial) {
    let changed = false;
    const updated = { ...inputs };
    for (const [key, value] of Object.entries(partial)) {
      if (!(key in DEFAULT_INPUTS)) {
        console.warn(`[useBankComparison] Input desconocido: "${key}"`); continue;
      }
      if (updated[key] !== value) { updated[key] = value; changed = true; }
    }
    if (!changed) return;

    const calcChanged = ['principal','termMonths','housingType'].some(
      k => partial[k] !== undefined && partial[k] !== inputs[k]
    );
    inputs = updated;
    if (calcChanged) cache = null; // invalidar caché de cálculos
    notify();
  }

  /**
   * Cambia el banco seleccionado sin recalcular los pagos.
   * Solo actualiza los flags .isSelected y .paymentDiff.
   *
   * @param {string} bankId
   */
  function selectBank(bankId) {
    if (!bankId || bankId === inputs.selectedBankId) return;
    const bank = getBankById(bankId);
    if (!bank) {
      console.warn(`[useBankComparison] Banco no encontrado: "${bankId}"`); return;
    }
    inputs = { ...inputs, selectedBankId: bankId };
    // No invalidar caché de cálculos — solo recalcular flags
    cache  = null; // forzar actualización de paymentDiff e isSelected
    notify();
  }

  function subscribe(fn) {
    if (typeof fn !== 'function') {
      console.error('[useBankComparison] subscribe requiere una función.'); return () => {};
    }
    subscribers.add(fn);
    return () => subscribers.delete(fn);
  }

  function destroy() { subscribers.clear(); cache = null; cacheKey = null; }

  compute();
  return { getState, setInputs, selectBank, subscribe, destroy };
}