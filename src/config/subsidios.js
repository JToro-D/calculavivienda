/**
 * @file subsidios.js
 * @description Datos y lógica de los subsidios de vivienda vigentes en Colombia.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ESTADO DE LOS PROGRAMAS EN 2026
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ✅ ACTIVOS:
 *   - Subsidio de Cajas de Compensación Familiar (43 cajas en Colombia)
 *   - Programas distritales (Bogotá, Medellín, Cali, Barranquilla)
 *   - FNA: crédito hasta el 100% del valor VIS/VIP (no es subsidio, es financiación)
 *
 * ⛔ SUSPENDIDO EN 2026:
 *   - Mi Casa Ya (Gobierno Nacional): sin nuevas inscripciones ni cupos.
 *     Fuente: Ministerio de Vivienda y FNA (mayo 2026).
 *     Puede reactivarse en una nueva vigencia. Verificar en:
 *     https://www.minvivienda.gov.co
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * MANTENIMIENTO
 * ─────────────────────────────────────────────────────────────────────────────
 * Frecuencia  : Cuando cambie el estado de algún programa (1–2 veces/año)
 * Responsable : Propietario del proyecto
 * Tiempo est. : 15 minutos por actualización
 *
 * QUÉ VERIFICAR:
 *   - Estado de Mi Casa Ya: https://www.minvivienda.gov.co
 *   - Montos cajas de compensación: https://www.asocajas.org.co
 *   - Programas distritales: sitio web de cada alcaldía
 *
 * @version 1.0.0
 * @updated 2026-05-26
 * @author  Arquitecto — calculavivienda.com.co
 */

import { SMMLV, VIS_MAX_COP, VIP_MAX_COP } from './constants.js';

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS (JSDoc)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {'active' | 'suspended' | 'closed'} ProgramStatus
 */

/**
 * @typedef {Object} SubsidyRange
 * @property {string}        id              - Identificador del rango
 * @property {number}        incomeMinSMMLV  - Ingreso mínimo en SMMLV (0 si no hay mínimo)
 * @property {number}        incomeMaxSMMLV  - Ingreso máximo en SMMLV
 * @property {number}        subsidyMaxSMMLV - Subsidio máximo en SMMLV
 * @property {string[]}      housingTypes    - Tipos de vivienda aplicables
 * @property {string}        description     - Descripción para mostrar en UI
 */

/**
 * @typedef {Object} SubsidyResult
 * @property {boolean}       eligible        - Si el hogar es elegible
 * @property {number}        subsidyAmountCOP - Monto del subsidio en COP
 * @property {number}        subsidySMMLV    - Monto del subsidio en SMMLV
 * @property {string}        source          - Fuente del subsidio
 * @property {string}        description     - Descripción para mostrar en UI
 * @property {string[]}      requirements    - Requisitos adicionales
 */

/**
 * @typedef {Object} EligibilityCheck
 * @property {boolean}       eligible           - Si aplica a algún subsidio
 * @property {SubsidyResult[]} subsidies        - Lista de subsidios disponibles
 * @property {number}          totalSubsidyCOP  - Total de subsidios combinables
 * @property {string[]}        notes            - Notas importantes
 */

// ─────────────────────────────────────────────────────────────────────────────
// PROGRAMA MI CASA YA — SUSPENDIDO 2026
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Estado del programa Mi Casa Ya del Gobierno Nacional.
 * Actualizar cuando el Ministerio de Vivienda anuncie nuevas convocatorias.
 *
 * @type {{ status: ProgramStatus, message: string, lastActive: number, source: string }}
 */
export const MI_CASA_YA_STATUS = {
  status:     'suspended',
  year:       2026,
  message:    'El programa Mi Casa Ya no tiene nuevas inscripciones en 2026. ' +
              'El Gobierno Nacional no dispone de presupuesto para nuevas asignaciones ' +
              'en la vigencia actual. Verifique en www.minvivienda.gov.co si hay ' +
              'una nueva convocatoria.',
  lastActive: 2024,
  source:     'Ministerio de Vivienda y FNA — Mayo 2026',
  checkUrl:   'https://www.minvivienda.gov.co',
};

