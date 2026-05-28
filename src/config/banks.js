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
 * @version 1.0.0
 * @updated 2026-05-26
 * @author  Arquitecto — calculavivienda.com.co
 */

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS (JSDoc para autocompletado en VS Code sin necesitar TypeScript)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} BankRate
 * @property {number} min  - Tasa EA mínima ofrecida (perfil crediticio excelente)
 * @property {number} max  - Tasa EA máxima ofrecida (perfil crediticio estándar)
 * @property {number} reference - Tasa EA de referencia para cálculos del simulador
 */

/**
 * @typedef {Object} BankLimits
 * @property {number}      minLoanCOP    - Monto mínimo de crédito en COP
 * @property {number|null} maxLoanCOP    - Monto máximo de crédito en COP (null = sin límite declarado)
 * @property {number}      minTermMonths - Plazo mínimo en meses
 * @property {number}      maxTermMonths - Plazo máximo en meses
 * @property {number}      maxLTV        - Loan-to-Value máximo (% del valor del inmueble que financia)
 */

/**
 * @typedef {Object} BankRequirements
 * @property {boolean}  requiresCesantias - Requiere traslado de cesantías
 * @property {boolean}  requiresPayroll   - Requiere domiciliación de nómina
 * @property {number}   minIncomeSMMLV    - Ingreso mínimo requerido en SMMLV
 * @property {string[]} notes             - Condiciones adicionales relevantes
 */

/**
 * @typedef {Object} Bank
 * @property {string}           id           - Identificador único interno (snake_case)
 * @property {string}           name         - Nombre oficial de la entidad
 * @property {string}           shortName    - Nombre corto para tablas compactas
 * @property {boolean}          active       - false = ocultar sin perder datos históricos
 * @property {boolean}          offersUVR    - true = ofrece crédito indexado a UVR
 * @property {BankRate}         rateVIS      - Tasas para vivienda VIS
 * @property {BankRate}         rateNoVIS    - Tasas para vivienda No VIS
 * @property {BankLimits}       limits       - Límites operativos del crédito
 * @property {BankRequirements} requirements - Requisitos especiales
 * @property {string}           color        - Color hex para identificación visual en UI
 * @property {string}           website      - URL oficial del simulador o producto
 * @property {string}           updatedAt    - Fecha de última verificación (ISO 8601)
 */

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES DE VALIDACIÓN
// Usadas internamente para validar la integridad del archivo en desarrollo.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detecta entorno de desarrollo en Vanilla JS puro (sin Node.js / bundler).
 * Funciona en navegador: localhost, 127.0.0.1, IPs locales y puertos no-80/443.
 */
const IS_DEV = (
  typeof window !== 'undefined' && (
    window.location.hostname === 'localhost'       ||
    window.location.hostname === '127.0.0.1'      ||
    window.location.hostname.startsWith('192.168') ||
    window.location.hostname.startsWith('10.')     ||
    (window.location.port !== '' &&
     window.location.port !== '80' &&
     window.location.port !== '443')
  )
);

const RATE_BOUNDS = {
  absolute: { min: 0.1, max: 40 },   // Límites absolutos (EA %)
  warning:  { min: 5,   max: 25 },   // Fuera de este rango → advertencia en consola
};

const VALID_COLORS = /^#[0-9A-Fa-f]{6}$/;

// ─────────────────────────────────────────────────────────────────────────────
// DATOS DE ENTIDADES FINANCIERAS
// Tasas verificadas: Mayo 2026 — Superfinanciera Colombia
// ─────────────────────────────────────────────────────────────────────────────

