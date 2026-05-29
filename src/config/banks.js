/**
 * @file banks.js
 * @description Fuente única de verdad (Single Source of Truth) para datos de
 *              entidades financieras que ofrecen crédito hipotecario en Colombia.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * MANTENIMIENTO
 * ─────────────────────────────────────────────────────────────────────────────
 * Frecuencia : Trimestral (enero, abril, julio, octubre)
 * Fuente     : Superintendencia Financiera de Colombia
 *              https://www.superfinanciera.gov.co → Tasas de colocación
 * Responsable: Propietario del proyecto
 * Tiempo est.: 30 minutos por actualización
 *
 * IMPORTANTE: Este es el ÚNICO archivo donde se modifican tasas o datos de
 * bancos. Nunca hardcodear valores en calculators/, modules/ o components/.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * @version 1.1.0
 * @updated 2026-05-26
 * @author  Arquitecto — calculavivienda.com.co
 */

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS (JSDoc)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} BankRate
 * @property {number} min       - Tasa EA mínima (perfil crediticio excelente)
 * @property {number} max       - Tasa EA máxima (perfil crediticio estándar)
 * @property {number} reference - Tasa EA de referencia para cálculos
 */

/**
 * @typedef {Object} BankLimits
 * @property {number}      minLoanCOP    - Monto mínimo de crédito en COP
 * @property {number|null} maxLoanCOP    - Monto máximo en COP (null = sin límite)
 * @property {number}      minTermMonths - Plazo mínimo en meses
 * @property {number}      maxTermMonths - Plazo máximo en meses
 * @property {number}      maxLTV        - LTV máximo (% del valor del inmueble)
 */

/**
 * @typedef {Object} BankRequirements
 * @property {boolean}  requiresCesantias - Requiere traslado de cesantías
 * @property {boolean}  requiresPayroll   - Requiere domiciliación de nómina
 * @property {number}   minIncomeSMMLV    - Ingreso mínimo en SMMLV
 * @property {string[]} notes             - Condiciones adicionales
 */

/**
 * @typedef {Object} Bank
 * @property {string}           id           - Identificador único (snake_case)
 * @property {string}           name         - Nombre oficial de la entidad
 * @property {string}           shortName    - Nombre corto para tablas
 * @property {boolean}          active       - false = ocultar sin perder datos
 * @property {boolean}          offersUVR    - true = ofrece crédito en UVR
 * @property {BankRate}         rateVIS      - Tasas para vivienda VIS
 * @property {BankRate}         rateNoVIS    - Tasas para vivienda No VIS
 * @property {BankLimits}       limits       - Límites operativos
 * @property {BankRequirements} requirements - Requisitos especiales
 * @property {string}           color        - Color hex para UI (#RRGGBB)
 * @property {string}           website      - URL del simulador oficial
 * @property {string}           updatedAt    - Fecha de verificación (ISO 8601)
 */

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES DE VALIDACIÓN
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detección de entorno de desarrollo (Vanilla JS sin Node.js/bundler).
 */
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

const RATE_BOUNDS = {
  absolute: { min: 0.1, max: 40 },
  warning:  { min: 5,   max: 25 },
};

const VALID_COLOR = /^#[0-9A-Fa-f]{6}$/;

// ─────────────────────────────────────────────────────────────────────────────
// DATOS — Tasas verificadas: Mayo 2026 — Superfinanciera Colombia
// ─────────────────────────────────────────────────────────────────────────────

