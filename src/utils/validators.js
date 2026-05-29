/**
 * @file validators.js
 * @description Validación de inputs para la UI del simulador.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * RESPONSABILIDAD Y LÍMITES
 * ─────────────────────────────────────────────────────────────────────────────
 * Este módulo valida ANTES de enviar datos a los calculadores.
 * Los calculadores (amortization.js, capacity.js, etc.) tienen su propia
 * validación interna — este archivo no la reemplaza ni la duplica.
 *
 * Lo que validators.js hace:
 *   ✓ Mensajes de error en español para mostrar al usuario
 *   ✓ Validación en tiempo real mientras el usuario escribe
 *   ✓ Validación de formatos (teléfono colombiano, email)
 *   ✓ Validación de reglas de negocio simples (VIS/VIP, 30% endeudamiento)
 *   ✓ Validadores compuestos para formularios completos
 *
 * Lo que NO hace:
 *   ✗ No hace cálculos hipotecarios
 *   ✗ No parsea COP (eso es formatters.js → parseCOPInput)
 *   ✗ No accede al DOM
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CONVENCIÓN DE RETORNO
 * ─────────────────────────────────────────────────────────────────────────────
 * Todas las funciones retornan: { valid: boolean, error?: string }
 *   - valid: true  → sin error (error es undefined)
 *   - valid: false → error contiene el mensaje para mostrar al usuario
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DEPENDENCIAS:
 *   config/constants.js → SMMLV, límites VIS/VIP, MAX_DEBT_RATIO
 *
 * @version 1.0.0
 * @updated 2026-05-26
 * @author  Arquitecto — calculavivienda.com.co
 */

import {
  SMMLV,
  VIS_MAX_COP,
  VIP_MAX_COP,
  MAX_DEBT_RATIO,
  MIN_TERM_MONTHS,
  MAX_TERM_MONTHS,
  MIN_DOWN_PCT,
  MAX_DOWN_PCT,
  PROPERTY_VALUE_MIN_COP,
  PROPERTY_VALUE_MAX_COP,
  INCOME_MIN_COP,
  INCOME_MAX_COP,
} from '../config/constants.js';

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS (JSDoc)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} ValidationResult
 * @property {boolean}          valid  - true si el input es válido
 * @property {string|undefined} error  - mensaje de error (undefined si válido)
 */

/**
 * @typedef {Object} FormValidationResult
 * @property {boolean}                  valid   - true si todos los campos son válidos
 * @property {Record<string, string|null>} errors - mapa campo → mensaje (null si válido)
 */

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS PRIVADOS
// ─────────────────────────────────────────────────────────────────────────────

/** @param {boolean} valid @param {string} [error] @returns {ValidationResult} */
const ok    = ()          => ({ valid: true });
const fail  = (error)     => ({ valid: false, error });

/**
 * Verifica si un valor es un número finito y usable.
 * @param {*} value
 * @returns {boolean}
 */
function isUsableNumber(value) {
  return typeof value === 'number' && isFinite(value) && !isNaN(value);
}

/**
 * Formatea un monto COP para mensajes de error.
 * @param {number} amount
 * @returns {string}
 */
