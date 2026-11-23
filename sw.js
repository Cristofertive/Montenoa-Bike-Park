const CACHE_NAME = 'montenoa-offline-v1';
const ARCHIVOS_OFFLINE = [
  './',
  './index.html',
  './manifest.json',
  './rutas/rutas_finales.kmz',
  './rutas/puntos_finales.kmz',
  './mapa-base.pmtiles',
  'https://unpkg.com/maplibre-gl@4.1.2/dist/maplibre-gl.css',
  'https://unpkg.com/maplibre-gl@4.1.2/dist/maplibre-gl.js',
  'https://unpkg.com/pmtiles@3.0.6/dist/pmtiles.js',
  'https://unpkg.com/jszip@3.10.1/dist/jszip.min.js',
  'https://unpkg.com/@tmcw/togeojson@5.8.1/dist/togeojson.umd.js',
  'https://unpkg.com/@turf/turf@6.5.0/turf.min.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Intenta guardar todos los archivos; si mapa-base.pmtiles aún no existe, no bloquea el resto
      return Promise.allSettled(
        ARCHIVOS_OFFLINE.map(url => cache.add(url))
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(respuestaCache => {
      return respuestaCache || fetch(event.request);
    })
  );
});