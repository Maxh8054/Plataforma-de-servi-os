// ==============================================
// Service Worker — Network-First + Cache 5 minutos
// ==============================================
// Versão do cache: será substituída pela query ?v=X
// no registro. O cache name usa essa versão para
// invalidação automática a cada deploy.
// ==============================================

// Extrai versão da própria URL (ex: sw.js?v=2)
const SW_URL = new URL(self.location.href);
const SW_VERSION = SW_URL.searchParams.get('v') || '0';
const CACHE_NAME = 'zamine-cache-v' + SW_VERSION;

// Notifica clientes sobre a versão ativa do SW
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'GET_SW_STATUS') {
    event.ports[0].postMessage({
      type: 'SW_STATUS',
      version: SW_VERSION,
      cacheName: CACHE_NAME,
    });
  }
});

const CACHE_TTL = 5 * 60 * 1000; // 5 minutos em ms

// URLs que NÃO devem ser cacheadas (streaming, SSE, etc.)
const NO_CACHE_PATTERNS = [
  /\/api\/(?:stream|sse|ws|socket)/i,
];

// Tipos de recurso e seus TTLs (em ms)
const RESOURCE_TTL = {
  'document':       5 * 60 * 1000,   // 5 min — páginas HTML
  'script':         5 * 60 * 1000,   // 5 min — JS
  'style':          5 * 60 * 1000,   // 5 min — CSS
  'image':          30 * 60 * 1000,  // 30 min — imagens
  'font':           60 * 60 * 1000,  // 1 hora — fontes
  'other':          5 * 60 * 1000,   // 5 min — resto
};

function getResourceType(request) {
  const url = new URL(request.url);
  const ext = url.pathname.split('.').pop()?.toLowerCase();

  if (request.destination === 'document' || ext === 'html') return 'document';
  if (request.destination === 'script' || ext === 'js') return 'script';
  if (request.destination === 'style' || ext === 'css') return 'style';
  if (request.destination === 'image' || ['png','jpg','jpeg','gif','svg','webp','ico','avif'].includes(ext || '')) return 'image';
  if (request.destination === 'font' || ['woff','woff2','ttf','otf','eot'].includes(ext || '')) return 'font';

  return 'other';
}

function shouldSkipCache(request) {  if (request.method !== 'GET') return true;

  const url = new URL(request.url);
  if (!url.protocol.startsWith('http')) return true;
  // Skip API calls entirely
  if (url.pathname.startsWith('/api/')) return true;

  for (const pattern of NO_CACHE_PATTERNS) {
    if (pattern.test(url.pathname)) return true;
  }

  return false;
}

async function cacheResponse(request, response) {
  if (!response || response.status !== 200) return;

  const type = getResourceType(request);
  const ttl = RESOURCE_TTL[type] || CACHE_TTL;

  const responseToCache = response.clone();

  const headers = new Headers(responseToCache.headers);
  headers.set('sw-cache-timestamp', Date.now().toString());
  headers.set('sw-cache-ttl', ttl.toString());

  const body = await responseToCache.blob();
  const newResponse = new Response(body, {
    status: responseToCache.status,
    statusText: responseToCache.statusText,
    headers,
  });

  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, newResponse);
}

async function getFromCache(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  if (!cached) return null;

  const timestamp = parseInt(cached.headers.get('sw-cache-timestamp') || '0');
  const ttl = parseInt(cached.headers.get('sw-cache-ttl') || CACHE_TTL.toString());
  const age = Date.now() - timestamp;
  const isExpired = age > ttl;

  if (isExpired) {
    await cache.delete(request);
    return null;
  }

  const headers = new Headers(cached.headers);
  headers.delete('sw-cache-timestamp');
  headers.delete('sw-cache-ttl');

  const body = await cached.blob();
  return new Response(body, {
    status: cached.status,
    statusText: cached.statusText,
    headers,
  });
}

async function getFromCacheEvenIfExpired(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  if (!cached) return null;

  const headers = new Headers(cached.headers);
  headers.delete('sw-cache-timestamp');
  headers.delete('sw-cache-ttl');

  headers.set('X-From-Offline-Cache', 'true');

  const body = await cached.blob();
  return new Response(body, {
    status: cached.status,
    statusText: cached.statusText,
    headers,
  });
}

async function cleanOldCache() {
  const cacheNames = await caches.keys();
  for (const name of cacheNames) {
    if (name !== CACHE_NAME) {
      await caches.delete(name);
    }
  }
}

// ====================
// FETCH — Network-First
// ====================
self.addEventListener('fetch', (event) => {
  if (shouldSkipCache(event.request)) return;

  event.respondWith(
    (async () => {
      try {
        const networkResponse = await fetch(event.request);

        if (networkResponse.status === 200) {
          event.waitUntil(cacheResponse(event.request, networkResponse));
        }

        // Adiciona header para o client saber que veio da rede
        const headers = new Headers(networkResponse.headers);
        headers.set('X-Served-By', 'network');

        return new Response(networkResponse.body, {
          status: networkResponse.status,
          statusText: networkResponse.statusText,
          headers,
        });

      } catch (networkError) {
        const cachedResponse = await getFromCacheEvenIfExpired(event.request);

        if (cachedResponse) {
          const headers = new Headers(cachedResponse.headers);
          headers.set('X-Served-By', 'cache');
          return new Response(cachedResponse.body, {
            status: cachedResponse.status,
            statusText: cachedResponse.statusText,
            headers,
          });
        }

        return new Response(
          JSON.stringify({ error: 'Sem conexao e sem cache disponivel.' }),
          {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    })()
  );
});

// ====================
// INSTALL
// ====================
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// ====================
// ACTIVATE
// ====================
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      cleanOldCache(),
      self.clients.claim(),
    ])
  );
});
