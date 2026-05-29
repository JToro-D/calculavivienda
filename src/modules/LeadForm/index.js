/**
 * @file LeadForm/index.js
 * @description Módulo de captación de leads para brokers hipotecarios.
 *              Captura nombre y teléfono del usuario, los envía a Formspree
 *              y notifica al propietario del sitio para reenviar al broker.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CONFIGURACIÓN REQUERIDA
 * ─────────────────────────────────────────────────────────────────────────────
 *   1. Crear cuenta gratuita en https://formspree.io
 *   2. Crear formulario → copiar el endpoint (ej: https://formspree.io/f/XXXXXXXX)
 *   3. Pasar el endpoint al inicializar el módulo:
 *
 *   initLeadForm(container, { formspreeEndpoint: 'https://formspree.io/f/XXXXXXXX' });
 *
 *   El plan gratuito de Formspree permite 50 envíos/mes — suficiente para validar.
 *   Cuando escale: plan Basic $8 USD/mes para envíos ilimitados.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * USO
 * ─────────────────────────────────────────────────────────────────────────────
 *   import { initLeadForm } from './modules/LeadForm/index.js';
 *
 *   const form = initLeadForm(document.getElementById('lead-form'), {
 *     formspreeEndpoint: 'https://formspree.io/f/XXXXXXXX',
 *     loanContext: {
 *       principal:   210_000_000,
 *       annualRate:  11.0,
 *       termMonths:  240,
 *       bankName:    'Bancolombia',
 *     },
 *   });
 *
 *   // Actualizar contexto cuando el usuario simula un crédito:
 *   document.addEventListener('bcp:bankSelected', e => {
 *     form.update({ loanContext: { bankName: e.detail.bank.name, ... } });
 *   });
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * EVENTOS EMITIDOS
 * ─────────────────────────────────────────────────────────────────────────────
 *   'lead:submitted'  → { success: true, name: string }
 *   'lead:error'      → { success: false, error: string }
 *   'lead:dismissed'  → {}
 *
 * @version 1.0.0
 * @updated 2026-05-26
 * @author  Arquitecto — calculavivienda.com.co
 */

import {
  validateName,
  validateColombianPhone,
  validateEmail,
}                              from '../../utils/validators.js';
import {
  formatCOP, formatMonths, formatRate,
}                              from '../../utils/formatters.js';
import { PROJECT }             from '../../config/constants.js';

// ─────────────────────────────────────────────────────────────────────────────
// CSS
// ─────────────────────────────────────────────────────────────────────────────

const CSS_ID = 'lf-styles';