function fmtCOP(amount) {
  return `$${Math.round(amount).toLocaleString('es-CO')}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// VALIDADORES BÁSICOS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verifica que un campo de texto no esté vacío.
 *
 * @param {string} value
 * @param {string} [fieldName='Este campo'] - Nombre del campo para el mensaje
 * @returns {ValidationResult}
 *
 * @example
 * validateRequired('');            // → { valid: false, error: 'Este campo es obligatorio.' }
 * validateRequired('Juan', 'Nombre'); // → { valid: true }
 */
export function validateRequired(value, fieldName = 'Este campo') {
  if (value === null || value === undefined) {
    return fail(`${fieldName} es obligatorio.`);
  }
  if (typeof value === 'string' && value.trim().length === 0) {
    return fail(`${fieldName} es obligatorio.`);
  }
  return ok();
}

/**
 * Verifica que un valor sea un número dentro de un rango.
 *
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @param {string} [fieldName='El valor']
 * @returns {ValidationResult}
 */
export function validateRange(value, min, max, fieldName = 'El valor') {
  if (!isUsableNumber(value)) {
    return fail(`${fieldName} debe ser un número válido.`);
  }
  if (value < min || value > max) {
    return fail(`${fieldName} debe estar entre ${min.toLocaleString('es-CO')} y ${max.toLocaleString('es-CO')}.`);
  }
  return ok();
}

// ─────────────────────────────────────────────────────────────────────────────
// VALIDADORES MONETARIOS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Valida el valor del inmueble en COP.
 *
 * @param {number} value - Valor en COP
 * @returns {ValidationResult}
 *
 * @example
 * validatePropertyValue(300_000_000); // → { valid: true }
 * validatePropertyValue(1_000);       // → { valid: false, error: '...' }
 */
export function validatePropertyValue(value) {
  if (!isUsableNumber(value) || value <= 0) {
    return fail('Ingresa el valor del inmueble.');
  }
  if (value < PROPERTY_VALUE_MIN_COP) {
    return fail(`El valor mínimo del inmueble es ${fmtCOP(PROPERTY_VALUE_MIN_COP)}.`);
  }
  if (value > PROPERTY_VALUE_MAX_COP) {
    return fail(`El valor máximo en el simulador es ${fmtCOP(PROPERTY_VALUE_MAX_COP)}.`);
  }
  return ok();
}

/**
 * Valida el ingreso mensual del hogar en COP.
 * Mínimo: 1 SMMLV (requisito básico de los bancos).
 *
 * @param {number} value - Ingreso mensual en COP
 * @returns {ValidationResult}
 *
 * @example
 * validateMonthlyIncome(5_000_000); // → { valid: true }
 * validateMonthlyIncome(500_000);   // → { valid: false, error: 'El ingreso mínimo...' }
 */
export function validateMonthlyIncome(value) {
  if (!isUsableNumber(value) || value <= 0) {
    return fail('Ingresa tu ingreso mensual.');
  }
  if (value < INCOME_MIN_COP) {
    return fail(
      `El ingreso mínimo para el simulador es ${fmtCOP(INCOME_MIN_COP)} (1 SMMLV). ` +
      'Los bancos evalúan solicitudes desde ese monto.'
    );
  }
  if (value > INCOME_MAX_COP) {
    return fail(`El ingreso máximo en el simulador es ${fmtCOP(INCOME_MAX_COP)}.`);
  }
  return ok();
}

/**
 * Valida el monto de un abono extraordinario.
 *
 * @param {number} value     - Monto del abono en COP
 * @param {number} [maxAmount] - Monto máximo (saldo del crédito). Opcional.
 * @returns {ValidationResult}
 */
export function validateExtraPaymentAmount(value, maxAmount) {
  if (!isUsableNumber(value) || value <= 0) {
    return fail('El monto del abono debe ser mayor a cero.');
  }
  if (value < 1_000_000) {
    return fail('El abono mínimo es $1.000.000. La mayoría de bancos tienen este mínimo.');
  }
  if (maxAmount !== undefined && value > maxAmount) {
    return fail(`El abono no puede superar el saldo del crédito (${fmtCOP(maxAmount)}).`);
  }
  return ok();
}

// ─────────────────────────────────────────────────────────────────────────────
// VALIDADORES DE PORCENTAJE Y TASA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Valida el porcentaje de cuota inicial.
 * Acepta valor en porcentaje (20–50) o decimal (0.20–0.50).
 * Retorna error si está fuera del rango permitido.
 *
 * @param {number} value - Porcentaje (ej: 30) o decimal (ej: 0.30)
 * @returns {ValidationResult}
 *
 * @example
 * validateDownPaymentPct(30);   // → { valid: true }  (30%)
 * validateDownPaymentPct(0.30); // → { valid: true }  (también válido)
 * validateDownPaymentPct(10);   // → { valid: false }  (menos del 20%)
 */
export function validateDownPaymentPct(value) {
  if (!isUsableNumber(value)) {
    return fail('Ingresa el porcentaje de cuota inicial.');
  }

  // Normalizar a porcentaje
  const pct = value > 1 ? value : value * 100;
  const minPct = MIN_DOWN_PCT * 100; // 20%
  const maxPct = MAX_DOWN_PCT * 100; // 50%

  if (pct < minPct) {
    return fail(
      `La cuota inicial mínima es ${minPct}%. Los bancos colombianos financian máximo el 80% del valor.` +
      ' (Excepción: FNA puede financiar hasta el 100% en VIS/VIP.)'
    );
  }
  if (pct > maxPct) {
    return fail(`La cuota inicial no puede superar el ${maxPct}% en el simulador.`);
  }
  return ok();
}

/**
 * Valida una tasa de interés efectiva anual (EA).
 *
 * @param {number} value - Tasa en porcentaje (ej: 11.5 para 11.5% EA)
 * @returns {ValidationResult}
 *
 * @example
 * validateAnnualRate(11.5); // → { valid: true }
 * validateAnnualRate(50);   // → { valid: false }
 */
export function validateAnnualRate(value) {
  if (!isUsableNumber(value) || value <= 0) {
    return fail('Ingresa la tasa de interés anual.');
  }
  if (value < 0.1) {
    return fail('La tasa mínima es 0.1% EA.');
  }
  if (value > 40) {
    return fail('La tasa máxima es 40% EA. Verifica el valor ingresado.');
  }
  if (value > 25) {
    return {
      valid: true,
      error: undefined,
      warning: `Una tasa del ${value}% EA es inusualmente alta. Verifica que sea correcta.`,
    };
  }
  return ok();
}

/**
 * Valida la proyección de inflación para el módulo UVR.
 *
 * @param {number} value - Inflación anual en porcentaje (ej: 5.0)
 * @returns {ValidationResult}
 */
export function validateInflationRate(value) {
  if (!isUsableNumber(value) || value < 0) {
    return fail('La proyección de inflación no puede ser negativa.');
  }
  if (value > 50) {
    return fail('La proyección de inflación máxima en el simulador es 50%.');
  }
  return ok();
}

// ─────────────────────────────────────────────────────────────────────────────
// VALIDADORES DE PLAZO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Valida el plazo del crédito en meses.
 *
 * @param {number} value - Plazo en meses (ej: 240 para 20 años)
 * @returns {ValidationResult}
 *
 * @example
 * validateTermMonths(240); // → { valid: true }
 * validateTermMonths(12);  // → { valid: false, error: 'El plazo mínimo...' }
 */
export function validateTermMonths(value) {
  if (!isUsableNumber(value) || value <= 0) {
    return fail('Ingresa el plazo del crédito.');
  }
  if (!Number.isInteger(value)) {
    return fail('El plazo debe ser un número entero de meses.');
  }
  if (value < MIN_TERM_MONTHS) {
    return fail(
      `El plazo mínimo es ${MIN_TERM_MONTHS} meses (${MIN_TERM_MONTHS / 12} años) ` +
      'según la Ley 546 de 1999.'
    );
  }
  if (value > MAX_TERM_MONTHS) {
    return fail(
      `El plazo máximo es ${MAX_TERM_MONTHS} meses (${MAX_TERM_MONTHS / 12} años) ` +
      'según la Ley 546 de 1999.'
    );
  }
  return ok();
}

/**
 * Valida el mes de un abono extraordinario.
 *
 * @param {number} value      - Mes del abono (1-based)
 * @param {number} termMonths - Plazo total del crédito
 * @returns {ValidationResult}
 */
export function validateExtraPaymentMonth(value, termMonths) {
  if (!isUsableNumber(value) || !Number.isInteger(value)) {
    return fail('Ingresa un mes válido para el abono.');
  }
  if (value < 1) {
    return fail('El mes del abono debe ser mayor o igual a 1.');
  }
  if (value > termMonths) {
    return fail(`El mes del abono no puede superar el plazo del crédito (${termMonths} meses).`);
  }
  return ok();
}

// ─────────────────────────────────────────────────────────────────────────────
// VALIDADORES DE CONTACTO (FORMULARIO DE LEADS)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Valida un nombre completo.
 * Mínimo 2 caracteres, máximo 100.
 *
 * @param {string} value
 * @returns {ValidationResult}
 *
 * @example
 * validateName('Juan');    // → { valid: true }
 * validateName('J');       // → { valid: false }
 * validateName('');        // → { valid: false }
 */
export function validateName(value) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return fail('Ingresa tu nombre.');
  }
  const trimmed = value.trim();
  if (trimmed.length < 2) {
    return fail('El nombre debe tener al menos 2 caracteres.');
  }
  if (trimmed.length > 100) {
    return fail('El nombre no puede superar los 100 caracteres.');
  }
  // Solo letras, espacios, tildes, ñ, guiones y apóstrofes
  if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'\-]+$/.test(trimmed)) {
    return fail('El nombre solo puede contener letras y espacios.');
  }
  return ok();
}

/**
 * Valida un número de teléfono colombiano.
 *
 * Formatos aceptados:
 *   - Móvil: 10 dígitos empezando en 3 (ej: 3001234567)
 *   - Con prefijo: +57 3001234567 (12 dígitos con +57)
 *   - Con espacios/guiones: 300 123 4567, 300-123-4567
 *   - Fijo: 10 dígitos empezando en 6 (ej: 6011234567 = Bogotá)
 *
 * @param {string} value
 * @returns {ValidationResult}
 *
 * @example
 * validateColombianPhone('3001234567');   // → { valid: true }
 * validateColombianPhone('+573001234567'); // → { valid: true }
 * validateColombianPhone('300 123 4567'); // → { valid: true }
 * validateColombianPhone('123456789');    // → { valid: false }
 */
export function validateColombianPhone(value) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return fail('Ingresa tu número de teléfono.');
  }

  // Limpiar: quitar +57, espacios, guiones, paréntesis
  const cleaned = value
    .trim()
    .replace(/^\+57/, '')   // quitar prefijo internacional
    .replace(/[\s\-().]/g, ''); // quitar separadores

  if (!/^\d+$/.test(cleaned)) {
    return fail('El teléfono solo puede contener números.');
  }
  if (cleaned.length !== 10) {
    return fail('El teléfono colombiano debe tener 10 dígitos (sin prefijo +57).');
  }
  // Móvil: empieza en 3 (30X, 31X, 32X, 33X, 34X, 35X)
  // Fijo: empieza en 6 (60X = área metropolitana)
  if (!/^[36]/.test(cleaned)) {
    return fail('El número debe empezar en 3 (móvil) o 6 (fijo).');
  }
  return ok();
}

/**
 * Valida una dirección de email.
 * Campo opcional — permite string vacío (en ese caso retorna válido).
 *
 * @param {string} value
 * @param {boolean} [required=false] - Si true, el campo es obligatorio
 * @returns {ValidationResult}
 *
 * @example
 * validateEmail('usuario@gmail.com'); // → { valid: true }
 * validateEmail('no-es-email');       // → { valid: false }
 * validateEmail('', false);           // → { valid: true }  (opcional)
 */
export function validateEmail(value, required = false) {
  if (!required && (value === '' || value === null || value === undefined)) {
    return ok();
  }
  if (typeof value !== 'string' || value.trim().length === 0) {
    return required ? fail('Ingresa tu correo electrónico.') : ok();
  }

  // RFC 5322 simplificado — cubre el 99.9% de emails reales
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!emailRegex.test(value.trim())) {
    return fail('Ingresa un correo electrónico válido (ej: nombre@gmail.com).');
  }
  return ok();
}

// ─────────────────────────────────────────────────────────────────────────────
// REGLAS DE NEGOCIO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verifica si una cuota mensual cumple la regla del 30% de endeudamiento.
 * No retorna error si supera el límite — retorna una advertencia.
 * (Los bancos a veces aprueban hasta 35% según el perfil.)
 *
 * @param {number} monthlyPayment - Cuota mensual estimada en COP
 * @param {number} monthlyIncome  - Ingreso mensual en COP
 * @returns {{ valid: boolean, ratio: number, warning?: string }}
 *
 * @example
 * validateDebtCapacity(2_000_000, 5_000_000);
 * // → { valid: true, ratio: 0.40, warning: 'La cuota supera el 30%...' }
 */
export function validateDebtCapacity(monthlyPayment, monthlyIncome) {
  if (!isUsableNumber(monthlyPayment) || !isUsableNumber(monthlyIncome) || monthlyIncome <= 0) {
    return { valid: false, ratio: 0, error: 'Valores inválidos para calcular capacidad.' };
  }

  const ratio = monthlyPayment / monthlyIncome;

  if (ratio > MAX_DEBT_RATIO) {
    return {
      valid:   false,
      ratio,
      error:   `La cuota (${(ratio * 100).toFixed(1)}% del ingreso) supera el límite del ` +
               `${(MAX_DEBT_RATIO * 100).toFixed(0)}% establecido por la Superfinanciera. ` +
               'El banco podría rechazar la solicitud.',
    };
  }
  if (ratio > 0.25) {
    return {
      valid:   true,
      ratio,
      warning: `La cuota representa el ${(ratio * 100).toFixed(1)}% de tus ingresos. ` +
               `Aunque es menor al límite del ${(MAX_DEBT_RATIO * 100).toFixed(0)}%, ` +
               'considera si es sostenible a largo plazo.',
    };
  }
  return { valid: true, ratio };
}

/**
 * Clasifica un inmueble según su precio: VIP / VIS / NoVIS.
 * Útil para mostrar información relevante de subsidios al usuario.
 *
 * @param {number} propertyValueCOP
 * @returns {{ type: 'VIP'|'VIS'|'NoVIS', eligible: boolean,
 *             maxCOP: number, label: string }}
 *
 * @example
 * classifyPropertyType(150_000_000);
 * // → { type: 'VIP', eligible: true, maxCOP: 157.5M, label: 'Vivienda VIP' }
 */
export function classifyPropertyType(propertyValueCOP) {
  if (propertyValueCOP <= VIP_MAX_COP) {
    return {
      type:     'VIP',
      eligible: true,
      maxCOP:   VIP_MAX_COP,
      label:    'Vivienda de Interés Prioritario (VIP)',
    };
  }
  if (propertyValueCOP <= VIS_MAX_COP) {
    return {
      type:     'VIS',
      eligible: true,
      maxCOP:   VIS_MAX_COP,
      label:    'Vivienda de Interés Social (VIS)',
    };
  }
  return {
    type:     'NoVIS',
    eligible: false,
    maxCOP:   null,
    label:    'Vivienda No VIS',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// VALIDADORES COMPUESTOS (FORMULARIOS COMPLETOS)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Valida todos los inputs del simulador principal de una sola vez.
 * Útil para validar antes de generar la tabla o el PDF.
 *
 * @param {Object} inputs
 * @param {number} inputs.propertyValue - Valor del inmueble en COP
 * @param {number} inputs.downPaymentPct - Cuota inicial (decimal 0–1 o porcentaje 0–100)
 * @param {number} inputs.termMonths    - Plazo en meses
 * @param {number} inputs.annualRate    - Tasa EA en porcentaje
 * @returns {FormValidationResult}
 *
 * @example
 * validateSimulatorInputs({ propertyValue: 300e6, downPaymentPct: 0.30,
 *                           termMonths: 240, annualRate: 11.5 });
 * // → { valid: true, errors: { propertyValue: null, ... } }
 */
export function validateSimulatorInputs({ propertyValue, downPaymentPct, termMonths, annualRate }) {
  const results = {
    propertyValue:  validatePropertyValue(propertyValue),
    downPaymentPct: validateDownPaymentPct(downPaymentPct),
    termMonths:     validateTermMonths(termMonths),
    annualRate:     validateAnnualRate(annualRate),
  };

  const errors = {};
  let allValid = true;

  for (const [field, result] of Object.entries(results)) {
    errors[field] = result.valid ? null : result.error;
    if (!result.valid) allValid = false;
  }

  return { valid: allValid, errors };
}

/**
 * Valida los campos del formulario de captación de leads.
 *
 * @param {Object}  inputs
 * @param {string}  inputs.name           - Nombre del usuario
 * @param {string}  inputs.phone          - Teléfono colombiano
 * @param {string}  [inputs.email]        - Email (opcional)
 * @param {boolean} [inputs.acceptsTerms] - Aceptación de términos
 * @returns {FormValidationResult}
 */
export function validateLeadFormInputs({ name, phone, email = '', acceptsTerms }) {
  const results = {
    name:  validateName(name),
    phone: validateColombianPhone(phone),
    email: validateEmail(email, false),
  };

  if (acceptsTerms === false) {
    results.acceptsTerms = fail('Debes aceptar los términos para continuar.');
  }

  const errors = {};
  let allValid = true;

  for (const [field, result] of Object.entries(results)) {
    errors[field] = result.valid ? null : result.error;
    if (!result.valid) allValid = false;
  }

  return { valid: allValid, errors };
}