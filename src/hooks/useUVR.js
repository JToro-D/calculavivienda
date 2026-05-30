/**
 * @file hooks/useUVR.js
 * @description Hook de estado para el valor UVR y la comparación pesos vs UVR.
 *
 *              A diferencia de los otros hooks, este gestiona estado asíncrono:
 *              obtiene el valor UVR del Banco de la República (vía Cloudflare
 *              Worker) y lo expone junto con los cálculos comparativos.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PATRÓN
 * ─────────────────────────────────────────────────────────────────────────────
 *   const uvr = useUVR({
 *     loanCOP:         210_000_000,
 *     pesosRate:       11.0,
 *     uvrRate:         7.5,
 *     termMonths:      240,
 *     annualInflation: 5.0,
 *   });
 *
 *   // Estado inmediato (con UVR de respaldo mientras carga)
 *   const { uvrValue, comparison, isLoading } = uvr.getState();
 *
 *   // Suscribirse — se llama cuando el UVR real llega de la API
 *   uvr.subscribe(state => {
 *     if (!state.isLoading) renderComparison(state.comparison);
 *   });
 *
 *   uvr.setInputs({ annualInflation: 3.0 }); // Actualizar proyección IPC
 *   await uvr.refresh();                      // Forzar re-fetch del UVR
 *   uvr.destroy();
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * FLUJO DE CARGA
 * ─────────────────────────────────────────────────────────────────────────────
 *   1. Inicializa con el valor de respaldo (410.5604) — disponible de inmediato
 *   2. Inicia fetch asíncrono al Cloudflare Worker /api/uvr
 *   3. Si el fetch tiene éxito → actualiza uvrValue y notifica suscriptores
 *   4. Si falla → mantiene el respaldo, marca uvrSource: 'fallback'
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ESTADO
 * ─────────────────────────────────────────────────────────────────────────────
 *   state.uvrValue        → valor UVR en COP (ej: 410.5604)
 *   state.uvrDate         → fecha de vigencia ('2026-05-15')
 *   state.uvrSource       → 'api' | 'cache' | 'fallback'
 *   state.isLoading       → true mientras el fetch está en curso
 *   state.hasError        → true si el fetch falló (pero usa respaldo)
 *   state.comparison      → resultado de compareUVRvsPesos (o null si inválido)
 *   state.inputs          → inputs de comparación actuales
 *   state.lastUpdated     → timestamp del último cambio
 *
 * @version 1.0.0
 * @updated 2026-05-26
 * @author  Arquitecto — calculavivienda.com.co
 */

import {
  fetchCurrentUVR,
  getFallbackUVR,
  compareUVRvsPesos,
}                                from '../calculators/uvr.js';
import { INFLATION_TARGET_PCT }  from '../config/constants.js';

// ─────────────────────────────────────────────────────────────────────────────
// INPUTS POR DEFECTO
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_INPUTS = Object.freeze({
  loanCOP:         210_000_000,
  pesosRate:       11.0,
  uvrRate:         7.5,
  termMonths:      240,
  annualInflation: INFLATION_TARGET_PCT,  // 3% — meta del Banrep
});

// ─────────────────────────────────────────────────────────────────────────────
// HOOK PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {Partial<typeof DEFAULT_INPUTS>} [initialInputs={}]
 * @returns {{
 *   getState:   () => object,
 *   setInputs:  (partial: object) => void,
 *   refresh:    () => Promise<void>,
 *   subscribe:  (fn: Function) => (() => void),
 *   destroy:    () => void,
 * }}
 */
