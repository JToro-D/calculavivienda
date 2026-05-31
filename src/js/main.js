/**
 * main.js — Bootstrap de CalculaVivienda.co (frontend)
 * Inicializa el router y el panel hero. El orquestador de módulos es
 * backend/calculavivienda/src/app.js (importado al final del body en index.html).
 */

import { initRouter } from './router.js';
import { initHero }   from './hero.js';

// ── Navbar: scroll shadow + hamburguesa ───────────────────────────────────────

function initNavbar() {
  const nav    = document.querySelector('.nav');
  const toggle = document.querySelector('.nav__toggle');
  const mobile = document.querySelector('.nav__mobile');
  if (!nav) return;

  // Sombra al hacer scroll
  window.addEventListener('scroll', () => {
    nav.classList.toggle('nav--scrolled', window.scrollY > 8);
  }, { passive: true });

  // Hamburguesa
  if (toggle && mobile) {
    toggle.addEventListener('click', () => {
      const open = mobile.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
    });

    // Cerrar con Escape
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && mobile.classList.contains('is-open')) {
        mobile.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.focus();
      }
    });

    // Cerrar al clic fuera
    document.addEventListener('click', e => {
      if (!toggle.contains(e.target) && !mobile.contains(e.target)) {
        mobile.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }
}

// ── Inter-module navigation ───────────────────────────────────────────────────
// app.js llama scrollIntoView sobre el contenedor de amortización, pero ese
// elemento puede estar en display:none. Navegamos primero; el scrollIntoView
// de app.js (retrasado 100ms) dispara cuando la página ya es visible.

function wireAppEvents() {
  document.addEventListener('cap:simulate', () => {
    window.location.hash = '#amortizacion';
  });
}

// ── Boot ──────────────────────────────────────────────────────────────────────

function boot() {
  initNavbar();
  initRouter();
  initHero(); // panel live del hero (no interfiere con app.js)
  wireAppEvents();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
