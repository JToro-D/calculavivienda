/**
 * @file functions/api/uvr.js
 * @description Cloudflare Pages Function — proxy del valor UVR del Banrep.
 *
 * UBICACIÓN EN EL PROYECTO:
 * ─────────────────────────────────────────────────────────────────────────────
 *   calculavivienda/          ← raíz del proyecto
 *   ├── functions/            ← directorio especial de Cloudflare Pages
 *   │   └── api/
 *   │       └── uvr.js        ← ESTE ARCHIVO
 *   └── src/
 *       └── calculators/
 *           └── uvr.js        ← el calculador (cliente)
 *
 * ENDPOINT GENERADO AUTOMÁTICAMENTE:
 *   https://calculavivienda.com.co/api/uvr
 *
 * CÓMO FUNCIONA:
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. El navegador del usuario NO puede llamar al Banrep directamente (CORS).
 * 2. Este Worker corre en el edge de Cloudflare — sin CORS, sin restricciones.
 * 3. Fetch a banrep.gov.co → parsea el HTML → extrae el valor UVR → JSON.
 * 4. Cloudflare cachea el resultado 4 horas en el edge (caches.default).
 *    Costo: $0 — está dentro del plan gratuito de Cloudflare Pages.
 *
 * RESPUESTA JSON:
 *   { value: number, date: string, source: 'banrep' | 'worker-fallback' }
 *
 * ACTUALIZACIÓN DEL FALLBACK:
 * ─────────────────────────────────────────────────────────────────────────────
 *   Si el Banrep cambia el HTML y el parser falla, el Worker usa WORKER_FALLBACK.
 *   Actualizar WORKER_FALLBACK mensualmente junto con FALLBACK_UVR en uvr.js.
 *   Fuente: https://www.banrep.gov.co/es/-/valoruvr
 *
 * VERIFICACIÓN DEL PARSER (hacer una vez al desplegar):
 * ─────────────────────────────────────────────────────────────────────────────
 *   curl https://calculavivienda.com.co/api/uvr
 *   → Si "source" es "banrep", el parser funciona.
 *   → Si "source" es "worker-fallback", revisar parseUVRFromHTML().
 *
 * @version 1.0.0
 * @updated 2026-05-26
 * @author  Arquitecto — calculavivienda.com.co
 */

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURACIÓN
// ─────────────────────────────────────────────────────────────────────────────

/** URL oficial del Banco de la República con el valor UVR actual */
const BANREP_URL = 'https://www.banrep.gov.co/es/-/valoruvr';

/** Tiempo de caché en el edge de Cloudflare (segundos) */
const EDGE_CACHE_SECONDS = 4 * 60 * 60; // 4 horas

/**
 * Valor de respaldo al nivel del Worker.
 * Actúa cuando el Banrep no responde O cuando el parser falla.
 * Actualizar mensualmente. Fuente: Boletín de la Junta Directiva del Banrep.
 *
 * NOTA: Este valor es independiente del FALLBACK_UVR en src/calculators/uvr.js.
 * Ambos deben actualizarse el mismo día (15 de cada mes).
 */