function injectCSS() {
  if (document.getElementById(CSS_ID)) return;
  const style = document.createElement('style');
  style.id    = CSS_ID;
  style.textContent = `
    .lf-wrapper {
      font-family: var(--font-sans, system-ui, sans-serif);
      border-radius: var(--radius-lg, 12px);
      border: 1px solid var(--color-border, #E5E7EB);
      overflow: hidden;
    }

    /* ── Hook (gancho de valor) ──────────────────────────────────────────── */
    .lf-hook {
      background: linear-gradient(135deg, #0A2540, #1E3A5F);
      padding: 16px;
    }
    .lf-hook-title {
      font-size: 16px;
      font-weight: 600;
      color: #fff;
      margin-bottom: 4px;
    }
    .lf-hook-sub {
      font-size: 13px;
      color: rgba(255,255,255,.7);
      margin-bottom: 12px;
    }
    .lf-context-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(110,231,183,.15);
      border: 1px solid rgba(110,231,183,.3);
      border-radius: 6px;
      padding: 5px 10px;
      font-size: 12px;
      color: #6EE7B7;
      margin-bottom: 12px;
    }
    .lf-benefits {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    .lf-benefit {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      font-size: 13px;
      color: rgba(255,255,255,.85);
    }
    .lf-benefit-icon { color: #6EE7B7; flex-shrink: 0; font-size: 14px; }

    /* ── Formulario ──────────────────────────────────────────────────────── */
    .lf-form {
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .lf-field { display: flex; flex-direction: column; gap: 4px; }
    .lf-label {
      font-size: 12px;
      font-weight: 500;
      color: #374151;
    }
    .lf-label-opt {
      font-size: 11px;
      color: #9CA3AF;
      font-weight: 400;
      margin-left: 4px;
    }
    .lf-input {
      padding: 10px 12px;
      border-radius: 8px;
      border: 1px solid #E5E7EB;
      font-size: 14px;
      color: #111827;
      background: #fff;
      width: 100%;
      box-sizing: border-box;
      transition: border-color .12s, box-shadow .12s;
    }
    .lf-input:focus {
      outline: none;
      border-color: var(--color-primary, #006241);
      box-shadow: 0 0 0 3px rgba(0,98,65,.1);
    }
    .lf-input--error  { border-color: #DC2626; }
    .lf-input--valid  { border-color: #16A34A; }
    .lf-field-error   { font-size: 11px; color: #DC2626; margin-top: 2px; }
    .lf-field-hint    { font-size: 11px; color: #9CA3AF; margin-top: 2px; }

    /* Checkbox de términos */
    .lf-terms {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      cursor: pointer;
    }
    .lf-checkbox {
      width: 16px; height: 16px;
      border-radius: 4px;
      border: 1px solid #E5E7EB;
      flex-shrink: 0;
      margin-top: 2px;
      cursor: pointer;
      accent-color: var(--color-primary, #006241);
    }
    .lf-terms-text { font-size: 12px; color: #6B7280; line-height: 1.5; }

    /* Botón principal */
    .lf-submit-btn {
      width: 100%;
      padding: 12px;
      border-radius: 8px;
      border: none;
      background: var(--color-primary, #006241);
      color: #fff;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity .15s, transform .1s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    .lf-submit-btn:hover:not(:disabled) { opacity: .92; }
    .lf-submit-btn:active:not(:disabled) { transform: scale(.99); }
    .lf-submit-btn:disabled { opacity: .5; cursor: not-allowed; }
    .lf-submit-btn--loading { opacity: .7; }

    /* Spinner */
    .lf-spinner {
      width: 14px; height: 14px;
      border: 2px solid rgba(255,255,255,.4);
      border-top-color: #fff;
      border-radius: 50%;
      animation: lf-spin .7s linear infinite;
      flex-shrink: 0;
    }
    @keyframes lf-spin { to { transform: rotate(360deg); } }

    /* Error de envío */
    .lf-submit-error {
      padding: 10px 12px;
      background: #FEF2F2;
      border: 1px solid #FCA5A5;
      border-radius: 8px;
      font-size: 13px;
      color: #991B1B;
      line-height: 1.5;
    }

    /* Nota de privacidad */
    .lf-privacy {
      padding: 0 16px 14px;
      font-size: 11px;
      color: #9CA3AF;
      line-height: 1.5;
      text-align: center;
    }

    /* ── Estado de éxito ─────────────────────────────────────────────────── */
    .lf-success {
      padding: 24px 16px;
      text-align: center;
    }
    .lf-success-icon { font-size: 40px; margin-bottom: 8px; }
    .lf-success-title {
      font-size: 18px;
      font-weight: 600;
      color: var(--color-secondary, #0A2540);
      margin-bottom: 6px;
    }
    .lf-success-body { font-size: 14px; color: #6B7280; line-height: 1.6; }
    .lf-success-body strong { color: #111827; }

    /* ── Config incompleta (dev) ─────────────────────────────────────────── */
    .lf-config-warning {
      padding: 12px 14px;
      background: #FFFBEB;
      border: 1px solid #FDE68A;
      border-radius: 8px;
      margin: 12px 16px;
      font-size: 12px;
      color: #92400E;
      line-height: 1.6;
    }
    .lf-config-warning code {
      background: #FEF3C7;
      padding: 1px 4px;
      border-radius: 3px;
      font-family: monospace;
    }
  `;
  document.head.appendChild(style);
}