/** @type {Bank[]} */
const BANKS_DATA = [
  {
    id:        'fna',
    name:      'Fondo Nacional del Ahorro',
    shortName: 'FNA',
    active:    true,
    offersUVR: false,
    rateVIS: {
      min:       9.3,
      max:       11.5,
      reference: 9.3,
    },
    rateNoVIS: {
      min:       10.5,
      max:       12.0,
      reference: 10.5,
    },
    limits: {
      minLoanCOP:    10_000_000,
      maxLoanCOP:   450_000_000,
      minTermMonths: 60,
      maxTermMonths: 360,
      maxLTV:        100,
    },
    requirements: {
      requiresCesantias: true,
      requiresPayroll:   false,
      minIncomeSMMLV:    1,
      notes: [
        'Requiere traslado de cesantías al FNA',
        'Financia hasta el 100% del valor del inmueble VIS y VIP desde 2026',
        'Disponible para empleados públicos y privados afiliados',
      ],
    },
    color:     '#006241',
    website:   'https://www.fna.gov.co/credito-vivienda',
    updatedAt: '2026-05-26',
  },

  {
    id:        'bancolombia',
    name:      'Bancolombia S.A.',
    shortName: 'Bancolombia',
    active:    true,
    offersUVR: true,
    rateVIS: {
      min:       10.2,
      max:       12.5,
      reference: 10.5,
    },
    rateNoVIS: {
      min:       10.5,
      max:       13.5,
      reference: 11.0,
    },
    limits: {
      minLoanCOP:    15_000_000,
      maxLoanCOP:    null,
      minTermMonths: 60,
      maxTermMonths: 360,
      maxLTV:        80,
    },
    requirements: {
      requiresCesantias: false,
      requiresPayroll:   false,
      minIncomeSMMLV:    2,
      notes: [
        'Tasa preferencial disponible con domiciliación de nómina',
        'Descuento adicional para clientes con cuenta de ahorro activa',
      ],
    },
    color:     '#FDDA24',
    website:   'https://www.bancolombia.com/personas/creditos/vivienda',
    updatedAt: '2026-05-26',
  },

  {
    id:        'davivienda',
    name:      'Banco Davivienda S.A.',
    shortName: 'Davivienda',
    active:    true,
    offersUVR: true,
    rateVIS: {
      min:       10.5,
      max:       12.8,
      reference: 10.8,
    },
    rateNoVIS: {
      min:       10.8,
      max:       13.8,
      reference: 11.2,
    },
    limits: {
      minLoanCOP:    20_000_000,
      maxLoanCOP:    null,
      minTermMonths: 60,
      maxTermMonths: 360,
      maxLTV:        80,
    },
    requirements: {
      requiresCesantias: false,
      requiresPayroll:   false,
      minIncomeSMMLV:    2,
      notes: [
        'Tasas preferenciales en proyectos aliados Davivienda',
        'Disponible en pesos o UVR',
      ],
    },
    color:     '#E30613',
    website:   'https://www.davivienda.com/wps/portal/personas/nuevo/personas/vivienda',
    updatedAt: '2026-05-26',
  },

  {
    id:        'av_villas',
    name:      'Banco AV Villas S.A.',
    shortName: 'AV Villas',
    active:    true,
    offersUVR: true,
    rateVIS: {
      min:       10.6,
      max:       12.5,
      reference: 10.9,
    },
    rateNoVIS: {
      min:       10.9,
      max:       13.2,
      reference: 11.2,
    },
    limits: {
      minLoanCOP:    10_000_000,
      maxLoanCOP:    null,
      minTermMonths: 60,
      maxTermMonths: 360,
      maxLTV:        80,
    },
    requirements: {
      requiresCesantias: false,
      requiresPayroll:   false,
      minIncomeSMMLV:    1.5,
      notes: [
        'Especializado históricamente en vivienda — amplia experiencia en el segmento',
      ],
    },
    color:     '#0054A6',
    website:   'https://www.avvillas.com.co/wps/portal/avvillas/banco/productos-y-servicios/creditos/credito-vivienda',
    updatedAt: '2026-05-26',
  },

  {
    id:        'banco_bogota',
    name:      'Banco de Bogotá S.A.',
    shortName: 'Bco. Bogotá',
    active:    true,
    offersUVR: true,
    rateVIS: {
      min:       10.7,
      max:       12.6,
      reference: 11.0,
    },
    rateNoVIS: {
      min:       11.0,
      max:       13.5,
      reference: 11.3,
    },
    limits: {
      minLoanCOP:    15_000_000,
      maxLoanCOP:    null,
      minTermMonths: 60,
      maxTermMonths: 360,
      maxLTV:        80,
    },
    requirements: {
      requiresCesantias: false,
      requiresPayroll:   false,
      minIncomeSMMLV:    2,
      notes: [
        'Mayor banco privado de Colombia por activos',
        'Disponible en pesos o UVR',
      ],
    },
    color:     '#003082',
    website:   'https://www.bancodebogota.com/wps/portal/banco-de-bogota/bogota/productos/para-comprar-vivienda',
    updatedAt: '2026-05-26',
  },

  {
    id:        'bbva',
    name:      'BBVA Colombia S.A.',
    shortName: 'BBVA',
    active:    true,
    offersUVR: true,
    rateVIS: {
      min:       10.9,
      max:       12.8,
      reference: 11.2,
    },
    rateNoVIS: {
      min:       11.2,
      max:       14.0,
      reference: 11.5,
    },
    limits: {
      minLoanCOP:    20_000_000,
      maxLoanCOP:    null,
      minTermMonths: 60,
      maxTermMonths: 360,
      maxLTV:        80,
    },
    requirements: {
      requiresCesantias: false,
      requiresPayroll:   false,
      minIncomeSMMLV:    2,
      notes: [
        'Tasas negociables para clientes con historial crediticio excelente',
        'Disponible en pesos o UVR',
      ],
    },
    color:     '#004481',
    website:   'https://www.bbva.com.co/personas/productos/prestamos/credito-hipotecario.html',
    updatedAt: '2026-05-26',
  },

  {
    id:        'itau',
    name:      'Banco Itaú Colombia S.A.',
    shortName: 'Itaú',
    active:    true,
    offersUVR: false,
    rateVIS: {
      min:       11.0,
      max:       13.0,
      reference: 11.5,
    },
    rateNoVIS: {
      min:       11.5,
      max:       14.5,
      reference: 12.0,
    },
    limits: {
      minLoanCOP:    20_000_000,
      maxLoanCOP:    null,
      minTermMonths: 60,
      maxTermMonths: 360,
      maxLTV:        80,
    },
    requirements: {
      requiresCesantias: false,
      requiresPayroll:   false,
      minIncomeSMMLV:    2,
      notes: [
        'Antiguo Helm Bank — presencia fuerte en segmento No VIS',
      ],
    },
    color:     '#F06800',
    website:   'https://banco.itau.co/personas/creditos/credito-hipotecario',
    updatedAt: '2026-05-26',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// VALIDACIÓN EN DESARROLLO
// ─────────────────────────────────────────────────────────────────────────────

function validateBanksData(banks) {
  if (!IS_DEV) return;

  const ids = new Set();

  banks.forEach((bank, index) => {
    const prefix = `[banks.js] Banco #${index} (${bank.id ?? 'sin id'})`;

    if (!bank.id) {
      console.error(`${prefix}: falta el campo "id"`);
    } else if (ids.has(bank.id)) {
      console.error(`${prefix}: id duplicado "${bank.id}"`);
    } else {
      ids.add(bank.id);
    }

    ['rateVIS', 'rateNoVIS'].forEach(rateKey => {
      const rate = bank[rateKey];
      if (!rate) { console.error(`${prefix}: falta "${rateKey}"`); return; }

      const { min, max, reference } = rate;
      if (min > max) {
        console.error(`${prefix}.${rateKey}: min (${min}) > max (${max})`);
      }
      if (reference < min || reference > max) {
        console.error(`${prefix}.${rateKey}: reference (${reference}) fuera de [${min}, ${max}]`);
      }
      [min, max, reference].forEach(val => {
        if (val < RATE_BOUNDS.absolute.min || val > RATE_BOUNDS.absolute.max) {
          console.error(`${prefix}.${rateKey}: valor ${val} fuera de límites absolutos`);
        } else if (val < RATE_BOUNDS.warning.min || val > RATE_BOUNDS.warning.max) {
          console.warn(`${prefix}.${rateKey}: valor ${val} inusual — verificar`);
        }
      });
    });

    if (!VALID_COLOR.test(bank.color)) {
      console.error(`${prefix}: color "${bank.color}" inválido (#RRGGBB)`);
    }

    if (!bank.updatedAt || isNaN(Date.parse(bank.updatedAt))) {
      console.error(`${prefix}: "updatedAt" inválido`);
    } else {
      const monthsOld = (Date.now() - Date.parse(bank.updatedAt)) / (1000 * 60 * 60 * 24 * 30);
      if (monthsOld > 4) {
        console.warn(`${prefix}: datos con más de 4 meses sin actualizar (${bank.updatedAt})`);
      }
    }

    const { minTermMonths, maxTermMonths, maxLTV } = bank.limits;
    if (minTermMonths >= maxTermMonths) {
      console.error(`${prefix}.limits: minTerm (${minTermMonths}) >= maxTerm (${maxTermMonths})`);
    }
    if (maxLTV < 1 || maxLTV > 100) {
      console.error(`${prefix}.limits: maxLTV (${maxLTV}) debe estar entre 1 y 100`);
    }
  });
}

validateBanksData(BANKS_DATA);

// ─────────────────────────────────────────────────────────────────────────────
// API PÚBLICA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retorna todos los bancos ACTIVOS ordenados por tasa de referencia.
 * @param {'VIS' | 'NoVIS'} [housingType='NoVIS']
 * @returns {Bank[]}
 */
export function getAllBanks(housingType = 'NoVIS') {
  const rateKey = housingType === 'VIS' ? 'rateVIS' : 'rateNoVIS';
  return BANKS_DATA
    .filter(bank => bank.active)
    .sort((a, b) => a[rateKey].reference - b[rateKey].reference);
}

/**
 * Retorna un banco por su ID único.
 * @param {string} id
 * @returns {Bank | undefined}
 */
export function getBankById(id) {
  return BANKS_DATA.find(bank => bank.id === id);
}

/**
 * Retorna la tasa de referencia de un banco según el tipo de vivienda.
 * @param {string}           bankId
 * @param {'VIS' | 'NoVIS'} [housingType='NoVIS']
 * @returns {number | null}
 */
export function getReferenceRate(bankId, housingType = 'NoVIS') {
  const bank = getBankById(bankId);
  if (!bank) return null;
  return housingType === 'VIS' ? bank.rateVIS.reference : bank.rateNoVIS.reference;
}

/**
 * Retorna los IDs de todos los bancos activos.
 * @returns {string[]}
 */
export function getBankIds() {
  return BANKS_DATA.filter(b => b.active).map(b => b.id);
}

/**
 * Retorna la fecha de la actualización más antigua.
 * @returns {string}
 */
export function getOldestUpdate() {
  return BANKS_DATA
    .filter(b => b.active)
    .reduce((oldest, bank) =>
      bank.updatedAt < oldest ? bank.updatedAt : oldest,
      BANKS_DATA[0].updatedAt
    );
}

/**
 * Retorna el banco con la tasa más baja para el tipo de vivienda.
 * @param {'VIS' | 'NoVIS'} [housingType='NoVIS']
 * @returns {Bank}
 */
export function getCheapestBank(housingType = 'NoVIS') {
  return getAllBanks(housingType)[0];
}

/**
 * Retorna solo los bancos que ofrecen crédito UVR.
 * @returns {Bank[]}
 */
export function getUVRBanks() {
  return BANKS_DATA.filter(bank => bank.active && bank.offersUVR);
}