/* Komet: klient. Rysuje WYŁĄCZNIE to, co daje widok(stan, id) i statyczne(stan); nigdy nie zagląda do ukrytego stanu.
   Sekcja SERWER LOKALNY to tymczasowy „serwer w przeglądarce” (prototyp z botami): ten sam silnik i te same komunikaty
   (zamiar -> widok), które później pójdą przez WebSocket. Reszta pliku to rysowanie, sterowanie i HUD. */
(function () {
  'use strict';
  var S = window.K_silnik, KS = window.K_ksztalty, BT = window.K_boty, B = S.BALANS, TAU = Math.PI * 2;
  var DZ = window.K_dzwiek || null; // dźwięk (dzwiek.js) jest opcjonalny: bez niego gra działa po cichu
  function dz(nazwa, o) { if (DZ && typeof DZ.graj === 'function') { try { DZ.graj(nazwa, o || {}); } catch (e) { /* cisza */ } } }
  function dzOdl(z, ja) { var d = Math.hypot(z.x - ja.x, z.y - ja.y); return { sila: Math.max(0.15, 1 - d / 700), pan: Math.max(-1, Math.min(1, (z.x - ja.x) / 500)) }; }
  var $ = function (s) { return document.querySelector(s); };
  var canvas = $('#scena'), ctx = canvas.getContext('2d', { alpha: false });
  var REDUKCJA = matchMedia('(prefers-reduced-motion: reduce)').matches, DOTYK = matchMedia('(pointer: coarse)').matches;
  var KOLOR = { szary: '#9da3ac', szaryJasny: '#d6dae0', zolty: '#f2c230', zoltyJasny: '#ffe08a', niebieski: '#5b8cff', czerwony: '#ff5a5a', bialy: '#f4f6f9', tlo: '#07060b' }; // czerń z fioletem

  // ================= SERWER LOKALNY (prototyp) =================
  var ZIARNO = (function () { var m = location.hash.match(/ziarno=(\d+)/); return m ? +m[1] : 1 + (Date.now() % 99991); })();
  var JA = 'ja', OSOB = ['budowniczy', 'ostrozny', 'chciwy', 'zdrajca'], PSOW = 1; // single: osobowości szarych botów (wilki to osobne 'zdrajca', czerwone od startu)
  var LICZBA_BOTOW = (function () { var m = location.hash.match(/boty=(\d+)/); return m ? Math.max(0, Math.min(11, +m[1])) : 8; })(); // #boty=N = liczba wilków (szarych zawsze SZARYCH); 0 = sam, jak w multi
  var RUNDA = (function () { var m = location.hash.match(/runda=(\d+)/); return m ? +m[1] : 0; })(); // #runda=N (sekundy) włącza limit rundy; na czas testów bez limitu
  var PRZESZKODY = /przeszkody=1/.test(location.hash); // na razie plansza bez przeszkód (decyzja właściciela 18.10); #przeszkody=1 włącza
  var BEZ_PRZESZKOD = function () { return []; };
  var st, STAT, pamiec, losBotow, gracze, licznikBotow = 0, SZARYCH = 4; // single: stała liczba szarych, wilków o wiele więcej
  function nowaGra(n) { // nowy świat z n botami (ten sam seed daje te same przeszkody i pole niezależnie od liczby graczy)
    LICZBA_BOTOW = n; var single = n > 0; document.body.classList.toggle('single', single); gracze = [{ id: JA, tylkoSzary: single }]; // single: tylko szary
    licznikBotow = 0; if (single) { for (var i = 0; i < SZARYCH; i++) gracze.push({ id: 'bot' + (++licznikBotow), bot: true, osobowosc: OSOB[i % OSOB.length] === 'zdrajca' ? 'budowniczy' : OSOB[i % OSOB.length] }); for (var pi = 0; pi < PSOW; pi++) gracze.push({ id: 'bot' + (++licznikBotow), bot: true, osobowosc: 'ostrozny', pies: true }); for (var j = 0; j < n; j++) gracze.push({ id: 'bot' + (++licznikBotow), bot: true, osobowosc: 'zdrajca', czerwony: true }); } // 4 szare + n wilków czających się w mroku
    st = S.nowyStan({ ziarno: ZIARNO, gracze: gracze, generuj: PRZESZKODY ? KS.generuj : BEZ_PRZESZKOD, ai: BT, runda: single ? RUNDA : 0, cel: single ? B.CEL_POKRYCIA : 0 }); // single: świt po zapaleniu CEL_POKRYCIA planszy
    STAT = S.statyczne(st); pamiec = {}; losBotow = S.rng(ZIARNO * 7 + 3);
    gracze.forEach(function (g) { if (g.bot) pamiec[g.id] = { statyczne: STAT, osobowosc: g.osobowosc, odNr: 0, ofiaraId: single ? JA : null, nieufny: single }; }); // single: wilki polują na gracza
  }
  nowaGra(LICZBA_BOTOW);
  var losRotacji = S.rng(ZIARNO * 3 + 11), ostatniWilk = 0;
  function rotacja() { // pokój online w miniaturze: bot, który jest już niebieski albo czerwony, po 1-2,5 min wychodzi, a nowy szary przychodzi
    if (LICZBA_BOTOW > 0) { var uR = st.pole.udzial || { jasne: 0 }, komR = STAT.pole.n * STAT.pole.n, wilki = 0; for (var wi = 0; wi < st.gracze.length; wi++) if (st.gracze[wi].bot && st.gracze[wi].czerwony) wilki++;
      if (wilki < Math.min(12, LICZBA_BOTOW + Math.floor((st.gracze[0].stat.wspolprace || 0) / 2)) && st.czas - ostatniWilk > 30) { ostatniWilk = st.czas; var idw = 'bot' + (++licznikBotow); S.dodajGracza(st, { id: idw, bot: true, osobowosc: 'zdrajca', czerwony: true }); pamiec[idw] = { statyczne: STAT, osobowosc: 'zdrajca', odNr: st.nrZdarzenia, ofiaraId: JA }; } } // im więcej światła, tym więcej wilków wychyla się z mroku
    for (var i = st.gracze.length - 1; i >= 0; i--) {
      var g = st.gracze[i]; if (!g.bot || g.kolorOd < 0 || g.pies) continue; // single: psy zostają (pomoc dla gracza), wychodzą tylko boty, które stały się wilkami
      var pm = pamiec[g.id]; if (!pm) continue; if (pm.zostaje == null) pm.zostaje = 60 + losRotacji() * 90;
      if (st.czas - g.kolorOd > pm.zostaje) { S.usunGracza(st, g.id); delete pamiec[g.id]; var id = 'bot' + (++licznikBotow), os = OSOB[licznikBotow % OSOB.length]; var czl = st.gracze[0]; S.dodajGracza(st, { id: id, bot: true, osobowosc: os, czerwony: os === 'zdrajca', zdala: { x: czl.x, y: czl.y } }); pamiec[id] = { statyczne: STAT, osobowosc: os, odNr: st.nrZdarzenia, ofiaraId: LICZBA_BOTOW > 0 ? JA : null, nieufny: LICZBA_BOTOW > 0 }; } // nowa szara daleko od gracza; szuka „1”, nie gracza
    }
  }
  var serwer = {
    krok: function (zamiarJa) {
      rotacja();
      var zam = {}; zam[JA] = zamiarJa;
      for (var gi = 0; gi < st.gracze.length; gi++) { var gb = st.gracze[gi]; if (gb.bot && !pamiec[gb.id]) pamiec[gb.id] = { statyczne: STAT, osobowosc: gb.osobowosc, odNr: st.nrZdarzenia, ofiaraId: LICZBA_BOTOW > 0 ? JA : null, nieufny: LICZBA_BOTOW > 0 }; } // szare dodane przez silnik (single) dostają pamięć AI
      for (var id in pamiec) { var w = S.widok(st, id, pamiec[id].odNr); pamiec[id].odNr = w.nr; zam[id] = BT.szary(w, pamiec[id], losBotow, B.TICK); }
      S.krok(st, zam, B.TICK);
    },
    widok: function (odNr) { return S.widok(st, JA, odNr); }
  };
  window.KOMET = { ziarno: ZIARNO, statyczne: function () { return STAT; }, boty: function () { return LICZBA_BOTOW; }, widok: function () { return serwer.widok(null); }, prawda: function () { return S.prawda(st); }, st: function () { return st; }, S: S }; // do testów Playwright (st i S: tylko do zrzutów scenariuszy)
  // ============================================================

  // ---------- płótno, kamera ----------
  var W = 0, H = 0, DPR = 1, kam = { x: B.SWIAT / 2, y: B.SWIAT / 2, s: 1, wx: 0, wy: 0 }, wstrzas = null, wolneKlatki = 0; // wx, wy: delikatny wstrząs po anihilacji; wolneKlatki: licznik do obniżenia jakości tła
  function rozmiar() {
    DPR = Math.min(2, window.devicePixelRatio || 1); W = innerWidth; H = innerHeight;
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR); canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    kam.s = Math.max(0.62, Math.min(1.05, Math.min(W / 1180, H / 760)));
  }
  addEventListener('resize', rozmiar); rozmiar();
  function ekran(x, y) { return [(x - kam.x) * kam.s + W / 2 + kam.wx, (y - kam.y) * kam.s + H / 2 + kam.wy]; }
  function wstrzasnij(x, y, sila) { // delikatny wstrząs: siła w pikselach, słabnie z odległością od kamery, gaśnie w 0,45 s
    if (REDUKCJA) return; var s = sila * Math.max(0, 1 - Math.hypot(x - kam.x, y - kam.y) / 800); if (s < 0.4) return;
    if (wstrzas && czasKlienta - wstrzas.t0 < wstrzas.czas) s = Math.max(s, wstrzas.sila); wstrzas = { t0: czasKlienta, sila: s, czas: 0.45 };
  }
  function rozpad(x, y, kolor, pal, moje) { // anihilacja: kula rozpada się na kwadratowe piksele (jak smuga), większy błysk, wstrząs
    efekty.push({ typ: 'rozpad', x: x, y: y, kolor: kolor, pal: pal, t0: czasKlienta, czas: 1.1, r: 96, n: 26 }); wstrzasnij(x, y, moje ? 7 : 4.5);
  }

  // ---------- sprite'y ----------
  function plotno(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function poswiata(kolor, rozmiar) { // miękka radialna poświata do składania „lighter”
    var c = plotno(rozmiar, rozmiar), x = c.getContext('2d'), g = x.createRadialGradient(rozmiar / 2, rozmiar / 2, 0, rozmiar / 2, rozmiar / 2, rozmiar / 2);
    g.addColorStop(0, kolor + 'ff'); g.addColorStop(0.25, kolor + '66'); g.addColorStop(0.6, kolor + '1a'); g.addColorStop(1, kolor + '00');
    x.fillStyle = g; x.fillRect(0, 0, rozmiar, rozmiar); return c;
  }
  function kula(kolor, jasny, rozmiar) { // miękki punkt światła: jasny rdzeń, kolor, łagodna krawędź (bez obrysu i cieniowania)
    var c = plotno(rozmiar, rozmiar), x = c.getContext('2d'), r = rozmiar / 2, g = x.createRadialGradient(r, r, 0, r, r, r);
    g.addColorStop(0, jasny); g.addColorStop(0.34, kolor); g.addColorStop(0.7, kolor + 'd9'); g.addColorStop(1, kolor + '00');
    x.fillStyle = g; x.fillRect(0, 0, rozmiar, rozmiar); return c;
  }
  var SPR = {
    posw: { szary: poswiata('#9da3ac', 128), zolty: poswiata('#f2c230', 256), niebieski: poswiata('#5b8cff', 160), czerwony: poswiata('#ff5a5a', 160), bialy: poswiata('#f4f6f9', 160), czarny: null },
    kula: {}, rdzen: null,
    glif: {}
  };
  (function () { // czarna plama na ciemne bity (gaśnięcie)
    var c = plotno(128, 128), x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.5, 'rgba(0,0,0,.7)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); SPR.posw.czarny = c;
  })();
  (function () { // każda kulka: para odcieni (chłodny i ciepły) do mienienia się oraz biały rdzeń
    var pary = { szary: ['#aeb6c4', '#c4b7cf', '#ffffff'], ja: ['#d3d9e5', '#ead9ec', '#ffffff'], niebieski: ['#5b8cff', '#8aa8ff', '#e4ecff'], czerwony: ['#ff5a5a', '#ff8a70', '#ffd9d2'], zolty: ['#f2c230', '#ffd86a', '#fff6d2'] };
    for (var k in pary) SPR.kula[k] = [kula(pary[k][0], pary[k][2], k === 'zolty' ? 128 : 64), kula(pary[k][1], pary[k][2], k === 'zolty' ? 128 : 64)];
    SPR.rdzen = kula('#ffffff', '#ffffff', 32);
  })();
  function slonce(rozmiar, odcien) { // żółta jak słońce: ciepły (nie biały) środek, złoto, szeroka miękka korona; bez pasów między warstwami
    var c = plotno(rozmiar, rozmiar), x = c.getContext('2d'), r = rozmiar / 2, g = x.createRadialGradient(r, r, 0, r, r, r);
    var st = odcien === 0 ? ['#fff1bd', '#ffd75e', '#f3b62f', 'rgba(241,168,42,.6)', 'rgba(229,138,44,.22)', 'rgba(229,138,44,0)'] : ['#fff3cc', '#ffd96c', '#f6bd3d', 'rgba(246,176,52,.58)', 'rgba(236,150,56,.2)', 'rgba(236,150,56,0)'];
    [0, 0.16, 0.38, 0.58, 0.8, 1].forEach(function (k, i) { g.addColorStop(k, st[i]); });
    x.fillStyle = g; x.fillRect(0, 0, rozmiar, rozmiar); return c;
  }
  function faza(id) { var h = 0; for (var i = 0; i < (id || '').length; i++) h += id.charCodeAt(i) * (i + 1); return (h % 1000) * 0.0063; }
  function glify() {
    var mono = getComputedStyle(document.documentElement).getPropertyValue('--mono') || 'monospace';
    ['0', '1'].forEach(function (ch) { [['dim', '#b4a9d8'], ['jasny', '#f4f6f9'], ['cien', '#000000']].forEach(function (p) { // kod w fioletowej szarości, „1” w świetle białe, cień pod zerami
      var c = plotno(40, 48), x = c.getContext('2d'); x.font = '400 26px ' + mono; x.textAlign = 'center'; x.textBaseline = 'middle';
      if (p[0] === 'cien') { x.shadowColor = '#000'; x.shadowBlur = 4; }
      x.fillStyle = p[1]; x.fillText(ch, 20, 25); SPR.glif[ch + p[0]] = c;
    }); });
    var cp = plotno(40, 48), xp = cp.getContext('2d'); xp.globalAlpha = 0.48; xp.drawImage(SPR.glif['0cien'], 2.1, 2.9); xp.globalAlpha = 0.26; xp.drawImage(SPR.glif['0cien'], -1.6, 1.3); xp.globalAlpha = 1; xp.drawImage(SPR.glif['0dim'], 0, 0); SPR.glif['0pelny'] = cp; // zero z wtopionymi cieniami: jedno rysowanie, gdy komórek jest dużo
  }
  glify(); if (document.fonts && document.fonts.ready) document.fonts.ready.then(glify);
  var ZIARNISTOSC = (function () { var c = plotno(160, 160), x = c.getContext('2d'), d = x.createImageData(160, 160), los = S.rng(99); for (var i = 0; i < d.data.length; i += 4) { var v = 128 + (los() - 0.5) * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } x.putImageData(d, 0, 0); return ctx.createPattern(c, 'repeat'); })();

  // ---------- warstwy statyczne: kontury szumu (fBm) i przeszkody z poświatą ----------
  var MARG = 200, ROZ = B.SWIAT + 2 * MARG; // świat plus margines, rysowany w skali 0,5 px na jednostkę
  var SKP = B.SWIAT > 2500 ? 0.5 : 1; // warstwa przeszkód w pół skali przy dużej planszy (pamięć)
  var warstwaKontur = plotno(ROZ / 2, ROZ / 2), warstwaPrzeszkod = plotno(Math.round(B.SWIAT * SKP), Math.round(B.SWIAT * SKP));
  (function kontury() { // wartościowy szum 4 oktawy -> poziomice (marching squares): organiczne, fraktalne linie tła
    var los = S.rng(ZIARNO + 17), N = 110, krok = ROZ / N, baza = 11, perm = [];
    for (var i = 0; i < (baza + 1) * (baza + 1); i++) perm.push(los());
    function wart(x, y) { var i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy), w = function (a, b) { return perm[((b % baza + baza) % baza) * (baza + 1) + ((a % baza + baza) % baza)]; };
      return (w(i, j) * (1 - sx) + w(i + 1, j) * sx) * (1 - sy) + (w(i, j + 1) * (1 - sx) + w(i + 1, j + 1) * sx) * sy; }
    function fbm(x, y) { var s = 0, a = 0.5, f = 1; for (var o = 0; o < 4; o++) { s += a * wart(x * f + o * 3.1, y * f + o * 7.7); a *= 0.5; f *= 2.03; } return s; }
    var pole = new Float32Array((N + 1) * (N + 1));
    for (var j = 0; j <= N; j++) for (var i2 = 0; i2 <= N; i2++) pole[j * (N + 1) + i2] = fbm(i2 / N * 3.2, j / N * 3.2);
    var x = warstwaKontur.getContext('2d'), sk = 0.5; x.lineWidth = 0.9; x.lineJoin = 'round';
    for (var lv = 0; lv < 16; lv++) {
      var iso = 0.22 + lv * 0.036, al = 0.05 + 0.07 * Math.abs(Math.sin(lv * 1.3)); x.strokeStyle = 'rgba(157,163,172,' + al.toFixed(3) + ')'; x.beginPath();
      for (var jj = 0; jj < N; jj++) for (var ii = 0; ii < N; ii++) {
        var a = pole[jj * (N + 1) + ii], b = pole[jj * (N + 1) + ii + 1], c = pole[(jj + 1) * (N + 1) + ii + 1], d = pole[(jj + 1) * (N + 1) + ii];
        var kod = (a > iso ? 8 : 0) | (b > iso ? 4 : 0) | (c > iso ? 2 : 0) | (d > iso ? 1 : 0); if (kod === 0 || kod === 15) continue;
        var x0 = ii * krok * sk, y0 = jj * krok * sk, k2 = krok * sk, t;
        var pt = { g: [x0 + k2 * (t = (iso - a) / (b - a)), y0], p: [x0 + k2, y0 + k2 * ((iso - b) / (c - b))], d: [x0 + k2 * ((iso - d) / (c - d)), y0 + k2], l: [x0, y0 + k2 * ((iso - a) / (d - a))] };
        var seg = { 1: 'ld', 2: 'pd', 3: 'lp', 4: 'gp', 5: 'lg,pd', 6: 'gd', 7: 'lg', 8: 'lg', 9: 'gd', 10: 'gp,ld', 11: 'gp', 12: 'lp', 13: 'pd', 14: 'ld' }[kod].split(',');
        for (var s2 = 0; s2 < seg.length; s2++) { var p1 = pt[seg[s2][0]], p2 = pt[seg[s2][1]]; x.moveTo(p1[0], p1[1]); x.lineTo(p2[0], p2[1]); }
      }
      x.stroke();
    }
  })();
  function zbudujPrzeszkody() { // jeden szary, miękka poświata na zewnątrz, delikatne rozjaśnienie krawędzi
    var x = warstwaPrzeszkod.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, warstwaPrzeszkod.width, warstwaPrzeszkod.height);
    if (!STAT.przeszkody.length) return;
    x.setTransform(SKP, 0, 0, SKP, 0, 0);
    x.shadowColor = 'rgba(157,163,172,.38)'; x.shadowBlur = 14; x.fillStyle = KOLOR.szary;
    STAT.przeszkody.forEach(function (p) { p.kola.forEach(function (k) { x.beginPath(); x.arc(k.x, k.y, k.r, 0, TAU); x.fill(); }); });
    x.shadowBlur = 0;
    STAT.przeszkody.forEach(function (p) { p.kola.forEach(function (k) { var g = x.createRadialGradient(k.x - k.r * 0.3, k.y - k.r * 0.35, k.r * 0.1, k.x, k.y, k.r); g.addColorStop(0, '#b4b9c1'); g.addColorStop(0.7, KOLOR.szary); g.addColorStop(1, '#8d939c'); x.fillStyle = g; x.beginPath(); x.arc(k.x, k.y, k.r, 0, TAU); x.fill(); }); });
  }
  zbudujPrzeszkody();

  // ---------- wejście ----------
  var klaw = { dx: 0, dy: 0, spacja: false, c: false, e: false, shift: false }, wcisniete = {};
  function ruchZKlawiszy() { var dx = 0, dy = 0; if (wcisniete.KeyA || wcisniete.ArrowLeft) dx -= 1; if (wcisniete.KeyD || wcisniete.ArrowRight) dx += 1; if (wcisniete.KeyW || wcisniete.ArrowUp) dy -= 1; if (wcisniete.KeyS || wcisniete.ArrowDown) dy += 1; klaw.dx = dx; klaw.dy = dy; }
  addEventListener('keydown', function (e) {
    if (e.code === 'Tab') { e.preventDefault(); if (gra) przelaczPodsumowanie(); return; }
    if (e.code === 'Escape') { if (podsumowanieOtwarte) przelaczPodsumowanie(); return; }
    if (e.code === 'Enter' && !gra) { start(); return; }
    if (e.code === 'Space') { e.preventDefault(); klaw.spacja = true; } // single: Spacja przyłącza jak E (silnik)
    if (e.code === 'KeyE') klaw.e = true;
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') klaw.shift = true;
    wcisniete[e.code] = true; ruchZKlawiszy();
  });
  addEventListener('keyup', function (e) { if (e.code === 'Space') klaw.spacja = false; if (e.code === 'KeyE') klaw.e = false; if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') klaw.shift = false; wcisniete[e.code] = false; ruchZKlawiszy(); });
  addEventListener('blur', function () { wcisniete = {}; klaw.dx = klaw.dy = 0; klaw.spacja = klaw.e = klaw.shift = false; });
  // dotyk: gałka (lewa) + przyciski (prawa); blokada gestów iOS
  (function dotyk() {
    var strefa = $('#strefa'), galka = $('#galka'), uchwyt = galka.querySelector('i'), palec = null, sx = 0, sy = 0, R0 = 70; // gałka pływająca (19.10 08:00): pojawia się pod kciukiem
    function pozycja(ev) { var dx = (ev.clientX - sx) / R0, dy = (ev.clientY - sy) / R0, d = Math.hypot(dx, dy); if (d > 1) { dx /= d; dy /= d; } klaw.dx = Math.abs(dx) < 0.12 ? 0 : dx; klaw.dy = Math.abs(dy) < 0.12 ? 0 : dy; uchwyt.style.transform = 'translate(' + (dx * 44) + 'px,' + (dy * 44) + 'px)'; } // wychylenie względem punktu dotyku; sprint tylko przyciskiem RUN
    strefa.addEventListener('pointerdown', function (ev) { if (palec !== null) return; palec = ev.pointerId; sx = ev.clientX; sy = ev.clientY; galka.style.left = (sx - R0) + 'px'; galka.style.top = (sy - R0) + 'px'; galka.classList.add('widac'); try { strefa.setPointerCapture(palec); } catch (e) {} pozycja(ev); ev.preventDefault(); });
    strefa.addEventListener('pointermove', function (ev) { if (ev.pointerId === palec) pozycja(ev); });
    function puszczenie(ev) { if (ev.pointerId === palec) { palec = null; klaw.dx = klaw.dy = 0; uchwyt.style.transform = ''; galka.classList.remove('widac'); } }
    strefa.addEventListener('pointerup', puszczenie); strefa.addEventListener('pointercancel', puszczenie);
    [['#bSpacja', 'spacja'], ['#bE', 'e'], ['#bShift', 'shift']].forEach(function (p) { var b = $(p[0]); var w = function (ev) { klaw[p[1]] = true; b.classList.add('aktywny'); ev.preventDefault(); }, u = function () { klaw[p[1]] = false; b.classList.remove('aktywny'); };
      b.addEventListener('pointerdown', w); b.addEventListener('pointerup', u); b.addEventListener('pointercancel', u); b.addEventListener('pointerleave', u); });
    ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (n) { document.addEventListener(n, function (e) { e.preventDefault(); }, { passive: false }); });
    document.addEventListener('touchmove', function (e) { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
    var ost = 0; document.addEventListener('touchend', function (e) { var t = Date.now(); if (t - ost < 320) e.preventDefault(); ost = t; }, { passive: false });
  })();

  // ---------- stan klienta ----------
  var gra = false, podsumowanieOtwarte = false, odNr = 0, poprz = null, biez = null, akum = 0, ostatni = 0, czasKlienta = 0;
  var slady = {}, efekty = [], komunikat = { tekst: '', do: 0, wazny: false }, epokaDo = 0;
  function ustawKomunikat(t, s, wazny) { komunikat = { tekst: t, do: czasKlienta + (s || 3), wazny: !!wazny }; }

  var elBoty = $('#botyLiczba');
  function ustawBoty(n) { n = Math.max(0, Math.min(11, n)); elBoty.textContent = n; $('#botyMinus').disabled = n <= 0; $('#botyPlus').disabled = n >= 11; }
  ustawBoty(LICZBA_BOTOW);
  $('#botyMinus').addEventListener('click', function () { ustawBoty(+elBoty.textContent - 1); });
  $('#botyPlus').addEventListener('click', function () { ustawBoty(+elBoty.textContent + 1); });
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) { try { navigator.serviceWorker.register('sw.js').catch(function () {}); } catch (e) {} } // aplikacja (PWA): instalacja na ekranie początkowym i praca offline
  function pelnyEkran() { // dotyk: po PLAY pełny ekran i blokada orientacji poziomej tam, gdzie przeglądarka pozwala (iOS: tylko jako zainstalowana aplikacja)
    if (!DOTYK) return;
    try { var de = document.documentElement, pr = de.requestFullscreen ? de.requestFullscreen() : (de.webkitRequestFullscreen ? de.webkitRequestFullscreen() : null); var blokuj = function () { try { var l = screen.orientation && screen.orientation.lock ? screen.orientation.lock('landscape') : null; if (l && l.catch) l.catch(function () {}); } catch (e2) {} }; if (pr && pr.then) pr.then(blokuj, function () {}); else blokuj(); } catch (e) {}
  }

  // licznik wejść i gier: serwer dolicza +1, nic nie zapisujemy w przeglądarce i nie wysyłamy danych o osobie
  var licz = function (r) { try { if (location.protocol !== 'https:') return; fetch(location.hostname.indexOf('komet.run') >= 0 ? '/api/licz' : '/kocilapki/api/licz', { method: 'POST', mode: 'no-cors', body: JSON.stringify({ r: 'komet:' + r }), keepalive: true }).catch(function () {}); } catch (e) {} };
  (function () { licz('wejscie'); var h = ''; try { h = document.referrer ? new URL(document.referrer).hostname : ''; } catch (e) {}
    var oz = (new URLSearchParams(location.search).get('z') || '').toLowerCase().replace(/[^a-z0-9.-]/g, '').slice(0, 40);
    var zr = oz || (!h ? 'bezposrednio' : h === location.hostname ? '' : /facebook|fb\.com/.test(h) ? 'facebook' : /instagram/.test(h) ? 'instagram' : /wykop/.test(h) ? 'wykop' : /google/.test(h) ? 'google'
      : /tiktok/.test(h) ? 'tiktok' : /reddit/.test(h) ? 'reddit' : /messenger/.test(h) ? 'messenger' : /(^|\.)t\.co$|twitter|x\.com/.test(h) ? 'x' : h.replace(/^www\./, '').slice(0, 40));
    if (zr) licz('zrodlo:' + zr.toLowerCase().replace(/[^a-z0-9.-]/g, '')); })();
  function start() {
    licz('gra');
    var n = parseInt(elBoty.textContent, 10); if (isNaN(n)) n = LICZBA_BOTOW;
    if (n !== LICZBA_BOTOW) { nowaGra(n); zbudujPrzeszkody(); biez = null; poprz = null; odNr = 0; slady = {}; efekty = []; ostZycia = -1; }
    if (NAUKA) NAUKA.stop(); gra = true; document.body.classList.add('gra'); $('#start').classList.remove('widac'); $('#start').setAttribute('aria-hidden', 'true'); canvas.focus(); pelnyEkran(); ustawKomunikat(document.body.classList.contains('single') ? 'Żyjesz w mroku. Szare nadają z „1”: wpadnij i wciśnij E albo Spację, zanim zrobi to wilk. W „1” masz 3 s.' : 'Trzymaj Spację: nawołujesz. Przy nawołującym: E dołącz. W parze Shift odłącza.', 7);
    if (DZ) { try { DZ.start(); DZ.tlo(true); } catch (e) { /* bez dźwięku */ } }
  }
  addEventListener('keydown', function (e) { if (e.code === 'KeyM' && DZ && typeof DZ.wycisz === 'function') { DZ.wycisz(!DZ.wyciszone); ustawKomunikat(DZ.wyciszone ? 'Dźwięk wyłączony (M).' : 'Dźwięk włączony (M).', 2); } });
  $('#graj').addEventListener('click', start);
  $('#pytajnik2').addEventListener('click', function () { var d = $('#dol'), r = !d.classList.contains('pomoc'); d.classList.toggle('pomoc', r); this.setAttribute('aria-expanded', r ? 'true' : 'false'); }); // „?” w rogu: podpowiedzi klawiszy
  var NAUKA = (typeof K_nauka !== 'undefined') ? K_nauka : null; if (NAUKA) { try { NAUKA.zbuduj($('#nauka')); } catch (e) { NAUKA = null; } } // ekran nauki bez słów (kafle rysowane na żywo, tylko gdy rozwinięty)
  $('#pytajnik').addEventListener('click', function () { var w = $('.wejscie'), r = !w.classList.contains('rozwiniety'); w.classList.toggle('rozwiniety', r); if (NAUKA) { if (r) NAUKA.start(); else NAUKA.stop(); } this.setAttribute('aria-expanded', r ? 'true' : 'false'); }); // „?”: rozsuwa klawisze i boty, GRAJ zsuwa się w dół
  (function () { // logo żyje samo: każda litera wędruje po własnej, nieregularnej ścieżce (suma sinusów o niewspółmiernych okresach), nie za kursorem
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var litery = document.querySelectorAll('#tytul .ch, .logo .ch'), t0 = performance.now();
    function krokLogo(now) { { var t = (now - t0) / 1000; for (var i = 0; i < litery.length; i++) { var f = i * 1.7, mx = 0.5 * Math.sin(t * 0.21 + f) + 0.3 * Math.sin(t * 0.047 + f * 2.3) + 0.2 * Math.sin(t * 0.113 + f * 0.7), my = 0.5 * Math.cos(t * 0.17 + f * 1.3) + 0.3 * Math.sin(t * 0.061 + f) + 0.2 * Math.cos(t * 0.091 + f * 1.9); var sk = litery[i].closest('.marka') ? 0.12 : 1; litery[i].style.setProperty('--mx', (mx * sk).toFixed(3)); litery[i].style.setProperty('--my', (my * sk).toFixed(3)); } } requestAnimationFrame(krokLogo); }
    requestAnimationFrame(krokLogo);
  })();
  function przelaczPodsumowanie() {
    podsumowanieOtwarte = !podsumowanieOtwarte; var n = $('#podsumowanie'); n.classList.toggle('widac', podsumowanieOtwarte);
    if (podsumowanieOtwarte) wypelnijPodsumowanie();
  }
  $('#zamknij').addEventListener('click', przelaczPodsumowanie);
  function wypelnijPodsumowanie() {
    if (!biez) return; var j = biez.ja, s = j.stat, u = biez.pole.udzial, n = u.komorek || 1600;
    var kolor = j.kolor === 'czerwony' ? 'czerwony (wilk)' : j.kolor === 'niebieski' ? 'niebieski (pies pasterski)' : 'szary';
    $('#tabela').innerHTML = [['Twój kolor (widzisz tylko Ty)', kolor], ['Punkty: niebiescy / czerwoni', biez.wynik.niebiescy + ' / ' + biez.wynik.czerwoni], ['Życia', j.zycia], ['Droga do niebieskiego', j.zjadl ? 'zamknięta (zjadłeś)' : j.pies ? 'osiągnięta' : j.partnerzy + ' / ' + B.PROG_PSA + ' różnych partnerów'], ['Współprace (rozświetlenia)', s.wspolprace || 0], ['Pokonane żółte we współpracy', s.zolte], ['Pożarci nadawcy', s.zjedzeni], ['Wilki padłe przy Tobie', s.wilki || 0], ['Twoje padnięcia jako wilk', s.padniecia || 0], ['Pożarcia, które Cię spotkały', s.zdrady], ['Anihilacje przez żółte', s.ugryzienia], ['Podczepienia', s.polaczenia]]
      .map(function (r) { return '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td></tr>'; }).join('');
    var pj = Math.round(u.jasne / n * 100), pc = Math.round(u.ciemne / n * 100), prow = u.jasne > u.ciemne ? 'prowadzi budowanie' : u.ciemne > u.jasne ? 'prowadzi pożeranie' : 'remis';
    $('#pole-opis').textContent = 'Pole bitów: zapalone ' + pj + '% („1”), zgaszone ' + pc + '% („0”), ' + prow + '. Czas gry ' + czasTekst(biez.czas) + '.';
    $('#ksiega').innerHTML = biez.dziennikEpok.length ? biez.dziennikEpok.map(function (w) { return 'epoka ' + w.nr + ' · 1: ' + w.jasne + ' · 0: ' + w.ciemne + ' · ' + w.prowadzi; }).join('<br>') : 'Księga epok: pierwszy wpis po 5 minutach.';
  }
  function pokazKoniec(z) {
    var n = z.komorek || 1, pj = (z.jasne / n * 100), pr = (z.rekord / n * 100), s = biez.ja.stat; $('#tytul3').textContent = z.wygrana ? 'Świt' : 'Koniec rundy'; $('#koniecPod').textContent = z.wygrana ? 'Zapaliłeś ' + Math.round(pj) + '% planszy. Mrok cofnął się do chmur. Czas: ' + czasTekst(z.czasGry || 0) + '.' : '';
    $('#wynikJasne').textContent = pj.toFixed(1) + '%'; $('#wynikRekord').textContent = pr.toFixed(1) + '%';
    $('#wynikTabela').innerHTML = [['Zapalone „1” na koniec', z.jasne + ' komórek'], ['Najwięcej naraz', z.rekord + ' komórek'], ['Współprace', s.wspolprace || 0], ['Pokonane żółte', s.zolte], ['Anihilacje przez żółte', s.ugryzienia], ['Pożarcia, które Cię spotkały', s.zdrady], ['Punkty niebiescy : czerwoni', z.wynik.niebiescy + ' : ' + z.wynik.czerwoni]]
      .map(function (r) { return '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td></tr>'; }).join('');
    $('#koniec').classList.add('widac'); if (DZ) { try { DZ.tlo(false); } catch (e) { /* cisza */ } }
  }
  $('#jeszcze').addEventListener('click', function () { location.hash = location.hash.replace(/ziarno=\d+&?/, ''); location.reload(); });
  function czasTekst(t) { var m = Math.floor(t / 60), s = Math.floor(t % 60); return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s; }

  // ---------- zdarzenia -> efekty i komunikaty ----------
  function obsluzZdarzenia(w) {
    for (var i = 0; i < w.zdarzenia.length; i++) {
      var z = w.zdarzenia[i], od = z.x != null ? dzOdl(z, w.ja) : { sila: 0.8, pan: 0 };
      switch (z.typ) { // dźwięk
        case 'ujawnienie': dz(z.kolor === 'czerwony' ? 'zdrada' : (z.kto === JA || z.partner === JA ? 'kes' : 'ujawnienieNiebieskie'), od); break;
        case 'wolanie': dz('propozycja', od); break; case 'polaczenie': dz('polaczenie', od); break; case 'rozlaczenie': dz('rozlaczenie', od); break; case 'odpychanie': dz('rozlaczenie', od); break;
        case 'zapalenie': dz('zapalenie', od); break; case 'ugryzienie': dz('ugryzienie', od); break; case 'pochloniecie': dz('ugryzienie', od); break; case 'zgasniecie': dz('ugryzienie', od); break; case 'odrodzenie': dz('odrodzenie', od); break;
        case 'narodziny': dz('narodziny', od); break; case 'epoka': dz('epoka', { sila: 0.7, pan: 0 }); break; case 'rozpuszczanie': dz('ukrycie', { sila: 0.5, pan: 0 }); break;
        case 'wezwanie': dz('narodziny', od); break; case 'pies': dz('ujawnienieNiebieskie', { sila: 0.8, pan: 0 }); break;
      }
      switch (z.typ) { // obraz i komunikat
        case 'ujawnienie': efekty.push({ typ: 'wybuch', x: z.x, y: z.y, kolor: z.kolor, t0: czasKlienta, czas: 1.5, r: z.kolor === 'czerwony' ? 110 : 150 }); if (z.padl || (z.ofiara && !z.zerwanie)) rozpad(z.x, z.y, z.padl ? 'czerwony' : 'szary', z.padl ? PIX_CZERWONE : PIX, z.ofiara === JA || z.wilk === JA);
          if (z.zerwanie) { if (z.kto === JA) ustawKomunikat('Zerwałeś tuż przed żółtą i partner w nią wpadł. Jesteś wilkiem, już na zawsze. Punkt dla czerwonych.', 5, true); else if (z.ofiara === JA) ustawKomunikat('Partner zerwał połączenie przed żółtą. Zdrada: jest wilkiem.', 4, true); }
          else if (z.pies === true) { if (z.ofiara === JA) ustawKomunikat(z.powod === 'sfora' ? 'Sfora wilków Cię dopadła. Wracasz jako szary.' : 'W mroku rządzi wilk: pożarł Cię. Wracasz jako szary.', 4, true); else if (z.kto === JA) ustawKomunikat('Pożarłeś psa. Punkt dla czerwonych.', 4, true); }
          else if (z.padl) { if (z.wilk === JA) ustawKomunikat('Padłeś. To był pies pasterski. Wracasz jako szary.', 4, true); else if (z.pies === JA) ustawKomunikat('Wilk padł. Punkt dla niebieskich.', 4, true); }
          else if (z.ofiara === JA) ustawKomunikat('Pożarł Cię partner. Był wilkiem.', 4, true); else if (z.kto === JA && z.kolor === 'czerwony') ustawKomunikat('Pożarłeś partnera. Jesteś wilkiem, już na zawsze bez szansy na niebieski. Punkt dla czerwonych.', 5, true);
          else if (z.kolor === 'niebieski' && (z.kto === JA || z.partner === JA)) ustawKomunikat('Żółta pokonana. Życie dla Was.', 3, true); else if (z.uratowany === JA) ustawKomunikat('Uratowali Cię. Masz dodatkowe życie.', 4, true); break;
        case 'wolanie': efekty.push({ typ: 'fala', x: z.x, y: z.y, kolor: 'bialy', t0: czasKlienta, czas: 2.2, r: 150 });
          if (z.od === JA) ustawKomunikat('Nawołujesz, póki trzymasz Spację. Kto odpowie, dołączy do Ciebie.', 4); else if (od.sila > 0.45 && !w.ja.polaczony) ustawKomunikat(document.body.classList.contains('single') ? 'Szara nadaje z „1”. Wpadnij i wciśnij E albo Spację, zanim zrobi to wilk.' : 'Ktoś nawołuje. Podejdź i wciśnij E, by dołączyć.', 4, true); break;
        case 'polaczenie': efekty.push({ typ: 'puls', x: z.x, y: z.y, kolor: 'niebieski', t0: czasKlienta, czas: 0.9, r: 60 }); ustawKomunikat(document.body.classList.contains('single') ? 'Połączeni. Prowadzisz szarą na smyczy: razem na żółtą.' : z.lider ? 'Ktoś dołączył. Trzymajcie się blisko, razem na żółtą.' : 'Dołączyłeś. Trzymaj się blisko nadawcy, razem na żółtą.', 4); break;
        case 'rozlaczenie': if (z.powod === 'rozwiazanie') ustawKomunikat('Para rozwiązana.', 2.5); else if (z.powod === 'odleglosc') ustawKomunikat('Rozłączeni: za daleko od siebie.', 2.5); break;
        case 'odpychanie': efekty.push({ typ: 'puls', x: z.x, y: z.y, kolor: 'szary', t0: czasKlienta, czas: 0.9, r: 70 }); ustawKomunikat(z.pies === JA ? 'Odepchnięcie: to szary, nie wilk.' : 'Odepchnięcie: to był pies pasterski.', 3.5, true); break;
        case 'wezwanie': efekty.push({ typ: 'fala', x: z.x, y: z.y, kolor: 'bialy', t0: czasKlienta, czas: 2.6, r: 200 }); if (z.para && z.para.indexOf(JA) >= 0) ustawKomunikat(z.zolta ? 'Sygnał poszedł w las. Żółta nadchodzi.' : 'Sygnał poszedł w las. Żadna żółta nie odpowiedziała.', 4, true); break;
        case 'zapalenie': efekty.push({ typ: 'blask', x: z.x, y: z.y, kolor: 'bialy', t0: czasKlienta, czas: 1.1, r: z.promien }); rozpad(z.x, z.y, 'zolty', PIX_ZOLTE, z.kto === JA || z.partner === JA); if (z.kto === JA || z.partner === JA) ustawKomunikat('Współpraca. Pole rozświetlone.', 3, true); break;
        case 'rozpuszczanie': ustawKomunikat('Rozpuszczasz światło. Kto patrzy, może Cię poznać.', 3, true); break;
        case 'ugryzienie': rozpad(z.x, z.y, 'szary', PIX, z.ofiara === JA); if (z.ofiara === JA) ustawKomunikat('Żółta Cię dopadła.', 2.5, true); break;
        case 'odrodzenie': efekty.push({ typ: 'puls', x: z.x, y: z.y, kolor: 'szary', t0: czasKlienta, czas: 1.2, r: 50 }); if (z.dla === JA) ustawKomunikat('Odrodzenie. Zaczynasz z jednym życiem.', 3); break;
        case 'narodziny': efekty.push({ typ: 'puls', x: z.x, y: z.y, kolor: 'zolty', t0: czasKlienta, czas: 1.4, r: 90 }); break;
        case 'zalew': efekty.push({ typ: 'puls', x: z.x, y: z.y, kolor: 'bialy', t0: czasKlienta, czas: 1.2, r: 70 }); break;
        case 'pies': efekty.push({ typ: 'puls', x: z.x, y: z.y, kolor: 'niebieski', t0: czasKlienta, czas: 1.4, r: 80 }); ustawKomunikat('Jesteś niebieski: żółte Cię nie atakują, a wilk, który się do Ciebie podczepi, padnie.', 6, true); break;
        case 'koniec': pokazKoniec(z); break;
        case 'pochloniecie': rozpad(z.x, z.y, 'szary', PIX, z.ofiara === JA); if (z.ofiara === JA) ustawKomunikat(z.bylPies ? 'Pochłonęła Cię czerń. Wracasz jako szary.' : 'Pochłonęła Cię czerń.', 3, true); break;
        case 'zdrada': if (!z.wilk) { if (z.kto === JA) ustawKomunikat('Zerwałeś tuż przed żółtą i partner zginął. Szarzy to zapamiętają.', 4, true); else if (z.ofiara === JA) ustawKomunikat('Partner zerwał połączenie przed żółtą. Zdrada.', 4, true); } break;
        case 'zgasniecie': rozpad(z.x, z.y, z.kolor === 'czerwony' ? 'czerwony' : 'szary', z.kolor === 'czerwony' ? PRYZMAT.czerwony : PIX, z.ofiara === JA); if (z.ofiara === JA) ustawKomunikat('Za długo w „1”: zgasłeś. Wracasz w mrok blisko światła.', 4, true); break;
        case 'zar': efekty.push({ typ: 'blask', x: z.x, y: z.y, kolor: 'bialy', t0: czasKlienta, czas: 1.4, r: z.promien }); break;
        case 'przerwa': ustawKomunikat('Z tą kropką znów dopiero za ' + Math.ceil(z.pozostalo) + ' s.', 2.5, true); break;
        case 'epoka': var e = $('#epoka'); e.textContent = 'Epoka ' + z.wpis.nr + ': ' + (z.wpis.prowadzi === 'remis' ? 'remis' : 'prowadzi ' + z.wpis.prowadzi); e.classList.add('widac'); epokaDo = czasKlienta + 7; break;
      }
    }
  }

  // ---------- smugi komet (za konsylium.ai: iskry stoją w miejscu, rozsypują się i gasną) ----------
  function slad(id, x, y, zycie) {
    var s = slady[id] || (slady[id] = { p: [], n: 0 }), o = s.p.length ? s.p[s.p.length - 1] : null;
    if (!o || Math.hypot(o.x - x, o.y - y) >= 3.4) { s.p.push({ x: x, y: y, t: czasKlienta, k: s.n++ }); if (s.p.length > 44) s.p.shift(); }
    while (s.p.length && czasKlienta - s.p[0].t > zycie) s.p.shift();
    return s;
  }
  function hash(a) { var h = Math.sin(a * 12.9898 + 78.233) * 43758.5453; return h - Math.floor(h); }
  var PIX = ['hsl(208,95%,82%)', 'hsl(228,95%,84%)', 'hsl(262,90%,86%)', 'hsl(300,80%,86%)', 'hsl(45,95%,86%)', 'hsl(190,90%,84%)']; // mieniące się piksele
  var PIX_ZOLTE = ['hsl(45,95%,86%)', 'hsl(38,95%,76%)', 'hsl(55,90%,90%)', 'hsl(28,90%,78%)', 'hsl(48,100%,70%)'], PIX_CZERWONE = ['hsl(0,90%,82%)', 'hsl(350,85%,74%)', 'hsl(18,90%,82%)', 'hsl(332,80%,78%)', 'hsl(5,95%,68%)']; // piksele rozpadu żółtej i wilka
  var PRYZMAT = { szary: PIX, ja: PIX, jaBlask: ['hsl(228,100%,80%)', 'hsl(262,95%,82%)', 'hsl(200,100%,86%)', 'hsl(285,90%,84%)', 'hsl(190,100%,82%)', '#ffffff'], niebieski: ['hsl(215,100%,78%)', 'hsl(230,100%,84%)', 'hsl(200,100%,88%)', 'hsl(250,90%,86%)', 'hsl(190,100%,80%)', 'hsl(0,0%,100%)'], czerwony: ['hsl(0,95%,80%)', 'hsl(350,90%,74%)', 'hsl(18,95%,78%)', 'hsl(332,85%,80%)', 'hsl(30,95%,82%)', 'hsl(0,0%,100%)'] }; // ogon mieni się pryzmatami odcienia kuli
  function rysujSlad(s, zycie, iskra, pal) { pal = pal || PIX; // ruch to piksele wypadające z kuli: kwadraciki w różnych odcieniach, część odlatuje pod kątem, gasną i migoczą
    var p = s.p, n = p.length; if (n < 1) return;
    for (var j = 0; j < n; j++) {
      var q = p[j], u = (czasKlienta - q.t) / zycie; if (u >= 1 || u < 0) continue;
      var h1 = hash(q.k), h2 = hash(q.k * 1.7 + 3), h3 = hash(q.k * 2.3 + 7); if (h1 > 0.84) continue;
      var kat = h2 * TAU, sila = (h3 < 0.3 ? 48 : 16) * iskra, drift = u * u * sila;
      var e = ekran(q.x + Math.cos(kat) * drift, q.y + Math.sin(kat) * drift);
      var sz = (2.8 * (1 - u * 0.65) + 1.1) * iskra * kam.s, mig = REDUKCJA ? 0.8 : 0.55 + 0.45 * Math.sin(czasKlienta * 9 + q.k * 1.3);
      ctx.fillStyle = pal[(q.k + Math.floor(czasKlienta * 2.5)) % pal.length]; ctx.globalAlpha = Math.pow(1 - u, 1.4) * 0.95 * mig; // barwy przesuwają się w czasie: pryzmat
      ctx.fillRect(Math.round(e[0] - sz / 2), Math.round(e[1] - sz / 2), Math.ceil(sz), Math.ceil(sz));
    }
    ctx.globalAlpha = 1;
  }
  function rysujSmugeMiekka(s, zyc, r0) { // miękki świetlisty ślad żółtej: zanikające poświaty, bez wstęgi i iskier
    var p = s.p; ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < p.length; i++) { var u = (czasKlienta - p[i].t) / zyc; if (u >= 1 || u < 0) continue; var e = ekran(p[i].x, p[i].y), g = r0 * (1 - u * 0.7) * kam.s * 2.0; ctx.globalAlpha = Math.pow(1 - u, 2.2) * 0.2; ctx.drawImage(SPR.posw.zolty, e[0] - g, e[1] - g, g * 2, g * 2); }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  }
  // ---------- rysowanie ----------
  function lerp(a, b, t) { return a + (b - a) * t; }
  function pozycje(w0, w1, t) { // interpolacja między dwoma kolejnymi widokami (symulacja 30 Hz, rysowanie 60 Hz)
    var map = {}; if (w0) { w0.inni.forEach(function (o) { map[o.id] = o; }); w0.zolte.forEach(function (o) { map[o.id] = o; }); map[JA] = w0.ja; }
    function L(o) { var p = map[o.id]; return p ? { x: lerp(p.x, o.x, t), y: lerp(p.y, o.y, t) } : { x: o.x, y: o.y }; }
    return { ja: L(w1.ja), inni: w1.inni.map(function (o) { var q = L(o); q.o = o; return q; }), zolte: w1.zolte.map(function (o) { var q = L(o); q.o = o; return q; }) };
  }
  // ---------- tło WebGL: płynące fraktalne mgławice (szum fbm z zawinięciem, jak tło iapply.pl) i fraktalne plamy mroku (czarne dziury) ----------
  var GLT = (function () {
    var c = plotno(2, 2), gl = null;
    try { gl = c.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' }); } catch (e) { gl = null; }
    if (!gl) return null;
    var VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
    var FS = '#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\n' +
      'uniform vec2 r;uniform float t;uniform vec2 cam;uniform vec3 c0,c1,c2,c3;uniform int nd;uniform vec3 dz[12];uniform vec4 brd;uniform float pas;uniform sampler2D nz;' +
      'float h(vec2 p){return texture2D(nz,(mod(p,256.)+.5)/256.).r;}' + // hasz z tekstury szumu: na mobilnych GPU fract(sin(duże)) rozpadał się w kwadraty

      'float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1.,0.)),f.x),mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),f.x),f.y);}' +
      'float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*n(p);p=p*2.02+vec2(1.7,9.2);a*=.5;}return v;}' +
      'void main(){vec2 fc=gl_FragCoord.xy;vec3 col=c0;float cov=0.;float densN=0.;' +
      // trzy plany mgławicy (daleki, średni, bliski): własna paralaksa, skala i tempo; czerń między obłokami zostaje (głębia, 3D)
      'for(int k=0;k<3;k++){float fk=float(k);float par=.16+.14*fk;vec2 uv=(fc+cam*par)/r.y*(1.9-.38*fk)+vec2(7.3*fk,2.1*fk);float s=t*(.012+.007*fk);' +
      'vec2 q=vec2(fbm(uv+s),fbm(uv+vec2(5.2,1.3)-s));' +
      'vec2 w=vec2(fbm(uv+3.*q+vec2(1.7,9.2)+.8*s),fbm(uv+3.*q+vec2(8.3,2.8)-.6*s));' +
      'float f=fbm(uv+3.*w);' +
      'float dens=smoothstep(.34+.04*fk,.8,f);float lane=smoothstep(.48,.62,fbm(uv*2.2+w*1.5+vec2(3.3,fk)));dens*=1.-.55*lane;' +
      'vec3 lc=mix(c1,c2,smoothstep(.3,.9,length(q)));lc=mix(lc,c3,.5*smoothstep(.55,1.,w.x*f*2.));' +
      'float hb=fbm(uv*.42+vec2(11.3,4.7)+s*.25);float hr=fbm(uv*.5+vec2(3.7,8.9)-s*.2);float mb=smoothstep(.5,.86,hb),mr=smoothstep(.54,.9,hr);' +
      'lc=mix(lc,vec3(.14,.26,.66),mb*.7);lc=mix(lc,vec3(.52,.12,.26),mr*.7);lc*=.55+.45*fk;' +
      'col=mix(col,lc,dens*(.75-.15*cov));' +
      'if(k>0){float fil=pow(1.-abs(2.*fbm(uv*2.3+w*1.4+vec2(s*.5,-s*.3))-1.),3.5);float jadro=smoothstep(.55,.95,fbm(uv*.7+q*.8+s*.4));' +
      'vec3 fio=mix(vec3(.46,.26,.78),vec3(.72,.34,.62),.5+.5*sin(t*.07+q.x*4.+uv.y*2.));fio=mix(fio,vec3(.30,.46,.96),mb*.8);fio=mix(fio,vec3(.92,.30,.40),mr*.8);' +
      'col+=fio*fil*(.16+.26*jadro)*dens*(.6+.4*fk);col+=mix(vec3(.30,.16,.50),vec3(.14,.26,.66),mb)*jadro*dens*.2;}' +
      'if(k==2)densN=dens;cov=max(cov,dens);}' +
      'float dark=0.;for(int i=0;i<12;i++){if(i>=nd)break;vec2 d=fc-dz[i].xy;float R=dz[i].z;float m=fbm((fc+cam*.1)/(R*1.1)+vec2(float(i)*3.1,t*.06));float e=length(d)/(R*(.62+.45*m));dark+=1.-smoothstep(.5,1.08,e);}' +
      'dark=clamp(dark,0.,1.);col*=1.-dark*.93;' +
      // granica planszy: zaokrąglona odległość od prostokąta (bez zacięć w rogach); poza planszą mgławica gaśnie łagodnie, ciągle już od wnętrza (bez załamania na ściance)
      'vec2 dd=max(vec2(brd.x-fc.x,brd.y-fc.y),vec2(fc.x-brd.z,fc.y-brd.w));float od=length(max(dd,0.))+min(max(dd.x,dd.y),0.);' +
      'float ob=smoothstep(-pas*.3,pas*1.2,od);col*=1.-ob*.9;' +
      // wpluwanie: fiolet wchodzi ze ścianek do środka wolnymi falami (okres ok. 30 s) i rozświetla fraktale najbliższego planu mgławicy w jej tempie; bez progu odcięcia (ciągłe); za ścianką tylko cienki błękit
      'float win=exp(-max(-od,0.)/(pas*1.4))*(1.-smoothstep(0.,pas*.4,od));float puls=.5+.5*sin(od/pas*2.+t*.25);' +
      'float hb1=fbm((fc+cam*.35)*.004+vec2(t*.008,-t*.006));vec3 fio=mix(vec3(.42,.22,.78),vec3(.62,.30,.86),hb1);' +
      'col+=fio*win*(.35+.65*puls)*(.25+.75*densN)*.9;' +
      'float wout=exp(-max(od,0.)/(pas*.22))*smoothstep(-pas*.1,pas*.05,od);col+=vec3(.30,.40,.95)*wout*(.4+.6*hb1)*.6;' +
      'col+=(h(fc+t)-.5)/255.;gl_FragColor=vec4(col,1.);}';
    function sh(type, src) { var x = gl.createShader(type); gl.shaderSource(x, src); gl.compileShader(x); if (gl.getShaderParameter(x, gl.COMPILE_STATUS)) return x; try { console.error('Komet: shader tła', gl.getShaderInfoLog(x)); } catch (e) {} return null; }
    var v = sh(gl.VERTEX_SHADER, VS), f = sh(gl.FRAGMENT_SHADER, FS); if (!v || !f) return null;
    var pr = gl.createProgram(); gl.attachShader(pr, v); gl.attachShader(pr, f); gl.linkProgram(pr); if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return null;
    gl.useProgram(pr);
    var bf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    var U = {}; ['r', 't', 'cam', 'c0', 'c1', 'c2', 'c3', 'nd', 'dz', 'brd', 'pas', 'nz'].forEach(function (k) { U[k] = gl.getUniformLocation(pr, k); });
    (function () { // tekstura szumu 256x256 (ziarno stałe): dokładny hasz dla szumu wartości na każdym GPU
      var tx = gl.createTexture(), dane = new Uint8Array(256 * 256 * 4); for (var i = 0; i < dane.length; i++) dane[i] = Math.floor(hash(i * 0.731 + 3.1) * 256);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tx); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 256, 0, gl.RGBA, gl.UNSIGNED_BYTE, dane);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
      gl.uniform1i(U.nz, 0);
    })();
    function hex(x) { return [parseInt(x.slice(1, 3), 16) / 255, parseInt(x.slice(3, 5), 16) / 255, parseInt(x.slice(5, 7), 16) / 255]; }
    var PAL = ['#07060b', '#1a1130', '#38204f', '#47142d'].map(hex), w0 = 0, h0 = 0, SK = 0.5, DZ = new Float32Array(36); // czerń, głęboki fiolet, fiolet, karmin
    return { c: c, sk: SK, jakosc: function (x) { SK = x; this.sk = x; }, rysuj: function (t, dziury) {
      var w = Math.max(2, Math.round(W * SK)), h = Math.max(2, Math.round(H * SK));
      if (w !== w0 || h !== h0) { w0 = w; h0 = h; c.width = w; c.height = h; gl.viewport(0, 0, w, h); }
      gl.uniform2f(U.r, w, h); gl.uniform1f(U.t, REDUKCJA ? 20 : t * 0.8 + 20);
      gl.uniform2f(U.cam, ((kam.x - B.SWIAT / 2) * kam.s - kam.wx) * SK, -((kam.y - B.SWIAT / 2) * kam.s - kam.wy) * SK); // paralaksę planów liczy shader; wstrząs też przez cam
      gl.uniform3f(U.c0, PAL[0][0], PAL[0][1], PAL[0][2]); gl.uniform3f(U.c1, PAL[1][0], PAL[1][1], PAL[1][2]); gl.uniform3f(U.c2, PAL[2][0], PAL[2][1], PAL[2][2]); gl.uniform3f(U.c3, PAL[3][0], PAL[3][1], PAL[3][2]);
      var n = Math.min(12, dziury.length); if (dziury.length > 12) dziury = dziury.slice().sort(function (a, b) { return (Math.hypot(a.x - kam.x, a.y - kam.y) - a.r) - (Math.hypot(b.x - kam.x, b.y - kam.y) - b.r); }); // najbliższe kamerze
      for (var i = 0; i < 12; i++) { if (i < n) { var e = ekran(dziury[i].x, dziury[i].y); DZ[i * 3] = e[0] * SK; DZ[i * 3 + 1] = (H - e[1]) * SK; DZ[i * 3 + 2] = Math.max(2, dziury[i].r * kam.s * SK); } else { DZ[i * 3] = -9999; DZ[i * 3 + 1] = -9999; DZ[i * 3 + 2] = 1; } }
      gl.uniform1i(U.nd, n); gl.uniform3fv(U.dz, DZ);
      var a0 = ekran(0, 0), b0 = ekran(B.SWIAT, B.SWIAT); gl.uniform4f(U.brd, a0[0] * SK, (H - b0[1]) * SK, b0[0] * SK, (H - a0[1]) * SK); gl.uniform1f(U.pas, 270 * kam.s * SK); // prostokąt planszy (GL: y od dołu) i pas mroku
      gl.drawArrays(gl.TRIANGLES, 0, 3); return true;
    } };
  })();
  var GWIAZDY = null;
  function rysujGwiazdy(t) { // pył gwiezdny jako warstwa 2D w pełnej rozdzielczości: rozsiany losowo, mały (0,5-1,8 px), najdalszy plan (paralaksa 0,08), migotanie, kilka cieplejszych
    if (!GWIAZDY) { GWIAZDY = []; for (var i = 0; i < 1200; i++) GWIAZDY.push({ fx: hash(i * 7.13 + 0.3), fy: hash(i * 3.31 + 1.7), sz: 0.5 + Math.pow(hash(i * 5.71 + 2.1), 2.2) * 1.3, tw: hash(i * 9.17 + 3.3), c: hash(i * 2.71 + 4.4) }); }
    var TW = W + 600, TH = H + 400, ox = -(kam.x - B.SWIAT / 2) * 0.08 * kam.s, oy = -(kam.y - B.SWIAT / 2) * 0.08 * kam.s, n = Math.min(GWIAZDY.length, Math.round(W * H / 1400));
    for (var k = 0; k < n; k++) { var g = GWIAZDY[k], x = ((g.fx * TW + ox) % TW + TW) % TW - 300, y = ((g.fy * TH + oy) % TH + TH) % TH - 200; if (x < -2 || y < -2 || x > W + 2 || y > H + 2) continue;
      var m = REDUKCJA ? 0.7 : 0.45 + 0.55 * Math.sin(t * (0.6 + g.tw * 2.2) + g.tw * 40); ctx.globalAlpha = (0.25 + 0.6 * m) * (0.5 + g.sz * 0.4); ctx.fillStyle = g.c > 0.85 ? '#ffd9b0' : g.c > 0.6 ? '#c9d6ff' : '#f2f4ff'; ctx.fillRect(x, y, g.sz, g.sz); }
    ctx.globalAlpha = 1;
  }
  function rysujTlo(t, w) {
    if (GLT && GLT.rysuj(t, w && w.dziury ? w.dziury : [])) { ctx.drawImage(GLT.c, 0, 0, W, H); rysujGwiazdy(t); rysujMechanizmy(t); return; }
    ctx.fillStyle = KOLOR.tlo; ctx.fillRect(0, 0, W, H); // zapas bez WebGL: mgławice z gradientów
    var par = 0.06, cx = W / 2 - (kam.x - B.SWIAT / 2) * par, cy = H / 2 - (kam.y - B.SWIAT / 2) * par, R0 = Math.max(W, H);
    ctx.globalCompositeOperation = 'screen';
    [[0.9, 0.35, 0.26, '112,64,190'], [-0.7, 0.55, 0.2, '150,34,82'], [0.3, -0.75, 0.17, '52,36,120']].forEach(function (m, i) {
      var x = cx + Math.cos(t * 0.05 + i * 2.1) * W * 0.25 * m[0], y = cy + Math.sin(t * 0.04 + i * 1.7) * H * 0.3 * m[1];
      var g = ctx.createRadialGradient(x, y, 0, x, y, R0 * 0.62); g.addColorStop(0, 'rgba(' + m[3] + ',' + m[2] + ')'); g.addColorStop(1, 'rgba(' + m[3] + ',0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    });
    ctx.globalCompositeOperation = 'source-over';
    rysujMechanizmy(t);
  }
  // orbity: cienkie świetliste okręgi o zmiennej jasności, podziałki i dekoracyjne komety krążące po nich (efekt z konsylium.ai)
  var ORB = [];
  function poswiataHsl(hue, rozmiar) {
    var c = plotno(rozmiar, rozmiar), x = c.getContext('2d'), g = x.createRadialGradient(rozmiar / 2, rozmiar / 2, 0, rozmiar / 2, rozmiar / 2, rozmiar / 2);
    g.addColorStop(0, 'hsla(' + hue + ',100%,84%,1)'); g.addColorStop(0.2, 'hsla(' + hue + ',100%,72%,.5)'); g.addColorStop(1, 'hsla(' + hue + ',100%,62%,0)');
    x.fillStyle = g; x.fillRect(0, 0, rozmiar, rozmiar); return c;
  }
  var SPR_KOM = { 208: poswiataHsl(208, 64), 228: poswiataHsl(228, 64), 262: poswiataHsl(262, 64) };
  (function orbity() {
    var los = S.rng(ZIARNO + 23), n = 11;
    for (var m = 0; m < n; m++) {
      var R = m === 0 ? 620 : 140 + los() * 380, pad = 30, size = Math.ceil((R + pad) * 2), c = plotno(size, size), x = c.getContext('2d'), cx = size / 2, cy = size / 2;
      var kregi = 1 + Math.floor(los() * 3), rings = [], k, i;
      x.lineWidth = 1; x.lineCap = 'round';
      for (k = 0; k < kregi; k++) {
        var rr = k === 0 ? R : R * (0.45 + 0.45 * los()); rings.push(rr);
        var segs = 72, a0 = los() * TAU; // jasność zmienna wzdłuż okręgu: łuk światła, nie jednolita kreska
        for (i = 0; i < segs; i++) { var a = i / segs * TAU, al = 0.04 + 0.14 * Math.pow(0.5 + 0.5 * Math.sin(a + a0), 2); x.strokeStyle = 'rgba(186,160,236,' + al.toFixed(3) + ')'; x.beginPath(); x.arc(cx, cy, rr, a, a + TAU / segs + 0.01); x.stroke(); }
        if (los() < 0.5) { var nt = 36 + Math.floor(los() * 60); x.strokeStyle = 'rgba(186,160,236,0.08)'; x.beginPath(); for (i = 0; i < nt; i++) { var aa = i / nt * TAU, l = i % 9 === 0 ? 9 : 3; x.moveTo(cx + Math.cos(aa) * rr, cy + Math.sin(aa) * rr); x.lineTo(cx + Math.cos(aa) * (rr - l), cy + Math.sin(aa) * (rr - l)); } x.stroke(); }
      }
      var komety = [], nk = 1 + Math.floor(los() * 2);
      for (k = 0; k < nk; k++) komety.push({ r: rings[Math.floor(los() * rings.length)], v: (0.03 + los() * 0.05) * (los() < 0.5 ? 1 : -1), f: los() * TAU, hue: [208, 228, 262][Math.floor(los() * 3)] });
      ORB.push({ c: c, x: m === 0 ? B.SWIAT / 2 : 200 + los() * (B.SWIAT - 400), y: m === 0 ? B.SWIAT / 2 : 200 + los() * (B.SWIAT - 400), R: R + pad, komety: komety });
    }
  })();
  var ORBITY = false; // orbity z kometami w tle wyłączone (decyzja właściciela 18.10); kod zostaje na przyszłość
  function rysujMechanizmy(t) {
    if (!ORBITY) return;
    for (var i = 0; i < ORB.length; i++) {
      var o = ORB[i], e = ekran(o.x, o.y), rr = o.R * kam.s;
      if (e[0] + rr < 0 || e[0] - rr > W || e[1] + rr < 0 || e[1] - rr > H) continue;
      ctx.drawImage(o.c, e[0] - rr, e[1] - rr, rr * 2, rr * 2);
      ctx.globalCompositeOperation = 'lighter';
      for (var k = 0; k < o.komety.length; k++) { // dekoracyjna kometa: iskry stoją na orbicie, rozsypują się i gasną; głowa z poświatą
        var km = o.komety[k], an = km.f + (REDUKCJA ? 0 : t * km.v * TAU), rk = km.r * kam.s, znak = km.v < 0 ? -1 : 1;
        ctx.fillStyle = 'hsl(' + km.hue + ',90%,82%)';
        for (var m = 1; m <= 14; m++) {
          var u = m / 14, hs = hash(m * 7.1 + k * 3 + i * 11); if (hs > 0.78 && m > 3) continue;
          var ak = an - m * 0.02 * znak, drift = u * u * 10 * kam.s, px = e[0] + Math.cos(ak) * rk + (hs - 0.5) * drift, py = e[1] + Math.sin(ak) * rk + (hash(hs * 3 + m) - 0.5) * drift;
          ctx.globalAlpha = Math.pow(1 - u, 1.6) * 0.6; ctx.beginPath(); ctx.arc(px, py, (1.6 * (1 - u * 0.7) + 0.4) * kam.s, 0, TAU); ctx.fill();
        }
        var hx = e[0] + Math.cos(an) * rk, hy = e[1] + Math.sin(an) * rk, gr = (5 + 3 * (0.5 + 0.5 * Math.sin(t * 0.8 + k + i))) * kam.s;
        ctx.globalAlpha = 0.75; ctx.drawImage(SPR_KOM[km.hue], hx - gr, hy - gr, gr * 2, gr * 2);
      }
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    }
  }
  function rysujBity(w, t) {
    var p = STAT.pole, wart = w.pole.w, k = p.k, s = kam.s, roz = 28 * s, i0 = Math.max(0, Math.floor((kam.x - W / 2 / s) / k) - 1), i1 = Math.min(p.n - 1, Math.floor((kam.x + W / 2 / s) / k) + 1);
    var j0 = Math.max(0, Math.floor((kam.y - H / 2 / s) / k) - 1), j1 = Math.min(p.n - 1, Math.floor((kam.y + H / 2 / s) / k) + 1), i, j, idx, v, e;
    // ciemne plamy i światło pod glifami
    for (j = j0; j <= j1; j++) for (i = i0; i <= i1; i++) { idx = j * p.n + i; v = wart[idx]; if (v > -0.05 && v < 0.05) continue; e = ekran((i + 0.5) * k, (j + 0.5) * k);
      if (v < 0) { ctx.globalAlpha = Math.min(1, -v) * 0.75; ctx.drawImage(SPR.posw.czarny, e[0] - 70 * s, e[1] - 70 * s, 140 * s, 140 * s); }
    }
    if (!GLT) {
    // czarne dziury: ruchome plamy mroku (jak plamy w tle iapply.pl), trzy nachodzące kleksy z wolnym falowaniem
    for (var h = 0; h < w.dziury.length; h++) {
      var dz = w.dziury[h], f = (parseInt(dz.id.slice(1), 10) || 0) * 1.7;
      for (var q = 0; q < 3; q++) {
        var fx = q ? Math.cos(t * 0.5 + f + q * 2.1) * dz.r * 0.35 : 0, fy = q ? Math.sin(t * 0.4 + f + q * 1.3) * dz.r * 0.35 : 0, rr = dz.r * (q ? 0.75 : 1.05) * s;
        e = ekran(dz.x + fx, dz.y + fy); ctx.globalAlpha = 0.9; ctx.drawImage(SPR.posw.czarny, e[0] - rr * 1.5, e[1] - rr * 1.5, rr * 3, rr * 3);
      }
    }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'lighter';
    var tanio = REDUKCJA || (i1 - i0 + 1) * (j1 - j0 + 1) > 700; // dużo komórek na ekranie: tańsze rysowanie (wydajność, 19.10 04:00)
    for (j = j0; j <= j1; j++) for (i = i0; i <= i1; i++) { idx = j * p.n + i; v = wart[idx]; if (v <= B.PROG_SWIATLA) continue; e = ekran((i + 0.5) * k, (j + 0.5) * k);
      var kraw = !tanio || (i > 0 && wart[idx - 1] <= B.PROG_SWIATLA) || (i < p.n - 1 && wart[idx + 1] <= B.PROG_SWIATLA) || (j > 0 && wart[idx - p.n] <= B.PROG_SWIATLA) || (j < p.n - 1 && wart[idx + p.n] <= B.PROG_SWIATLA);
      if (kraw) { ctx.globalAlpha = Math.min(1, v) * 0.28; ctx.drawImage(SPR.posw.bialy, e[0] - 80 * s, e[1] - 80 * s, 160 * s, 160 * s); } else { ctx.globalAlpha = Math.min(1, v) * 0.22; ctx.drawImage(SPR.posw.bialy, e[0] - 44 * s, e[1] - 44 * s, 88 * s, 88 * s); } } // pełna poświata na brzegu plamy, wnętrze mniejszą (4x tańszą), żadnych pudełek
    ctx.globalCompositeOperation = 'source-over';
    // glify 0/1: przygaszone w stanie neutralnym, „1” jasne w świetle, znikają w ciemności
    for (j = j0; j <= j1; j++) for (i = i0; i <= i1; i++) {
      idx = j * p.n + i; v = wart[idx]; var baza = p.baza[idx], wid = p.widoczne[idx];
      if (!wid && v <= 0.05) continue;
      var hc = hash(idx * 0.618 + 1), hc2 = hash(idx * 1.3 + 7), fl = REDUKCJA ? 0.5 : 0.5 + 0.5 * Math.sin(t * (0.4 + 0.5 * hc) + idx * 0.37), al, spr, sk = 0.85 + 0.35 * hc2;
      e = ekran((i + 0.5) * k, (j + 0.5) * k);
      if (v > B.PROG_SWIATLA) { al = Math.min(1, 0.3 + 0.7 * v) * (0.85 + 0.15 * fl); ctx.globalAlpha = al; ctx.drawImage(SPR.glif['1jasny'], e[0] - roz * 0.5, e[1] - roz * 0.6, roz, roz * 1.2); continue; } // „1” tam, gdzie działa ochrona
      var baza0 = v < -0.05 ? Math.max(0, 0.14 * (1 + v)) : (0.06 + 0.2 * hc); // zera: każda komórka z własną przezroczystością, w mroku gasną
      al = baza0 * (0.7 + 0.3 * fl); if (al < 0.01) continue;
      var w0 = roz * sk, h0 = roz * 1.2 * sk;
      if (tanio) { ctx.globalAlpha = al; ctx.drawImage(SPR.glif['0pelny'], e[0] - w0 * 0.5, e[1] - h0 * 0.5, w0, h0); continue; } // zero z wtopionymi cieniami
      if (hc2 > 0.86) { ctx.globalAlpha = al * 0.12; var px = (kam.x - B.SWIAT / 2) * 0.06 * kam.s, py = (kam.y - B.SWIAT / 2) * 0.06 * kam.s; ctx.drawImage(SPR.glif['0dim'], e[0] + px - w0 * 0.9, e[1] + py - h0 * 0.9, w0 * 1.8, h0 * 1.8); } // duch: większa, bledsza warstwa z paralaksą
      var fc1 = REDUKCJA ? 0 : czasKlienta * 0.05 + hc2 * 6.28, fc2 = REDUKCJA ? 0 : -czasKlienta * 0.03 + hc2 * 9.4; // dwa cienie krążą bardzo powoli po elipsach, każdy w swoją stronę
      ctx.globalAlpha = al * 0.48; ctx.drawImage(SPR.glif['0cien'], e[0] + (1.6 + Math.cos(fc1) * 1.1) * kam.s - w0 * 0.5, e[1] + (2.2 + Math.sin(fc1) * 0.7) * kam.s - h0 * 0.5, w0, h0);
      ctx.globalAlpha = al * 0.26; ctx.drawImage(SPR.glif['0cien'], e[0] + (-1.2 + Math.cos(fc2) * 2.4) * kam.s - w0 * 0.5, e[1] + (1.0 + Math.sin(fc2) * 1.5) * kam.s - h0 * 0.5, w0, h0);
      ctx.globalAlpha = al; spr = SPR.glif['0dim']; ctx.drawImage(spr, e[0] - w0 * 0.5, e[1] - h0 * 0.5, w0, h0);
    }
    ctx.globalAlpha = 1;
  }
  function rysujBrzeg() { // czarna obwódka planszy: poza granicą pełna czerń, do wewnątrz łagodne przejście przez pas mroku
    var S0 = B.SWIAT, pas = (B.BRZEG_MROKU + 120) * kam.s, a = ekran(0, 0), b = ekran(S0, S0), g;
    ctx.fillStyle = '#000';
    if (a[0] > 0) ctx.fillRect(0, 0, a[0], H); if (b[0] < W) ctx.fillRect(b[0], 0, W - b[0], H); if (a[1] > 0) ctx.fillRect(0, 0, W, a[1]); if (b[1] < H) ctx.fillRect(0, b[1], W, H - b[1]);
    g = ctx.createLinearGradient(a[0], 0, a[0] + pas, 0); g.addColorStop(0, 'rgba(0,0,0,.96)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(a[0], 0, pas, H);
    g = ctx.createLinearGradient(b[0], 0, b[0] - pas, 0); g.addColorStop(0, 'rgba(0,0,0,.96)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(b[0] - pas, 0, pas, H);
    g = ctx.createLinearGradient(0, a[1], 0, a[1] + pas); g.addColorStop(0, 'rgba(0,0,0,.96)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, a[1], W, pas);
    g = ctx.createLinearGradient(0, b[1], 0, b[1] - pas); g.addColorStop(0, 'rgba(0,0,0,.96)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, b[1] - pas, W, pas);
  }
  function rysujPrzeszkody() { if (!STAT.przeszkody.length) return; var e = ekran(0, 0); ctx.drawImage(warstwaPrzeszkod, e[0], e[1], B.SWIAT * kam.s, B.SWIAT * kam.s); }
  function rysujSlonce(x, y, r, alfaPosw, t, fz) { // korona pod spodem (lighter), tarcza z dwoma przenikającymi się odcieniami, wolny oddech
    var e = ekran(x, y), rs = r * kam.s, tw = REDUKCJA ? 0.5 : 0.5 + 0.5 * Math.sin(t * 0.7 + fz), hu = REDUKCJA ? 0.5 : 0.5 + 0.5 * Math.sin(t * 0.35 + fz * 1.3);
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = alfaPosw * (0.7 + 0.3 * tw); var gr = rs * (3.4 + 0.3 * tw); ctx.drawImage(SPR.posw.zolty, e[0] - gr, e[1] - gr, gr * 2, gr * 2);
    ctx.globalCompositeOperation = 'source-over';
    var rk = rs * 1.75 * (1 + 0.03 * tw);
    ctx.globalAlpha = 1 - hu; ctx.drawImage(SPR.slonce[0], e[0] - rk, e[1] - rk, rk * 2, rk * 2);
    ctx.globalAlpha = hu; ctx.drawImage(SPR.slonce[1], e[0] - rk, e[1] - rk, rk * 2, rk * 2);
    ctx.globalAlpha = 1;
  }
  // każda kulka to trzy płaszczyzny: tył (duża, przejrzysta, wolne mienienie), ciało (główna barwa) i przód (jasny rdzeń, szybkie mienienie);
  // każda w innej barwie i z innym rytmem, lekko dryfują względem siebie: głębia, hipnoza
  var WARSTWY = { szary: ['#8e86b8', '#b4bac8', '#f2f4ff'], ja: ['#9a93c6', '#cdd3e2', '#ffffff'], niebieski: ['#2e4fd6', '#5b8cff', '#b9d4ff'], czerwony: ['#b03a4a', '#ff6a5a', '#ffd2c8'], zolty: ['#d98a1a', '#f7c43a', '#fff0bd'] };
  function kulaWarstwa(kolor, rozmiar) {
    var c = plotno(rozmiar, rozmiar), x = c.getContext('2d'), r = rozmiar / 2, g = x.createRadialGradient(r, r, 0, r, r, r);
    g.addColorStop(0, kolor); g.addColorStop(0.5, kolor + 'e6'); g.addColorStop(0.82, kolor + '59'); g.addColorStop(1, kolor + '00');
    x.fillStyle = g; x.fillRect(0, 0, rozmiar, rozmiar); return c;
  }
  SPR.warstwy = {}; (function () { for (var k in WARSTWY) SPR.warstwy[k] = [kulaWarstwa(WARSTWY[k][0], 128), kulaWarstwa(WARSTWY[k][1], 128), kulaWarstwa(WARSTWY[k][2], 96)]; })();
  var LOBY = { szary: ['#5c63c8', '#d9b3ff'], ja: ['#6a74d8', '#eecbff'], niebieski: ['#2f8cff', '#b8d0ff'], czerwony: ['#ff3d5a', '#ffb3a0'], zolty: ['#ff9a2e', '#fff1b0'] }; // barwne obłoki krążące wewnątrz halo (mienienie, głębia)
  SPR.loby = {}; (function () { for (var k in LOBY) SPR.loby[k] = [kulaWarstwa(LOBY[k][0], 96), kulaWarstwa(LOBY[k][1], 96)]; })(); SPR.cien = kulaWarstwa('#000000', 64);
  var PALETY = { // palety warstw kul: mgła koronalna (2), loby (4), ziarna (3), ciało (3); kula gracza jak słońce w swoim odcieniu
    zolty: { mgla: ['#ff9a2e', '#ffd36b'], loby: ['#ff7a1a', '#ffc247', '#fff0b3', '#ff9f5a'], ziarna: ['#ffe28a', '#ffb347', '#fff7d6'], cialo: ['#f7c43a', '#ffd86a', '#fff0bd'], tony: ['#ffffff', '#fff1b0', '#ffd36b'], ognie: ['#fff7d6', '#ffd36b', '#ff9a2e', '#ffffff', '#ffb347', '#ff6a3d'] },
    ja: { mgla: ['#8e86b8', '#cdd3e2'], loby: ['#6b98ff', '#d9b3ff', '#ffffff', '#9ad7ff'], ziarna: ['#ffffff', '#bcd9ff', '#e6d6ff'], cialo: ['#9a93c6', '#cdd3e2', '#ffffff'], tony: ['#ffffff', '#cfe6ff', '#e9d6ff'], ognie: ['#ffffff', '#cfe6ff', '#bcd9ff', '#d9b3ff', '#9ad7ff', '#e9d6ff'] },
    jaBlask: { mgla: ['#4a5cff', '#9a7cff'], loby: ['#5b8cff', '#8a5cff', '#d08cff', '#5ad7ff'], ziarna: ['#9ad7ff', '#d9b3ff', '#5af0ff'], cialo: ['#9a93c6', '#cdd3e2', '#ffffff'], tony: ['#ffffff', '#9fd0ff', '#d9b3ff'], ognie: ['#ffffff', '#9fd0ff', '#5ad7ff', '#8a5cff', '#d9b3ff', '#5b8cff'] }, // blask gracza: płomienie w błękit, indygo i fiolet (rdzeń zostaje)
    niebieski: { mgla: ['#2e4fd6', '#5b8cff'], loby: ['#2f8cff', '#5fd0ff', '#4a5cff', '#a8c8ff'], ziarna: ['#9fd0ff', '#5fa8ff', '#d6ecff'], cialo: ['#2a46c8', '#3f7bff', '#8fc0ff'], blask: '#6fb0ff', rdzen: ['#5b9cff', '#dff0ff'], ognie: ['#dff0ff', '#9fd0ff', '#5b9cff', '#ffffff'] }, // pies: niebieski także w środku (gradienty i warstwy, bez białego rdzenia)
    czerwony: { mgla: ['#b03a4a', '#ff6a5a'], loby: ['#ff3d5a', '#ffb3a0', '#ff8a3d', '#c0203a'], ziarna: ['#ffd2c8', '#ff9f8a', '#ff6a3d'], cialo: ['#8a1f30', '#ff4a4a', '#ff9f8a'], blask: '#ff7a60', rdzen: ['#ff5a5a', '#ffe0d8'], ognie: ['#ffe0d8', '#ff8a70', '#ff5a5a', '#ffb3a0'] } }; // wilk: czerwień z czernią, rdzeń czerwony
  SPR.gwiazdy = {}; (function () { for (var k in PALETY) { var g = PALETY[k]; SPR.gwiazdy[k] = { kolory: g, tony: (g.tony || ['#ffffff']).map(function (c) { return kula(c, '#ffffff', 32); }), blask: g.blask ? kulaWarstwa(g.blask, 96) : null, rdzen: g.rdzen ? kula(g.rdzen[0], g.rdzen[1], 32) : null, mgla: g.mgla.map(function (c) { return kulaWarstwa(c, 128); }), loby: g.loby.map(function (c) { return kulaWarstwa(c, 96); }), ziarna: g.ziarna.map(function (c) { return kulaWarstwa(c, 48); }), cialo: g.cialo.map(function (c) { return kulaWarstwa(c, 128); }) }; } })();
  function warstwa(img1, img2, mix, x, y, w, h, alfa) { // warstwa z dwóch palet zmieszanych wagą mix (blask gracza)
    if (!img2 || mix <= 0) { ctx.globalAlpha = alfa; ctx.drawImage(img1, x, y, w, h); return; }
    if (mix < 1) { ctx.globalAlpha = alfa * (1 - mix); ctx.drawImage(img1, x, y, w, h); } ctx.globalAlpha = alfa * mix; ctx.drawImage(img2, x, y, w, h);
  }
  var SPR_PIERSCIENIE = {};
  function pierscienWarstwa(kolor, rozmiar) { // miękka obręcz: przezroczysty środek, barwny brzeg, łagodnie gasnący
    var k = kolor + rozmiar; if (SPR_PIERSCIENIE[k]) return SPR_PIERSCIENIE[k];
    var c = plotno(rozmiar, rozmiar), x = c.getContext('2d'), r = rozmiar / 2, g = x.createRadialGradient(r, r, 0, r, r, r);
    g.addColorStop(0, kolor + '00'); g.addColorStop(0.62, kolor + '00'); g.addColorStop(0.8, kolor + 'cc'); g.addColorStop(1, kolor + '00');
    x.fillStyle = g; x.fillRect(0, 0, rozmiar, rozmiar); SPR_PIERSCIENIE[k] = c; return c;
  }
  SPR.cienF = kulaWarstwa('#2a1650', 64); // półcień fioletowy zamiast czarnego (19.10 02:10): rdzeń nie odcina się czarnym obrysem
  function rysujGwiazde(e, rs, t, fz, M, kx, ky, G, cien, W3, G2, mix, sk, moc) { // kula z ok. 30 płaszczyzn w tym samym promieniu: mgła koronalna (4), pierścienie atmosfery (3), loby (4-8), włókna (8), ziarna (6-24), ciało (3), bryła (oświetlona strona, słaby fioletowy półcień), rdzeń (3), iskra; G2/mix/sk/moc: blask gracza (druga paleta, skala i tempo płomieni)
    var R = REDUKCJA, i; mix = mix || 0; sk = sk || 1; moc = moc || 0; var s = function (f, p) { return R ? 0.5 : 0.5 + 0.5 * Math.sin(t * f * (1 + 1.6 * moc) + fz * p); };
    var pal = (mix > 0.5 && G2) ? G2 : G;
    ctx.globalCompositeOperation = 'lighter';
    var gracz = !!G2; for (i = 0; i < (gracz ? 4 : 2); i++) { var rm = rs * sk * (1.75 + 0.2 * i + (i > 1 ? 0.5 : 0)) * (1 + (0.06 + 0.1 * moc) * s(0.3 + i * 0.17, 1.1 + i)), ox = R ? 0 : Math.cos(t * (0.2 + i * 0.13) + fz) * 0.1 * rs * sk, oy = R ? 0 : Math.sin(t * (0.17 + i * 0.11) + fz) * 0.1 * rs * sk; warstwa(G.mgla[i % 2], G2 && G2.mgla[i % 2], mix, e[0] + ox - rm, e[1] + oy - rm, rm * 2, rm * 2, M * (i < 2 ? 0.10 + 0.08 * s(0.5 + i * 0.3, 2 + i) : 0.035 + 0.03 * s(0.4 + i * 0.2, 1 + i)) * (1 + 0.5 * moc)); } // mgła: dwie bliższe i dwie dalsze, bardzo słabe
    for (i = 0; i < (gracz ? 3 : (cien ? 0 : 1)); i++) { var rp2 = rs * sk * (1.05 + 0.22 * i) * (1 + 0.05 * s(0.6 + i * 0.25, 2.5 + i)), ap = (R ? 0 : t * (0.12 + 0.05 * i) * (i % 2 ? -1 : 1)) + fz, px = e[0] + Math.cos(ap) * rs * 0.08 * (i + 1), py = e[1] + Math.sin(ap) * rs * 0.08 * (i + 1); ctx.globalAlpha = M * (0.10 + 0.08 * s(0.9 + i * 0.3, 0.7 + i)) * (1 + 0.6 * moc); ctx.drawImage(pierscienWarstwa(pal.kolory.loby[(i + 1) % 4], 96), px - rp2, py - rp2, rp2 * 2, rp2 * 2); } // pierścienie atmosfery: oddychają, obracają się, przesunięte środki
    var nl = 4 + Math.round(4 * moc); for (i = 0; i < nl; i++) { var a = (R ? 0 : t * (0.18 + i * 0.09) * (1 + moc) * (i % 2 ? -1 : 1)) + fz + i * 1.6, d = rs * sk * (0.25 + 0.12 * (i % 3)), rl = rs * sk * (0.75 + 0.15 * (i % 2)); warstwa(G.loby[i % 4], G2 && G2.loby[i % 4], mix, e[0] + Math.cos(a) * d - rl, e[1] + Math.sin(a) * d - rl, rl * 2, rl * 2, M * (0.12 + 0.08 * s(0.7 + i * 0.2, 1 + i)) * (1 + 0.9 * moc) * (i < 4 ? 1 : 0.7)); }
    ctx.lineCap = 'round';
    var ruch = Math.min(1, Math.hypot(kx, ky)), katR = Math.atan2(ky, kx); // ruch (19.10 04:30): włókna układają się przed kulką w kierunku lotu; w spoczynku krążą po orbitach
    for (i = 0; i < (gracz ? 8 : 0); i++) { var hw = hash(i * 3.7 + fz + 2), dl = 0.9 + 0.6 * hw, aw0 = (R ? 0 : t * (0.08 + 0.12 * hw) * (i % 2 ? -1 : 1)) + hw * TAU, m0 = aw0 + dl / 2, m1 = katR + (i - 3.5) * 0.2 + (R ? 0 : Math.sin(t * 1.3 + i) * 0.06), dm = Math.atan2(Math.sin(m1 - m0), Math.cos(m1 - m0)), aw = m0 + dm * ruch - dl / 2, rw = rs * sk * (0.95 + 0.7 * hash(i * 1.9 + fz)), lw = (0.9 + 1.2 * hash(i * 7.1 + fz + 3)) * (1 + 0.45 * moc) * Math.max(0.5, kam.s); ctx.strokeStyle = pal.kolory.loby[i % 4]; ctx.globalAlpha = M * (0.10 + 0.14 * s(0.5 + i * 0.15, 3 + i)) * (1 + 0.45 * moc); ctx.lineWidth = lw; ctx.beginPath(); ctx.arc(e[0] + Math.cos(aw * 0.5) * rs * 0.15 + kx * rs * 0.1, e[1] + Math.sin(aw * 0.5) * rs * 0.15 + ky * rs * 0.1, rw, aw, aw + dl); ctx.stroke(); } // włókna: cienkie łuki jak protuberancje; w ruchu zbiegają się z przodu
    var nz = 6 + Math.round(18 * moc); for (i = 0; i < nz; i++) { var h1 = hash(i * 2.3 + fz), h2 = hash(i * 5.1 + fz + 1), ph = (t * (0.08 + h1 * 0.1) * (1 + moc) + h2) % 1, ang = h2 * TAU + (R ? 0 : t * 0.15 * (1 + moc) * (i % 2 ? 1 : -1)), dd = rs * sk * (0.2 + 0.45 * h1), rz = rs * (0.16 + 0.1 * h2) * (1 + 0.3 * moc); warstwa(G.ziarna[i % 3], G2 && G2.ziarna[i % 3], mix, e[0] + Math.cos(ang) * dd - rz, e[1] + Math.sin(ang) * dd - rz, rz * 2, rz * 2, M * Math.sin(ph * Math.PI) * (0.35 + 0.55 * moc)); }
    ctx.globalCompositeOperation = 'source-over';
    for (i = 0; i < 3; i++) { var rc = rs * (1.15 - 0.22 * i) * (1 + 0.04 * s(0.9 + i * 0.4, 1.7 + i)); ctx.globalAlpha = M * (0.5 + 0.2 * i + 0.15 * s(1.2 + i * 0.3, 2.2)); ctx.drawImage(G.cialo[i], e[0] + kx * 0.06 * rs * i - rc, e[1] + ky * 0.06 * rs * i - rc, rc * 2, rc * 2); }
    if (cien) { var as = R ? fz * 0.5 : t * 0.17 + fz * 0.5, ds = rs * 0.26, rcs = rs * 0.95, rj = rs * 0.7; ctx.globalAlpha = M * 0.08; ctx.drawImage(SPR.cienF, e[0] - Math.cos(as) * ds - rcs, e[1] - Math.sin(as) * ds - rcs, rcs * 2, rcs * 2); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = M * (0.2 + 0.1 * s(0.9, 1.7)); ctx.drawImage(G.blask || W3[2], e[0] + Math.cos(as) * ds * 0.7 - rj, e[1] + Math.sin(as) * ds * 0.7 - rj, rj * 2, rj * 2); ctx.globalCompositeOperation = 'source-over'; } // bryła: słaby fioletowy półcień i oświetlona strona
    ctx.globalCompositeOperation = 'lighter';
    var kp = cien ? 0.14 : 0.26, r3 = rs * 0.55 * (1 + 0.1 * s(1.8, 0.6)), o3x = kx * kp * rs, o3y = ky * kp * rs; ctx.globalAlpha = M * (0.5 + 0.4 * s(1.8, 0.6)); ctx.drawImage(G.blask || W3[2], e[0] + o3x - r3, e[1] + o3y - r3, r3 * 2, r3 * 2);
    var r4 = rs * 0.36 * (1 + 0.08 * s(2.6, 1.3)), tony = G.tony || [SPR.rdzen], wsum = 0, wagi = [], ti; // rdzeń mieni się (19.10 02:20): odcienie przenikają się w czasie
    for (ti = 0; ti < tony.length; ti++) { wagi[ti] = R ? 1 : 0.5 + 0.5 * Math.sin(t * (1.1 + 0.3 * ti) * (1 + moc) + fz + 2.1 * ti); wsum += wagi[ti]; }
    for (ti = 0; ti < tony.length; ti++) { ctx.globalAlpha = M * (0.35 + 0.3 * s(2.1, 0.4)) * wagi[ti] / wsum; ctx.drawImage(G.rdzen || tony[ti], e[0] + o3x * 0.8 - r4, e[1] + o3y * 0.8 - r4, r4 * 2, r4 * 2); }
    for (ti = 0; ti < 5; ti++) { var ai = (R ? 0 : t * (0.9 + 0.4 * ti) * (1 + moc) * (ti % 2 ? -1 : 1)) + hash(ti + fz) * TAU, ri = rs * (0.28 + 0.1 * hash(ti + 9 + fz)), si = rs * 0.07; ctx.globalAlpha = M * (0.3 + 0.6 * Math.abs(Math.sin(t * (3 + ti) + fz))); ctx.drawImage(SPR.rdzen, e[0] + o3x * 0.8 + Math.cos(ai) * ri - si, e[1] + o3y * 0.8 + Math.sin(ai) * ri - si, si * 2, si * 2); } // iskierki krążą po brzegu rdzenia
    var ng = gracz ? 10 : (cien ? 6 : 12), tonyG = pal.kolory.ognie || pal.kolory.loby; ctx.lineCap = 'round'; // gałęzie ognia (19.10 05:00): krótkie, wygięte języki w różnych odcieniach, każdy pojawia się i gaśnie w swoim rytmie
    for (i = 0; i < ng; i++) { var hg = hash(i * 4.3 + fz + 5), hg2 = hash(i * 6.1 + fz + 9), okres = 1.2 + 2.4 * hg, fazaG = R ? 0.5 : ((t + hg2 * 10) % okres) / okres, zycie = Math.sin(fazaG * Math.PI); if (zycie < 0.05) continue;
      var ag = hg * TAU + (R ? 0 : t * 0.1 * (i % 2 ? 1 : -1)) + Math.sin(t * 0.7 + i) * 0.08, dlG = rs * (0.35 + 0.5 * hg2) * (0.6 + 0.4 * zycie) * (1 + 0.5 * moc), r0 = rs * (cien ? 0.8 : 0.95), c0x = e[0] + Math.cos(ag) * r0, c0y = e[1] + Math.sin(ag) * r0, c1x = e[0] + Math.cos(ag) * (r0 + dlG), c1y = e[1] + Math.sin(ag) * (r0 + dlG), wyg = Math.sin(t * 2.1 + i * 1.7) * dlG * 0.35, mx = (c0x + c1x) / 2 - Math.sin(ag) * wyg, my = (c0y + c1y) / 2 + Math.cos(ag) * wyg;
      ctx.strokeStyle = tonyG[i % tonyG.length]; ctx.lineWidth = Math.max(0.8, 2.6 * kam.s); ctx.globalAlpha = M * 0.18 * zycie; ctx.beginPath(); ctx.moveTo(c0x, c0y); ctx.quadraticCurveTo(mx, my, c1x, c1y); ctx.stroke();
      ctx.strokeStyle = tonyG[(i + 1) % tonyG.length]; ctx.lineWidth = Math.max(0.5, 1 * kam.s); ctx.globalAlpha = M * 0.6 * zycie; ctx.beginPath(); ctx.moveTo(c0x, c0y); ctx.quadraticCurveTo(mx, my, c1x, c1y); ctx.stroke(); }
    var rp = rs * 0.22; ctx.globalAlpha = M * (0.3 + 0.3 * s(2.3, 0.9)); ctx.drawImage(G.rdzen || SPR.rdzen, e[0] + o3x * 0.6 - rp, e[1] + o3y * 0.6 - rp, rp * 2, rp * 2); // rdzeń: trzy warstwy, podążają za ruchem
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  }
  function mruganie(u) { if (REDUKCJA) return 0.55; return (1 - 0.94 * Math.pow(0.5 + 0.5 * Math.sin(czasKlienta * (10 + 26 * u)), 5)) * (1 - 0.3 * u); } // utrata życia (19.10 01:30): krótkie, głębokie zaciemnienia coraz częstsze, kulka przygasa
  function migot(wc) { if (!wc) return 1; return mruganie(Math.min(1, wc / B.CZERN_ZABIJA)); } // kulka pochłaniana przez czerń
  var KIER = {}, BLASK_JA = 0; // blask gracza (0-1) na bieżącą klatkę
  function kierunek(id, vx, vy) { var k = KIER[id] || (KIER[id] = { dx: 0, dy: 0 }), l = Math.hypot(vx, vy), tx = l > 5 ? vx / l : 0, ty = l > 5 ? vy / l : 0; k.dx += (tx - k.dx) * 0.12; k.dy += (ty - k.dy) * 0.12; return k; } // wygładzony kierunek ruchu kulki (rdzeń podąża za ruchem)
  function migotO(o) { if (o.wSw > 0 && !(o.wCzerni > 0)) return mruganie(Math.min(1, o.wSw / B.SWIATLO_ZABIJA)); if (o.migocze && !(o.wCzerni > 0)) return REDUKCJA ? 0.5 : 0.5 + 0.5 * Math.abs(Math.sin(czasKlienta * 16)); return migot(o.wCzerni); } // wilk w „1” migocze równym rytmem
  function rysujKule(x, y, r, kolor, posw, alfaPosw, t, fz, M, kier) { // kula z wielu płaszczyzn w tym samym promieniu: halo, obłoki krążące w przeciwne strony, ciało, bryła (strona w cieniu i oświetlona), rdzeń, iskra rdzenia
    var e = ekran(x, y), rs = r * kam.s, W3 = SPR.warstwy[kolor] || SPR.warstwy.szary, L = SPR.loby[kolor] || SPR.loby.szary, zolty = kolor === 'zolty', g = SPR.posw[posw], R = REDUKCJA; M = M == null ? 1 : M; var kx = kier ? kier.dx : 0, ky = kier ? kier.dy : 0, kp = zolty ? 0.26 : 0.14; // rdzeń przesuwa się w stronę ruchu (żółta najmocniej)
    if (!zolty && g && alfaPosw > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = M * (alfaPosw * 0.7); var gr = rs * 2.3; ctx.drawImage(g, e[0] - gr, e[1] - gr, gr * 2, gr * 2); ctx.globalCompositeOperation = 'source-over'; }
    var s1 = R ? 0.5 : 0.5 + 0.5 * Math.sin(t * 0.45 + fz), s2 = R ? 0.5 : 0.5 + 0.5 * Math.sin(t * 0.9 + fz * 1.7 + 1), s3 = R ? 0.5 : 0.5 + 0.5 * Math.sin(t * 1.8 + fz * 0.6 + 2);
    var o1x = R ? 0 : Math.cos(t * 0.5 + fz) * 0.14 * rs, o1y = R ? 0 : Math.sin(t * 0.42 + fz) * 0.14 * rs, o3x = (R ? 0 : Math.cos(t * 0.8 + fz + 1) * 0.04 * rs) + kx * kp * rs, o3y = (R ? 0 : Math.sin(t * 0.7 + fz + 1) * 0.04 * rs) + ky * kp * rs;
    var r1 = rs * (zolty ? 1.7 : 1.6) * (1 + 0.05 * s1), r2 = rs * 1.15 * (1 + 0.04 * s2), r3 = rs * 0.62 * (1 + 0.1 * s3);
    ctx.globalAlpha = M * ((zolty ? 0.4 : 0.3) + 0.3 * s1); ctx.drawImage(W3[0], e[0] + o1x - r1, e[1] + o1y - r1, r1 * 2, r1 * 2); // halo
    if (zolty || kolor === 'ja' || kolor === 'niebieski' || kolor === 'czerwony') { rysujGwiazde(e, rs, t, fz, M, kx, ky, SPR.gwiazdy[kolor], !zolty, W3, kolor === 'ja' ? SPR.gwiazdy.jaBlask : null, kolor === 'ja' ? BLASK_JA : 0, kolor === 'ja' ? 1 + 2.2 * BLASK_JA : 1, kolor === 'ja' ? BLASK_JA : 0); return; } // kula gracza i kolory ról: pełne 17 płaszczyzn
    var a1 = R ? fz : t * 0.23 + fz, a2 = R ? fz * 1.3 : -t * 0.31 + fz * 1.3, rl = rs * 1.02, dl = rs * 0.34, rl2 = rl * 0.85; // obłoki: dwie barwy krążą w przeciwne strony, nie wychodzą poza halo
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = M * (0.14 + 0.1 * s2); ctx.drawImage(L[0], e[0] + Math.cos(a1) * dl - rl, e[1] + Math.sin(a1) * dl - rl, rl * 2, rl * 2);
    ctx.globalAlpha = M * (0.1 + 0.1 * s1); ctx.drawImage(L[1], e[0] + Math.cos(a2) * dl * 0.8 - rl2, e[1] + Math.sin(a2) * dl * 0.8 - rl2, rl2 * 2, rl2 * 2);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = M * (0.72 + 0.23 * s2); ctx.drawImage(W3[1], e[0] - o1x * 0.5 - r2, e[1] - o1y * 0.5 - r2, r2 * 2, r2 * 2); // ciało
    if (!zolty) { var as = R ? fz * 0.5 : t * 0.17 + fz * 0.5, ds = rs * 0.26, rc = rs * 0.95, rj = rs * 0.7; // bryła: strona w cieniu i oświetlona; światło wolno obiega kulę
      ctx.globalAlpha = M * (0.2); ctx.drawImage(SPR.cien, e[0] - Math.cos(as) * ds - rc, e[1] - Math.sin(as) * ds - rc, rc * 2, rc * 2);
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = M * (0.2 + 0.1 * s2); ctx.drawImage(W3[2], e[0] + Math.cos(as) * ds * 0.7 - rj, e[1] + Math.sin(as) * ds * 0.7 - rj, rj * 2, rj * 2); ctx.globalCompositeOperation = 'source-over'; }
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = M * (0.4 + 0.5 * s3); ctx.drawImage(W3[2], e[0] + o3x - r3, e[1] + o3y - r3, r3 * 2, r3 * 2); // rdzeń
    ctx.globalAlpha = M * (0.22 + 0.33 * s3); var rp = rs * 0.24; ctx.drawImage(SPR.rdzen, e[0] + o3x * 0.5 - rp, e[1] + o3y * 0.5 - rp, rp * 2, rp * 2); // iskra rdzenia: punkt w głębi
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  }
  function rysujKuleStare(x, y, r, kolor, posw, alfaPosw, t, fz) {
    if (kolor === 'zolty') return rysujSlonce(x, y, r, alfaPosw, t, fz); // kulka: poświata, dwa przenikające się odcienie, rdzeń, oddech pierścienia, krążące iskry (głębia)
    var e = ekran(x, y), rs = r * kam.s, g = SPR.posw[posw], tw = REDUKCJA ? 0.5 : 0.5 + 0.5 * Math.sin(t * 1.7 + fz), hu = REDUKCJA ? 0.5 : 0.5 + 0.5 * Math.sin(t * 0.45 + fz * 1.3), odd = REDUKCJA ? 0.5 : 0.5 + 0.5 * Math.sin(t * 0.9 + fz * 0.7);
    if (g && alfaPosw > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = alfaPosw * (0.75 + 0.25 * tw); var gr = rs * (3.0 + 0.5 * odd); ctx.drawImage(g, e[0] - gr, e[1] - gr, gr * 2, gr * 2); ctx.globalCompositeOperation = 'source-over'; }
    var rk = rs * 1.4, para = SPR.kula[kolor] || SPR.kula.szary;
    ctx.globalAlpha = 1 - hu; ctx.drawImage(para[0], e[0] - rk, e[1] - rk, rk * 2, rk * 2);
    ctx.globalAlpha = hu; ctx.drawImage(para[1], e[0] - rk, e[1] - rk, rk * 2, rk * 2);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.55 + 0.35 * tw; var rc = rs * 0.7; ctx.drawImage(SPR.rdzen, e[0] - rc, e[1] - rc, rc * 2, rc * 2);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  }
  var WIEZ = { ja: ['#ffffff', '#bcd9ff', '#8a5cff', '#5ad7ff', '#d9b3ff', '#5b8cff'], czerwony: ['#ffe0d8', '#ff5a5a', '#ff8a70', '#c0203a', '#ffb3a0', '#ff3d5a'] }; // barwy więzi: najwyższy poziom gracza; wilk: czerwień
  function rysujWiez(ax, ay, bx, by, t, pal, fz) { // więź pary (19.10 03:00): dwie błyskawice (poświata i jasny rdzeń) z falującym zygzakiem, iskry z pikseli wędrujące wzdłuż, pulsy na końcach jak fale nawoływania
    var a = ekran(ax, ay), b = ekran(bx, by), dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, n = Math.max(4, Math.min(22, Math.round(L / 11))), i, k, R = REDUKCJA;
    ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (k = 0; k < 2; k++) { var amp = (k ? 3.5 : 6) * Math.min(1, L / 60), ph = fz + k * 2.7; ctx.beginPath(); ctx.moveTo(a[0], a[1]);
      for (i = 1; i < n; i++) { var u = i / n, j = R ? 0 : Math.sin(t * (9 + 3 * k) + i * 1.9 + ph) * amp * Math.sin(u * Math.PI); ctx.lineTo(a[0] + dx * u + nx * j, a[1] + dy * u + ny * j); }
      ctx.lineTo(b[0], b[1]); ctx.strokeStyle = pal[(k + 2) % pal.length]; ctx.lineWidth = k ? 1.1 : 4; ctx.globalAlpha = k ? 0.9 : 0.22 + 0.1 * Math.sin(t * 5 + ph); ctx.stroke(); }
    for (i = 0; i < 12; i++) { var h1 = hash(i * 3.1 + fz), u2 = (h1 + (R ? 0 : t * (0.3 + 0.4 * hash(i + 7)))) % 1, j2 = Math.sin(t * 7 + i * 2.3 + fz) * 7, s2 = 1.5 + 2 * hash(i + 3); ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * (6 + i) + fz); ctx.fillStyle = pal[i % pal.length]; ctx.fillRect(a[0] + dx * u2 + nx * j2 - s2 / 2, a[1] + dy * u2 + ny * j2 - s2 / 2, s2, s2); }
    for (k = 0; k < 2; k++) { var e = k ? b : a, w = ((t * 0.8 + k * 0.5 + fz) % 1 + 1) % 1, rr = (4 + 14 * w) * Math.max(0.6, kam.s); ctx.globalAlpha = 0.5 * (1 - w); ctx.strokeStyle = pal[0]; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(e[0], e[1], rr, 0, TAU); ctx.stroke(); }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  }
  function rysujPierscien(x, y, r, kolor, alfa, grub, od, doo, kreski) {
    var e = ekran(x, y); ctx.strokeStyle = kolor; ctx.globalAlpha = alfa; ctx.lineWidth = grub; if (kreski) ctx.setLineDash([4, 5]);
    ctx.beginPath(); ctx.arc(e[0], e[1], r * kam.s, od || 0, doo == null ? TAU : doo); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
  }
  var HEX = { szary: '#9da3ac', bialy: '#f4f6f9', niebieski: '#5b8cff', czerwony: '#ff5a5a', zolty: '#f2c230' };
  var SPEKTRUM = ['#ffffff', '#eef4ff', '#d8e8ff', '#bcd9ff', '#9fc8ff', '#c7e6ff', '#e6f3ff']; // fale nawoływania mienią się od bieli po jasny błękit
  function rysujFale(x, y, R, u, t, k) { // jedna fala jak na wodzie: faluje, z czasem coraz bardziej przerywana, na końcu rozpada się w piksele; odcień zmienia się wzdłuż i w czasie
    var e = ekran(x, y), rs = R * kam.s, N = 56, on = 1 - u * 0.95, al = Math.pow(1 - u, 1.2) * 0.6, pix = u > 0.5, seg = TAU / N;
    ctx.lineWidth = 1.2 * (1 - u * 0.4); ctx.globalAlpha = al;
    for (var i = 0; i < N; i++) {
      var a0 = i * seg, h = hash(i * 3.1 + k * 7.7 + Math.floor(t * 3 + u * 6)); if (h > on) continue;
      var r1 = rs * (1 + 0.05 * Math.sin(5 * a0 + t * 1.3 + k)), kol = SPEKTRUM[Math.floor((i / N * 3 + t * 0.7 + k * 0.4) % 1 * SPEKTRUM.length)];
      if (!pix) { ctx.strokeStyle = kol; ctx.beginPath(); ctx.arc(e[0], e[1], r1, a0, a0 + seg * 0.9); ctx.stroke(); }
      else { var sz = (1.5 + u * 2.5) * kam.s, px = e[0] + Math.cos(a0 + seg * 0.45) * r1, py = e[1] + Math.sin(a0 + seg * 0.45) * r1; ctx.fillStyle = kol; ctx.fillRect(Math.round(px - sz / 2), Math.round(py - sz / 2), Math.ceil(sz), Math.ceil(sz)); }
    }
    ctx.globalAlpha = 1;
  }
  function rysujWolanie(x, y, t, kolor) { // nawoływanie: trzy warstwy fal o różnych częstotliwościach, przenikają się z tłem
    for (var k = 0; k < 3; k++) { var sp = [0.45, 0.3, 0.6][k], u = (t * sp + k * 0.33) % 1; rysujFale(x, y, B.R + 10 + 150 * u, u, t, k); }
  }
  function rysujEfekty() {
    for (var i = efekty.length - 1; i >= 0; i--) {
      var f = efekty[i], u = (czasKlienta - f.t0) / f.czas; if (u >= 1) { efekty.splice(i, 1); continue; }
      var e = ekran(f.x, f.y), kol = HEX[f.kolor] || HEX.bialy;
      if (f.typ === 'wybuch') { // ujawnienie: błysk i rozchodzący się pierścień w kolorze prawdy
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.pow(1 - u, 2) * 0.9; var gr = f.r * kam.s * (0.6 + 1.2 * u); ctx.drawImage(SPR.posw[f.kolor], e[0] - gr, e[1] - gr, gr * 2, gr * 2); ctx.globalCompositeOperation = 'source-over';
        rysujPierscien(f.x, f.y, f.r * Math.pow(u, 0.6), kol, (1 - u) * 0.9, 2.2 * (1 - u) + 0.4);
        rysujPierscien(f.x, f.y, f.r * 0.5 * Math.pow(u, 0.8), kol, (1 - u) * 0.5, 1);
      } else if (f.typ === 'puls') { rysujPierscien(f.x, f.y, f.r * Math.pow(u, 0.7), kol, (1 - u) * 0.7, 1.2); if (u < 0.5) rysujPierscien(f.x, f.y, f.r * 0.4 * Math.pow(u * 2, 0.7), kol, (1 - u * 2) * 0.5, 1); }
      else if (f.typ === 'blask') { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.sin(u * Math.PI) * 0.55; var g2 = f.r * kam.s * (0.8 + 0.6 * u); ctx.drawImage(SPR.posw.bialy, e[0] - g2, e[1] - g2, g2 * 2, g2 * 2); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
      else if (f.typ === 'rozpad') { // kula rozpada się na kwadratowe piksele: szybki wyrzut, hamowanie, migotanie, gaśnięcie; na początku większy miękki błysk
        if (u < 0.35 && SPR.posw[f.kolor]) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.pow(1 - u / 0.35, 1.5) * 0.8; var g3 = f.r * kam.s * (0.5 + 1.4 * u); ctx.drawImage(SPR.posw[f.kolor], e[0] - g3, e[1] - g3, g3 * 2, g3 * 2); ctx.globalCompositeOperation = 'source-over'; }
        var ease = 1 - Math.pow(1 - u, 2.2), pal = f.pal || PIX;
        for (var k3 = 0; k3 < f.n; k3++) {
          var h1 = hash(k3 * 1.3 + f.t0), h2 = hash(k3 * 2.9 + 1), h3 = hash(k3 * 4.1 + 2), a3 = k3 / f.n * TAU + (h1 - 0.5) * 0.9, d3 = f.r * kam.s * ease * (0.3 + h2 * 0.9);
          var sz3 = (2.4 + h3 * 2.8) * kam.s * (1 - u * 0.6), mig3 = REDUKCJA ? 0.85 : 0.6 + 0.4 * Math.sin(czasKlienta * 11 + k3 * 1.7);
          ctx.fillStyle = pal[k3 % pal.length]; ctx.globalAlpha = Math.pow(1 - u, 1.3) * 0.95 * mig3;
          ctx.fillRect(Math.round(e[0] + Math.cos(a3) * d3 - sz3 / 2), Math.round(e[1] + Math.sin(a3) * d3 - sz3 / 2), Math.ceil(sz3), Math.ceil(sz3));
        }
        ctx.globalAlpha = 1;
      }
      else if (f.typ === 'fala') { for (var k4 = 0; k4 < 3; k4++) { var uk = u * (1 + k4 * 0.25) - k4 * 0.12; if (uk <= 0 || uk >= 1) continue; rysujFale(f.x, f.y, f.r * Math.pow(uk, 0.7), uk, czasKlienta, k4); } } // sygnał: trzy fale jak na wodzie
      else if (f.typ === 'odlamki') { ctx.fillStyle = kol; ctx.globalAlpha = (1 - u) * 0.9; for (var k = 0; k < 7; k++) { var a = k / 7 * TAU + hash(k + f.t0) * 0.8, d = f.r * kam.s * Math.pow(u, 0.5) * (0.6 + hash(k * 3) * 0.8); ctx.beginPath(); ctx.arc(e[0] + Math.cos(a) * d, e[1] + Math.sin(a) * d, (1.6 + hash(k) * 1.4) * kam.s * (1 - u * 0.5), 0, TAU); ctx.fill(); } ctx.globalAlpha = 1; }
    }
  }
  function rysujScene(w, t, alfa) {
    var P = pozycje(poprz, w, alfa), ja = w.ja, pulsa = REDUKCJA ? 0 : Math.sin(t * 2.4) * 0.5 + 0.5;
    // smugi
    if (!ja.martwy && !ja.ukryty) slad(JA, P.ja.x, P.ja.y, 1.0); else if (slady[JA]) slad(JA, P.ja.x, P.ja.y, 1.0);
    P.inni.forEach(function (o) { slad(o.o.id, o.x, o.y, 1.0); });
    P.zolte.forEach(function (z) { var o = z.o; rysujKule(z.x, z.y, B.ZOLTA_R, 'zolty', 'zolty', o.trawi ? 0.25 : 0.5, t, faza(o.id), 1, kierunek(o.id, o.vx, o.vy)); }); // jedna kula; jej wpływ pokażemy na planszy
    var kolSladu = {}; kolSladu[JA] = (ja.kolor === 'szary' && ja.blask > 0.35) ? (ja.blask > 0.7 ? 'jaBlask' : 'niebieski') : ja.kolor; P.inni.forEach(function (o) { kolSladu[o.o.id] = (o.o.kolor === 'niebieski' || o.o.kolor === 'czerwony') ? o.o.kolor : 'szary'; });
    for (var id in slady) { // także smugi kropek, które zniknęły z widoku (ukryte, zjedzone): gasną i znikają
      var s = slady[id], zolta = id.charAt(0) === 'z', zyc = zolta ? 1.5 : 1.0;
      while (s.p.length && czasKlienta - s.p[0].t > zyc) s.p.shift();
      if (!s.p.length) { delete slady[id]; continue; }
      if (zolta) rysujSmugeMiekka(s, 1.4, B.ZOLTA_R); else rysujSlad(s, 1.1, 1.15, PRYZMAT[kolSladu[id] || 'szary']); }
    // żółte: duże, ciepłe, wolny puls; w pogoni jaśniejsze
    P.zolte.forEach(function (z) { var o = z.o, p2 = o.goni ? 0.55 + 0.45 * Math.sin(t * 7) : pulsa; rysujKule(z.x, z.y, B.ZOLTA_R, 'zolty', 'zolty', o.trawi ? 0.25 : 0.5, t, faza(o.id), 1, kierunek(o.id, o.vx, o.vy)); if (o.goniMnie || o.wezwanaDoMnie) rysujPierscien(z.x, z.y, B.ZOLTA_R + 8 + 6 * pulsa, HEX.zolty, o.goniMnie ? 0.5 : 0.3, 1.2); });
    // inni: zawsze szarzy (kolor ukryty); partner z nitką połączenia (widzą ją tylko połączeni)
    P.inni.forEach(function (o) {
      if (o.o.partner && !ja.martwy) rysujWiez(P.ja.x, P.ja.y, o.x, o.y, t, ja.kolor === 'czerwony' ? WIEZ.czerwony : WIEZ.ja, faza(o.o.id)); // więź: piorun w barwach najwyższego poziomu gracza
      else if (o.o.para && o.o.para !== JA) { for (var pi2 = 0; pi2 < P.inni.length; pi2++) { var pp = P.inni[pi2]; if (pp.o.id !== o.o.para || pp.o.id < o.o.id) continue; rysujWiez(o.x, o.y, pp.x, pp.y, t, WIEZ.czerwony, faza(o.o.id)); } } // single: splątana para (wilk z przechwyconą szarą): czerwony piorun, widoczny też poza „1”
      var kolInnego = (o.o.kolor === 'niebieski' || o.o.kolor === 'czerwony') ? o.o.kolor : 'szary'; // niebieski: pary w widoku wilka, psy w single; czerwony: wilki w single (tylko gracz widzi kolory)
      if (o.o.wola) rysujWolanie(o.x, o.y, t, '#d6dae0');
      rysujKule(o.x, o.y, B.R, kolInnego, kolInnego, o.o.ukryty ? 0 : 0.3, t, faza(o.o.id), migotO(o.o), kierunek(o.o.id, o.o.vx || 0, o.o.vy || 0));
    });
    // ja: kolor własny (jedyny, który znam), cienki pierścień tożsamości, pierścienie trzymania
    if (!ja.martwy) {
      var kol = ja.kolor; BLASK_JA = ja.blask || 0; // kolor roli: szary, niebieski (pies pasterski), czerwony (wilk); połączenie = niebieski pierścień i nitka; blask: płomienie rosną i mienią się
      if (ja.wolam) rysujWolanie(P.ja.x, P.ja.y, t, HEX.bialy);
      if (ja.niewidzialny) ctx.globalAlpha = 0.45; // w mroku: dla siebie przyciemniony, dla innych nieistniejący
      rysujKule(P.ja.x, P.ja.y, B.R, kol === 'szary' ? 'ja' : kol, kol === 'szary' ? 'bialy' : kol, ja.ukryty ? 0.1 : (kol === 'szary' ? 0.4 : 0.6), t, 0.3, migotO(ja), kierunek('ja', ja.vx || 0, ja.vy || 0)); ctx.globalAlpha = 1;
      var uz = Math.max(ja.wSw > 0 ? ja.wSw / B.SWIATLO_ZABIJA : 0, ja.wCzerni > 0 ? ja.wCzerni / B.CZERN_ZABIJA : 0); // utrata życia: pierścień ubywającego czasu, biel przechodzi w karmin
      if (uz > 0) { var kolZ = uz < 0.45 ? '#f4f6f9' : uz < 0.75 ? '#ff8a70' : '#ff3d5a'; rysujPierscien(P.ja.x, P.ja.y, B.R + 15, kolZ, 0.22, 1.2, 0, TAU); rysujPierscien(P.ja.x, P.ja.y, B.R + 15, kolZ, 0.95, 2.8, -Math.PI / 2, -Math.PI / 2 + Math.max(0.02, 1 - uz) * TAU); }
    }
    rysujEfekty();
  }
  function rysujWinietaIZiarno(t) {
    var g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.78); g.addColorStop(0, 'rgba(10,11,15,0)'); g.addColorStop(1, 'rgba(10,11,15,.72)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // stałe strefy HUD: łagodne zacienienie góry i dołu, żeby tekst był czytelny nad planszą
    var gora = 60 + 36, dol = (DOTYK ? 176 : 64) + 36, gg = ctx.createLinearGradient(0, 0, 0, gora); gg.addColorStop(0, 'rgba(10,11,15,.88)'); gg.addColorStop(0.6, 'rgba(10,11,15,.45)'); gg.addColorStop(1, 'rgba(10,11,15,0)'); ctx.fillStyle = gg; ctx.fillRect(0, 0, W, gora);
    var gd = ctx.createLinearGradient(0, H - dol, 0, H); gd.addColorStop(0, 'rgba(10,11,15,0)'); gd.addColorStop(0.4, 'rgba(10,11,15,.45)'); gd.addColorStop(1, 'rgba(10,11,15,.88)'); ctx.fillStyle = gd; ctx.fillRect(0, H - dol, W, dol);
    ctx.save(); ctx.globalAlpha = 0.045; ctx.globalCompositeOperation = 'overlay'; if (!REDUKCJA) ctx.translate(Math.floor(hash(t) * 160), Math.floor(hash(t + 9) * 160)); ctx.fillStyle = ZIARNISTOSC; ctx.fillRect(-160, -160, W + 320, H + 320); ctx.restore();
  }

  // ---------- HUD ----------
  var hudOst = 0, elSwit = $('#swit i.glowna'), elKom = $('#komunikat'), elEpoka = $('#epoka'), elSprint = $('#sprint');
  function hud(w) {
    if (czasKlienta - hudOst < 0.1) return; hudOst = czasKlienta;
    var ja = w.ja, u = w.pole.udzial, kom = STAT.pole.n * STAT.pole.n, celU = w.cel || B.CEL_POKRYCIA, post = Math.min(1, u.jasne / Math.max(1, celU * kom)), szer = (post * 100).toFixed(1) + '%'; // linia świtu: jasna część rośnie od środka ku celowi
    if (elSwit.style.width !== szer) { var wsz = elSwit.parentNode.querySelectorAll('i'); for (var wi = 0; wi < wsz.length; wi++) wsz[wi].style.width = szer; elSwit.parentNode.setAttribute('aria-label', 'Droga do świtu: ' + Math.round(u.jasne / kom * 100) + '% planszy w „1”, cel ' + Math.round(celU * 100) + '%'); }
    elSprint.style.width = (ja.sprint * 100).toFixed(0) + '%'; elSprint.parentNode.style.opacity = ja.sprint < 0.999 ? 1 : 0;
    var tekst = komunikat.tekst, wazny = komunikat.wazny;
    if (czasKlienta > komunikat.do) { tekst = ''; wazny = false; }
    if (ja.martwy) { tekst = 'Odrodzenie za ' + Math.ceil(ja.odrodzenie) + ' s'; wazny = true; }
    else if (!tekst && ja.ukryty) tekst = 'Ukryty. Żółte Cię nie widzą.';
    else if (ja.wCzerni > 0) { tekst = 'Czerń Cię pochłania. Uciekaj.'; wazny = true; }
    else if (ja.wSw > 0 && !ja.polaczony) { tekst = 'W „1” gaśniesz: ' + Math.max(0, B.SWIATLO_ZABIJA - ja.wSw).toFixed(1) + ' s. Połącz się albo wyjdź w mrok.'; wazny = true; }
    else if (!tekst && ja.niewidzialny) tekst = 'W mroku. Nikt Cię nie widzi.';
    else if (!tekst && ja.wolam) tekst = 'Nawołujesz.';
    else if (!tekst && ja.polaczony) { var idzie = false; for (var q = 0; q < w.zolte.length; q++) if (w.zolte[q].wezwanaDoMnie) idzie = true; var odl1 = document.body.classList.contains('single') ? '' : ' Shift: odłącz.'; tekst = (idzie ? 'Para. Żółta nadchodzi, idźcie na nią razem.' : 'Para. Trzymajcie się blisko.') + odl1; }
    if (elKom.textContent !== tekst) elKom.textContent = tekst; elKom.classList.toggle('wazny', wazny);
    if (epokaDo && czasKlienta > epokaDo) { elEpoka.classList.remove('widac'); epokaDo = 0; }
    // dźwięk stanu: trzymanie klawisza, ukrycie, poziom zagrożenia od żółtych
    if (DZ) {
      if (ja.ukryty && !hudUkryty) dz('ukrycie', { sila: 0.5 }); hudUkryty = ja.ukryty;
      if (czasKlienta - hudZagr > 0.2) { hudZagr = czasKlienta; var poziom = 0; for (var k = 0; k < w.zolte.length; k++) { var zz = w.zolte[k], d = Math.hypot(zz.x - ja.x, zz.y - ja.y); poziom = Math.max(poziom, zz.goniMnie ? 1 : d < 320 && !ja.polaczony ? 0.5 * (1 - d / 320) + 0.2 : 0); } if (typeof DZ.zagrozenie === 'function') { try { DZ.zagrozenie(ja.martwy ? 0 : poziom); } catch (e) { /* cisza */ } } }
    }
  }
  var hudUkryty = false, hudZagr = 0;

  // ---------- pętla ----------
  function klatka(ts) {
    requestAnimationFrame(klatka);
    var dt = ostatni ? Math.min(0.1, (ts - ostatni) / 1000) : 0; ostatni = ts; czasKlienta += dt;
    if (gra && !podsumowanieOtwarte) {
      akum += dt; var n = 0;
      while (akum >= B.TICK && n++ < 4) { serwer.krok({ dx: klaw.dx, dy: klaw.dy, spacja: klaw.spacja, e: klaw.e, shift: klaw.shift }); akum -= B.TICK; poprz = biez; biez = serwer.widok(odNr); odNr = biez.nr; obsluzZdarzenia(biez); }
      if (akum > B.TICK) akum = 0;
    }
    if (!biez) { biez = serwer.widok(null); odNr = biez.nr; }
    var w = biez, alfa = Math.min(1, akum / B.TICK), celX = w.ja.x, celY = w.ja.y;
    if (!gra) { celX = B.SWIAT / 2 + Math.cos(czasKlienta * 0.07) * 160; celY = B.SWIAT / 2 + Math.sin(czasKlienta * 0.05) * 120; }
    var f = Math.min(1, dt * (gra ? 6 : 1.2)); kam.x += (celX - kam.x) * f; kam.y += (celY - kam.y) * f;
    if (GLT && GLT.sk > 0.36) { if (dt > 0.03) wolneKlatki++; else if (wolneKlatki > 0) wolneKlatki--; if (wolneKlatki > 90) GLT.jakosc(0.36); } // słabszy sprzęt: tło w mniejszej rozdzielczości
    kam.wx = kam.wy = 0; if (wstrzas) { var uw = (czasKlienta - wstrzas.t0) / wstrzas.czas; if (uw >= 1) wstrzas = null; else { var am = wstrzas.sila * (1 - uw) * (1 - uw); kam.wx = Math.sin(czasKlienta * 61) * am; kam.wy = Math.cos(czasKlienta * 47) * am * 0.7; } }
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    rysujTlo(czasKlienta, w); if (!GLT) rysujBrzeg(); rysujBity(w, czasKlienta); rysujPrzeszkody(); rysujScene(w, czasKlienta, gra ? alfa : 1); rysujWinietaIZiarno(czasKlienta);
    hud(w);
  }
  requestAnimationFrame(klatka);
})();