export function useUVR(initialInputs = {}) {
  // ── Estado interno ─────────────────────────────────────────────────────────

  const fallback = getFallbackUVR();

  let uvrData = {
    value:  fallback.value,
    date:   fallback.date,
    source: fallback.source,
  };

  let inputs      = { ...DEFAULT_INPUTS, ...initialInputs };
  let isLoading   = false;
  let hasError    = false;
  let compCache   = null;      // cache del resultado de compareUVRvsPesos
  let compCacheKey = null;
  let subscribers = new Set();
  let destroyed   = false;
  let fetchAbort  = null;      // AbortController para cancelar fetch en flight

  // ── Caché de comparación ───────────────────────────────────────────────────

  function getCompKey() {
    return [
      uvrData.value,
      inputs.loanCOP,
      inputs.pesosRate,
      inputs.uvrRate,
      inputs.termMonths,
      inputs.annualInflation,
    ].join('|');
  }

  function computeComparison() {
    const key = getCompKey();
    if (compCache && compCacheKey === key) return compCache;

    if (inputs.loanCOP <= 0 || inputs.termMonths <= 0) {
      compCache    = null;
      compCacheKey = key;
      return null;
    }

    compCache = compareUVRvsPesos(
      inputs.loanCOP,
      uvrData.value,
      inputs.uvrRate,
      inputs.pesosRate,
      inputs.termMonths,
      inputs.annualInflation,
    );
    compCacheKey = key;
    return compCache;
  }

  // ── Snapshot del estado ────────────────────────────────────────────────────

  function snapshot() {
    return {
      uvrValue:    uvrData.value,
      uvrDate:     uvrData.date,
      uvrSource:   uvrData.source,
      isLoading,
      hasError,
      inputs:      { ...inputs },
      comparison:  computeComparison(),
      lastUpdated: Date.now(),
    };
  }

  function notify() {
    if (destroyed) return;
    const state = snapshot();
    subscribers.forEach(fn => {
      try { fn(state); } catch (err) {
        console.error('[useUVR] Error en suscriptor:', err);
      }
    });
  }

  // ── Fetch del UVR ──────────────────────────────────────────────────────────

  async function doFetch() {
    if (destroyed) return;

    isLoading = true;
    hasError  = false;
    compCache = null;   // invalidar caché al cambiar el UVR
    notify();

    try {
      const result = await fetchCurrentUVR();

      if (destroyed) return; // se destruyó durante el fetch

      uvrData   = { value: result.value, date: result.date, source: result.source };
      hasError  = false;
    } catch (err) {
      if (destroyed) return;
      console.warn('[useUVR] Fetch falló, usando respaldo:', err?.message ?? err);
      hasError = true;
      // uvrData ya tiene el valor de respaldo del init → mantener
    } finally {
      if (!destroyed) {
        isLoading = false;
        compCache = null; // forzar recalculo con el nuevo UVR
        notify();
      }
    }
  }

  // ── API pública ────────────────────────────────────────────────────────────

  function getState() { return snapshot(); }

  /**
   * Actualiza los inputs de comparación y recalcula.
   * @param {{ loanCOP?:number, pesosRate?:number, uvrRate?:number,
   *            termMonths?:number, annualInflation?:number }} partial
   */
  function setInputs(partial) {
    let changed = false;
    const updated = { ...inputs };
    for (const [key, value] of Object.entries(partial)) {
      if (!(key in DEFAULT_INPUTS)) {
        console.warn(`[useUVR] Input desconocido: "${key}"`); continue;
      }
      if (updated[key] !== value) { updated[key] = value; changed = true; }
    }
    if (!changed) return;
    inputs    = updated;
    compCache = null;   // invalidar caché de comparación
    notify();
  }

  /**
   * Fuerza un nuevo fetch del valor UVR desde la API.
   * Útil para botones de "actualizar" o cuando el sitio lleva mucho tiempo abierto.
   * @returns {Promise<void>}
   */
  async function refresh() {
    await doFetch();
  }

  function subscribe(fn) {
    if (typeof fn !== 'function') {
      console.error('[useUVR] subscribe requiere una función.'); return () => {};
    }
    subscribers.add(fn);
    return () => subscribers.delete(fn);
  }

  /**
   * Limpia suscriptores y cancela cualquier fetch en vuelo.
   */
  function destroy() {
    destroyed   = true;
    isLoading   = false;
    subscribers.clear();
    compCache   = null;
    compCacheKey = null;
  }

  // ── Inicio ─────────────────────────────────────────────────────────────────
  // Lanzar el fetch en segundo plano. No bloquea — el hook ya tiene
  // el valor de respaldo disponible para getState() inmediato.
  doFetch();

  return { getState, setInputs, refresh, subscribe, destroy };
}