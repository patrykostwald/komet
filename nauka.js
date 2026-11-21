/* KOMET: ekran nauki bez słów (19.10). Kafle to małe płótna z wycinkami gry: klawisze (WASD, SHIFT, E) i mechanika (mrok i światło,
   żółta na „0”, para na żółtą, wilk przejmuje, chmura, świt). Każdy kafel ma pętlę czasu i rysuje się od zera z prostych warstw:
   pole bitów, kule z halo, smugi z pikseli, fale nawoływania, nitka pary, wybuch. ES5, bez zależności; K_nauka.zbuduj(kontener), start(), stop(). */
(function (root) {
  'use strict';
  var KOL = { ja: ['#ffffff', '#cdd3e2', '#8e86b8'], szary: ['#f2f4ff', '#b4bac8', '#8e86b8'], czerwony: ['#ffe0d8', '#ff5a5a', '#8a1f30'], niebieski: ['#dff0ff', '#5b9cff', '#2a46c8'], zolty: ['#fff7d6', '#f7c43a', '#d98a1a'] };
  var PRYZMAT = ['#8e86b8', '#cdd3e2', '#6b98ff', '#d9b3ff', '#ffffff', '#9ad7ff'], CZERW = ['#ff5a5a', '#ff8a70', '#ffb3a0', '#8a1f30', '#ffd2c8'];
  var W = 200, H = 120, K = 20, SK = 2, kafle = [], petla = null, zegar0 = 0, REDUKCJA = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function lerp(a, b, u) { return a + (b - a) * u; }
  function klem(u) { return u < 0 ? 0 : u > 1 ? 1 : u; }
  function faza(t, a, b) { return klem((t - a) / (b - a)); } // 0..1 między chwilami a i b
  function gladko(u) { u = klem(u); return u * u * (3 - 2 * u); }
  function hash(i) { var v = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); }
  // ---------- warstwy ----------
  function tlo(x, jasne) { // mgławica i pole bitów; jasne: funkcja (i, j) -> 0..1 siła światła komórki
    var g = x.createRadialGradient(W * 0.5, H * 0.55, 4, W * 0.5, H * 0.55, W * 0.7); g.addColorStop(0, '#1b1136'); g.addColorStop(0.6, '#100a22'); g.addColorStop(1, '#07060b');
    x.globalAlpha = 0.72; x.fillStyle = g; x.fillRect(0, 0, W, H); x.globalAlpha = 1;
    x.font = '10px "Geist Mono", ui-monospace, monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
    for (var j = 0; j < H / K; j++) for (var i = 0; i < W / K; i++) {
      var s = jasne ? jasne(i, j) : 0, cx = i * K + K / 2, cy = j * K + K / 2;
      if (s > 0.02) { x.globalCompositeOperation = 'lighter'; var gl = x.createRadialGradient(cx, cy, 2, cx, cy, K * 1.4); gl.addColorStop(0, 'rgba(214,210,255,' + (0.22 * s) + ')'); gl.addColorStop(1, 'rgba(214,210,255,0)'); x.fillStyle = gl; x.fillRect(cx - K * 1.4, cy - K * 1.4, K * 2.8, K * 2.8); x.globalCompositeOperation = 'source-over'; }
      x.fillStyle = s > 0.5 ? 'rgba(244,246,249,' + (0.5 + 0.4 * s) + ')' : 'rgba(157,163,172,' + (0.16 + 0.3 * s) + ')';
      x.fillText(s > 0.5 ? '1' : '0', cx, cy);
    }
  }
  function winieta(x) { // miękkie krawędzie wycinka: kafel wtapia się w ekran startu, bez ramki
    var g = x.createRadialGradient(W / 2, H / 2, H * 0.26, W / 2, H / 2, W * 0.55); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.globalCompositeOperation = 'destination-in'; x.fillStyle = g; x.fillRect(0, 0, W, H); x.globalCompositeOperation = 'source-over';
  }
  function kula(x, px, py, r, kolor, alfa) { // halo, ciało, rdzeń (jak w grze, uproszczone)
    var k = KOL[kolor] || KOL.szary, a = alfa == null ? 1 : alfa; if (a <= 0) return;
    x.globalCompositeOperation = 'lighter';
    var h = x.createRadialGradient(px, py, r * 0.4, px, py, r * (kolor === 'zolty' ? 3.2 : 2.4)); h.addColorStop(0, k[1]); h.addColorStop(1, 'rgba(0,0,0,0)');
    x.globalAlpha = a * (kolor === 'zolty' ? 0.5 : 0.35); x.fillStyle = h; x.fillRect(px - r * 3.2, py - r * 3.2, r * 6.4, r * 6.4);
    x.globalCompositeOperation = 'source-over'; x.globalAlpha = a;
    var b = x.createRadialGradient(px - r * 0.3, py - r * 0.3, r * 0.1, px, py, r); b.addColorStop(0, k[0]); b.addColorStop(0.55, k[1]); b.addColorStop(1, k[2]);
    x.fillStyle = b; x.beginPath(); x.arc(px, py, r, 0, 6.2832); x.fill(); x.globalAlpha = 1;
  }
  function smuga(x, punkty, paleta, rozmiar) { // ślad z kwadratowych pikseli (ostatnie pozycje, gasnące)
    var n = punkty.length; if (n < 2) return; x.globalCompositeOperation = 'lighter';
    for (var i = 0; i < n; i++) { var u = i / n, p = punkty[i], s = (rozmiar || 3) * (0.4 + 0.6 * u); x.globalAlpha = 0.75 * u * u; x.fillStyle = paleta[i % paleta.length]; x.fillRect(p.x - s / 2 + Math.sin(i * 2.3) * 2, p.y - s / 2 + Math.cos(i * 3.1) * 2, s, s); }
    x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
  }
  function fale(x, px, py, t) { // nawoływanie: trzy pierścienie biało-błękitne rozchodzące się jak na wodzie
    x.globalCompositeOperation = 'lighter';
    for (var i = 0; i < 3; i++) { var u = ((t * 0.5 + i / 3) % 1), r = 6 + u * 34; x.globalAlpha = 0.55 * (1 - u); x.strokeStyle = i % 2 ? '#bcd9ff' : '#ffffff'; x.lineWidth = 1.2; x.beginPath(); x.arc(px, py, r, 0, 6.2832); x.stroke(); }
    x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
  }
  function nitka(x, a, b, kolor, t) { // więź jak w grze: poświata i jasny rdzeń z falującym zygzakiem
    var dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, n = 8; x.globalCompositeOperation = 'lighter';
    for (var k = 0; k < 2; k++) { x.beginPath(); x.moveTo(a.x, a.y); for (var i = 1; i < n; i++) { var u = i / n, j = Math.sin((t || 0) * (9 + 3 * k) + i * 1.9 + k * 2.7) * (k ? 2 : 3.5) * Math.sin(u * Math.PI); x.lineTo(a.x + dx * u + nx * j, a.y + dy * u + ny * j); } x.lineTo(b.x, b.y); x.strokeStyle = k ? '#ffffff' : kolor; x.lineWidth = k ? 0.9 : 2.5; x.globalAlpha = k ? 0.9 : 0.3; x.stroke(); }
    x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
  }
  function wybuch(x, px, py, u, paleta) { // u 0..1: piksele rozlatują się i gasną, błysk na początku
    if (u <= 0 || u >= 1) return; x.globalCompositeOperation = 'lighter';
    if (u < 0.25) { var g = x.createRadialGradient(px, py, 1, px, py, 40 * (0.3 + u)); g.addColorStop(0, 'rgba(255,255,255,' + (0.9 * (1 - u * 4)) + ')'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(px - 40, py - 40, 80, 80); }
    for (var i = 0; i < 26; i++) { var a = hash(i) * 6.2832, d = (10 + 50 * hash(i + 50)) * u, s = 2 + 3 * hash(i + 100); x.globalAlpha = (1 - u) * 0.9; x.fillStyle = paleta[i % paleta.length]; x.fillRect(px + Math.cos(a) * d - s / 2, py + Math.sin(a) * d - s / 2 + 12 * u * u, s, s); }
    x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
  }
  function chmura(x, px, py, r, t) { // czarna chmura: kilka nakładających się plam czerni z falującym brzegiem
    for (var i = 0; i < 5; i++) { var a = i * 1.26 + t * 0.4, ox = Math.cos(a) * r * 0.35, oy = Math.sin(a * 1.3) * r * 0.25, rr = r * (0.75 + 0.1 * Math.sin(t * 1.7 + i)); var g = x.createRadialGradient(px + ox, py + oy, rr * 0.2, px + ox, py + oy, rr); g.addColorStop(0, 'rgba(0,0,0,0.98)'); g.addColorStop(0.7, 'rgba(2,0,8,0.85)'); g.addColorStop(1, 'rgba(2,0,8,0)'); x.fillStyle = g; x.fillRect(px + ox - rr, py + oy - rr, rr * 2, rr * 2); }
  }
  function migot(u, t) { return u <= 0 ? 1 : (1 - 0.94 * Math.pow(0.5 + 0.5 * Math.sin(t * (10 + 26 * u)), 5)) * (1 - 0.3 * u); } // jak w grze: krótkie głębokie zaciemnienia coraz częstsze, przygasanie
  function slad(lista, p, maks) { lista.push({ x: p.x, y: p.y }); while (lista.length > (maks || 22)) lista.shift(); return lista; }
  function plama(cx, cy, r) { return function (i, j) { var d = Math.hypot(i * K + K / 2 - cx, j * K + K / 2 - cy); return d < r ? 1 : d < r + K ? 0.35 : 0; }; }
  // ---------- kafle: każdy ma czas pętli, pole światła, klawisze i rysuj(t) ----------
  function kafelWASD() { var sl = []; return { czas: 6, klawisze: ['W', 'A', 'S', 'D'], uklad: 'wasd', rysuj: function (x, t, kl) {
    tlo(x, null); var f = (t % 6) / 1.5, k = Math.floor(f), u = gladko(f - k), c = [{ x: 70, y: 40 }, { x: 130, y: 40 }, { x: 130, y: 80 }, { x: 70, y: 80 }], a = c[k], b = c[(k + 1) % 4], p = { x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u) };
    slad(sl, p); smuga(x, sl, PRYZMAT); kula(x, p.x, p.y, 7, 'ja'); kl(['D', 'S', 'A', 'W'][k]); } }; }
  function kafelShift() { var sl = []; return { czas: 4.5, klawisze: ['SHIFT'], rysuj: function (x, t, kl) {
    tlo(x, null); var tt = t % 4.5, sprint = tt > 1.3 && tt < 3.2, px = tt < 1.3 ? lerp(30, 60, tt / 1.3) : tt < 3.2 ? lerp(60, 170, (tt - 1.3) / 1.9) : lerp(170, 185, (tt - 3.2) / 1.3), py = 60 + Math.sin(tt * 2) * 6;
    slad(sl, { x: px, y: py }, sprint ? 30 : 12); smuga(x, sl, PRYZMAT, sprint ? 4 : 2.5); kula(x, px, py, 7, 'ja'); kl(sprint ? 'SHIFT' : null); if (tt > 4.3) sl.length = 0; } }; }
  function kafelE() { var sl = [], j = plama(140, 60, 26); return { czas: 5.5, klawisze: ['E', 'SPACE'], rysuj: function (x, t, kl) {
    var tt = t % 5.5; tlo(x, j); var g = { x: 140, y: 60 }, u1 = gladko(faza(tt, 0.2, 2.2)), razem = tt > 2.5, u2 = gladko(faza(tt, 2.8, 4.8));
    var p = { x: lerp(30, 118, u1) + (razem ? lerp(0, -70, u2) : 0), y: 60 + (razem ? lerp(0, 24, u2) : 0) }; if (razem) { g = { x: lerp(140, 70, u2) + 22, y: 60 + lerp(0, 24, u2) }; }
    if (!razem) fale(x, g.x, g.y, tt); slad(sl, p); smuga(x, sl, PRYZMAT); if (razem) nitka(x, p, g, '#8a5cff', tt); kula(x, g.x, g.y, 7, 'szary'); kula(x, p.x, p.y, 7, 'ja'); kl(tt > 2.2 && tt < 2.8 ? 'E' : null); if (tt > 5.3) sl.length = 0; } }; }
  function kafelSwiatlo() { var sl = []; return { czas: 7.5, rysuj: function (x, t) { // mrok bezpieczny; w „1” migotanie coraz szybsze i zgaśnięcie po 3 s
    var tt = t % 7.5; tlo(x, plama(130, 60, 30)); var px = tt < 1.5 ? 40 : tt < 2.5 ? lerp(40, 125, gladko((tt - 1.5))) : 125, wSw = faza(tt, 2.6, 5.4), zn = faza(tt, 5.4, 6.2);
    if (tt < 5.4) { slad(sl, { x: px, y: 60 }); smuga(x, sl, PRYZMAT); kula(x, px, 60, 7, 'ja', migot(wSw, tt)); } else sl.length = 0;
    wybuch(x, 125, 60, zn, PRYZMAT); if (tt > 6.6) kula(x, 40, 60, 7, 'ja', faza(tt, 6.6, 7.3)); } }; }
  function kafelZolta() { var sl = [], sz = []; return { czas: 6.5, rysuj: function (x, t) { // żółta poluje na „0”; w światło nie wejdzie, krótki skok przez „1” ją gubi
    var tt = t % 6.5; tlo(x, plama(115, 60, 26)); var px = tt < 2.4 ? lerp(20, 92, tt / 2.4) : tt < 3.4 ? lerp(92, 140, gladko(tt - 2.4)) : lerp(140, 180, faza(tt, 3.4, 5.5)), py = 60 + Math.sin(tt * 1.3) * 10;
    var zx = tt < 2.4 ? lerp(-20, 72, tt / 2.4) : tt < 3.4 ? lerp(72, 80, tt - 2.4) : lerp(80, 50, faza(tt, 3.4, 5.5)), zy = tt < 3.4 ? 60 + Math.sin(tt * 1.3 - 0.6) * 10 : lerp(60, 95, faza(tt, 3.4, 5.5));
    slad(sl, { x: px, y: py }, 16); slad(sz, { x: zx, y: zy }, 10); smuga(x, sz, ['#f7c43a', '#ff9a2e', '#fff1b0'], 3); smuga(x, sl, PRYZMAT); kula(x, zx, zy, 10, 'zolty'); kula(x, px, py, 7, 'ja', migot(faza(tt, 2.6, 3.4) * 0.4, tt)); if (tt > 6.3) { sl.length = 0; sz.length = 0; } } }; }
  function kafelPara() { var sl = []; return { czas: 7, rysuj: function (x, t) { // para na żółtą: anihilacja, wokół zapala się „1”, linia świtu rośnie
    var tt = t % 7, u = gladko(faza(tt, 0.2, 3)), zn = faza(tt, 3, 3.7), sw = gladko(faza(tt, 3.3, 5)), p = { x: lerp(30, 118, u), y: lerp(80, 62, u) }, g = { x: p.x - 20, y: p.y + 10 };
    tlo(x, function (i, j) { var d = Math.hypot(i * K + K / 2 - 140, j * K + K / 2 - 60); return d < 36 * sw ? 1 : 0; });
    x.fillStyle = 'rgba(214,218,224,.18)'; x.fillRect(60, 8, 80, 1); x.fillStyle = 'rgba(244,246,249,.85)'; var szer = 14 + 14 * sw; x.fillRect(100 - szer / 2, 8, szer, 1); // linia świtu
    if (zn <= 0) kula(x, 140, 60, 10, 'zolty'); wybuch(x, 140, 60, zn, ['#f7c43a', '#fff1b0', '#ff9a2e', '#ffffff']);
    slad(sl, p); smuga(x, sl, PRYZMAT); if (tt < 3.4) nitka(x, p, g, '#8a5cff', tt); kula(x, g.x, g.y, 7, 'szary'); kula(x, p.x, p.y, 7, 'ja'); if (tt > 6.8) sl.length = 0; } }; }
  function kafelWilk() { var sw = [], sj = []; return { czas: 7.5, rysuj: function (x, t) { // wilk pierwszy: przejmuje nadającą, ciągnie na żółtą, szara wybucha; gracz za późno
    var tt = t % 7.5, j = plama(70, 60, 24); tlo(x, j); var g = { x: 70, y: 60 }, u1 = gladko(faza(tt, 0.3, 1.9)), razem = tt > 2.1, u2 = gladko(faza(tt, 2.3, 4.6)), zn = faza(tt, 4.6, 5.3);
    var w = { x: lerp(185, 88, u1) + (razem ? lerp(0, 74, u2) : 0), y: lerp(100, 60, u1) + (razem ? lerp(0, 20, u2) : 0) }; if (razem) g = { x: lerp(70, 144, u2), y: lerp(60, 80, u2) };
    var jx = lerp(10, 40, gladko(faza(tt, 1, 4))); kula(x, 178, 88, 10, 'zolty'); if (!razem) fale(x, g.x, g.y, tt);
    slad(sw, w, 18); smuga(x, sw, CZERW); slad(sj, { x: jx, y: 60 }, 10); smuga(x, sj, PRYZMAT); if (razem && zn <= 0) nitka(x, w, g, '#ff5a5a', tt);
    if (zn <= 0) kula(x, g.x, g.y, 7, 'szary'); wybuch(x, 160, 84, zn, ['#b4bac8', '#f2f4ff', '#8e86b8']); if (tt < 5.3) kula(x, w.x, w.y, 7, 'czerwony'); else kula(x, lerp(160, 195, faza(tt, 5.3, 7)), lerp(84, 110, faza(tt, 5.3, 7)), 7, 'czerwony');
    kula(x, jx, 60, 7, 'ja'); if (tt > 7.3) { sw.length = 0; sj.length = 0; } } }; }
  function kafelChmura() { var sl = []; return { czas: 6.5, rysuj: function (x, t) { // chmura czerni nadciąga; w niej migotanie i po 1,5 s pochłonięcie; ucieczka to jedyne wyjście
    var tt = t % 6.5; tlo(x, null); var cx = lerp(230, 110, gladko(faza(tt, 0, 2.4))), px = tt < 2.2 ? 100 : lerp(100, 100, 1), wCz = faza(tt, 2.4, 3.9), zn = faza(tt, 3.9, 4.6);
    if (tt < 3.9) { slad(sl, { x: px, y: 62 }); smuga(x, sl, PRYZMAT); kula(x, px, 62, 7, 'ja', migot(wCz, tt)); } else sl.length = 0;
    chmura(x, cx, 60, 52, tt); wybuch(x, 100, 62, zn, PRYZMAT); if (tt > 5.4) kula(x, 30, 62, 7, 'ja', faza(tt, 5.4, 6.2)); } }; }
  function kafelSwit() { return { czas: 8, rysuj: function (x, t) { // świt: cała plansza w „1” to koniec gry; linia u góry zapełnia się od środka
    var tt = t % 8, u = gladko(faza(tt, 0.5, 6.5));
    tlo(x, function (i, j) { var d = Math.hypot(i - 4.5, (j - 2.5) * 1.6); return d < 7 * u ? 1 : d < 7 * u + 1 ? 0.35 : 0; });
    x.fillStyle = 'rgba(214,218,224,.18)'; x.fillRect(40, 8, 120, 1); x.fillStyle = 'rgba(244,246,249,.9)'; var szer = 120 * u; x.fillRect(100 - szer / 2, 8, szer, 1);
    if (u > 0.98) { x.globalCompositeOperation = 'lighter'; x.globalAlpha = 0.25 * (1 - faza(tt, 6.5, 8)); x.fillStyle = '#ffffff'; x.fillRect(0, 0, W, H); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; }
    kula(x, 100, 60, 7, 'ja'); } }; }
  // ---------- budowa DOM i pętla ----------
  function zbuduj(kontener) {
    kafle = []; kontener.textContent = '';
    var lista = [[kafelWASD(), 'tylko-klawiatura'], [kafelShift(), 'tylko-klawiatura'], [kafelE(), 'laczenie'], [kafelSwiatlo(), 'dzial'], [kafelZolta(), ''], [kafelPara(), ''], [kafelWilk(), ''], [kafelChmura(), ''], [kafelSwit(), '']];
    for (var i = 0; i < lista.length; i++) {
      var k = lista[i][0], el = document.createElement('div'), c = document.createElement('canvas'), caps = {};
      el.className = 'kafel' + (lista[i][1] ? ' ' + lista[i][1] : ''); c.width = W * SK; c.height = H * SK; el.appendChild(c);
      if (k.klawisze) { var kl = document.createElement('div'); kl.className = 'k' + (k.uklad ? ' ' + k.uklad : ''); for (var j = 0; j < k.klawisze.length; j++) { var kb = document.createElement('kbd'); kb.textContent = k.klawisze[j]; kl.appendChild(kb); caps[k.klawisze[j]] = kb; } el.appendChild(kl); }
      kontener.appendChild(el); k.el = el; k.ctx = c.getContext('2d'); k.caps = caps; k.faza = i * 0.9; kafle.push(k);
    }
    klatka(0);
  }
  function klatka(ms) {
    var t = Math.max(0, (ms - zegar0) / 1000); // pierwsza klatka rAF bywa wcześniejsza niż start(): bez ujemnego czasu
    for (var i = 0; i < kafle.length; i++) { var k = kafle[i], x = k.ctx, tt = REDUKCJA ? k.czas * 0.42 : t + k.faza, wc = null;
      x.setTransform(SK, 0, 0, SK, 0, 0); x.clearRect(0, 0, W, H);
      k.rysuj(x, tt, function (nazwa) { wc = nazwa; }); winieta(x);
      for (var n in k.caps) k.caps[n].classList.toggle('wcisniety', n === wc); }
  }
  function start() { if (petla || REDUKCJA) return; zegar0 = performance.now(); var krok = function (ms) { klatka(ms); petla = requestAnimationFrame(krok); }; petla = requestAnimationFrame(krok); }
  function stop() { if (petla) cancelAnimationFrame(petla); petla = null; }
  root.K_nauka = { zbuduj: zbuduj, start: start, stop: stop };
})(typeof self !== 'undefined' ? self : this);