/** @type {Bank[]} */
const BANKS_DATA = [
  {
    id: 'fna',
    name: 'Fondo Nacional del Ahorro',
    shortName: 'FNA',
    active: true,
    offersUVR: false,
      min: 9.3,
      max: 11.5,
      reference: 9.3,
    },
    rateNoVIS: {
      min: 10.5,
      max: 12.0,
      reference: 10.5,
    },
    limits: {
      minLoanCOP:    10_000_000,
      maxLoanCOP:   450_000_000,
      minTermMonths: 60,
      maxTermMonths: 360,
      maxLTV: 100, // Financia hasta el 100% en VIS/VIP desde 2026
    },
    requirements: {
      requiresCesantias: true,
      requiresPayroll: false,
      minIncomeSMMLV: 1,
      notes: [
        'Requiere traslado de cesantías al FNA',
        'Financia hasta el 100% del valor del inmueble VIS y VIP desde 2026',
        'Disponible para empleados públicos y privados afiliados',
      ],
    },
    color: '#006241',
    website: 'https://www.fna.gov.co/credito-vivienda',
    updatedAt: '2026-05-26',
  },

  {
    id: 'bancolombia',
    name: 'Bancolombia S.A.',
    shortName: 'Bancolombia',
    active: true,
    offersUVR: true,
      min: 10.2,
      max: 12.5,
      reference: 10.5,
    },
    rateNoVIS: {
      min: 10.5,
      max: 13.5,
      reference: 11.0,
    },
    limits: {
      minLoanCOP:    15_000_000,
      maxLoanCOP:  null, // Sin límite declarado
      minTermMonths: 60,
      maxTermMonths: 360,
      maxLTV: 80,
    },
    requirements: {
      requiresCesantias: false,
      requiresPayroll: false,
      minIncomeSMMLV: 2,
      notes: [
        'Tasa preferencial disponible con domiciliación de nómina',
        'Descuento adicional para clientes con cuenta de ahorro activa',
      ],
    },
    color: '#FDDA24',
    website: 'https://www.bancolombia.com/personas/creditos/vivienda',
    updatedAt: '2026-05-26',
  },

  {
    id: 'davivienda',
    name: 'Banco Davivienda S.A.',
    shortName: 'Davivienda',
    active: true,
    offersUVR: true,
      min: 10.5,
      max: 12.8,
      reference: 10.8,
    },
    rateNoVIS: {
      min: 10.8,
      max: 13.8,
      reference: 11.2,
    },
    limits: {
      minLoanCOP:    20_000_000,
      maxLoanCOP:  null,
      minTermMonths: 60,
      maxTermMonths: 360,
      maxLTV: 80,
    },
    requirements: {
      requiresCesantias: false,
      requiresPayroll: false,
      minIncomeSMMLV: 2,
      notes: [
        'Tasas preferenciales en proyectos aliados Davivienda',
        'Disponible en pesos o UVR',
      ],
    },
    color: '#E30613',
    website: 'https://www.davivienda.com/wps/portal/personas/nuevo/personas/vivienda',
    updatedAt: '2026-05-26',
  },

  {
    id: 'av_villas',
    name: 'Banco AV Villas S.A.',
    shortName: 'AV Villas',
    active: true,
    offersUVR: true,
      min: 10.6,
      max: 12.5,
      reference: 10.9,
    },
    rateNoVIS: {
      min: 10.9,
      max: 13.2,
      reference: 11.2,
    },
    limits: {
      minLoanCOP:    10_000_000,
      maxLoanCOP:  null,
      minTermMonths: 60,
      maxTermMonths: 360,
      maxLTV: 80,
    },
    requirements: {
      requiresCesantias: false,
      requiresPayroll: false,
      minIncomeSMMLV: 1.5,
      notes: [
        'Especializado históricamente en vivienda — amplia experiencia en el segmento',
      ],
    },
    color: '#0054A6',
    website: 'https://www.avvillas.com.co/wps/portal/avvillas/banco/productos-y-servicios/creditos/credito-vivienda',
    updatedAt: '2026-05-26',
  },

  {
    id: 'banco_bogota',
    name: 'Banco de Bogotá S.A.',
    shortName: 'Bco. Bogotá',
    active: true,
    offersUVR: true,
      min: 10.7,
      max: 12.6,
      reference: 11.0,
    },
    rateNoVIS: {
      min: 11.0,
      max: 13.5,
      reference: 11.3,
    },
    limits: {
      minLoanCOP:    15_000_000,
      maxLoanCOP:  null,
      minTermMonths: 60,
      maxTermMonths: 360,
      maxLTV: 80,
    },
    requirements: {
      requiresCesantias: false,
      requiresPayroll: false,
      minIncomeSMMLV: 2,
      notes: [
        'Mayor banco privado de Colombia por activos',
        'Disponible en pesos o UVR',
      ],
    },
    color: '#003082',
    website: 'https://www.bancodebogota.com/wps/portal/banco-de-bogota/bogota/productos/para-comprar-vivienda',
    updatedAt: '2026-05-26',
  },

  {
    id: 'bbva',
    name: 'BBVA Colombia S.A.',
    shortName: 'BBVA',
    active: true,
    offersUVR: true,
      min: 10.9,
      max: 12.8,
      reference: 11.2,
    },
    rateNoVIS: {
      min: 11.2,
      max: 14.0,
      reference: 11.5,
    },
    limits: {
      minLoanCOP:    20_000_000,
      maxLoanCOP:  null,
      minTermMonths: 60,
      maxTermMonths: 360,
      maxLTV: 80,
    },
    requirements: {
      requiresCesantias: false,
      requiresPayroll: false,
      minIncomeSMMLV: 2,
      notes: [
        'Tasas negociables para clientes con historial crediticio excelente',
        'Producto hipotecario disponible en pesos o UVR',
      ],
    },
    color: '#004481',
    website: 'https://www.bbva.com.co/personas/productos/prestamos/credito-hipotecario.html',
    updatedAt: '2026-05-26',
  },

  {
    id: 'itau',
    name: 'Banco Itaú Colombia S.A.',
    shortName: 'Itaú',
    active: true,
    offersUVR: false,
      min: 11.0,
      max: 13.0,
      reference: 11.5,
    },
    rateNoVIS: {
      min: 11.5,
      max: 14.5,
      reference: 12.0,
    },
    limits: {
      minLoanCOP:    20_000_000,
      maxLoanCOP:  null,
      minTermMonths: 60,
      maxTermMonths: 360,
      maxLTV: 80,
    },
    requirements: {
      requiresCesantias: false,
      requiresPayroll: false,
      minIncomeSMMLV: 2,
      notes: [
        'Antiguo Helm Bank — presencia fuerte en segmento No VIS',
      ],
    },
    color: '#F06800',
    website: 'https://banco.itau.co/personas/creditos/credito-hipotecario',
    updatedAt: '2026-05-26',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// VALIDACIÓN EN DESARROLLO
