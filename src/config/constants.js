/**
 * @file constants.js
 * @description Constantes legales, regulatorias y operativas del mercado
 *              hipotecario colombiano.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * MANTENIMIENTO
 * ─────────────────────────────────────────────────────────────────────────────
 * Frecuencia  : Anual (cada enero)
 * Responsable : Propietario del proyecto
 * Tiempo est. : 20 minutos por actualización
 *
 * QUÉ ACTUALIZAR CADA AÑO Y DÓNDE VERIFICAR:
 *
 *   SMMLV              → Ministerio del Trabajo (decretos diciembre/enero)
 *                        https://www.mintrabajo.gov.co
 *
 *   VIS_MAX_SMMLV      → Ministerio de Vivienda — puede cambiar con cada gobierno
 *   VIP_MAX_SMMLV        para ajustar el acceso a vivienda de interés social.
 *                        Verificar en: https://www.minvivienda.gov.co
 *
 *   VIS_BOGOTA_MAX_SMMLV → Bogotá y su aglomeración tienen tope especial.
 *                          Verificar en: https://bogota.gov.co
 *
 *   INFLATION_TARGET_PCT → Banco de la República, meta de inflación.
 *                          Verificar en: https://www.banrep.gov.co
 *
 * QUÉ NO CAMBIA Y POR QUÉ:
 *
 *   MAX_DEBT_RATIO  → Art. 17 Ley 546 de 1999. Sin modificaciones desde 1999.
 *   MIN_DOWN_PCT    → Regulación bancaria estándar.
 *   MIN/MAX_TERM    → Ley 546 de 1999.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * HISTORIAL DE CAMBIOS
 * ─────────────────────────────────────────────────────────────────────────────
 * 2026-05-26 v1.1 — Actualización de topes VIS/VIP para 2026:
 *                   VIS: 135 → 150 SMMLV | VIP: 70 → 90 SMMLV
 *                   Fuente: Ajuste regulatorio 2026 por incremento del SMMLV
 *                   Fuente VIS Bogotá: hasta 160 SMMLV (tope especial)
 *
 * 2026-05-26 v1.0 — Versión inicial con SMMLV 2026: $1.750.905
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * VIGENCIA: Año 2026
 * Fuentes:
 *   - Decreto 1469/2025 y Decreto 0159/2026 (SMMLV $1.750.905)
 *   - Ajuste regulatorio 2026 (topes VIS 150 SMMLV, VIP 90 SMMLV)
 *   - Ley 546 de 1999 (regla de endeudamiento y plazos)
 *   - Banco de la República (meta de inflación y UVR)
 *
 * @version 1.1.0
 * @updated 2026-05-26
 * @author  Arquitecto — calculavivienda.com.co
 */

// ─────────────────────────────────────────────────────────────────────────────
// ENTORNO — Detección de desarrollo
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
// ─────────────────────────────────────────────────────────────────────────────

/** Salario Mínimo Mensual Legal Vigente 2026 (COP) — Decreto 1469/2025 */
export const SMMLV = 1_750_905;

/** Auxilio de transporte 2026 (COP) — Decreto 1470/2025 */
export const AUXILIO_TRANSPORTE = 249_095;

/** Año de vigencia de las constantes */
export const VIGENCIA_AÑO = 2026;

// ─────────────────────────────────────────────────────────────────────────────
// 2. CATEGORÍAS DE VIVIENDA (VIS / VIP)
//    ACTUALIZADO en 2026: topes ajustados por incremento del SMMLV.
//    Fuente: Ajuste regulatorio 2026 — Ministerio de Vivienda
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tope VIS nacional en SMMLV — Ajustado a 150 SMMLV en 2026.
 * (Antes: 135 SMMLV según Decreto 1077 de 2015)
 */
export const VIS_MAX_SMMLV = 150;

/**
 * Tope VIP nacional en SMMLV — Ajustado a 90 SMMLV en 2026.
 * (Antes: 70 SMMLV según Decreto 1077 de 2015)
 */
export const VIP_MAX_SMMLV = 90;

/**
 * Tope VIS especial para Bogotá y municipios de su aglomeración — 160 SMMLV.
 * Aplica para proyectos ubicados en Bogotá D.C. y municipios aledaños.
 */
export const VIS_BOGOTA_MAX_SMMLV = 160;

/** Tope VIS nacional en pesos 2026: 150 × $1.750.905 = $262.635.750 COP */
export const VIS_MAX_COP = SMMLV * VIS_MAX_SMMLV;

/** Tope VIP nacional en pesos 2026: 90 × $1.750.905 = $157.581.450 COP */
export const VIP_MAX_COP = SMMLV * VIP_MAX_SMMLV;

/** Tope VIS Bogotá en pesos 2026: 160 × $1.750.905 = $280.144.800 COP */
export const VIS_BOGOTA_MAX_COP = SMMLV * VIS_BOGOTA_MAX_SMMLV;

