const CACHE_NAME = 'montenoa-offline-v2';

// Rutas relativas a tu repositorio en GitHub Pages
const PMTILES_URL = '/Montenoa-Bike-Park/mapa-base.pmtiles';

const ASSETS_TO_CACHE = [
  '/Montenoa-Bike-Park/',
  '/Montenoa-Bike-Park/index.html',
  '/Montenoa-Bike-Park/manifest.json',
  PMTILES_URL
];

// 1. Instalar y guardar en caché todo lo necesario
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// 2. Borrar cachés anteriores
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// 3. Interceptar peticiones (guarda automáticamente las librerías CDN y responde offline)
self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Manejo especial para fragmentos del mapa (.pmtiles)
  if (url.includes('mapa-base.pmtiles')) {
    event.respondWith(handleRangeRequest(event.request));
    return;
  }

  // Para el resto de archivos (MapLibre, PMTiles JS, fuentes, GeoJSON):
  // Busca en caché; si no está, lo descarga y lo guarda automáticamente para uso offline
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200) {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      });
    })
  );
});

async function handleRangeRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(PMTILES_URL);

  if (!cachedResponse) {
    return fetch(request);
  }

  const rangeHeader = request.headers.get('range');
  if (!rangeHeader) {
    return cachedResponse;
  }

  const arrayBuffer = await cachedResponse.arrayBuffer();
  const bytes = /^bytes\=(\d+)\-(\d+)?$/g.exec(rangeHeader);
  const start = Number(bytes[1]);
  const end = bytes[2] ? Number(bytes[2]) : arrayBuffer.byteLength - 1;
  const slicedBuffer = arrayBuffer.slice(start, end + 1);

  return new Response(slicedBuffer, {
    status: 206,
    statusText: 'Partial Content',
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Range': `bytes ${start}-${end}/${arrayBuffer.byteLength}`,
      'Content-Length': slicedBuffer.byteLength
    }
  });
}