// ─────────────────────────────────────────────────────────────────────────────
// ESTADO INICIAL
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_STATE = {
  // Datos del usuario
  name:         '',
  phone:        '',
  email:        '',
  acceptsTerms: false,
  // Estado UI
  isSubmitting: false,
  submitted:    false,
  submitError:  null,
  // Errores por campo
  errors:       { name: null, phone: null, email: null },
  // Contexto de la simulación (para Formspree y para el hook)
  loanContext:  null,   // { principal, annualRate, termMonths, bankName }
  // Configuración
  formspreeEndpoint: '',
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Construye el texto de contexto de la simulación para mostrar en el hook
 * y para enviar a Formspree junto con los datos del usuario.
 */
function buildContextText(loanContext) {
  if (!loanContext) return null;
  const parts = [];
  if (loanContext.principal)  parts.push(`Crédito: ${formatCOP(loanContext.principal)}`);
  if (loanContext.annualRate) parts.push(`Tasa: ${formatRate(loanContext.annualRate)}`);
  if (loanContext.termMonths) parts.push(`Plazo: ${formatMonths(loanContext.termMonths)}`);
  if (loanContext.bankName)   parts.push(`Banco: ${loanContext.bankName}`);
  return parts.join(' · ');
}

/**
 * Detecta entorno de desarrollo para mostrar aviso de configuración.
 */
function isDevEnvironment() {
  return (
    typeof window !== 'undefined' && (
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.port !== ''
    )
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MÓDULO PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

export function initLeadForm(container, initialState = {}) {
  if (!container) {
    console.error('[LeadForm] Se requiere un elemento contenedor.');
    return null;
  }

  injectCSS();

  let state = { ...DEFAULT_STATE, ...initialState };

  // ── Estado de éxito ───────────────────────────────────────────────────────

  function renderSuccess() {
    const firstName = state.name.trim().split(' ')[0];
    return `
      <div class="lf-wrapper">
        <div class="lf-success">
          <div class="lf-success-icon">✅</div>
          <div class="lf-success-title">¡Gracias, ${firstName}!</div>
          <div class="lf-success-body">
            Un asesor hipotecario certificado te contactará en las próximas
            <strong>24 horas hábiles</strong> al número <strong>${state.phone}</strong>.<br><br>
            El servicio es <strong>completamente gratuito para ti</strong> —
            el banco paga al asesor cuando se aprueba el crédito.
          </div>
        </div>
      </div>`.trim();
  }

  // ── Render principal ──────────────────────────────────────────────────────

  function render() {
    if (state.submitted) {
      container.innerHTML = renderSuccess();
      return;
    }

    const contextText = buildContextText(state.loanContext);
    const contextPill = contextText
      ? `<div class="lf-context-pill">📊 ${contextText}</div>`
      : '';

    const configWarning = !state.formspreeEndpoint && isDevEnvironment()
      ? `<div class="lf-config-warning">
           <strong>Configuración pendiente:</strong> Para activar el formulario, crea
           una cuenta en <a href="https://formspree.io" target="_blank">formspree.io</a>
           y pasa el endpoint al inicializar:<br>
           <code>initLeadForm(container, { formspreeEndpoint: 'https://formspree.io/f/XXXX' })</code>
         </div>`
      : '';

    const submitError = state.submitError
      ? `<div class="lf-submit-error">${state.submitError}</div>`
      : '';

    const submitLabel = state.isSubmitting
      ? `<span class="lf-spinner"></span> Enviando...`
      : '¡Quiero que me contacten! →';

    const submitDisabled = state.isSubmitting || !state.formspreeEndpoint
      ? ' disabled'
      : '';

    const fieldClass = (field) => {
      if (state.errors[field]) return 'lf-input lf-input--error';
      if (state[field].length > 0) return 'lf-input lf-input--valid';
      return 'lf-input';
    };

    container.innerHTML = `
      <div class="lf-wrapper">

        <div class="lf-hook">
          <div class="lf-hook-title">¿Quieres que un asesor te ayude?</div>
          <div class="lf-hook-sub">Es completamente gratuito para ti.</div>
          ${contextPill}
          <div class="lf-benefits">
            <div class="lf-benefit">
              <span class="lf-benefit-icon">✓</span>
              Consigue la mejor tasa negociando con múltiples bancos
            </div>
            <div class="lf-benefit">
              <span class="lf-benefit-icon">✓</span>
              Gestiona todos los trámites y documentos por ti
            </div>
            <div class="lf-benefit">
              <span class="lf-benefit-icon">✓</span>
              Gratis — el banco paga al asesor al aprobar el crédito
            </div>
          </div>
        </div>

        ${configWarning}

        <div class="lf-form">
          <div class="lf-field">
            <label class="lf-label" for="lf-name">Nombre completo</label>
            <input id="lf-name" class="${fieldClass('name')}" type="text"
                   value="${state.name}"
                   placeholder="Ej: Carlos Rodríguez"
                   autocomplete="name"
                   aria-describedby="lf-name-error" />
            ${state.errors.name
              ? `<span class="lf-field-error" id="lf-name-error">${state.errors.name}</span>`
              : ''}
          </div>

          <div class="lf-field">
            <label class="lf-label" for="lf-phone">
              Teléfono celular
              <span class="lf-label-opt">(te contactarán a este número)</span>
            </label>
            <input id="lf-phone" class="${fieldClass('phone')}" type="tel"
                   value="${state.phone}"
                   placeholder="3001234567"
                   inputmode="tel"
                   autocomplete="tel"
                   aria-describedby="lf-phone-error" />
            ${state.errors.phone
              ? `<span class="lf-field-error" id="lf-phone-error">${state.errors.phone}</span>`
              : `<span class="lf-field-hint">Sin prefijo +57. Ej: 3001234567</span>`}
          </div>

          <div class="lf-field">
            <label class="lf-label" for="lf-email">
              Correo electrónico
              <span class="lf-label-opt">(opcional)</span>
            </label>
            <input id="lf-email" class="${fieldClass('email')}" type="email"
                   value="${state.email}"
                   placeholder="nombre@correo.com"
                   autocomplete="email" />
            ${state.errors.email
              ? `<span class="lf-field-error">${state.errors.email}</span>`
              : ''}
          </div>

          <label class="lf-terms">
            <input class="lf-checkbox" type="checkbox"
                   ${state.acceptsTerms ? 'checked' : ''}
                   aria-label="Acepto que un asesor hipotecario me contacte" />
            <span class="lf-terms-text">
              Acepto que un asesor hipotecario certificado me contacte para
              asesorarme en la búsqueda del mejor crédito de vivienda.
            </span>
          </label>

          ${submitError}

          <button class="lf-submit-btn${state.isSubmitting ? ' lf-submit-btn--loading' : ''}"
                  data-action="submit"${submitDisabled}
                  aria-live="polite">
            ${submitLabel}
          </button>
        </div>

        <div class="lf-privacy">
          Tus datos se usan únicamente para conectarte con un asesor hipotecario.
          No recibirás correo no deseado. ${PROJECT.name} no comparte tu información
          con ningún banco directamente.
        </div>

      </div>`.trim();

    bindEvents();
  }

  // ── Validación ────────────────────────────────────────────────────────────

  function validateAll() {
    const vName  = validateName(state.name);
    const vPhone = validateColombianPhone(state.phone);
    const vEmail = validateEmail(state.email, false);

    state.errors = {
      name:  vName.valid  ? null : vName.error,
      phone: vPhone.valid ? null : vPhone.error,
      email: vEmail.valid ? null : vEmail.error,
    };

    return vName.valid && vPhone.valid && vEmail.valid && state.acceptsTerms;
  }

  // ── Envío a Formspree ─────────────────────────────────────────────────────

  async function submitToFormspree() {
    const contextText = buildContextText(state.loanContext);
    const payload     = {
      nombre:    state.name.trim(),
      telefono:  state.phone.trim(),
      email:     state.email.trim() || undefined,
      _subject:  `Nuevo lead hipotecario — ${PROJECT.name}`,
      simulacion: contextText ?? 'Sin datos de simulación',
      fuente:    PROJECT.domain,
      fecha:     new Date().toLocaleDateString('es-CO'),
    };

    const response = await fetch(state.formspreeEndpoint, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept':       'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      const msg  = data?.errors?.[0]?.message ?? `Error ${response.status}`;
      throw new Error(msg);
    }
  }

  // ── Manejo de envío ───────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!validateAll()) {
      render(); // Muestra errores de validación
      return;
    }

    if (!state.formspreeEndpoint) {
      state.submitError = 'El formulario no está configurado. Contacta al administrador del sitio.';
      render();
      return;
    }

    state.isSubmitting = true;
    state.submitError  = null;
    render();

    try {
      await submitToFormspree();

      state.isSubmitting = false;
      state.submitted    = true;
      render();

      container.dispatchEvent(new CustomEvent('lead:submitted', {
        bubbles: true,
        detail:  { success: true, name: state.name.trim() },
      }));

    } catch (error) {
      state.isSubmitting = false;
      state.submitError  = `No se pudo enviar el formulario. Por favor intenta de nuevo. (${error.message})`;
      render();

      container.dispatchEvent(new CustomEvent('lead:error', {
        bubbles: true,
        detail:  { success: false, error: error.message },
      }));
    }
  }

  // ── Event binding ─────────────────────────────────────────────────────────

  function bindEvents() {
    if (state.submitted) return;

    // Nombre
    const nameInput = container.querySelector('#lf-name');
    if (nameInput) {
      nameInput.addEventListener('input', () => {
        state.name = nameInput.value;
        if (state.errors.name) {
          const v = validateName(state.name);
          state.errors.name = v.valid ? null : v.error;
          render();
        }
      });
      nameInput.addEventListener('blur', () => {
        const v = validateName(state.name);
        state.errors.name = v.valid ? null : v.error;
        if (state.errors.name) render();
      });
    }

    // Teléfono
    const phoneInput = container.querySelector('#lf-phone');
    if (phoneInput) {
      phoneInput.addEventListener('input', () => {
        state.phone = phoneInput.value;
        if (state.errors.phone) {
          const v = validateColombianPhone(state.phone);
          state.errors.phone = v.valid ? null : v.error;
          render();
        }
      });
      phoneInput.addEventListener('blur', () => {
        const v = validateColombianPhone(state.phone);
        state.errors.phone = v.valid ? null : v.error;
        if (state.errors.phone) render();
      });
    }

    // Email (opcional)
    const emailInput = container.querySelector('#lf-email');
    if (emailInput) {
      emailInput.addEventListener('blur', () => {
        state.email = emailInput.value;
        const v = validateEmail(state.email, false);
        state.errors.email = v.valid ? null : v.error;
        if (state.errors.email) render();
      });
    }

    // Checkbox de términos
    const checkbox = container.querySelector('.lf-checkbox');
    if (checkbox) {
      checkbox.addEventListener('change', () => {
        state.acceptsTerms = checkbox.checked;
      });
    }

    // Botón submit
    const submitBtn = container.querySelector('[data-action="submit"]');
    if (submitBtn) {
      submitBtn.addEventListener('click', handleSubmit);
    }

    // Enter en inputs → submit
    [nameInput, phoneInput, emailInput].forEach(input => {
      if (input) {
        input.addEventListener('keydown', e => {
          if (e.key === 'Enter') handleSubmit();
        });
      }
    });
  }

  // ── API pública ───────────────────────────────────────────────────────────

  function update(newState) {
    const prev = { ...state };
    state = { ...state, ...newState };
    const changed = Object.keys(newState).some(k => newState[k] !== prev[k]);
    if (changed) render();
  }

  function destroy() { container.innerHTML = ''; }
  function getState() { return { ...state, errors: { ...state.errors } }; }

  render();
  return { update, destroy, getState };
}