// ─────────────────────────────────────────────────────────────────────────────
// 3. REGULACIÓN CREDITICIA
// ─────────────────────────────────────────────────────────────────────────────

/** Porcentaje máximo del ingreso para cuota hipotecaria — Art. 17 Ley 546/99 */
export const MAX_DEBT_RATIO = 0.30;

/** Cuota inicial mínima estándar (20%) */
export const MIN_DOWN_PCT     = 0.20;
/** Cuota inicial máxima en el simulador (50%) */
export const MAX_DOWN_PCT     = 0.50;
/** FNA puede financiar el 100% en VIS/VIP desde 2026 */
export const MIN_DOWN_PCT_FNA = 0.00;

/** Plazo mínimo en meses — Ley 546/99 */
export const MIN_TERM_MONTHS = 60;
/** Plazo máximo en meses — Ley 546/99 */
export const MAX_TERM_MONTHS = 360;

/** Opciones de plazo para la UI */
export const TERM_OPTIONS_YEARS = [5, 10, 15, 20, 25, 30];

// ─────────────────────────────────────────────────────────────────────────────
// 4. PARÁMETROS DEL SIMULADOR
// ─────────────────────────────────────────────────────────────────────────────

/** Valor del inmueble por defecto (COP) */
export const DEFAULT_PROPERTY_VALUE_COP = 300_000_000;
/** Cuota inicial por defecto */
export const DEFAULT_DOWN_PCT           = 0.30;
/** Plazo por defecto (meses) */
export const DEFAULT_TERM_MONTHS        = 240;

/** Rango del slider de valor del inmueble */
export const PROPERTY_VALUE_MIN_COP = 50_000_000;
export const PROPERTY_VALUE_MAX_COP = 2_000_000_000;

/** Rango del slider de ingresos mensuales para CapacityCalc */
export const INCOME_MIN_COP = SMMLV;
export const INCOME_MAX_COP = 30_000_000;

/** Meta de inflación anual del Banco de la República (% anual) */
export const INFLATION_TARGET_PCT = 3.0;

// ─────────────────────────────────────────────────────────────────────────────
// 5. SEGUROS DE REFERENCIA
// ─────────────────────────────────────────────────────────────────────────────

export const INSURANCE_REFERENCE = {
  lifeInsurancePctMonthly:     0.0003,
  propertyInsurancePctMonthly: 0.0001,
};

// ─────────────────────────────────────────────────────────────────────────────
// 6. APIs EXTERNAS
// ─────────────────────────────────────────────────────────────────────────────

export const BANREP_UVR_API  = 'https://www.banrep.gov.co/es/-/valoruvr';
export const UVR_CACHE_TTL_MS = 4 * 60 * 60 * 1000;

// ─────────────────────────────────────────────────────────────────────────────
// 7. METADATA DEL PROYECTO
// ─────────────────────────────────────────────────────────────────────────────

export const PROJECT = {
  name:       'CalculaVivienda.co',
  domain:     'calculavivienda.com.co',
  version:    '1.0.0',
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

  if (SMMLV < 1_000_000 || SMMLV > 5_000_000) {
    errors.push(`SMMLV fuera de rango: ${SMMLV}`);
  }
  if (VIS_MAX_SMMLV <= VIP_MAX_SMMLV) {
    errors.push(`VIS_MAX_SMMLV (${VIS_MAX_SMMLV}) debe ser > VIP_MAX_SMMLV (${VIP_MAX_SMMLV})`);
  }
  if (VIS_BOGOTA_MAX_SMMLV < VIS_MAX_SMMLV) {
    errors.push(`VIS_BOGOTA (${VIS_BOGOTA_MAX_SMMLV}) debe ser >= VIS nacional (${VIS_MAX_SMMLV})`);
  }
  if (MAX_DEBT_RATIO <= 0 || MAX_DEBT_RATIO >= 1) {
    errors.push(`MAX_DEBT_RATIO inválido: ${MAX_DEBT_RATIO}`);
  }
  if (MIN_TERM_MONTHS >= MAX_TERM_MONTHS) {
    errors.push(`Plazos incoherentes: ${MIN_TERM_MONTHS} >= ${MAX_TERM_MONTHS}`);
  }

  const currentYear = new Date().getFullYear();
  if (VIGENCIA_AÑO < currentYear) {
    warn.push(`[constants.js] Vigencia ${VIGENCIA_AÑO} — estamos en ${currentYear}. ¿Actualizaste el SMMLV?`);
  }

  errors.forEach(e => console.error(`[constants.js] ✗ ${e}`));
  warn.forEach(w   => console.warn(w));

  if (errors.length === 0) {
    console.log(
      `[constants.js] ✓ SMMLV ${VIGENCIA_AÑO}: $${SMMLV.toLocaleString('es-CO')}` +
      ` | VIS ≤ $${VIS_MAX_COP.toLocaleString('es-CO')}` +
      ` | VIP ≤ $${VIP_MAX_COP.toLocaleString('es-CO')}`
    );
  }
}

validateConstants();