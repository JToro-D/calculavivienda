/**
 * @file app.js
 * @description Punto de entrada — orquesta, conecta y controla todos los módulos.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CONFIGURACIÓN INICIAL (lo único que hay que editar antes de lanzar)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   1. FORMSPREE_ENDPOINT → endpoint del formulario de leads
 *      Crear cuenta en formspree.io → copiar endpoint aquí.
 *
 *   2. MODULES → desactivar cualquier módulo con active: false
 *      Sin tocar ningún otro archivo.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ARQUITECTURA DE EVENTOS
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   BankComparator  ──bcp:bankSelected──▶  AmortizationTable
 *                                      ▶  ExtraPayments
 *                                      ▶  UVRComparator
 *                                      ▶  LeadForm (contexto)
 *
 *   CapacityCalc    ──cap:simulate──────▶  BankComparator
 *                                      ▶  AmortizationTable
 *                                      ▶  ExtraPayments
 *                                      ▶  LeadForm (contexto)
 *
 *   Subsidies       ──sub:subsidyApplied▶  AmortizationTable
 *                                      ▶  ExtraPayments
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CONTENEDORES HTML ESPERADOS (IDs en index.html)
 * ─────────────────────────────────────────────────────────────────────────────
 *   #sim-property-slider  → range del valor del inmueble
 *   #sim-property-display → texto formateado del valor
 *   #sim-down-[pct]       → botones cuota inicial (20,25,30,35,40,50)
 *   #sim-term-[months]    → botones plazo (120,180,240,300,360)
 *   #bank-comparator      → contenedor BankComparator
 *   #amortization-table   → contenedor AmortizationTable
 *   #capacity-calc        → contenedor CapacityCalc
 *   #extra-payments       → contenedor ExtraPayments
 *   #uvr-comparator       → contenedor UVRComparator
 *   #subsidies            → contenedor Subsidies
 *   #lead-form            → contenedor LeadForm
 *
 * @version 1.0.0
 * @updated 2026-05-26
 * @author  Arquitecto — calculavivienda.com.co
 */

// ─────────────────────────────────────────────────────────────────────────────
// IMPORTACIONES
// ─────────────────────────────────────────────────────────────────────────────

import { initBankComparator }    from './modules/BankComparator/index.js';
import { initAmortizationTable } from './modules/AmortizationTable/index.js';
import { initCapacityCalc }      from './modules/CapacityCalc/index.js';
import { initExtraPayments }     from './modules/ExtraPayments/index.js';
import { initUVRComparator }     from './modules/UVRComparator/index.js';
import { initSubsidies }         from './modules/Subsidies/index.js';
import { initLeadForm }          from './modules/LeadForm/index.js';

import { getAllBanks, getReferenceRate } from './config/banks.js';
import { formatCOP, formatMonths }      from './utils/formatters.js';

// ─────────────────────────────────────────────────────────────────────────────
// ★ CONFIGURACIÓN — editar antes de lanzar
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Endpoint de Formspree para el formulario de captación de leads.
 * Obtener en: https://formspree.io → crear formulario → copiar endpoint.
 * Ejemplo: 'https://formspree.io/f/xpwzabcd'
 */
const FORMSPREE_ENDPOINT = 'https://formspree.io/f/xykvvjya';  // ← PEGAR AQUÍ

/**
 * Registro de módulos. Cambiar active a false para desactivar sin borrar código.
 * Si el contenedor HTML no existe, el módulo se omite automáticamente.
 */
const MODULES_CONFIG = {
  bankComparator:    { active: true,  containerId: 'bank-comparator'    },
  amortizationTable: { active: true,  containerId: 'amortization-table'  },
  capacityCalc:      { active: true,  containerId: 'capacity-calc'       },
  extraPayments:     { active: true,  containerId: 'extra-payments'      },
  uvrComparator:     { active: true,  containerId: 'uvr-comparator'      },
  subsidies:         { active: true,  containerId: 'subsidies'           },
  leadForm:          { active: true,  containerId: 'lead-form'           },
};

// ─────────────────────────────────────────────────────────────────────────────
// ESTADO GLOBAL DE LA SIMULACIÓN
// Es la única fuente de verdad para los inputs del simulador principal.
// Todos los módulos leen de aquí cuando necesitan los valores actuales.
// ─────────────────────────────────────────────────────────────────────────────