// Solo se ejecuta en entornos de desarrollo (no en producción).
// Detecta errores de datos antes de que lleguen al usuario.
// ─────────────────────────────────────────────────────────────────────────────

function validateBanksData(banks) {
  if (!IS_DEV) return; // Solo ejecutar en desarrollo local

  const ids = new Set();

  banks.forEach((bank, index) => {
    const prefix = `[banks.js] Banco #${index} (${bank.id ?? 'sin id'})`;

    // IDs únicos
    if (!bank.id) {
      console.error(`${prefix}: falta el campo "id"`);
    } else if (ids.has(bank.id)) {
      console.error(`${prefix}: id duplicado "${bank.id}"`);
    } else {
      ids.add(bank.id);
    }

    // Tasas dentro de límites razonables
    ['rateVIS', 'rateNoVIS'].forEach(rateKey => {
      const rate = bank[rateKey];
      if (!rate) {
        console.error(`${prefix}: falta "${rateKey}"`);
        return;
      }

      const { min, max, reference } = rate;

      if (min > max) {
        console.error(`${prefix}.${rateKey}: min (${min}) > max (${max})`);
      }
      if (reference < min || reference > max) {
        console.error(`${prefix}.${rateKey}: reference (${reference}) fuera del rango [${min}, ${max}]`);
      }
      [min, max, reference].forEach(val => {
        if (val < RATE_BOUNDS.absolute.min || val > RATE_BOUNDS.absolute.max) {
          console.error(`${prefix}.${rateKey}: valor ${val} fuera de límites absolutos`);
        } else if (val < RATE_BOUNDS.warning.min || val > RATE_BOUNDS.warning.max) {
          console.warn(`${prefix}.${rateKey}: valor ${val} inusual — verificar`);
        }
      });
    });

    // Color válido
    if (!VALID_COLORS.test(bank.color)) {
      console.error(`${prefix}: color "${bank.color}" no es un hex válido (#RRGGBB)`);
    }

    // Fecha de actualización
    if (!bank.updatedAt || isNaN(Date.parse(bank.updatedAt))) {
      console.error(`${prefix}: "updatedAt" inválido o faltante`);
    } else {
      const monthsOld = (Date.now() - Date.parse(bank.updatedAt)) / (1000 * 60 * 60 * 24 * 30);
      if (monthsOld > 4) {
        console.warn(`${prefix}: datos con más de 4 meses sin actualizar (${bank.updatedAt}) — verificar tasas`);
      }
    }

    // Límites coherentes
    const { minTermMonths, maxTermMonths, maxLTV, minLoanCOP } = bank.limits;
    if (minTermMonths >= maxTermMonths) {
      console.error(`${prefix}.limits: minTermMonths (${minTermMonths}) >= maxTermMonths (${maxTermMonths})`);
    }
    if (maxLTV < 1 || maxLTV > 100) {
      console.error(`${prefix}.limits: maxLTV (${maxLTV}) debe estar entre 1 y 100`);
    }
    if (minLoanCOP < 0) {
      console.error(`${prefix}.limits: minLoanCOP no puede ser negativo`);
    }
  });
}

