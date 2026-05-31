/**
 * router.js — Hash router de CalculaVivienda.co
 * Muestra/oculta secciones de página según el hash.
 * Simple y sin dependencias: no hace dynamic import, no destruye módulos.
 * El orquestador backend/app.js ya inicializó todos los módulos al cargar.
 */

const ROUTES = {
  '':            'page-home',
  'home':        'page-home',
  'comparar':    'page-comparar',
  'amortizacion':'page-amortizacion',
  'capacidad':   'page-capacidad',
  'abonos':      'page-abonos',
  'uvr':         'page-uvr',
  'subsidios':   'page-subsidios',
  'asesoria':    'page-asesoria',
};

const DEFAULT_PAGE = 'page-home';

// ── Helpers ──────────────────────────────────────────────────────────────────

function getHash() {
  return (window.location.hash || '').replace(/^#\/?/, '').split('?')[0].toLowerCase();
}

function updateNavActive(hash) {
  document.querySelectorAll('.nav__link, .nav__mobile-link').forEach(link => {
    const href = (link.getAttribute('href') || '').replace(/^#\/?/, '').toLowerCase();
    const isActive = href === hash || (hash === '' && (href === '' || href === 'home'));
    link.classList.toggle('nav__link--active', isActive && link.classList.contains('nav__link'));
    link.classList.toggle('nav__mobile-link--active', isActive && link.classList.contains('nav__mobile-link'));
    link.setAttribute('aria-current', isActive ? 'page' : 'false');
  });
}

// ── Navegación ────────────────────────────────────────────────────────────────

function navigate() {
  const hash   = getHash();
  const pageId = ROUTES[hash] ?? DEFAULT_PAGE;

  // Ocultar todas las páginas
  document.querySelectorAll('.page').forEach(p => p.classList.remove('page--active'));

  // Mostrar la página destino
  const page = document.getElementById(pageId);
  if (page) {
    page.classList.add('page--active');
  } else {
    // Fallback: mostrar home si el ID no existe
    document.getElementById(DEFAULT_PAGE)?.classList.add('page--active');
  }

  // Actualizar navbar
  updateNavActive(hash);

  // Scroll al top
  window.scrollTo({ top: 0 });

  // Mover foco al encabezado de la página (WCAG 2.4.3)
  const heading = page?.querySelector('h1, h2, [tabindex="-1"]');
  if (heading) {
    heading.setAttribute('tabindex', '-1');
    heading.focus({ preventScroll: true });
  }

  // Cerrar menú móvil si está abierto
  document.querySelector('.nav__mobile')?.classList.remove('is-open');
  document.querySelector('.nav__toggle')?.setAttribute('aria-expanded', 'false');
}

// ── Inicialización ────────────────────────────────────────────────────────────

export function initRouter() {
  window.addEventListener('hashchange', navigate);
  navigate(); // carga inicial
}
