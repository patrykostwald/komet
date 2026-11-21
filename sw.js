/* KOMET: service worker aplikacji (PWA). Sieć najpierw, pamięć podręczna jako zapas (offline); wersja w nazwie, stare pamięci kasowane. */
'use strict';
var WERSJA = 'komet-v2', PLIKI = ['./', 'index.html', 'klient.js', 'nauka.js', 'silnik.js', 'boty.js', 'dzwiek.js', 'ksztalty.js', 'manifest.json', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', function (e) { e.waitUntil(caches.open(WERSJA).then(function (c) { return c.addAll(PLIKI); }).then(function () { return self.skipWaiting(); })); });
self.addEventListener('activate', function (e) { e.waitUntil(caches.keys().then(function (k) { return Promise.all(k.filter(function (n) { return n !== WERSJA; }).map(function (n) { return caches.delete(n); })); }).then(function () { return self.clients.claim(); })); });
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(function (r) { if (r && r.ok) { var kopia = r.clone(); caches.open(WERSJA).then(function (c) { c.put(e.request, kopia); }); } return r; }).catch(function () { return caches.match(e.request).then(function (r) { return r || caches.match('./'); }); }));
});
