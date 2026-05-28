/**
 * @file constants.js
 * @description Constantes legales, regulatorias y operativas del mercado
 *              hipotecario colombiano. Segunda fuente de verdad del proyecto
 *              junto con banks.js.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * MANTENIMIENTO
 * ─────────────────────────────────────────────────────────────────────────────
 * Frecuencia  : Anual (cada enero, después del decreto de salario mínimo)
 * Responsable : Propietario del proyecto
 * Tiempo est. : 20 minutos por actualización
 *
 * QUÉ ACTUALIZAR CADA AÑO Y DÓNDE VERIFICAR:
 *
 *   SMMLV          → Decreto del Ministerio del Trabajo (diciembre/enero)
 *                    https://www.mintrabajo.gov.co
 *
 *   AUXILIO_TRANSPORTE → Mismo decreto del SMMLV
 *
 *   VIS_MAX_COP / VIP_MAX_COP → Se recalculan automáticamente desde el SMMLV.
 *                    Solo cambiar VIS_MAX_SMMLV o VIP_MAX_SMMLV si la ley
 *                    modifica los topes (no ha cambiado desde Decreto 1077/2015).
 *
 *   INFLATION_TARGET_PCT → Verificar con el Banco de la República en enero
 *                    https://www.banrep.gov.co → Política monetaria → Meta de inflación
 *
 * QUÉ NO CAMBIA Y POR QUÉ:
 *
 *   MAX_DEBT_RATIO  → Art. 17 Ley 546 de 1999. Sin modificaciones desde 1999.
 *   MIN_DOWN_PCT    → Regulación bancaria estándar. El FNA es la excepción (100% VIS).
 *   MIN/MAX_TERM    → Ley 546 de 1999.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * VIGENCIA DE ESTE ARCHIVO: Año 2026
 * Fuentes:
 *   - Decreto 1469 del 29 de diciembre de 2025 (SMMLV 2026)
 *   - Decreto 0159 del 19 de febrero de 2026 (ratificación transitoria)
 *   - Decreto 1077 de 2015 (topes VIS/VIP en SMMLV)
 *   - Ley 546 de 1999 (regla de endeudamiento y plazos)
 *   - Banco de la República (meta de inflación y UVR)
 *
 * @version 1.0.0
 * @updated 2026-05-26
 * @author  Arquitecto — calculavivienda.com.co
 */

// ─────────────────────────────────────────────────────────────────────────────
// ENTORNO — Detección de desarrollo (mismo patrón que banks.js)
// ─────────────────────────────────────────────────────────────────────────────

const IS_DEV = (
  typeof window !== 'undefined' && (
    window.location.hostname === 'localhost'        ||
    window.location.hostname === '127.0.0.1'       ||
    window.location.hostname.startsWith('192.168') ||
    window.location.hostname.startsWith('10.')     ||
    (window.location.port !== '' &&
     window.location.port !== '80' &&
     window.location.port !== '443')
  )
);

// ─────────────────────────────────────────────────────────────────────────────
// 1. SALARIO Y AUXILIOS
//    Fuente: Decretos 1469 y 0159 de 2025–2026
//    Actualizar: cada enero
// ─────────────────────────────────────────────────────────────────────────────

/** Salario Mínimo Mensual Legal Vigente 2026 (COP) — Decreto 1469/2025 */
export const SMMLV = 1_750_905;

/** Auxilio de transporte 2026 (COP) — Decreto 1470/2025 */
export const AUXILIO_TRANSPORTE = 249_095;

/** Año de vigencia de las constantes — para alertas de mantenimiento */
export const VIGENCIA_AÑO = 2026;

// ─────────────────────────────────────────────────────────────────────────────
// 2. CATEGORÍAS DE VIVIENDA (VIS / VIP)
//    Los topes en SMMLV son fijos por ley (Decreto 1077/2015).
//    Los topes en COP se calculan automáticamente con el SMMLV vigente.
//    Actualizar: solo si la ley modifica los topes en SMMLV (muy poco frecuente)
// ─────────────────────────────────────────────────────────────────────────────

/** Tope VIS en unidades de SMMLV — Decreto 1077 de 2015, Art. 1 */
export const VIS_MAX_SMMLV = 135;

/** Tope VIP en unidades de SMMLV — Decreto 1077 de 2015, Art. 1 */
export const VIP_MAX_SMMLV = 70;

/**
 * Tope VIS en pesos COP 2026 — calculado automáticamente.
 * 135 × $1.750.905 = $236.372.175 COP
 * @type {number}
 */
