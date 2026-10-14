const VER = 'rf-quote-v1';
const CORE = ['./','./index.html','./app.js','./calc.js','./styles.css','./manifest.json','./accessories.json','./logo.png',
  './icons/icon-192.png','./icons/icon-512.png','./icons/icon-maskable-512.png','./icons/apple-touch-icon.png','./icons/favicon-32.png'];
const OCR = ['./ocr/tesseract.min.js','./ocr/worker.min.js','./ocr/tesseract-core-lstm.wasm.js','./ocr/tesseract-core-simd-lstm.wasm.js','./ocr/eng.traineddata.gz'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VER).then(c => c.addAll(CORE)).then(() => {
    // OCR pack (~11 MB) cached in the background so install is not blocked
    caches.open(VER + '-ocr').then(c => c.addAll(OCR)).catch(() => {});
    return self.skipWaiting();
  }));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => !k.startsWith(VER)).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, {ignoreSearch: true}).then(hit => hit || fetch(e.request).then(res => {
    if (res.ok && new URL(e.request.url).origin === location.origin) { const cp = res.clone(); caches.open(VER).then(c => c.put(e.request, cp)); }
    return res;
  }).catch(() => e.request.mode === 'navigate' ? caches.match('./index.html') : Response.error())));
});