/**
 * Datos históricos de Mi Casa Ya para referencia.
 * Útil para mostrar al usuario cómo era el beneficio cuando estaba activo.
 */
export const MI_CASA_YA_HISTORICAL = [
  {
    year:           2024,
    incomeMaxSMMLV: 8,
    subsidySMMLV:   30,
    housingTypes:   ['VIS', 'VIP'],
    requiresSisben: true,
    sisbenRange:    'A1 a D20',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// CAJAS DE COMPENSACIÓN FAMILIAR — ACTIVO 2026
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Rangos de subsidio de las Cajas de Compensación Familiar.
 * Fuente: Asocajas y reglamentación nacional (lineamientos SFV).
 *
 * NOTA: Cada caja puede tener condiciones internas propias (puntajes,
 * cronogramas, documentación). Los montos aquí son los topes nacionales.
 * 43 cajas de compensación operan en Colombia.
 *
 * Actualizar: cuando el Gobierno modifique los montos máximos del SFV.
 */
export const CAJAS_SUBSIDY_RANGES = [
  {
    id:             'caja_rango_1',
    incomeMinSMMLV: 0,
    incomeMaxSMMLV: 2,
    subsidyMaxSMMLV: 30,
    housingTypes:   ['VIS', 'VIP'],
    description:    'Ingresos hasta 2 SMMLV — subsidio hasta 30 SMMLV',
    onlyNewHousing: true,
  },
  {
    id:             'caja_rango_2',
    incomeMinSMMLV: 2,
    incomeMaxSMMLV: 4,
    subsidyMaxSMMLV: 20,
    housingTypes:   ['VIS', 'VIP'],
    description:    'Ingresos entre 2 y 4 SMMLV — subsidio hasta 20 SMMLV',
    onlyNewHousing: true,
  },
];

/**
 * Requisitos generales de las Cajas de Compensación.
 */
export const CAJAS_REQUIREMENTS = [
  'Estar afiliado a una Caja de Compensación Familiar',
  'No ser propietario de vivienda en Colombia',
  'No haber sido beneficiario de subsidio familiar de vivienda anteriormente',
  'Tener aprobado un crédito hipotecario o leasing habitacional',
  'El inmueble debe ser vivienda nueva (VIS o VIP)',
  'Ingresos del hogar no superiores a 4 SMMLV',
];

// ─────────────────────────────────────────────────────────────────────────────
// PROGRAMAS DISTRITALES — REFERENCIA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Programas distritales vigentes en 2026.
 * No calculados automáticamente — sirven para mostrar información al usuario.
 * Los montos están en pesos COP.
 */
export const PROGRAMAS_DISTRITALES = [
  {
    id:        'bogota_reduce_cuota',
    city:      'Bogotá',
    name:      'Reduce tu Cuota',
    amountCOP: 21_010_860,
    description: 'Subsidio distribuido en 48 cuotas mensuales de ~$437.726 ' +
                 'abonadas directamente al crédito hipotecario.',
    incomeMaxSMMLV: 4,
    status:    'active',
    url:       'https://bogota.gov.co',
  },
  {
    id:        'bogota_oferta_preferente',
    city:      'Bogotá',
    name:      'Oferta Preferente',
    amountMinCOP: 17_509_050,
    amountMaxCOP: 52_527_150,
    description: 'Subsidio para vivienda VIS y VIP en proyectos seleccionados ' +
                 'por la Secretaría Distrital del Hábitat.',
    incomeMaxSMMLV: 4,
    status:    'active',
    url:       'https://bogota.gov.co',
  },
  {
    id:        'medellin_isvimed',
    city:      'Medellín',
    name:      'ISVIMED — Subsidio Distrital',
    amountCOP: null,
    description: 'Verificar vigencia y monto actualizado con el ISVIMED ' +
                 '(Instituto Social de Vivienda y Hábitat de Medellín).',
    status:    'verify',
    url:       'https://www.isvimed.gov.co',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// API PÚBLICA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calcula el monto del subsidio de Cajas de Compensación dado el ingreso.
 *
 * @param {number} monthlyIncomeCOP - Ingreso mensual del hogar en COP
 * @returns {{ eligible: boolean, subsidySMMLV: number, subsidyCOP: number,
 *             range: SubsidyRange | null, description: string }}
 *
 * @example
 * calcCajasSubsidy(3_000_000);
 * // → { eligible: true, subsidySMMLV: 20, subsidyCOP: ~35M, ... }
 */
export function calcCajasSubsidy(monthlyIncomeCOP) {
  if (typeof monthlyIncomeCOP !== 'number' || monthlyIncomeCOP <= 0) {
    return { eligible: false, subsidySMMLV: 0, subsidyCOP: 0, range: null,
             description: 'Ingreso inválido.' };
  }

  const incomeSMMLV = monthlyIncomeCOP / SMMLV;

  for (const range of CAJAS_SUBSIDY_RANGES) {
    if (incomeSMMLV > range.incomeMinSMMLV && incomeSMMLV <= range.incomeMaxSMMLV) {
      const subsidyCOP = range.subsidyMaxSMMLV * SMMLV;
      return {
        eligible:     true,
        subsidySMMLV: range.subsidyMaxSMMLV,
        subsidyCOP,
        range,
        description:  range.description,
      };
    }
  }

  // Ingresos superiores al límite
  const maxSMMLV = Math.max(...CAJAS_SUBSIDY_RANGES.map(r => r.incomeMaxSMMLV));
  return {
    eligible:     false,
    subsidySMMLV: 0,
    subsidyCOP:   0,
    range:        null,
    description:  `Ingresos superiores a ${maxSMMLV} SMMLV ($${(maxSMMLV * SMMLV).toLocaleString('es-CO')}). ` +
                  'No aplica para subsidio de Caja de Compensación.',
  };
}

/**
 * Verifica elegibilidad general y retorna todos los subsidios disponibles.
 * Función principal del módulo Subsidies/.
 *
 * @param {number}  monthlyIncomeCOP - Ingreso mensual del hogar en COP
 * @param {number}  propertyValueCOP - Valor del inmueble en COP
 * @param {boolean} [isNewHousing=true] - ¿Es vivienda nueva?
 * @returns {EligibilityCheck}
 *
 * @example
 * const result = checkSubsidyEligibility(3_000_000, 200_000_000);
 * result.eligible;          // → true
 * result.totalSubsidyCOP;   // → ~35M COP
 * result.subsidies[0].source; // → 'Cajas de Compensación'
 */
export function checkSubsidyEligibility(monthlyIncomeCOP, propertyValueCOP, isNewHousing = true) {
  const subsidies = [];
  const notes     = [];
  let   totalSubsidyCOP = 0;

  // ── Determinar tipo de vivienda ───────────────────────────────────────────
  const isVIP = propertyValueCOP <= VIP_MAX_COP;
  const isVIS = propertyValueCOP <= VIS_MAX_COP;

  if (!isVIS) {
    notes.push(
      `La vivienda ($${propertyValueCOP.toLocaleString('es-CO')}) supera el tope VIS ` +
      `($${VIS_MAX_COP.toLocaleString('es-CO')}). Los subsidios aplican solo para VIS y VIP.`
    );
    return { eligible: false, subsidies: [], totalSubsidyCOP: 0, notes };
  }

  if (!isNewHousing) {
    notes.push('Los subsidios de Caja de Compensación aplican exclusivamente para vivienda nueva.');
    return { eligible: false, subsidies: [], totalSubsidyCOP: 0, notes };
  }

  // ── Caja de Compensación ──────────────────────────────────────────────────
  const cajas = calcCajasSubsidy(monthlyIncomeCOP);
  if (cajas.eligible) {
    subsidies.push({
      eligible:     true,
      subsidyAmountCOP: cajas.subsidyCOP,
      subsidySMMLV: cajas.subsidySMMLV,
      source:       'Cajas de Compensación Familiar',
      description:  cajas.description,
      requirements: CAJAS_REQUIREMENTS,
    });
    totalSubsidyCOP += cajas.subsidyCOP;
  }

  // ── Mi Casa Ya — informar suspensión ─────────────────────────────────────
  notes.push(MI_CASA_YA_STATUS.message);

  // ── Nota sobre programas distritales ─────────────────────────────────────
  notes.push(
    'Consulte también los programas distritales de su ciudad ' +
    '(Bogotá, Medellín, Cali, Barranquilla) que pueden combinarse con ' +
    'el subsidio de su Caja de Compensación.'
  );

  return {
    eligible:        subsidies.length > 0,
    subsidies,
    totalSubsidyCOP,
    notes,
  };
}

/**
 * Calcula el impacto del subsidio sobre el crédito hipotecario.
 * El subsidio reduce el monto del crédito necesario.
 *
 * @param {number} propertyValueCOP  - Valor del inmueble en COP
 * @param {number} downPaymentCOP    - Cuota inicial disponible en COP
 * @param {number} subsidyAmountCOP  - Monto del subsidio en COP
 * @returns {{ originalLoan: number, reducedLoan: number, loanReduction: number,
 *             effectiveDownPct: number }}
 *
 * @example
 * calcSubsidyImpact(200_000_000, 40_000_000, 35_000_000);
 * // → { originalLoan: 160M, reducedLoan: 125M, loanReduction: 35M, effectiveDownPct: 37.5% }
 */
export function calcSubsidyImpact(propertyValueCOP, downPaymentCOP, subsidyAmountCOP) {
  if ([propertyValueCOP, downPaymentCOP, subsidyAmountCOP].some(
    v => typeof v !== 'number' || v < 0
  )) return null;

  const originalLoan    = Math.max(0, propertyValueCOP - downPaymentCOP);
  // El subsidio se aplica como reducción adicional al crédito
  const reducedLoan     = Math.max(0, originalLoan - subsidyAmountCOP);
  const effectiveDown   = downPaymentCOP + subsidyAmountCOP;
  const effectiveDownPct = propertyValueCOP > 0 ? effectiveDown / propertyValueCOP : 0;

  return {
    originalLoan,
    reducedLoan,
    loanReduction:    originalLoan - reducedLoan,
    effectiveDown,
    effectiveDownPct,
  };
}

/**
 * Retorna los programas distritales de una ciudad.
 *
 * @param {string} city - Nombre de la ciudad (ej: 'Bogotá', 'Medellín')
 * @returns {typeof PROGRAMAS_DISTRITALES}
 */
export function getDistrictPrograms(city) {
  if (!city) return PROGRAMAS_DISTRITALES;
  return PROGRAMAS_DISTRITALES.filter(
    p => p.city.toLowerCase() === city.toLowerCase()
  );
}

/**
 * Retorna los rangos de Cajas en pesos COP (calculados desde SMMLV).
 * Útil para mostrar en la UI sin que el componente haga cálculos.
 */
export function getCajasRangesInCOP() {
  return CAJAS_SUBSIDY_RANGES.map(range => ({
    ...range,
    incomeMinCOP:    range.incomeMinSMMLV * SMMLV,
    incomeMaxCOP:    range.incomeMaxSMMLV  * SMMLV,
    subsidyMaxCOP:   range.subsidyMaxSMMLV * SMMLV,
  }));
}