export const VIS_MAX_COP = SMMLV * VIS_MAX_SMMLV;

/**
 * Tope VIP en pesos COP 2026 — calculado automáticamente.
 * 70 × $1.750.905 = $122.563.350 COP
 * @type {number}
 */
export const VIP_MAX_COP = SMMLV * VIP_MAX_SMMLV;

// ─────────────────────────────────────────────────────────────────────────────
// 3. REGULACIÓN CREDITICIA
//    Fuente: Ley 546 de 1999 y normativa Superfinanciera
//    Actualizar: solo si la Superfinanciera modifica la regulación
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Máximo porcentaje del ingreso mensual destinado a cuota hipotecaria.
 * Base legal: Art. 17 Ley 546 de 1999 (sin cambios desde 1999).
 * Todos los bancos aplican este límite al estudiar una solicitud de crédito.
 */
export const MAX_DEBT_RATIO = 0.30;

/**
 * Porcentaje mínimo de cuota inicial (Loan-to-Value máximo = 80%).
 * La regulación bancaria estándar exige mínimo 20% de cuota inicial.
 * Excepción: FNA financia hasta el 100% para VIS/VIP desde 2026.
 */
export const MIN_DOWN_PCT    = 0.20; // 20%
export const MAX_DOWN_PCT    = 0.50; // 50% — límite razonable en el simulador
export const MIN_DOWN_PCT_FNA = 0.00; // FNA puede financiar el 100% en VIS 2026

/**
 * Plazos permitidos para crédito hipotecario en Colombia.
 * Base legal: Ley 546 de 1999.
 */
export const MIN_TERM_MONTHS = 60;   // 5 años mínimo
export const MAX_TERM_MONTHS = 360;  // 30 años máximo

/** Opciones de plazo estándar para los controles de la UI */
export const TERM_OPTIONS_YEARS = [5, 10, 15, 20, 25, 30];

// ─────────────────────────────────────────────────────────────────────────────
// 4. PARÁMETROS DEL SIMULADOR
//    Valores por defecto y rangos para los inputs de la UI.
//    Cambiar si el mercado cambia significativamente.
// ─────────────────────────────────────────────────────────────────────────────

/** Valor del inmueble por defecto al cargar el simulador (COP) */
export const DEFAULT_PROPERTY_VALUE_COP = 300_000_000; // $300M

/** Cuota inicial por defecto (porcentaje) */
export const DEFAULT_DOWN_PCT = 0.30; // 30%

/** Plazo por defecto (meses) */
export const DEFAULT_TERM_MONTHS = 240; // 20 años

/** Rango del slider de valor del inmueble (COP) */
export const PROPERTY_VALUE_MIN_COP = 50_000_000;   // $50M
export const PROPERTY_VALUE_MAX_COP = 2_000_000_000; // $2B

/** Rango del slider de ingresos mensuales para CapacityCalc (COP) */
export const INCOME_MIN_COP = 1_750_905;    // 1 SMMLV
export const INCOME_MAX_COP = 30_000_000;   // $30M

/**
 * Meta de inflación anual del Banco de la República.
 * Usada como proyección por defecto en el módulo UVRComparator.
 * Verificar en enero si el Banco de la República modifica su meta.
 * Fuente: https://www.banrep.gov.co → Política Monetaria → Meta de Inflación
 */
export const INFLATION_TARGET_PCT = 3.0; // 3% anual — meta largo plazo Banrep

// ─────────────────────────────────────────────────────────────────────────────
// 5. SEGUROS DE REFERENCIA
//    Tasas aproximadas para mostrar el costo real del crédito.
//    IMPORTANTE: son valores de referencia. El banco define las tasas reales
//    según el perfil del solicitante, su edad y la aseguradora.
//    Actualizar: cuando cambien significativamente (revisar anualmente)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Referencia de seguros para crédito hipotecario en Colombia.
 * Estas tasas se aplican sobre el saldo del crédito cada mes.
 * Son para mostrar un estimado del costo real — no son exactas.
 */
export const INSURANCE_REFERENCE = {
  /**
   * Seguro de vida deudor (sobre saldo del crédito, mensual).
   * Varía según la edad del solicitante. Promedio del mercado ~0.03–0.05%/mes.
   */
  lifeInsurancePctMonthly: 0.0003, // 0.03% mensual del saldo

  /**
   * Seguro de incendio y terremoto (sobre valor comercial del inmueble, mensual).
   * Aproximadamente 0.0098% mensual (equivale a ~0.12% anual).
   */
  propertyInsurancePctMonthly: 0.0001, // 0.01% mensual del valor del inmueble
};

