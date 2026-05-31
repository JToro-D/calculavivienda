/**
 * hero.js — Panel de resultados live del simulador (lado derecho navy)
 * Lee los controles del DOM y actualiza los displays sin conflicto con app.js.
 * app.js ya maneja la actualización de módulos; esto solo actualiza el panel visual.
 */

import { calcAmortizationSummary } from '../calculators/amortization.js';
import { getAllBanks }              from '../config/banks.js';
import { formatCOP, formatMillions } from '../utils/formatters.js';
import { classifyPropertyType }    from '../utils/validators.js';

// IDs de los elementos del panel derecho (navy)
const EL = {
  payment:    'hero-payment',
  principal:  'hero-principal',
  downamt:    'hero-downpayment',
  interest:   'hero-interest',
  total:      'hero-total',
  rateRef:    'hero-rate-ref',
  badge:      'hero-housing-badge',
};

function set(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function readSimState() {
  const slider    = document.getElementById('sim-property-slider');
  const propVal   = slider ? Number(slider.value) : 300_000_000;

  const activeDown = document.querySelector('[data-down].active, [data-down].is-active');
  const downPct    = activeDown ? Number(activeDown.dataset.down) : 0.30;

  const activeTerm = document.querySelector('[data-term].active, [data-term].is-active');
  const termMonths = activeTerm ? Number(activeTerm.dataset.term) : 240;

  return { propVal, downPct, termMonths };
}

export function updateHeroResults() {
  const { propVal, downPct, termMonths } = readSimState();
  const principal = propVal * (1 - downPct);

  // Usar banco más barato de los activos (ya ordenados por tasa en getAllBanks)
  const banks  = getAllBanks();
  const bank   = banks[0];
  const rate   = bank?.rateNoVIS?.reference ?? 11.0;

  const summary = bank ? calcAmortizationSummary(principal, rate, termMonths) : null;
  const housing = classifyPropertyType(propVal);

  // Actualizar displays
  set(EL.payment,   summary ? formatCOP(Math.round(summary.payment))    : '—');
  set(EL.principal, formatMillions(principal));
  set(EL.downamt,   formatCOP(Math.round(propVal * downPct)));
  set(EL.interest,  summary ? formatMillions(summary.totalInterest) : '—');
  set(EL.total,     summary ? formatMillions(summary.totalPaid)      : '—');
  set(EL.rateRef,   bank ? `${rate.toFixed(2).replace('.', ',')}% EA · ${bank.shortName}` : '—');

  // Badge tipo vivienda
  const badge = document.getElementById(EL.badge);
  if (badge) {
    badge.className = `hero__housing-badge hero__housing-badge--${housing.type}`;
    badge.textContent = `● ${housing.label}`;
  }

  // Actualizar fill visual del slider
  const slider = document.getElementById('sim-property-slider');
  if (slider) {
    const pct = ((propVal - Number(slider.min)) / (Number(slider.max) - Number(slider.min))) * 100;
    slider.style.setProperty('--fill', `${pct.toFixed(1)}%`);
  }

  // Actualizar display de valor formateado
  const display = document.getElementById('sim-property-display');
  if (display) display.textContent = formatCOP(propVal);
}

export function initHero() {
  // Escuchar cambios del slider
  document.getElementById('sim-property-slider')
    ?.addEventListener('input', updateHeroResults);

  // Escuchar clicks en botones de cuota inicial y plazo
  document.querySelectorAll('[data-down], [data-term]')
    .forEach(btn => btn.addEventListener('click', () => queueMicrotask(updateHeroResults)));

  // Cuando BankComparator selecciona banco → actualizar tasa del hero
  document.addEventListener('bcp:bankSelected', e => {
    const rate = e.detail?.bank?.rateNoVIS?.reference;
    if (rate) {
      // Recalcular con la tasa del banco seleccionado
      const { propVal, downPct, termMonths } = readSimState();
      const principal = propVal * (1 - downPct);
      const summary   = calcAmortizationSummary(principal, rate, termMonths);
      if (summary) {
        set(EL.payment,  formatCOP(Math.round(summary.payment)));
        set(EL.interest, formatMillions(summary.totalInterest));
        set(EL.total,    formatMillions(summary.totalPaid));
        set(EL.rateRef,  `${rate.toFixed(2).replace('.', ',')}% EA · ${e.detail.bank.shortName}`);
      }
    }
  });

  // Calcular estado inicial
  updateHeroResults();
}