const sim = {
  propertyValueCOP: 300_000_000,
  downPaymentPct:   0.30,         // decimal (0.30 = 30%)
  termMonths:       240,
  selectedBankId:   'bancolombia',
  housingType:      'NoVIS',

  /** Capital a financiar — calculado automáticamente */
  get principal() {
    return Math.round(this.propertyValueCOP * (1 - this.downPaymentPct));
  },

  /** Tasa EA del banco seleccionado */
  get annualRate() {
    return getReferenceRate(this.selectedBankId, this.housingType) ?? 11.0;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// INSTANCIAS DE MÓDULOS (se pueblan en initModules())
// ─────────────────────────────────────────────────────────────────────────────

const mods = {
  bankComparator:    null,
  amortizationTable: null,
  capacityCalc:      null,
  extraPayments:     null,
  uvrComparator:     null,
  subsidies:         null,
  leadForm:          null,
};

// ─────────────────────────────────────────────────────────────────────────────
// TOAST — notificaciones ligeras para feedback al usuario
// ─────────────────────────────────────────────────────────────────────────────

const TOAST_CSS = `
  .app-toast {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%) translateY(12px);
    background: #111827;
    color: #fff;
    padding: 10px 20px;
    border-radius: 8px;
    font-size: 14px;
    box-shadow: 0 4px 12px rgba(0,0,0,.2);
    opacity: 0;
    transition: opacity .2s, transform .2s;
    z-index: 9999;
    max-width: 360px;
    text-align: center;
    pointer-events: none;
  }
  .app-toast--visible {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
  .app-toast--success { background: #065F46; }
  .app-toast--error   { background: #991B1B; }
  .app-toast--info    { background: #1E3A5F; }
`;

function injectToastCSS() {
  if (document.getElementById('app-toast-css')) return;
  const s  = document.createElement('style');
  s.id     = 'app-toast-css';
  s.textContent = TOAST_CSS;
  document.head.appendChild(s);
}

/**
 * Muestra una notificación temporal en la parte inferior de la pantalla.
 * @param {string} message
 * @param {'success'|'error'|'info'} [type='info']
 * @param {number} [duration=3000] - ms antes de desaparecer
 */
function showToast(message, type = 'info', duration = 3000) {
  const toast = document.createElement('div');
  toast.className = `app-toast app-toast--${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add('app-toast--visible'));
  });

  setTimeout(() => {
    toast.classList.remove('app-toast--visible');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Obtiene un contenedor del DOM de forma segura.
 * @param {string} id
 * @returns {HTMLElement | null}
 */
function getContainer(id) {
  return document.getElementById(id);
}

/**
 * Actualiza el display formateado del valor del inmueble en los inputs principales.
 */
function updatePropertyDisplay() {
  const el = document.getElementById('sim-property-display');
  if (el) el.textContent = formatCOP(sim.propertyValueCOP);
}

/**
 * Actualiza los botones de cuota inicial para resaltar el activo.
 */
function updateDownBtns() {
  document.querySelectorAll('[data-down]').forEach(btn => {
    const pct = parseFloat(btn.dataset.down);
    btn.classList.toggle('active', Math.abs(pct - sim.downPaymentPct) < 0.001);
  });
}

/**
 * Actualiza los botones de plazo para resaltar el activo.
 */
function updateTermBtns() {
  document.querySelectorAll('[data-term]').forEach(btn => {
    const months = parseInt(btn.dataset.term, 10);
    btn.classList.toggle('active', months === sim.termMonths);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// INICIALIZACIÓN DE MÓDULOS
// ─────────────────────────────────────────────────────────────────────────────

function initModules() {
  const cfg = MODULES_CONFIG;

  // ── BankComparator ────────────────────────────────────────────────────────
  if (cfg.bankComparator.active) {
    const el = getContainer(cfg.bankComparator.containerId);
    if (el) {
      mods.bankComparator = initBankComparator(el, {
        propertyValueCOP: sim.propertyValueCOP,
        downPaymentPct:   sim.downPaymentPct,
        termMonths:       sim.termMonths,
        selectedBankId:   sim.selectedBankId,
        housingType:      sim.housingType,
      });
    }
  }

  // ── AmortizationTable ─────────────────────────────────────────────────────
  if (cfg.amortizationTable.active) {
    const el = getContainer(cfg.amortizationTable.containerId);
    if (el) {
      mods.amortizationTable = initAmortizationTable(el, {
        principal:        sim.principal,
        annualRate:       sim.annualRate,
        termMonths:       sim.termMonths,
        selectedBank:     getAllBanks().find(b => b.id === sim.selectedBankId),
        propertyValueCOP: sim.propertyValueCOP,
        downPaymentPct:   sim.downPaymentPct,
      });
    }
  }

  // ── CapacityCalc ──────────────────────────────────────────────────────────
  if (cfg.capacityCalc.active) {
    const el = getContainer(cfg.capacityCalc.containerId);
    if (el) {
      mods.capacityCalc = initCapacityCalc(el, {
        annualRate: sim.annualRate,
        termMonths: sim.termMonths,
      });
    }
  }

  // ── ExtraPayments ─────────────────────────────────────────────────────────
  if (cfg.extraPayments.active) {
    const el = getContainer(cfg.extraPayments.containerId);
    if (el) {
      mods.extraPayments = initExtraPayments(el, {
        principal:  sim.principal,
        annualRate: sim.annualRate,
        termMonths: sim.termMonths,
      });
    }
  }

  // ── UVRComparator ─────────────────────────────────────────────────────────
  if (cfg.uvrComparator.active) {
    const el = getContainer(cfg.uvrComparator.containerId);
    if (el) {
      mods.uvrComparator = initUVRComparator(el, {
        loanCOP:    sim.principal,
        pesosRate:  sim.annualRate,
        termMonths: sim.termMonths,
      });
    }
  }

  // ── Subsidies ─────────────────────────────────────────────────────────────
  if (cfg.subsidies.active) {
    const el = getContainer(cfg.subsidies.containerId);
    if (el) {
      mods.subsidies = initSubsidies(el, {
        propertyValueCOP: sim.propertyValueCOP,
      });
    }
  }

  // ── LeadForm ──────────────────────────────────────────────────────────────
  if (cfg.leadForm.active) {
    const el = getContainer(cfg.leadForm.containerId);
    if (el) {
      mods.leadForm = initLeadForm(el, {
        formspreeEndpoint: FORMSPREE_ENDPOINT,
        loanContext: {
          principal:  sim.principal,
          annualRate: sim.annualRate,
          termMonths: sim.termMonths,
          bankName:   getAllBanks().find(b => b.id === sim.selectedBankId)?.name ?? '',
        },
      });
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// INPUTS PRINCIPALES (propiedad, cuota inicial, plazo)
// Wiran los controles del simulador principal en index.html
// ─────────────────────────────────────────────────────────────────────────────

function wireInputs() {
  // Slider del valor del inmueble
  const propSlider = document.getElementById('sim-property-slider');
  if (propSlider) {
    propSlider.value = sim.propertyValueCOP;
    propSlider.addEventListener('input', () => {
      sim.propertyValueCOP = parseInt(propSlider.value, 10);
      updatePropertyDisplay();
      onSimulatorInputChange();
    });
    updatePropertyDisplay();
  }

  // Botones de cuota inicial (data-down="0.20", "0.30", etc.)
  document.querySelectorAll('[data-down]').forEach(btn => {
    btn.addEventListener('click', () => {
      sim.downPaymentPct = parseFloat(btn.dataset.down);
      updateDownBtns();
      onSimulatorInputChange();
    });
  });
  updateDownBtns();

  // Botones de plazo (data-term="120", "240", etc.)
  document.querySelectorAll('[data-term]').forEach(btn => {
    btn.addEventListener('click', () => {
      sim.termMonths = parseInt(btn.dataset.term, 10);
      updateTermBtns();
      onSimulatorInputChange();
    });
  });
  updateTermBtns();
}

/**
 * Se llama cuando cambia cualquier input del simulador principal.
 * Actualiza todos los módulos con los nuevos valores.
 */
function onSimulatorInputChange() {
  const { propertyValueCOP, downPaymentPct, termMonths, principal, annualRate, selectedBankId, housingType } = sim;
  const bank = getAllBanks().find(b => b.id === selectedBankId);

  mods.bankComparator?.update({ propertyValueCOP, downPaymentPct, termMonths, housingType });
  mods.amortizationTable?.update({ principal, annualRate, termMonths,
    propertyValueCOP, downPaymentPct, selectedBank: bank });
  mods.extraPayments?.update({ principal, annualRate, termMonths });
  mods.uvrComparator?.update({ loanCOP: principal, pesosRate: annualRate, termMonths });
  mods.subsidies?.update({ propertyValueCOP });
  mods.leadForm?.update({
    loanContext: { principal, annualRate, termMonths, bankName: bank?.name ?? '' },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// EVENTOS ENTRE MÓDULOS
// ─────────────────────────────────────────────────────────────────────────────

function wireEvents() {
  // ── bcp:bankSelected ───────────────────────────────────────────────────
  // BankComparator → AmortizationTable, ExtraPayments, UVRComparator, LeadForm
  document.addEventListener('bcp:bankSelected', (e) => {
    const { bankId, bank } = e.detail;

    sim.selectedBankId = bankId;
    const rate = bank.rateNoVIS.reference;

    mods.amortizationTable?.update({
      annualRate:   rate,
      selectedBank: bank,
    });
    mods.extraPayments?.update({ annualRate: rate });
    mods.uvrComparator?.update({ pesosRate: rate });
    mods.capacityCalc?.update({ annualRate: rate });
    mods.leadForm?.update({
      loanContext: {
        principal:  sim.principal,
        annualRate: rate,
        termMonths: sim.termMonths,
        bankName:   bank.name,
      },
    });
  });

  // ── cap:simulate ───────────────────────────────────────────────────────
  // CapacityCalc → BankComparator, AmortizationTable, ExtraPayments, LeadForm
  document.addEventListener('cap:simulate', (e) => {
    const { principal, annualRate, termMonths, propertyValueCOP,
            downPaymentPct, housingType } = e.detail;

    // Actualizar estado global
    if (propertyValueCOP) sim.propertyValueCOP = propertyValueCOP;
    if (downPaymentPct)   sim.downPaymentPct   = downPaymentPct;
    if (termMonths)       sim.termMonths        = termMonths;

    const bank = getAllBanks().find(b => b.id === sim.selectedBankId);

    mods.bankComparator?.update({
      propertyValueCOP: propertyValueCOP ?? sim.propertyValueCOP,
      downPaymentPct:   downPaymentPct   ?? sim.downPaymentPct,
      termMonths:       termMonths       ?? sim.termMonths,
      housingType:      housingType      ?? sim.housingType,
    });
    mods.amortizationTable?.update({
      principal,
      annualRate,
      termMonths:       termMonths       ?? sim.termMonths,
      propertyValueCOP: propertyValueCOP ?? sim.propertyValueCOP,
      downPaymentPct:   downPaymentPct   ?? sim.downPaymentPct,
      selectedBank:     bank,
    });
    mods.extraPayments?.update({ principal, annualRate, termMonths });
    mods.uvrComparator?.update({ loanCOP: principal, pesosRate: annualRate, termMonths });
    mods.leadForm?.update({
      loanContext: { principal, annualRate, termMonths, bankName: bank?.name ?? '' },
    });

    // Scroll suave hacia la tabla de amortización
    const amtEl = getContainer(MODULES_CONFIG.amortizationTable.containerId);
    if (amtEl) {
      setTimeout(() => amtEl.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    }

    showToast(
      `Simulando crédito de ${formatCOP(principal)} a ${formatMonths(termMonths)}`,
      'success',
    );
  });

  // ── sub:subsidyApplied ─────────────────────────────────────────────────
  // Subsidies → AmortizationTable, ExtraPayments
  document.addEventListener('sub:subsidyApplied', (e) => {
    const { newLoanCOP, subsidyAmountCOP, originalLoanCOP } = e.detail;

    mods.amortizationTable?.update({ principal: newLoanCOP });
    mods.extraPayments?.update({ principal: newLoanCOP });

    showToast(
      `Subsidio de ${formatCOP(subsidyAmountCOP)} aplicado — crédito reducido a ${formatCOP(newLoanCOP)}`,
      'success',
      4000,
    );
  });

  // ── amt:pdfGenerated ───────────────────────────────────────────────────
  document.addEventListener('amt:pdfGenerated', (e) => {
    if (e.detail.success) {
      showToast('PDF descargado correctamente', 'success');
    } else {
      showToast('No se pudo generar el PDF. Intenta de nuevo.', 'error');
    }
  });

  // ── lead:submitted ─────────────────────────────────────────────────────
  document.addEventListener('lead:submitted', (e) => {
    showToast(
      `¡Gracias, ${e.detail.name}! Un asesor te contactará pronto.`,
      'success',
      5000,
    );
  });

  // ── lead:error ─────────────────────────────────────────────────────────
  document.addEventListener('lead:error', () => {
    showToast('Error al enviar. Por favor intenta de nuevo.', 'error');
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// ARRANQUE
// ─────────────────────────────────────────────────────────────────────────────

function init() {
  injectToastCSS();
  initModules();
  wireInputs();
  wireEvents();

  console.info(
    `%c calculavivienda.com.co %c v1.0 lista`,
    'background:#006241;color:#fff;padding:2px 6px;border-radius:4px;font-weight:bold',
    'color:#006241;font-weight:bold',
  );
}

// Esperar a que el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init(); // DOM ya listo (script diferido o al final del body)
}