// Ejecutar validación al cargar el módulo
validateBanksData(BANKS_DATA);

// ─────────────────────────────────────────────────────────────────────────────
// API PÚBLICA DEL MÓDULO
// Estas son las únicas funciones que el resto del proyecto debe usar.
// Nunca importar BANKS_DATA directamente desde otros módulos.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retorna todos los bancos ACTIVOS, ordenados de menor a mayor tasa de referencia.
 *
 * @param {'VIS' | 'NoVIS'} [housingType='NoVIS'] - Tipo de vivienda para ordenar
 * @returns {Bank[]}
 *
 * @example
 * import { getAllBanks } from './config/banks.js';
 * const banks = getAllBanks('VIS');
 */
export function getAllBanks(housingType = 'NoVIS') {
  const rateKey = housingType === 'VIS' ? 'rateVIS' : 'rateNoVIS';
  return BANKS_DATA
    .filter(bank => bank.active)
    .sort((a, b) => a[rateKey].reference - b[rateKey].reference);
}

/**
 * Retorna un banco por su ID único.
 *
 * @param {string} id - Identificador del banco (ej: 'bancolombia')
 * @returns {Bank | undefined}
 *
 * @example
 * import { getBankById } from './config/banks.js';
 * const bank = getBankById('fna');
 */
export function getBankById(id) {
  return BANKS_DATA.find(bank => bank.id === id);
}

/**
 * Retorna la tasa de referencia de un banco según el tipo de vivienda.
 *
 * @param {string}            bankId      - ID del banco
 * @param {'VIS' | 'NoVIS'}  housingType - Tipo de vivienda
 * @returns {number | null}   Tasa EA en porcentaje, o null si el banco no existe
 *
 * @example
 * import { getReferenceRate } from './config/banks.js';
 * const rate = getReferenceRate('bancolombia', 'NoVIS'); // → 11.0
 */
export function getReferenceRate(bankId, housingType = 'NoVIS') {
  const bank = getBankById(bankId);
  if (!bank) return null;
  return housingType === 'VIS'
    ? bank.rateVIS.reference
    : bank.rateNoVIS.reference;
}

/**
 * Retorna los IDs de todos los bancos disponibles.
 * Útil para iterar sin cargar el objeto completo.
 *
 * @returns {string[]}
 *
 * @example
 * import { getBankIds } from './config/banks.js';
 * getBankIds(); // → ['fna', 'bancolombia', 'davivienda', ...]
 */
export function getBankIds() {
  return BANKS_DATA.map(bank => bank.id);
}

/**
 * Retorna la fecha de la actualización más antigua entre todos los bancos.
 * Útil para mostrar al usuario cuándo fue la última revisión de tasas.
 *
 * @returns {string} Fecha ISO 8601 (ej: '2026-05-26')
 *
 * @example
 * import { getOldestUpdate } from './config/banks.js';
 * console.log(`Tasas verificadas al: ${getOldestUpdate()}`);
 */
export function getOldestUpdate() {
  return BANKS_DATA.reduce((oldest, bank) => {
    return bank.updatedAt < oldest ? bank.updatedAt : oldest;
  }, BANKS_DATA[0].updatedAt);
}

/**
 * Retorna el banco con la tasa de referencia más baja para un tipo de vivienda.
 * Útil para el módulo de comparación ("este banco te ahorra X").
 *
 * @param {'VIS' | 'NoVIS'} [housingType='NoVIS']
 * @returns {Bank}
 *
 * @example
 * import { getCheapestBank } from './config/banks.js';
 * const cheapest = getCheapestBank('VIS'); // → FNA
 */
export function getCheapestBank(housingType = 'NoVIS') {
  return getAllBanks(housingType)[0];
}