// ─────────────────────────────────────────────────────────────────────────────
// 6. APIs EXTERNAS
//    URLs de servicios externos usados por el proyecto.
//    Actualizar si cambia la estructura de la API.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * API del Banco de la República para obtener el valor UVR actual.
 * Usada por: src/calculators/uvr.js → modules/UVRComparator/
 * Si la API cambia su estructura, actualizar también useUVR.js
 */
export const BANREP_UVR_API = 'https://www.banrep.gov.co/es/-/valoruvr';

/**
 * Tiempo de caché del valor UVR en milisegundos.
 * El UVR cambia diariamente. Se cachea en sessionStorage para evitar
 * múltiples peticiones durante la misma visita.
 * 4 horas — suficiente para una sesión, no tan largo que el valor quede viejo.
 */
export const UVR_CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 horas

// ─────────────────────────────────────────────────────────────────────────────
// 7. METADATA DEL PROYECTO
//    Usada en el footer, el PDF exportado y el disclaimer legal.
// ─────────────────────────────────────────────────────────────────────────────

export const PROJECT = {
  name:    'CalculaVivienda.co',
  domain:  'calculavivienda.com.co',
  version: '1.0.0',
  /** Texto del disclaimer que aparece en el footer y en los PDFs */
  disclaimer: 'Los cálculos son referenciales y no constituyen una oferta ' +
              'crediticia. Consulte directamente con su entidad financiera ' +
              'para obtener condiciones definitivas.',
};

// ─────────────────────────────────────────────────────────────────────────────
// VALIDACIÓN EN DESARROLLO
// ─────────────────────────────────────────────────────────────────────────────

function validateConstants() {
  if (!IS_DEV) return;

  const errors = [];
  const warn   = [];

  // SMMLV razonable para Colombia
  if (SMMLV < 1_000_000 || SMMLV > 5_000_000) {
    errors.push(`SMMLV fuera de rango razonable: ${SMMLV}`);
  }

  // Topes VIS/VIP coherentes
  if (VIS_MAX_SMMLV <= VIP_MAX_SMMLV) {
    errors.push(`VIS_MAX_SMMLV (${VIS_MAX_SMMLV}) debe ser > VIP_MAX_SMMLV (${VIP_MAX_SMMLV})`);
  }

  // Regla de endeudamiento entre 0 y 1
  if (MAX_DEBT_RATIO <= 0 || MAX_DEBT_RATIO >= 1) {
    errors.push(`MAX_DEBT_RATIO debe estar entre 0 y 1: ${MAX_DEBT_RATIO}`);
  }

  // Plazos coherentes
  if (MIN_TERM_MONTHS >= MAX_TERM_MONTHS) {
    errors.push(`MIN_TERM_MONTHS (${MIN_TERM_MONTHS}) >= MAX_TERM_MONTHS (${MAX_TERM_MONTHS})`);
  }

  // Cuota inicial coherente
  if (MIN_DOWN_PCT < 0 || MAX_DOWN_PCT > 1 || MIN_DOWN_PCT >= MAX_DOWN_PCT) {
    errors.push(`Rango de cuota inicial inválido: [${MIN_DOWN_PCT}, ${MAX_DOWN_PCT}]`);
  }

  // Verificar vigencia del archivo
  const currentYear = new Date().getFullYear();
  if (VIGENCIA_AÑO < currentYear) {
    warn.push(`[constants.js] Archivo con vigencia ${VIGENCIA_AÑO} — estamos en ${currentYear}. ¿Actualizaste el SMMLV?`);
  }

  // Inflación target razonable
  if (INFLATION_TARGET_PCT < 0 || INFLATION_TARGET_PCT > 20) {
    errors.push(`INFLATION_TARGET_PCT inusual: ${INFLATION_TARGET_PCT}%`);
  }

  errors.forEach(e => console.error(`[constants.js] ✗ ${e}`));
  warn.forEach(w  => console.warn(w));

  if (errors.length === 0) {
    console.log(`[constants.js] ✓ SMMLV ${VIGENCIA_AÑO}: $${SMMLV.toLocaleString('es-CO')} — VIS hasta $${VIS_MAX_COP.toLocaleString('es-CO')} — VIP hasta $${VIP_MAX_COP.toLocaleString('es-CO')}`);
  }
}

validateConstants();