const WORKER_FALLBACK = {
  value:  410.5604,  // Valor al 15 de mayo de 2026 — Boletín 13/2026
  date:   '2026-05-15',
  source: 'worker-fallback',
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extrae el valor numérico de la UVR desde el HTML del Banrep.
 *
 * ESTRATEGIA DE PARSEO (3 capas, de más a menos específica):
 *
 * 1. Busca el número inmediatamente después de "UVR" en el texto.
 *    El Banrep suele mostrar: "El valor UVR es $410,5604" o similar.
 *
 * 2. Busca cualquier número de 3-4 dígitos con exactamente 4 decimales
 *    en el rango UVR esperado (300–600 COP).
 *    Acepta coma (formato colombiano: 410,5604) o punto (410.5604).
 *
 * 3. Si nada funciona, retorna null → el Worker usa WORKER_FALLBACK.
 *
 * SI EL PARSER FALLA después de actualizar el Banrep su página:
 *   1. Inspeccionar el HTML: curl -s https://www.banrep.gov.co/es/-/valoruvr | grep -o '[0-9][0-9][0-9],[0-9][0-9][0-9][0-9]'
 *   2. Ajustar los patrones de regex en esta función.
 *   3. Redeploy automático al hacer git push.
 *
 * @param {string} html - HTML completo de la página del Banrep
 * @returns {number | null}
 */
function parseUVRFromHTML(html) {
  // Normalizar: remover whitespace excesivo para facilitar el match
  const text = html.replace(/\s+/g, ' ');

  // ── Estrategia 1: número después de "UVR" (más específica) ───────────────
  const contextPatterns = [
    // "UVR ... 410,5604" o "UVR ... 410.5604" (con hasta 50 chars entre UVR y el número)
    /UVR[^0-9]{0,80}(\d{3,4})[,.](\d{4})\b/i,
    // Con símbolo $: "$ 410,5604"
    /\$\s*(\d{3,4})[,.](\d{4})\b/,
    // Formato "valor" en tablas HTML: <td>410,5604</td>
    /<td[^>]*>\s*(\d{3,4})[,.](\d{4})\s*<\/td>/i,
  ];

  for (const pattern of contextPatterns) {
    const match = text.match(pattern);
    if (match) {
      const num = parseFloat(`${match[1]}.${match[2]}`);
      if (num >= 300 && num <= 700) return num;
    }
  }

  // ── Estrategia 2: cualquier número en rango UVR (menos específica) ────────
  // Encuentra todos los números con exactamente 4 decimales en el HTML
  const globalPattern = /\b(\d{3,4})[,.](\d{4})\b/g;
  const candidates    = [];
  let match;

  while ((match = globalPattern.exec(text)) !== null) {
    const num = parseFloat(`${match[1]}.${match[2]}`);
    // El UVR en 2026 está en el rango 380–450 aproximadamente
    if (num >= 380 && num <= 500) candidates.push(num);
  }

  // Si hay un único candidato en el rango esperado, usarlo
  if (candidates.length === 1) return candidates[0];

  // Si hay múltiples candidatos, tomar el primero (suele ser el más prominente)
  if (candidates.length > 1) return candidates[0];

  return null;
}

/**
 * Construye los headers CORS.
 * Aunque /api/uvr es same-origin, los headers permiten testing con curl o Postman.
 * @returns {Headers}
 */
function corsHeaders() {
  return new Headers({
    'Access-Control-Allow-Origin':  'https://calculavivienda.com.co',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Max-Age':       '86400',
    'Vary':                         'Origin',
  });
}

/**
 * Crea una Response JSON con headers apropiados.
 * @param {Object} data           - Datos a serializar
 * @param {number} cacheSeconds   - Segundos de Cache-Control
 * @returns {Response}
 */
function jsonResponse(data, cacheSeconds) {
  const headers = corsHeaders();
  headers.set('Content-Type',  'application/json; charset=utf-8');
  headers.set('Cache-Control', `public, max-age=${cacheSeconds}, s-maxage=${cacheSeconds}`);
  headers.set('X-Source',      data.source);

  return new Response(JSON.stringify(data), { status: 200, headers });
}

// ─────────────────────────────────────────────────────────────────────────────
// HANDLERS DE CLOUDFLARE PAGES FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Maneja peticiones GET a /api/uvr
 * @param {EventContext} context - Contexto de Cloudflare Pages
 * @returns {Promise<Response>}
 */
export async function onRequestGet(context) {
  // ── 1. Verificar caché del edge de Cloudflare ─────────────────────────────
  const cache    = caches.default;
  const cacheKey = new Request('https://calculavivienda.com.co/_cache/uvr-value');

  try {
    const cached = await cache.match(cacheKey);
    if (cached) {
      // Clonar y añadir header para saber que viene del edge cache
      const clone = new Response(cached.body, cached);
      clone.headers.set('X-Cache', 'HIT');
      return clone;
    }
  } catch {
    // Cache falla silenciosamente — continuar al fetch
  }

  // ── 2. Obtener UVR del Banco de la República ──────────────────────────────
  try {
    const banrepResponse = await fetch(BANREP_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CalculaVivienda-Bot/1.0; +https://calculavivienda.com.co)',
        'Accept':     'text/html,application/xhtml+xml',
        'Accept-Language': 'es-CO,es;q=0.9',
      },
      // Timeout de 8 segundos — Workers tiene límite de CPU tiempo
      signal: AbortSignal.timeout(8_000),
    });

    if (banrepResponse.ok) {
      const html   = await banrepResponse.text();
      const uvrVal = parseUVRFromHTML(html);

      if (uvrVal !== null) {
        const today = new Date().toISOString().split('T')[0];
        const data  = { value: uvrVal, date: today, source: 'banrep' };

        const response = jsonResponse(data, EDGE_CACHE_SECONDS);
        response.headers.set('X-Cache', 'MISS');

        // Guardar en caché del edge de forma asíncrona (no bloquea la respuesta)
        context.waitUntil(cache.put(cacheKey, response.clone()));

        return response;
      }

      // HTML llegó pero el parser no encontró el valor
      console.error('[uvr-worker] Parser falló. Revisar parseUVRFromHTML(). HTML snippet:', html.slice(0, 500));
    }
  } catch (error) {
    // Red caída, timeout, o error del Banrep
    console.error('[uvr-worker] Fetch error:', error.message);
  }

  // ── 3. Fallback — valor hardcodeado actualizado mensualmente ──────────────
  const fallbackResponse = jsonResponse(WORKER_FALLBACK, 3_600); // 1 hora para que intente de nuevo pronto
  fallbackResponse.headers.set('X-Cache', 'FALLBACK');
  return fallbackResponse;
}

/**
 * Maneja preflight CORS (OPTIONS)
 */
export async function onRequestOptions() {
  return new Response(null, {
    status:  204,
    headers: corsHeaders(),
  });
}

/**
 * Métodos no permitidos
 */
export async function onRequest() {
  return new Response(JSON.stringify({ error: 'Method not allowed. Use GET.' }), {
    status:  405,
    headers: { 'Content-Type': 'application/json', 'Allow': 'GET, OPTIONS' },
  });
}