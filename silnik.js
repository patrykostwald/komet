/* Komety: silnik gry. Symulacja autorytatywna: pełny stan (z ukrytymi kolorami) żyje tylko tutaj.
   Klient dostaje wyłącznie widok(stan, id, odNr), czyli to, co dany gracz ma prawo widzieć.
   Działa w przeglądarce (window.K_silnik) i w Node (module.exports). Bez DOM, bez Math.random:
   losowość tylko z stan.los (ziarno), stały krok BALANS.TICK. Później ten sam plik idzie na serwer (Node + WebSocket). */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.K_silnik = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var BALANS = {
    R: 10,                   // promień gracza (jednostki świata = px przy skali 1)
    ZOLTA_R: 40,             // żółta 4 razy większa
    SWIAT: 3000,             // bok kwadratowej planszy (las: w polu widzenia zwykle 0-3 kropki i 1-3 żółte)
    TICK: 1 / 30,            // stały krok symulacji (s)
    PREDKOSC: 190, PREDKOSC_ZOLTEJ: 115, PREDKOSC_GONU: 135,
    SPRINT: 1.8, SPRINT_CZAS: 2.5, SPRINT_ODNOWA: 5, // Shift: 1,8x prędkości przez 2,5 s, odnowa w 5 s (smuga zdradza biegnącego)
    WIDZENIE_ZOLTEJ: 200,    // zasięg wzroku żółtej od jej środka (160 od krawędzi = 8 średnic gracza)
    WIDZENIE_GRACZA: 420,    // single (19.10 02:40): gracza żółta widzi z daleka i zawsze woli go od szarych
    ZASIEG_PROPOZYCJI: 30,   // Spacja: propozycja połączenia do 3 promieni
    ZASIEG_POLACZENIA: 60,   // połączenie pęka powyżej 6 promieni (3 średnice)
    TAP: 0.3, HOLD_E: 0.7, HOLD_SPACJA: 0.6, PROPOZYCJA: 1.5,
    ODRODZENIE: 1.5, ODRODZENIE_ZOLTEJ: 2, ODRODZENIE_ZOLTEJ_DALEKO: 1500, ZOLTE_PRZY_GRACZU: 2, ZOLTE_PRZY_MIN: 150, ZOLTE_PRZY_MAKS: 650, ZOLTE_PRZY_CZAS: 0.3, SKRET_ZOLTEJ: 2.2, TRAWIENIE: 2, UKRYCIE: 0.3, // single (19.10 05:40): ZOLTE_PRZY_*: po anihilacji gracza tyle żółtych wyłania się z mroku w tym zasięgu od zapalenia
    KOMORKA: 50, PROMIEN_ZAPALENIA: 120, PROMIEN_ZGASZENIA: 120,
    GASNIECIE_SWIATLA: 150, LASKA_SWIATLA: 300, GASNIECIE_CIEMNOSCI: 45, CEL_POKRYCIA: 1, ZAR_MIN: 8, ZAR_R: 80, ZAR_CO: 10, PROG_SWIATLA: 0.3, PROMIEN_PODTRZYMANIA: 100, // szary w „1” podtrzymuje światło wokół siebie
    EPOKA: 300, ZASIEG_WZROKU: 900, ZYCIA_START: 1, TTL_ZDARZEN: 2, // ZASIEG_WZROKU: dalej nikogo nie widać (ciemny las)
    LICZBA_ZOLTYCH: 22, ZOLTE_MIN: 22, ZOLTE_MAKS: 22, ZOLTE_STALE: true, CIEMNOSC_NA_ZOLTA: 60, // stała liczba żółtych (18.10 16:30): zabita wraca po 2 s z mroku na drugim końcu planszy // żywych żółtych: ZOLTE_MIN + ciemne komórki / CIEMNOSC_NA_ZOLTA, do ZOLTE_MAKS
    CZAS_ROZPUSZCZANIA: 3, PROMIEN_ROZPUSZCZANIA: 60, TEMPO_ROZPUSZCZANIA: 0, // wilk w świetle po 3 s rozpuszcza „1” w „0” wokół siebie (0,4/s)
    DZIURY_MIN: 20, DZIURY_MAKS: 30, DZIURA_R: 190, DZIURA_V: 22, DZIURA_ODRODZENIE: 20, DZIURY_NA_SWIATLO: 60, DZIURA_CIAG: 0.5, // czarne dziury: ruchome plamy mroku tylko po „0”, rodzą żółte
    PROG_PSA: 4,             // po współpracy (pokonana żółta) z tyloma RÓŻNYMI kropkami gracz zostaje psem pasterskim (niebieskim)
    WOLANIE: 6,              // nawoływanie (Spacja) trwa tyle sekund
    ZASIEG_ODPOWIEDZI: 55,   // E (single także Spacja) przy nawołującym w tym promieniu (środek do środka) = podczepienie; 19.10 05:00: z 30 na 55, łatwiej złapać
    ODSTEP_HOLOWANIA: 24,    // podczepiony idzie tyle za nadawcą
    LIMIT_PARY: 45,          // para bez rozstrzygnięcia rozwiązuje się sama po tylu sekundach
    ROZSWIETLENIE: 2,        // siła rozświetlenia pola przy współpracy (krotność jednego zapalenia)
    ODSTEP_ODRODZENIA: 500,  // odrodzony gracz nie bliżej niż tyle od żółtej
    CZAS_RUNDY: 300,         // single: runda 5 min, cel: jak najwięcej „1” na planszy
    BRZEG_MROKU: 0,          // 18.10 (13:30): bez stałego pasa czerni przy granicy; czerń to tylko ruchome chmury (dziury) w środku
    PRZERWA_PARY: 8,         // z tą samą kropką ponownie dopiero po tylu sekundach (okno dla czerwonych)
    WILK_MIGOT: 1,           // wilk stojący w „1” po tylu sekundach migocze: widać, że to wilk
    WILK_W_SWIETLE: 8,       // single (19.10 06:00): wilk (bot) ponad tyle sekund w „1” gaśnie i wraca z mroku (wentyl: nie wisi w wielkiej plamie)
    CZERN_ZABIJA: 1.5,       // szary (bot) w pełnej czerni (< -próg) po tylu sekundach zostaje pochłonięty; półczerń o wiele dłużej
    SZARE_PRZY_GRACZU: 2, SZARE_CO: 20, SZARE_MAKS: 9, // single (19.10 07:40): po anihilacji gracza tyle nowych szarych w „1” przy krawędzi; co tyle sekund jedna nowa przy graczu; najwyżej tyle szarych (botów) naraz
    ZALEW_MAKS: 60,          // single (19.10 03:40): okrążone „0” do tylu komórek zalewa się „1” co 5 s (tam nie da się doprowadzić żółtej)
    BLASK_PREDKOSC: 0.35, // single (19.10, właściciel): im większy blask (poziom) kulki, tym szybciej: pełny blask +35% prędkości; sprint mnoży już podniesioną prędkość
    BLASK_CZAS: 300, BLASK_ZAPALENIE: 0.12, // single (19.10 01:50): blask gracza: pełny po tylu sekundach bez śmierci, +tyle za zapalenie; śmierć zeruje
    MROK_WOLNO: 0.12, MROK_SZYBKO: 5, // single (19.10 01:20): gracz w czerni: tempo = WOLNO + SZYBKO * głębia^2,5 (pełny mrok ok. 0,3 s, półmrok ok. 3 s, skraj chmury ok. 11 s)
    SWIATLO_ZABIJA: 3,       // single (19.10 00:50): gracz w „1” bez pary gaśnie po tylu sekundach (2x dłużej niż w czerni: czas na ucieczkę)
    ODRODZENIE_DALEKO: 1200, // odrodzenie co najmniej tyle od miejsca śmierci
    OKNO_ZDRADY: 2.5,        // po zerwaniu Shiftem: jeśli ex-partner wpadnie w żółtą w tym czasie, zrywający staje się wilkiem (punkt dla czerwonych)
    ODLACZENIE: 0            // (nieużywane) odłączenie robi Shift
  };

  // ---------- narzędzia ----------
  function rng(ziarno) { // mulberry32
    var a = (ziarno >>> 0) || 1;
    return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  function odl(a, b) { var dx = a.x - b.x, dy = a.y - b.y; return Math.sqrt(dx * dx + dy * dy); }
  function klem(v, a, b) { return v < a ? a : v > b ? b : v; }
  // czy odcinek a-b przecina koło k (promień powiększony o zapas)
  function odcinekKolo(a, b, k, zapas) {
    var dx = b.x - a.x, dy = b.y - a.y, fx = a.x - k.x, fy = a.y - k.y, r = k.r + (zapas || 0);
    var A = dx * dx + dy * dy; if (A < 1e-9) return fx * fx + fy * fy <= r * r;
    var t = klem(-(fx * dx + fy * dy) / A, 0, 1), px = fx + dx * t, py = fy + dy * t;
    return px * px + py * py <= r * r;
  }
  function liniaWzroku(st, a, b) { for (var i = 0; i < st.kola.length; i++) if (odcinekKolo(a, b, st.kola[i], 0)) return false; return true; }
  function wKole(st, p, r) { for (var i = 0; i < st.kola.length; i++) { var k = st.kola[i]; if (odl(p, k) < k.r + r) return true; } return false; }
  function rozsun(st, e, lista, minOdl) { // miękkie rozsuwanie kół: gdy dwa są bliżej niż minOdl, odsuwają się po połowie
    for (var i = 0; i < lista.length; i++) { var o = lista[i]; if (o === e || o.martwa || o.martwy) continue; var dx = e.x - o.x, dy = e.y - o.y, d = Math.sqrt(dx * dx + dy * dy); if (d >= minOdl || d < 1e-6) continue;
      var p = (minOdl - d) * 0.5, ux = dx / d, uy = dy / d; e.x += ux * p; e.y += uy * p; } // tylko własna kula; druga odsunie się w swoim takcie
  }
  function koliduj(st, e, r) { // wypycha koło e (promień r) z kół przeszkód i z granic świata; do 8 przebiegów, aż nic nie nachodzi
    for (var pas = 0; pas < 8; pas++) {
      var ruszone = false;
      for (var i = 0; i < st.kola.length; i++) {
        var k = st.kola[i], dx = e.x - k.x, dy = e.y - k.y, d = Math.sqrt(dx * dx + dy * dy), min = k.r + r;
        if (d < min - 1e-3) { if (d < 1e-6) { dx = 1; dy = 0; d = 1; } e.x = k.x + dx / d * min; e.y = k.y + dy / d * min; ruszone = true; }
      }
      var S = BALANS.SWIAT, x0 = e.x, y0 = e.y; e.x = klem(e.x, r, S - r); e.y = klem(e.y, r, S - r);
      if (!ruszone && x0 === e.x && y0 === e.y) break;
    }
  }
  function wMroku(st, g) { return g.czerwony && st.pole && st.pole.w[komorka(st.pole, g.x, g.y)] < -BALANS.PROG_SWIATLA; } // czerwony w czerni (< -próg) znika z danych innych
  function gracz(st, id) { for (var i = 0; i < st.gracze.length; i++) if (st.gracze[i].id === id) return st.gracze[i]; return null; }
  function zdarzenie(st, z) { z.nr = ++st.nrZdarzenia; z.czas = st.czas; st.zdarzenia.push(z); return z; }

  // ---------- pole bitów (księga główna): w[i] w [-1, 1], >0 światło („1”), <0 ciemność („0”) ----------
  function nowePole(los) {
    var n = Math.round(BALANS.SWIAT / BALANS.KOMORKA), c = (n - 1) / 2, dmax = Math.sqrt(2) * c;
    var p = { n: n, k: BALANS.KOMORKA, w: new Float32Array(n * n), baza: new Uint8Array(n * n), widoczne: new Uint8Array(n * n), wersja: 0, udzial: { jasne: 0, ciemne: 0, komorek: n * n } };
    for (var j = 0; j < n; j++) for (var i = 0; i < n; i++) { // cała mapa to kod 0 1 0 1 (drobne przerwy dla oddechu)
      p.baza[j * n + i] = los() < 0.5 ? 0 : 1; p.widoczne[j * n + i] = los() < 0.9 ? 1 : 0;
    }
    void c; void dmax;
    return p;
  }
  function komorka(p, x, y) { var i = klem(Math.floor(x / p.k), 0, p.n - 1), j = klem(Math.floor(y / p.k), 0, p.n - 1); return j * p.n + i; }
  function swiatlo(st, x, y) { return st.pole.w[komorka(st.pole, x, y)]; }
  function zmienPole(st, x, y, prom, znak) {
    var p = st.pole, i0 = Math.max(0, Math.floor((x - prom) / p.k)), i1 = Math.min(p.n - 1, Math.floor((x + prom) / p.k));
    var j0 = Math.max(0, Math.floor((y - prom) / p.k)), j1 = Math.min(p.n - 1, Math.floor((y + prom) / p.k));
    for (var j = j0; j <= j1; j++) for (var i = i0; i <= i1; i++) {
      var cx = (i + .5) * p.k, cy = (j + .5) * p.k, d = Math.sqrt((cx - x) * (cx - x) + (cy - y) * (cy - y));
      if (d > prom) continue;
      var f = 1 - d / prom, idx = j * p.n + i; p.w[idx] = klem(p.w[idx] + znak * (0.45 + 0.55 * f), -1, 1);
      if (znak > 0) { if (!p.odn) p.odn = new Float32Array(p.w.length); p.odn[idx] = st.czas; } // świeże światło: okres łaski liczony od zapalenia
    }
    p.wersja++;
  }
  function rozpuszcz(st, x, y, prom, ile) { // światło („1”) opada ku „0”, nigdy poniżej zera
    var p = st.pole, i0 = Math.max(0, Math.floor((x - prom) / p.k)), i1 = Math.min(p.n - 1, Math.floor((x + prom) / p.k));
    var j0 = Math.max(0, Math.floor((y - prom) / p.k)), j1 = Math.min(p.n - 1, Math.floor((y + prom) / p.k));
    for (var j = j0; j <= j1; j++) for (var i = i0; i <= i1; i++) {
      var cx = (i + .5) * p.k, cy = (j + .5) * p.k, d = Math.sqrt((cx - x) * (cx - x) + (cy - y) * (cy - y)); if (d > prom) continue;
      var idx = j * p.n + i; if (p.w[idx] > 0) p.w[idx] = Math.max(0, p.w[idx] - ile * (0.5 + 0.5 * (1 - d / prom)));
    }
    p.wersja++;
  }
  function gasnijPole(st, dt) { // światło gaśnie, chyba że podtrzymuje je obecność szarego (w promieniu PROMIEN_PODTRZYMANIA); mrok blaknie zawsze
    var p = st.pole, ds = dt / BALANS.GASNIECIE_SWIATLA, dc = dt / BALANS.GASNIECIE_CIEMNOSCI, i;
    if (!p.podtrzymane) p.podtrzymane = new Uint8Array(p.w.length); var pod = p.podtrzymane; pod.fill(0);
    for (var g = 0; g < st.gracze.length; g++) {
      var q = st.gracze[g]; if (q.martwy || q.czerwony || q.pies || p.w[komorka(p, q.x, q.y)] <= 0) continue;
      var R = BALANS.PROMIEN_PODTRZYMANIA, i0 = Math.max(0, Math.floor((q.x - R) / p.k)), i1 = Math.min(p.n - 1, Math.floor((q.x + R) / p.k)), j0 = Math.max(0, Math.floor((q.y - R) / p.k)), j1 = Math.min(p.n - 1, Math.floor((q.y + R) / p.k));
      for (var j = j0; j <= j1; j++) for (i = i0; i <= i1; i++) { var cx = (i + .5) * p.k - q.x, cy = (j + .5) * p.k - q.y; if (cx * cx + cy * cy <= R * R) pod[j * p.n + i] = 1; }
    }
    for (i = 0; i < p.w.length; i++) { var v = p.w[i]; if (v > 0) { if (!pod[i] && (!p.odn || st.czas - p.odn[i] > BALANS.LASKA_SWIATLA)) p.w[i] = v > ds ? v - ds : 0; } else if (v < 0) p.w[i] = v < -dc ? v + dc : 0; } // „1” gaśnie dopiero po okresie łaski, chyba że ktoś w nim stoi
    if (!p.brzeg) { p.brzeg = new Uint8Array(p.w.length); var kb = Math.ceil(BALANS.BRZEG_MROKU / p.k); for (var j = 0; j < p.n; j++) for (i = 0; i < p.n; i++) if (i < kb || j < kb || i >= p.n - kb || j >= p.n - kb) p.brzeg[j * p.n + i] = 1; }
    for (i = 0; i < p.w.length; i++) if (p.brzeg[i] && p.w[i] > -0.7) p.w[i] = -0.7; // granice planszy: stała czerń
  }
  function udzialPola(st) {
    var p = st.pole, j = 0, c = 0, prog = BALANS.PROG_SWIATLA;
    for (var i = 0; i < p.w.length; i++) { if (p.w[i] > prog) j++; else if (p.w[i] < -prog) c++; }
    p.udzial = { jasne: j, ciemne: c, komorek: p.w.length }; if (j > st.rekordJasne) st.rekordJasne = j; return p.udzial;
  }

  // ---------- stan ----------
  function nowyGracz(o) {
    return { id: o.id, bot: !!o.bot, osobowosc: o.osobowosc || null, tylkoSzary: !!o.tylkoSzary, x: 0, y: 0, vx: 0, vy: 0, zycia: BALANS.ZYCIA_START, czerwony: !!o.czerwony, pies: !!o.pies, zjadl: !!o.czerwony, spacjaOd: -1e9,
      polaczenie: null, lider: false, polaczonyOd: 0, wolanie: -1e9, ukryty: false, czasBezruchu: 0, rozpuszcza: 0, kryjowka: -1, martwy: false, odrodzenie: 0,
      sprint: 1, sprintuje: false, partnerzy: {}, kolorOd: -1, ostatniaPara: {}, wCzerni: 0, wSwietle: 0, wSw: 0, nadaje: -1e9, blask: 0, // partnerzy: z kim pokonano żółtą (różni, do progu psa); kolorOd: kiedy przestał być szary
      klaw: { spacja: false, c: false, e: false, shift: false },
      stat: { wspolprace: 0, zolte: 0, zjedzeni: 0, zdrady: 0, ugryzienia: 0, polaczenia: 0, wilki: 0, padniecia: 0 } };
  }
  function nowaZolta(i) { return { id: 'z' + i, x: 0, y: 0, vx: 0, vy: 0, cel: null, goni: null, pamiec: null, wezwanie: null, trawienie: 0, odrodzenie: 0, martwa: false, ai: {} }; }
  function celDziur(st) { var u = st.pole.udzial || { jasne: 0 }; return klem(BALANS.DZIURY_MIN + Math.floor(u.jasne / BALANS.DZIURY_NA_SWIATLO), BALANS.DZIURY_MIN, BALANS.DZIURY_MAKS); } // im więcej światła, tym więcej dziur
  function rozstawDziury(st, d) { // chmury wokół jednej plamy światła: najwyżej 4 (piąta i dalsze puszczają na 20 s) i rozstawione po okręgu, by zawsze zostały co najmniej dwie furtki
    var sasiedzi = [], i, blizej = 0; for (i = 0; i < st.dziury.length; i++) { var o = st.dziury[i]; if (o !== d && o.cel && odl(o.cel, d.cel) < 150) { sasiedzi.push(o); if (odl(o, o.cel) < odl(d, d.cel)) blizej++; } }
    if (blizej >= 4) { d.cel = null; d.wolny = st.czas + 20; return; }
    var a0 = Math.atan2(d.y - d.cel.y, d.x - d.cel.x), naj = 10, znak = 0;
    for (i = 0; i < sasiedzi.length; i++) { var a1 = Math.atan2(sasiedzi[i].y - d.cel.y, sasiedzi[i].x - d.cel.x), r = Math.atan2(Math.sin(a1 - a0), Math.cos(a1 - a0)); if (Math.abs(r) < naj) { naj = Math.abs(r); znak = r > 0 ? -1 : 1; } }
    d.bok = naj < 1.3 ? znak : 0; // sąsiad bliżej niż 75 stopni: odsuwam się po okręgu
  }
  function najblizszeSwiatloDziury(st, d) { // najbliższa jasna komórka (> próg) w promieniu 800, próbkowana co 3 komórki; mrok ciągnie do światła i je otacza
    var p = st.pole, k = p.k, n = p.n, zas = 800, best = null, bd = zas * zas, i0 = Math.max(0, Math.floor((d.x - zas) / k)), i1 = Math.min(n - 1, Math.floor((d.x + zas) / k)), j0 = Math.max(0, Math.floor((d.y - zas) / k)), j1 = Math.min(n - 1, Math.floor((d.y + zas) / k));
    for (var j = j0; j <= j1; j += 3) for (var i = i0; i <= i1; i += 3) { if (p.w[j * n + i] <= BALANS.PROG_SWIATLA) continue; var cx = (i + 0.5) * k - d.x, cy = (j + 0.5) * k - d.y, q = cx * cx + cy * cy; if (q < bd) { bd = q; best = { x: (i + 0.5) * k, y: (j + 0.5) * k }; } }
    return best;
  }
  function celZoltych(st) { if (BALANS.ZOLTE_STALE) return BALANS.ZOLTE_MIN; var u = st.pole.udzial || { ciemne: 0 }; return klem(BALANS.ZOLTE_MIN + Math.floor(u.ciemne / BALANS.CIEMNOSC_NA_ZOLTA) + Math.max(0, st.dziury.length - BALANS.DZIURY_MIN), BALANS.ZOLTE_MIN, BALANS.ZOLTE_MAKS); }
  // ---------- czarne dziury: ruchome plamy mroku, tylko po „0”; światło je rozpuszcza; z nich rodzą się żółte ----------
  function nowaDziura(st, x, y, r) { return { id: 'd' + (st.nrDziury++), x: x, y: y, r: r || BALANS.DZIURA_R, kat: st.los() * Math.PI * 2 }; }
  function miejsceDziury(st) { // losowe miejsce poza światłem, z dala od graczy
    var S = BALANS.SWIAT, p = { x: S / 2, y: S / 2 };
    for (var n = 0; n < 60; n++) {
      var q = { x: 150 + st.los() * (S - 300), y: 150 + st.los() * (S - 300) }, ok = swiatlo(st, q.x, q.y) <= BALANS.PROG_SWIATLA && !wKole(st, q, 40);
      for (var i = 0; ok && i < st.gracze.length; i++) if (!st.gracze[i].martwy && odl(st.gracze[i], q) < 500) ok = false;
      if (ok) return q; p = q;
    }
    return p;
  }
  function krokDziur(st, dt) {
    var p = st.pole, S = BALANS.SWIAT, i, d;
    for (i = st.dziury.length - 1; i >= 0; i--) {
      d = st.dziury[i];
      if (swiatlo(st, d.x, d.y) > BALANS.PROG_SWIATLA) { d.r -= dt * 45; if (d.r < 35) { st.dziury.splice(i, 1); continue; } } // światło rozpuszcza mrok
      else if (d.r < BALANS.DZIURA_R) d.r = Math.min(BALANS.DZIURA_R, d.r + dt * 10);
      d.kat += (st.los() - 0.5) * dt * 1.4;
      if (st.tick % 15 === 0) { d.cel = d.wolny > st.czas ? null : najblizszeSwiatloDziury(st, d); d.bok = 0; if (d.cel) rozstawDziury(st, d); }
      if (d.cel) { var chce = Math.atan2(d.cel.y - d.y, d.cel.x - d.x), roz = Math.atan2(Math.sin(chce - d.kat), Math.cos(chce - d.kat)); d.kat += Math.max(-BALANS.DZIURA_CIAG * dt, Math.min(BALANS.DZIURA_CIAG * dt, roz)); d.kat += (d.bok || 0) * 0.5 * dt; } // ciąg do światła, odsuwanie od sąsiedniej chmury
      var nx = d.x + Math.cos(d.kat) * BALANS.DZIURA_V * dt, ny = d.y + Math.sin(d.kat) * BALANS.DZIURA_V * dt;
      if (nx < 120 || ny < 120 || nx > S - 120 || ny > S - 120 || swiatlo(st, nx, ny) > BALANS.PROG_SWIATLA || swiatlo(st, nx + Math.cos(d.kat) * d.r * 0.85, ny + Math.sin(d.kat) * d.r * 0.85) > 0.05) d.kat += Math.PI * 0.6 + st.los() * 0.8; // tylko po „0”; krawędź chmury nie wchodzi na światło (otacza je)
      else { d.x = nx; d.y = ny; }
      if (st.tick % 5 === 0) { // mrok pod dziurą
        var i0 = Math.max(0, Math.floor((d.x - d.r) / p.k)), i1 = Math.min(p.n - 1, Math.floor((d.x + d.r) / p.k)), j0 = Math.max(0, Math.floor((d.y - d.r) / p.k)), j1 = Math.min(p.n - 1, Math.floor((d.y + d.r) / p.k));
        for (var j = j0; j <= j1; j++) for (var ii = i0; ii <= i1; ii++) { var cx = (ii + .5) * p.k - d.x, cy = (j + .5) * p.k - d.y; if (cx * cx + cy * cy <= d.r * d.r) { var idx = j * p.n + ii; if (p.w[idx] > -0.6 && p.w[idx] <= 0) p.w[idx] = -0.6; } }
      }
    }
    if (st.dziury.length < celDziur(st)) { st.dziuraOdrodzenie -= dt; if (st.dziuraOdrodzenie <= 0) { var m = miejsceDziury(st); st.dziury.push(nowaDziura(st, m.x, m.y)); st.dziuraOdrodzenie = BALANS.DZIURA_ODRODZENIE; } }
  }

  function nowyStan(o) {
    var los = rng(o.ziarno || 1);
    var st = { czas: 0, tick: 0, los: los, ziarno: o.ziarno || 1, B: BALANS, gracze: [], zolte: [], zdarzenia: [], nrZdarzenia: 0,
      epoka: 0, dziennikEpok: [], kola: [], kryjowki: [], przeszkody: [], pole: null, ai: o.ai || null, runda: o.runda || 0, cel: o.cel || 0, koniec: false, rekordJasne: 0, // cel: ułamek komórek w „1”, przy którym gra kończy się świtem
      wynik: { niebiescy: 0, czerwoni: 0 }, dziury: [], nrDziury: 0, dziuraOdrodzenie: 0 }; // punkty stron: niebiescy za padłego wilka, czerwoni za pożartego gracza
    st.przeszkody = o.generuj(los, BALANS);
    st.przeszkody.forEach(function (p, pi) {
      p.kola.forEach(function (k) { st.kola.push(k); });
      p.kryjowki.forEach(function (k) { st.kryjowki.push({ x: k.x, y: k.y, przeszkoda: pi }); });
    });
    st.pole = nowePole(los);
    (o.gracze || []).forEach(function (g) { st.gracze.push(nowyGracz(g)); });
    st.gracze.forEach(function (g) { umiesc(st, g); });
    for (var di = 0; di < BALANS.DZIURY_MIN; di++) { var md = miejsceDziury(st); st.dziury.push(nowaDziura(st, md.x, md.y)); }
    for (var i = 0; i < BALANS.ZOLTE_MAKS; i++) st.zolte.push(nowaZolta(i));
    st.zolte.forEach(function (z, i) { if (i < BALANS.LICZBA_ZOLTYCH) umiescZolta(st, z); else { z.martwa = true; z.odrodzenie = 0; } }); // reszta czeka na ciemność
    udzialPola(st);
    return st;
  }
  function wolnaKryjowka(st, odstepZolte, daleko) {
    var kandydaci = st.kryjowki.filter(function (k) {
      if (daleko && odl(k, daleko) < BALANS.ODRODZENIE_DALEKO) return false; // z dala od miejsca śmierci
      for (var i = 0; i < st.gracze.length; i++) { var g = st.gracze[i]; if (!g.martwy && odl(g, k) < BALANS.R * 3) return false; }
      for (var j = 0; j < st.zolte.length; j++) { var z = st.zolte[j]; if (!z.martwa && odl(z, k) < odstepZolte) return false; }
      return true;
    });
    if (!kandydaci.length && daleko) return wolnaKryjowka(st, odstepZolte, null);
    if (!kandydaci.length) kandydaci = st.kryjowki;
    return kandydaci[Math.floor(st.los() * kandydaci.length)];
  }
  function wolneMiejsce(st, r, odstepZolte, daleko) { // losowe miejsce poza przeszkodami, daleko od żółtych i innych graczy (plansza bez kryjówek)
    var p = { x: BALANS.SWIAT / 2, y: BALANS.SWIAT / 2 };
    for (var n = 0; n < 80; n++) {
      var m0 = BALANS.BRZEG_MROKU + 80, q = { x: m0 + st.los() * (BALANS.SWIAT - 2 * m0), y: m0 + st.los() * (BALANS.SWIAT - 2 * m0) }, ok = !wKole(st, q, r) && swiatlo(st, q.x, q.y) > -BALANS.PROG_SWIATLA; // odrodzenie poza obwódką i poza mrokiem
      for (var i = 0; ok && i < st.zolte.length; i++) if (!st.zolte[i].martwa && odl(st.zolte[i], q) < odstepZolte) ok = false;
      for (var j = 0; ok && j < st.gracze.length; j++) if (!st.gracze[j].martwy && odl(st.gracze[j], q) < 60) ok = false;
      if (ok && daleko && n < 60 && odl(q, daleko) < BALANS.ODRODZENIE_DALEKO) ok = false; // z dala od miejsca śmierci: nie pamiętasz, gdzie kto lata
      if (ok) return q; p = q;
    }
    return p;
  }
  function odswiezPlame(st, x, y) { // dołączony blok odświeża całą plamę „1”: wszystkie połączone jasne komórki dostają nowy czas (okres łaski od nowa)
    var p = st.pole; if (!p.odn) return; var start = komorka(p, x, y), stos = [start], byl = new Uint8Array(p.w.length); byl[start] = 1;
    while (stos.length) {
      var c = stos.pop(); if (p.w[c] <= BALANS.PROG_SWIATLA) continue; p.odn[c] = st.czas; var ci = c % p.n, cj = (c - ci) / p.n;
      if (ci > 0 && !byl[c - 1]) { byl[c - 1] = 1; stos.push(c - 1); } if (ci < p.n - 1 && !byl[c + 1]) { byl[c + 1] = 1; stos.push(c + 1); }
      if (cj > 0 && !byl[c - p.n]) { byl[c - p.n] = 1; stos.push(c - p.n); } if (cj < p.n - 1 && !byl[c + p.n]) { byl[c + p.n] = 1; stos.push(c + p.n); }
    }
  }
  function przyBrzegu(p, i, j) { for (var dj = -2; dj <= 2; dj++) for (var di = -2; di <= 2; di++) { var ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= p.n || jj >= p.n) return true; if (p.w[jj * p.n + ii] <= BALANS.PROG_SWIATLA) return true; } return false; } // jasna komórka z ciemnością (albo brzegiem planszy) w odległości 2
  function miejsceWSwietle(st, daleko, rozproszone) { // jasna komórka co najmniej ODRODZENIE_DALEKO od miejsca śmierci, bez żółtej obok; pierwszeństwo mają te, przy których kryje się szara kropka (250); rozproszone (szare boty w single): odwrotnie, plama bez szarej
    var p = st.pole, zwykle = [], dobre = [];
    for (var j = 0; j < p.n; j += 2) for (var i = 0; i < p.n; i += 2) {
      if (p.w[j * p.n + i] <= BALANS.PROG_SWIATLA) continue; var q = { x: (i + .5) * p.k, y: (j + .5) * p.k };
      if (odl(q, daleko) < BALANS.ODRODZENIE_DALEKO || wKole(st, q, BALANS.R)) continue;
      if (rozproszone && !przyBrzegu(p, i, j)) continue; // szara (single) odradza się tylko przy krawędzi plamy (19.10 05:20): w środku wielkiej plamy nikt by jej nie dosięgnął
      var zle = false, szara = false, z;
      for (z = 0; z < st.zolte.length && !zle; z++) if (!st.zolte[z].martwa && odl(st.zolte[z], q) < BALANS.ODSTEP_ODRODZENIA) zle = true;
      if (zle) continue;
      for (z = 0; z < st.gracze.length; z++) { var o = st.gracze[z]; if (o.bot && !o.martwy && !o.czerwony && !o.pies && odl(o, q) < 250) szara = true; }
      ((rozproszone ? !szara : szara) ? dobre : zwykle).push(q);
    }
    var lista = dobre.length ? dobre : zwykle; return lista.length ? lista[Math.floor(st.los() * lista.length)] : null;
  }
  function miejsceWMroku(st, daleko) { // single (18.10 21:40): gracz odradza się na „0” (nie w „1”, nie w czerni), ODRODZENIE_DALEKO od śmierci, bez żółtej i chmury obok; najlepiej blisko światła (szara w 400)
    var p = st.pole, zwykle = [], dobre = [];
    for (var j = 0; j < p.n; j += 2) for (var i = 0; i < p.n; i += 2) {
      var wv = p.w[j * p.n + i]; if (wv > BALANS.PROG_SWIATLA || wv < -BALANS.PROG_SWIATLA * 0.5) continue; var q = { x: (i + .5) * p.k, y: (j + .5) * p.k };
      if (odl(q, daleko) < BALANS.ODRODZENIE_DALEKO || wKole(st, q, BALANS.R)) continue;
      var zle = false, z;
      for (z = 0; z < st.zolte.length && !zle; z++) if (!st.zolte[z].martwa && odl(st.zolte[z], q) < BALANS.ODSTEP_ODRODZENIA) zle = true;
      for (z = 0; z < st.dziury.length && !zle; z++) if (odl(st.dziury[z], q) < st.dziury[z].r + 80) zle = true;
      if (zle) continue;
      var szara = false; for (z = 0; z < st.gracze.length; z++) { var o = st.gracze[z]; if (o.bot && !o.martwy && !o.czerwony && !o.pies && odl(o, q) < 400) szara = true; }
      (szara ? dobre : zwykle).push(q);
    }
    var lista = dobre.length ? dobre : zwykle; return lista.length ? lista[Math.floor(st.los() * lista.length)] : null;
  }
  function zalewaj(st) { // single (19.10 03:40): okrążone „0”: komponent ciemnych komórek (4-sąsiedztwo) bez styku z brzegiem i nie większy niż ZALEW_MAKS zmienia się w „1”
    var p = st.pole, n = p.n, odw = new Uint8Array(n * n), stos = [], zalane = 0;
    for (var s = 0; s < n * n; s++) {
      if (odw[s] || p.w[s] > BALANS.PROG_SWIATLA) continue;
      var kom = [], brzeg = false; stos.length = 0; stos.push(s); odw[s] = 1;
      while (stos.length) { var c = stos.pop(); kom.push(c); var ci = c % n, cj = (c - ci) / n; if (ci === 0 || cj === 0 || ci === n - 1 || cj === n - 1) brzeg = true;
        var sas = [ci > 0 ? c - 1 : -1, ci < n - 1 ? c + 1 : -1, cj > 0 ? c - n : -1, cj < n - 1 ? c + n : -1];
        for (var q = 0; q < 4; q++) { var d = sas[q]; if (d >= 0 && !odw[d] && p.w[d] <= BALANS.PROG_SWIATLA) { odw[d] = 1; stos.push(d); } } }
      if (brzeg || kom.length > BALANS.ZALEW_MAKS) continue;
      if (!p.odn) p.odn = new Float32Array(p.w.length); var sx = 0, sy = 0;
      for (var k = 0; k < kom.length; k++) { var idx = kom[k]; p.w[idx] = 1; p.odn[idx] = st.czas; sx += (idx % n + .5) * p.k; sy += (Math.floor(idx / n) + .5) * p.k; }
      zalane += kom.length; zdarzenie(st, { typ: 'zalew', x: sx / kom.length, y: sy / kom.length, komorek: kom.length });
    }
    if (!zalane) return; p.wersja++; udzialPola(st);
    for (var zi = 0; zi < st.zolte.length; zi++) { var z = st.zolte[zi]; if (!z.martwa && p.w[komorka(p, z.x, z.y)] > BALANS.PROG_SWIATLA) { z.martwa = true; z.odrodzenie = BALANS.ODRODZENIE_ZOLTEJ; z.goni = null; z.wezwanie = null; z.vx = z.vy = 0; z.smierc = { x: z.x, y: z.y }; } } // żółta zalana światłem odradza się w mroku
    for (var di = 0; di < st.dziury.length; di++) { var dz = st.dziury[di]; if (p.w[komorka(p, dz.x, dz.y)] > BALANS.PROG_SWIATLA) { var m = miejsceDziury(st); if (m) { dz.x = m.x; dz.y = m.y; } } } // chmura zalana światłem przenosi się
  }
  function zar(st) { // żar: w single zawsze tli się kilka małych „1” (schronienie i miejsce spotkań); gdy jasnych komórek mało, zapala się nowy żar z dala od chmur
    var u = st.pole.udzial || udzialPola(st); if (u.jasne >= BALANS.ZAR_MIN * 8) return;
    for (var n = 0; n < 80; n++) {
      var q = { x: 200 + st.los() * (BALANS.SWIAT - 400), y: 200 + st.los() * (BALANS.SWIAT - 400) }; if (swiatlo(st, q.x, q.y) !== 0 || wKole(st, q, BALANS.ZAR_R)) continue;
      var blisko = false; for (var i = 0; i < st.dziury.length; i++) if (odl(q, st.dziury[i]) < st.dziury[i].r + 40) blisko = true; if (blisko) continue;
      zmienPole(st, q.x, q.y, BALANS.ZAR_R, 1); zdarzenie(st, { typ: 'zar', x: q.x, y: q.y, promien: BALANS.ZAR_R }); return;
    }
  }
  function umiesc(st, g) {
    var k = st.kryjowki.length ? wolnaKryjowka(st, BALANS.ODSTEP_ODRODZENIA, g.smierc) : null, m0 = g.smierc ? (!g.bot ? (g.tylkoSzary ? miejsceWMroku(st, g.smierc) : miejsceWSwietle(st, g.smierc)) : (st.cel && !g.czerwony && !g.pies ? miejsceWSwietle(st, g.smierc, true) : (st.cel && g.czerwony ? miejsceDziury(st) : null))) : null; // single: człowiek odradza się na „0” blisko światła, szara (bot) w „1” bez innej szarej; multi: człowiek w „1”
    if (m0) { g.x = m0.x; g.y = m0.y; } else if (k) { g.x = k.x; g.y = k.y; } else { var m = wolneMiejsce(st, BALANS.R, BALANS.ODSTEP_ODRODZENIA, g.smierc); g.x = m.x; g.y = m.y; }
    koliduj(st, g, BALANS.R);
    g.vx = g.vy = 0; g.wSw = 0; g.nadaje = -1e9; g.martwy = false; g.odrodzenie = 0; g.ukryty = false; g.czasBezruchu = 0; g.kryjowka = -1; g.wolanie = -1e9; g.lider = false;
  }
  function zyweZolte(st) { var n = 0; for (var i = 0; i < st.zolte.length; i++) if (!st.zolte[i].martwa) n++; return n; }
  function mrokPrzy(st, pt, rMin, rMaks) { // ciemna komórka w pierścieniu rMin-rMaks od punktu, poza chmurą i przeszkodą, nie bliżej niż 200 od kulek; pierwszeństwo: tuż za krawędzią światła (jasna komórka w odległości 2)
    var p = st.pole, kraw = [], inne = [], i0 = klem(Math.floor((pt.x - rMaks) / p.k), 1, p.n - 2), i1 = klem(Math.floor((pt.x + rMaks) / p.k), 1, p.n - 2), j0 = klem(Math.floor((pt.y - rMaks) / p.k), 1, p.n - 2), j1 = klem(Math.floor((pt.y + rMaks) / p.k), 1, p.n - 2);
    for (var j = j0; j <= j1; j++) for (var i = i0; i <= i1; i++) {
      if (p.w[j * p.n + i] > BALANS.PROG_SWIATLA) continue; var q = { x: (i + .5) * p.k, y: (j + .5) * p.k }, d = odl(q, pt); if (d < rMin || d > rMaks || wKole(st, q, BALANS.ZOLTA_R + 4)) continue;
      var zle = false, k; for (k = 0; k < st.dziury.length && !zle; k++) if (odl(st.dziury[k], q) < st.dziury[k].r + 40) zle = true; for (k = 0; k < st.gracze.length && !zle; k++) if (!st.gracze[k].martwy && odl(st.gracze[k], q) < 120) zle = true;
      if (zle) continue;
      var przyKraw = false; for (var dj = -2; dj <= 2 && !przyKraw; dj++) for (var di = -2; di <= 2; di++) { var ii = i + di, jj = j + dj; if (ii >= 0 && jj >= 0 && ii < p.n && jj < p.n && p.w[jj * p.n + ii] > BALANS.PROG_SWIATLA) { przyKraw = true; break; } }
      (przyKraw ? kraw : inne).push(q);
    }
    var lista = kraw.length ? kraw : inne; return lista.length ? lista[Math.floor(st.los() * lista.length)] : null;
  }
  function liczbaSzarych(st) { var n = 0; for (var i = 0; i < st.gracze.length; i++) { var g = st.gracze[i]; if (g.bot && !g.czerwony && !g.pies) n++; } return n; }
  function miejsceSzarejPrzy(st, pt) { // jasna komórka przy krawędzi plamy, 150-500 od punktu, nie bliżej niż 120 od kulek; inaczej dowolna jasna przy krawędzi
    var p = st.pole, lista = [], i0 = klem(Math.floor((pt.x - 500) / p.k), 0, p.n - 1), i1 = klem(Math.floor((pt.x + 500) / p.k), 0, p.n - 1), j0 = klem(Math.floor((pt.y - 500) / p.k), 0, p.n - 1), j1 = klem(Math.floor((pt.y + 500) / p.k), 0, p.n - 1);
    for (var j = j0; j <= j1; j++) for (var i = i0; i <= i1; i++) {
      if (p.w[j * p.n + i] <= BALANS.PROG_SWIATLA || !przyBrzegu(p, i, j)) continue; var q = { x: (i + .5) * p.k, y: (j + .5) * p.k }, d = odl(q, pt); if (d < 60 || d > 500 || wKole(st, q, BALANS.R)) continue;
      var zle = false; for (var k = 0; k < st.gracze.length && !zle; k++) if (!st.gracze[k].martwy && odl(st.gracze[k], q) < 120) zle = true; if (!zle) lista.push(q);
    }
    if (lista.length) return lista[Math.floor(st.los() * lista.length)];
    var naj = null, nd = 1e9; for (j = 0; j < p.n; j++) for (i = 0; i < p.n; i++) { if (p.w[j * p.n + i] <= BALANS.PROG_SWIATLA || !przyBrzegu(p, i, j)) continue; var q2 = { x: (i + .5) * p.k, y: (j + .5) * p.k }, d2 = odl(q2, pt); if (d2 >= 60 && d2 < nd && !wKole(st, q2, BALANS.R)) { nd = d2; naj = q2; } }
    return naj;
  }
  function nowaSzara(st, pt) { // single: nowa szara (bot) w „1” przy krawędzi plamy blisko punktu; klient dorabia jej pamięć AI
    var osoby = ['budowniczy', 'ostrozny', 'chciwy']; st.licznikSzarych = (st.licznikSzarych || 0) + 1;
    var g = nowyGracz({ id: 'szara' + st.licznikSzarych, bot: true, osobowosc: osoby[st.licznikSzarych % 3] }); st.gracze.push(g);
    var m = miejsceSzarejPrzy(st, pt); if (m) { g.x = m.x; g.y = m.y; } else umiesc(st, g); koliduj(st, g, BALANS.R);
    zdarzenie(st, { typ: 'przybycie', x: g.x, y: g.y, kto: g.id }); return g;
  }
  function przywolajZolte(st, pt) { // single: po anihilacji gracza ZOLTE_PRZY_GRACZU żółtych wróci blisko: zabite (martwe) najpierw, potem dalekie, niezajęte
    var ile = BALANS.ZOLTE_PRZY_GRACZU, i, z;
    for (i = 0; i < st.zolte.length && ile > 0; i++) { z = st.zolte[i]; if (z.martwa && !z.przyOdrodzeniu) { z.przyOdrodzeniu = { x: pt.x, y: pt.y }; z.smierc = null; z.odrodzenie = Math.min(z.odrodzenie, BALANS.ZOLTE_PRZY_CZAS); ile--; } } // od razu (po rozpadzie)
    var dalekie = []; for (i = 0; i < st.zolte.length; i++) { z = st.zolte[i]; if (!z.martwa && z.goni == null && !z.wezwanie && z.trawienie <= 0 && odl(z, pt) > 1100) dalekie.push(z); }
    dalekie.sort(function (p, q) { return odl(q, pt) - odl(p, pt); }); // najdalsze wolne żółte przenoszą się bliżej gracza
    for (i = 0; i < dalekie.length && ile > 0; i++) { z = dalekie[i]; z.martwa = true; z.odrodzenie = BALANS.ZOLTE_PRZY_CZAS + 0.2; z.vx = z.vy = 0; z.goni = null; z.przyOdrodzeniu = { x: pt.x, y: pt.y }; z.smierc = null; ile--; }
  }
  function umiescZolta(st, z, przy) { // rodzi się w ciemności (pole < -próg), inaczej losowo; daleko od graczy i poza przeszkodami. „przy”: wyłania się z mroku obok wilka
    var p = st.pole, ciemne = [];
    for (var i = 0; i < p.w.length; i++) if (p.w[i] < -BALANS.PROG_SWIATLA) ciemne.push(i);
    var proba = null, ok = false, n = 0;
    if (!przy && st.dziury.length) { var dz = null, dzd = -1; for (var pr = 0; pr < 8; pr++) { var kand = st.dziury[Math.floor(st.los() * st.dziury.length)], ddk = z.smierc ? odl(kand, z.smierc) : 1e9; if (ddk > dzd) { dzd = ddk; dz = kand; } if (ddk >= BALANS.ODRODZENIE_ZOLTEJ_DALEKO) break; } przy = { x: dz.x, y: dz.y }; } // żółte rodzą się z czarnych dziur; po śmierci z dziury daleko od miejsca śmierci
    while (!ok && n++ < 60) {
      if (przy && n < 20) { var a = st.los() * Math.PI * 2, r = 20 + st.los() * 60; proba = { x: klem(przy.x + Math.cos(a) * r, 60, BALANS.SWIAT - 60), y: klem(przy.y + Math.sin(a) * r, 60, BALANS.SWIAT - 60) }; }
      else if (ciemne.length && n < 40) { var c = ciemne[Math.floor(st.los() * ciemne.length)]; proba = { x: (c % p.n + .5) * p.k, y: (Math.floor(c / p.n) + .5) * p.k }; }
      else proba = { x: 100 + st.los() * (BALANS.SWIAT - 200), y: 100 + st.los() * (BALANS.SWIAT - 200) };
      ok = !wKole(st, proba, BALANS.ZOLTA_R + 4) && swiatlo(st, proba.x, proba.y) <= BALANS.PROG_SWIATLA && !(z.smierc && n < 50 && odl(proba, z.smierc) < BALANS.ODRODZENIE_ZOLTEJ_DALEKO); // daleko od miejsca śmierci
      if (ok && !(przy && n <= 20)) for (var g = 0; g < st.gracze.length; g++) if (!st.gracze[g].martwy && odl(st.gracze[g], proba) < 400) { ok = false; break; }
    }
    if (!proba) proba = { x: BALANS.SWIAT / 2, y: 100 };
    z.x = proba.x; z.y = proba.y; z.vx = z.vy = 0; z.cel = null; z.goni = null; z.pamiec = null; z.wezwanie = null; z.trawienie = 0; z.martwa = false; z.odrodzenie = 0; z.ai = {};
    koliduj(st, z, BALANS.ZOLTA_R);
  }

  // ---------- połączenia, zjadanie, oddawanie ----------
  function nadawca(st, g) { return !!st.cel && g.bot && !g.czerwony; } // single: szare boty (i psy) nadają tylko z „1”: nieruchomo, ślepo, bez przerwania, aż ktoś się połączy (18.10 22:20)
  function wola(st, g) { if (g.martwy || g.polaczenie || g.tylkoSzary || (st.cel && g.czerwony)) return false; return nadawca(st, g) ? g.nadaje > st.czas : !!g.klaw.spacja; } // multi: nawołuje, póki trzyma Spację; drugi decyduje (E)
  function podczep(st, lider, g) { // odpowiedź na nawoływanie (E): g podczepia się do nadawcy; bez ukrytego zamiaru, zdrada to zerwanie Shiftem tuż przed żółtą
    lider.ostatniaPara[g.id] = st.czas; g.ostatniaPara[lider.id] = st.czas; // przerwa: z tą samą kropką ponownie dopiero po PRZERWA_PARY
    lider.polaczenie = g.id; g.polaczenie = lider.id; lider.lider = true; g.lider = false; lider.zerwal = g.zerwal = null;
    lider.polaczonyOd = g.polaczonyOd = st.czas; lider.wolanie = -1e9; g.wolanie = -1e9; lider.nadaje = g.nadaje = -1e9; lider.wSw = g.wSw = 0;
    lider.stat.polaczenia++; g.stat.polaczenia++;
    zdarzenie(st, { typ: 'polaczenie', x: lider.x, y: lider.y, dla: lider.id, partner: g.id, lider: true });
    zdarzenie(st, { typ: 'polaczenie', x: g.x, y: g.y, dla: g.id, partner: lider.id, lider: false });
    wezwij(st, lider, g);
  }
  function wezwij(st, a, b) { // połączenie to sygnał w lesie: najbliższa wolna żółta rusza na parę (puls widzą wszyscy w zasięgu)
    var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, naj = null, nd = 1e9;
    for (var i = 0; i < st.zolte.length; i++) { var z = st.zolte[i]; if (z.martwa || z.wezwanie) continue; var d = odl(z, { x: mx, y: my }); if (d < nd) { nd = d; naj = z; } }
    if (naj) { naj.wezwanie = { a: a.id, b: b.id }; naj.cel = null; }
    zdarzenie(st, { typ: 'wezwanie', x: mx, y: my, para: [a.id, b.id], zolta: naj ? naj.id : null });
  }
  function odwolaj(st, id) { for (var i = 0; i < st.zolte.length; i++) { var w = st.zolte[i].wezwanie; if (w && (w.a === id || w.b === id)) st.zolte[i].wezwanie = null; } }
  function rozlacz(st, a, b, powod) {
    if (a) { a.polaczenie = null; a.lider = false; odwolaj(st, a.id); zdarzenie(st, { typ: 'rozlaczenie', x: a.x, y: a.y, dla: a.id, powod: powod }); }
    if (b) { b.polaczenie = null; b.lider = false; odwolaj(st, b.id); zdarzenie(st, { typ: 'rozlaczenie', x: b.x, y: b.y, dla: b.id, powod: powod }); }
  }
  function zabij(st, g) {
    if (g.polaczenie) { var p = gracz(st, g.polaczenie); rozlacz(st, g, p, 'smierc'); }
    g.blask = 0; g.martwy = true; g.odrodzenie = BALANS.ODRODZENIE; g.ukryty = false; g.wolanie = -1e9; g.vx = g.vy = 0; g.smierc = { x: g.x, y: g.y };
    st.zolte.forEach(function (z) { if (z.goni === g.id) z.goni = null; });
  }
  function zjedzPartnera(st, g, p) { // zdrada: g staje się wilkiem (czerwony), bierze wszystkie życia p; ujawnienie czerwone, pole gaśnie
    if (!g.czerwony) g.kolorOd = st.czas;
    g.czerwony = true; g.pies = false; g.zjadl = true; g.zycia += p.zycia; p.zycia = 0; g.stat.zjedzeni++; p.stat.zdrady++; st.wynik.czerwoni++; // kto raz zjadł, nigdy nie będzie niebieski
    zdarzenie(st, { typ: 'ujawnienie', kolor: 'czerwony', x: p.x, y: p.y, kto: g.id, ofiara: p.id });
    zmienPole(st, p.x, p.y, BALANS.PROMIEN_ZGASZENIA, -1);
    zabij(st, p);
  }
  function zjedzPsa(st, wilk, pies, powod) { // pies pożarty (w czerni przy żółtej albo przez sforę): wraca jako szary z zerowym licznikiem, punkt dla czerwonych, pole gaśnie
    if (!st.cel) { pies.pies = false; pies.partnerzy = {}; pies.kolorOd = -1; } pies.zycia = 0; pies.stat.zdrady++; wilk.stat.zjedzeni++; st.wynik.czerwoni++; // single: pies zostaje psem (pomoc dla gracza), w multi wraca jako szary
    zdarzenie(st, { typ: 'ujawnienie', kolor: 'czerwony', x: pies.x, y: pies.y, kto: wilk.id, ofiara: pies.id, pies: true, powod: powod });
    zmienPole(st, pies.x, pies.y, BALANS.PROMIEN_ZGASZENIA, -1);
    zabij(st, pies);
  }
  function padnijWilk(st, wilk, pies) { // zetknięcie psa z wilkiem: wilk pada, jego życia zapalają pole, wraca po 3 s z 1 życiem, nadal czerwony (z tej drogi nie ma powrotu)
    if (st.cel) { // single (19.10 03:40): bez zapalania pola i bez powrotu jako szary: wilk ginie i wraca wilkiem (równowaga bez gracza: plansza nie zapełnia się sama)
      zdarzenie(st, { typ: 'ujawnienie', kolor: 'niebieski', padl: true, x: wilk.x, y: wilk.y, pies: pies.id, wilk: wilk.id });
      wilk.zycia = 0; wilk.stat.padniecia++; pies.stat.wilki++; st.wynik.niebiescy++; zabij(st, wilk); return;
    }
    var n = Math.min(6, Math.max(1, wilk.zycia));
    for (var i = 0; i < n; i++) zmienPole(st, wilk.x, wilk.y, BALANS.PROMIEN_ZAPALENIA, 1);
    odswiezPlame(st, wilk.x, wilk.y);
    zdarzenie(st, { typ: 'ujawnienie', kolor: 'niebieski', padl: true, x: wilk.x, y: wilk.y, pies: pies.id, wilk: wilk.id });
    wilk.czerwony = false; wilk.zjadl = false; wilk.kolorOd = -1; wilk.zycia = 0; wilk.stat.padniecia++; pies.stat.wilki++; st.wynik.niebiescy++; // padły wilk wraca jako szary: status trzeba zdobyć od nowa
    zabij(st, wilk);
  }
  function rozstrzygnij(st, z, lider, pod) { // zderzenie pary z żółtą: tylko żółte anihilują, zależnie od tego, kto do nich podleciał
    var wilk = lider.czerwony ? lider : pod.czerwony ? pod : null, drugi = wilk === lider ? pod : lider;
    if (wilk && drugi.pies) { // pies z wilkiem: w świetle i na „0” żółta anihiluje wilka; w czerni (teren wilka) ginie pies
      z.trawienie = BALANS.TRAWIENIE; z.goni = null; z.pamiec = null; z.wezwanie = null;
      if (swiatlo(st, z.x, z.y) < -BALANS.PROG_SWIATLA) zjedzPsa(st, wilk, drugi, 'mrok'); else padnijWilk(st, wilk, drugi); return;
    }
    if (wilk) { // wilk w parze: żółtej nie da się pokonać. Szary partner ginie (punkt dla czerwonych), wilk przeżywa, żółta odlatuje polować dalej
      z.trawienie = BALANS.TRAWIENIE; z.goni = null; z.pamiec = null; z.wezwanie = null;
      if (!drugi.czerwony) zjedzPartnera(st, wilk, drugi); else rozlacz(st, lider, pod, 'rozstrzygniecie');
      return;
    }
    var ofiara = z.goni != null ? gracz(st, z.goni) : null; // bez wilka: żółta pada, +1 życie obojgu i gonionemu
    lider.zycia++; pod.zycia++;
    if (ofiara && !ofiara.martwy && ofiara.id !== lider.id && ofiara.id !== pod.id) { ofiara.zycia++; }
    zdarzenie(st, { typ: 'ujawnienie', kolor: 'niebieski', x: z.x, y: z.y, kto: lider.id, partner: pod.id, uratowany: ofiara ? ofiara.id : null });
    z.martwa = true; z.odrodzenie = BALANS.ODRODZENIE_ZOLTEJ; z.goni = null; z.wezwanie = null; z.vx = z.vy = 0; z.smierc = { x: z.x, y: z.y };
    var mx = (lider.x + pod.x) / 2, my = (lider.y + pod.y) / 2; // współpraca: pole rozświetla się, licznik do psa pasterskiego
    for (var i = 0; i < BALANS.ROZSWIETLENIE; i++) zmienPole(st, mx, my, BALANS.PROMIEN_ZAPALENIA, 1);
    odswiezPlame(st, mx, my);
    zdarzenie(st, { typ: 'zapalenie', x: mx, y: my, kto: lider.id, partner: pod.id, promien: BALANS.PROMIEN_ZAPALENIA });
    if (lider.tylkoSzary) lider.blask = Math.min(1, (lider.blask || 0) + BALANS.BLASK_ZAPALENIE); if (pod.tylkoSzary) pod.blask = Math.min(1, (pod.blask || 0) + BALANS.BLASK_ZAPALENIE); // single: blask gracza rośnie z każdym zapaleniem
    if (st.cel && (lider.tylkoSzary || pod.tylkoSzary)) { przywolajZolte(st, { x: mx, y: my }); for (var ns = 0; ns < BALANS.SZARE_PRZY_GRACZU && liczbaSzarych(st) < BALANS.SZARE_MAKS; ns++) nowaSzara(st, { x: mx, y: my }); } // single: kolejne żółte wyłonią się z mroku w zasięgu gracza, nowe szare staną w „1” przy krawędzi
    [lider, pod].forEach(function (q, k) {
      q.stat.wspolprace++; q.stat.zolte++; q.partnerzy[(k === 0 ? pod : lider).id] = true;
      if (!q.pies && !q.zjadl && !q.tylkoSzary && !st.cel && Object.keys(q.partnerzy).length >= BALANS.PROG_PSA) { q.pies = true; q.kolorOd = st.czas; zdarzenie(st, { typ: 'pies', x: q.x, y: q.y, dla: q.id }); } // PROG_PSA różnych partnerów; kto kiedykolwiek zjadł, psem nie zostanie
    });
    rozlacz(st, lider, pod, 'rozstrzygniecie');
  }
  function oddaj(st, g) { // oddanie 1 życia do pola (tylko nadwyżka ponad 1), bity wokół zapalają się na „1”
    g.zycia--; g.stat.oddane++;
    zmienPole(st, g.x, g.y, BALANS.PROMIEN_ZAPALENIA, 1);
    zdarzenie(st, { typ: 'zapalenie', x: g.x, y: g.y, kto: g.id, promien: BALANS.PROMIEN_ZAPALENIA });
  }
  function zgasnij(st, g) { // single (18.10 21:40): gracz zbyt długo w „1” (SWIATLO_ZABIJA s): gaśnie, wraca na „0” blisko światła
    g.zycia = 0; g.wSw = 0; g.wCzerni = 0; g.stat.zgasniecia = (g.stat.zgasniecia || 0) + 1;
    zdarzenie(st, { typ: 'zgasniecie', x: g.x, y: g.y, ofiara: g.id });
    zabij(st, g);
  }
  function pochlon(st, g) { // czerń anihiluje szarego albo psa: traci wszystko (pies także status), wraca po chwili z jednym życiem
    var bylPies = !!g.pies; if (bylPies && !st.cel) { g.pies = false; g.partnerzy = {}; g.kolorOd = -1; } // single: pies zostaje psem (przynęta na wilki nie znika)
    g.zycia = 0; g.wCzerni = 0; g.stat.pochloniecia = (g.stat.pochloniecia || 0) + 1;
    zdarzenie(st, { typ: 'pochloniecie', x: g.x, y: g.y, ofiara: g.id, bylPies: bylPies });
    zabij(st, g);
  }
  function zdrada(st, g, p) { // zdrada przez zerwanie: g zerwał połączenie, a żółta pożarła p. g staje się wilkiem (bez powrotu), punkt dla czerwonych, pole przy ofierze gaśnie
    var awans = !g.czerwony && !g.tylkoSzary && !g.pies; // single: gracz tylko szary nie awansuje (i nie ma punktu), ale szarzy to widzą
    if (awans) { g.kolorOd = st.czas; g.czerwony = true; g.zjadl = true; }
    if (g.czerwony) { g.stat.zjedzeni++; st.wynik.czerwoni++; } p.stat.zdrady++;
    zmienPole(st, p.x, p.y, BALANS.PROMIEN_ZGASZENIA, -1);
    zdarzenie(st, { typ: 'zdrada', x: g.x, y: g.y, kto: g.id, ofiara: p.id, wilk: !!g.czerwony });
    if (g.czerwony) zdarzenie(st, { typ: 'ujawnienie', kolor: 'czerwony', x: g.x, y: g.y, kto: g.id, ofiara: p.id, zerwanie: true });
  }
  function ugryz(st, z, g) { // żółta anihiluje samotnego od razu: traci wszystkie życia, odradza się po 3 s z jednym
    if (g.zerwal && st.czas <= g.zerwalDo) { var zd = gracz(st, g.zerwal); if (zd && !zd.martwy) zdrada(st, zd, g); } g.zerwal = null; // ex-partner zerwał tuż przed żółtą
    g.zycia = 0; g.stat.ugryzienia++; z.trawienie = BALANS.TRAWIENIE; z.goni = null; z.pamiec = null;
    zdarzenie(st, { typ: 'ugryzienie', x: g.x, y: g.y, ofiara: g.id, zolta: z.id });
    zabij(st, g);
  }
  function akcjaSpacja(st, g) { // Spacja wciśnięta: singiel zaczyna nawoływać; single: gracz nie nawołuje, Spacja = przyłączenie (jak E)
    if (g.tylkoSzary) { odpowiedz(st, g); return; } // single (18.10 21:40): Spacja i E przyłączają do nadającej szarej
    g.spacjaOd = st.czas;
    if (g.polaczenie) return;
    if (st.cel && g.czerwony) return; // single (18.10 23:40): wilki nie nawołują, nawołują tylko szare i niebieskie
    if (nadawca(st, g)) { if (g.nadaje > st.czas || swiatlo(st, g.x, g.y) <= BALANS.PROG_SWIATLA) return; g.nadaje = Infinity; } // single: szara nadaje tylko z „1”, bez limitu czasu (kończy podczepienie albo odepchnięcie)
    g.wolanie = st.czas; zdarzenie(st, { typ: 'wolanie', x: g.x, y: g.y, od: g.id });
  }
  function odpowiedz(st, g) { // E przy nawołującym (jedyny klawisz zgody): podczepienie; pies i szary się odpychają
    if (g.polaczenie) return;
    var naj = null, nd = BALANS.ZASIEG_ODPOWIEDZI + 1e-6, przerwa = null;
    for (var i = 0; i < st.gracze.length; i++) { var o = st.gracze[i]; if (o === g || !wola(st, o)) continue; var d = odl(g, o); if (d < nd) { nd = d; naj = o; } }
    if (!naj) return;
    var od = g.ostatniaPara[naj.id]; if (od != null && st.czas - od < BALANS.PRZERWA_PARY && !st.cel) { zdarzenie(st, { typ: 'przerwa', x: g.x, y: g.y, dla: g.id, z: naj.id, pozostalo: BALANS.PRZERWA_PARY - (st.czas - od) }); return; } // z tą samą kropką jeszcze nie
    var piesIWilk = (g.pies && naj.czerwony) || (g.czerwony && naj.pies); // pies i wilk łączą się jak każda para; prawda wyjdzie przy żółtej
    if ((g.pies || naj.pies) && !piesIWilk) { odepchnij(st, g, naj); return; } // pies i szary (albo dwa psy) rozchodzą się, odpychają
    if (nadawca(st, naj)) podczep(st, g, naj); else podczep(st, naj, g); // single (18.10 23:00): kto dołącza do nadającej szarej (gracz albo wilk), prowadzi ją na smyczy do żółtej
  }
  function odepchnij(st, a, b) { // odepchnięcie o 2 smycze; nawoływanie zużyte; oboje dostają zdarzenie (kto psem, wiedzą tylko oni)
    var dx = a.x - b.x, dy = a.y - b.y, d = Math.sqrt(dx * dx + dy * dy) || 1, s = BALANS.ZASIEG_POLACZENIA * 0.6;
    a.x += dx / d * s; a.y += dy / d * s; b.x -= dx / d * s; b.y -= dy / d * s; koliduj(st, a, BALANS.R); koliduj(st, b, BALANS.R);
    a.wolanie = -1e9; b.wolanie = -1e9; a.nadaje = b.nadaje = -1e9;
    var pies = a.pies ? a.id : b.id;
    zdarzenie(st, { typ: 'odpychanie', x: a.x, y: a.y, dla: a.id, pies: pies, drugi: b.id }); zdarzenie(st, { typ: 'odpychanie', x: b.x, y: b.y, dla: b.id, pies: pies, drugi: a.id });
  }
  function nierozerwalna(st, a, b) { return !!st.cel; } // single (18.10 23:40): żadna para się nie zrywa (Shift, odległość, czas); kończy ją żółta albo śmierć; wilk prowadzi przechwyconą szarą
  function akcjaShift(st, g) { // odłączenie (i sprint). Jeśli ex-partner wpadnie w żółtą w OKNO_ZDRADY s, to zdrada: kto zerwał, staje się wilkiem
    if (!g.polaczenie) return; var p = gracz(st, g.polaczenie); if (nierozerwalna(st, g, p)) return;
    if (p) { p.zerwal = g.id; p.zerwalDo = st.czas + BALANS.OKNO_ZDRADY; }
    rozlacz(st, g, p, 'rozwiazanie');
  }
  function akcjaE(st, g) { odpowiedz(st, g); }
  function nacisk(st, g, nazwa, wcisniety, akcja) { var k = g.klaw; if (wcisniety && !k[nazwa]) akcja(st, g); k[nazwa] = !!wcisniety; } // działa przy wciśnięciu

  // ---------- krok ----------
  function krok(st, zamiary, dt) {
    if (st.koniec) return st; // runda skończona: świat zamrożony
    dt = dt || BALANS.TICK; st.czas += dt; st.tick++;
    if (st.runda && st.czas >= st.runda) { st.koniec = true; var uk = udzialPola(st); zdarzenie(st, { typ: 'koniec', wszedzie: true, jasne: uk.jasne, rekord: st.rekordJasne, komorek: uk.komorek, wynik: st.wynik }); return st; }
    if (st.cel && st.tick % 15 === 1) { var up = st.pole.udzial; if (up && up.jasne >= st.cel * up.komorek) { st.koniec = true; zdarzenie(st, { typ: 'koniec', wszedzie: true, wygrana: true, jasne: up.jasne, rekord: st.rekordJasne, komorek: up.komorek, wynik: st.wynik, czasGry: st.czas }); return st; } } // świt: cel pokrycia osiągnięty
    if (st.cel && st.tick % (BALANS.ZAR_CO * 30) === 2) zar(st); // żar w single
    var i, g, z;
    while (st.zdarzenia.length && st.czas - st.zdarzenia[0].czas > BALANS.TTL_ZDARZEN) st.zdarzenia.shift();
    // gracze
    for (i = 0; i < st.gracze.length; i++) {
      g = st.gracze[i];
      if (g.martwy) { g.odrodzenie -= dt; if (g.odrodzenie <= 0) { g.zycia = BALANS.ZYCIA_START; umiesc(st, g); zdarzenie(st, { typ: 'odrodzenie', x: g.x, y: g.y, dla: g.id }); } continue; }
      var zm = (zamiary && zamiary[g.id]) || { dx: 0, dy: 0, spacja: false, c: false, e: false };
      if (g.nadaje > st.czas) zm = { dx: 0, dy: 0, spacja: zm.spacja, c: false, e: false, shift: false }; // nadająca szara (single): nieruchoma i ślepa do końca nadawania
      var dx = zm.dx || 0, dy = zm.dy || 0, dl = Math.sqrt(dx * dx + dy * dy); if (dl > 1) { dx /= dl; dy /= dl; dl = 1; }
      { // każdy steruje sobą, także w parze (smycz: para pęka, gdy odejdą od siebie dalej niż ZASIEG_POLACZENIA)
        var chce = !!zm.shift && dl > 0.05 && g.sprint > 0.03; // sprint: zużywa zapas, odnawia się w spoczynku lub marszu
        g.sprint = chce ? Math.max(0, g.sprint - dt / BALANS.SPRINT_CZAS) : Math.min(1, g.sprint + dt / BALANS.SPRINT_ODNOWA); g.sprintuje = chce;
        var vmax = BALANS.PREDKOSC * (1 + BALANS.BLASK_PREDKOSC * (g.tylkoSzary ? (g.blask || 0) : 0)) * (chce ? BALANS.SPRINT : 1);
        g.vx = dx * vmax; g.vy = dy * vmax;
        g.x += g.vx * dt; g.y += g.vy * dt;
      }
      // kulki graczy nie odpychają się fizycznie (18.10 20:00): dystans trzymają boty własnym ruchem; żółte rozsuwa silnik
      koliduj(st, g, BALANS.R);
      // kryjówka: dociąganie przy braku ruchu, ukrycie po UKRYCIE s bezruchu
      var ruch = dl > 0.05; g.kryjowka = -1;
      for (var kk = 0; kk < st.kryjowki.length; kk++) {
        var kr = st.kryjowki[kk], d = odl(g, kr);
        if (d < BALANS.R * 0.9) { g.kryjowka = kk; if (!ruch) { var f = Math.min(1, dt * 12); g.x += (kr.x - g.x) * f; g.y += (kr.y - g.y) * f; } break; }
      }
      g.czasBezruchu = ruch ? 0 : g.czasBezruchu + dt;
      g.ukryty = g.kryjowka >= 0 && !ruch && g.czasBezruchu >= BALANS.UKRYCIE && odl(g, st.kryjowki[g.kryjowka]) < BALANS.R * 0.35;
      // czerń pochłania szarych: szary (nie wilk, nie pies) w komórce < -próg dłużej niż CZERN_ZABIJA s ginie
      var wc = swiatlo(st, g.x, g.y); if (!g.czerwony && wc < -BALANS.PROG_SWIATLA) { var glebia = Math.pow(Math.min(1, (-wc - BALANS.PROG_SWIATLA) / (1 - BALANS.PROG_SWIATLA)), 1.5); g.wCzerni += dt * (g.tylkoSzary ? BALANS.MROK_WOLNO + BALANS.MROK_SZYBKO * Math.pow(glebia, 2.5) : Math.max(0.05, glebia)); if (g.wCzerni >= BALANS.CZERN_ZABIJA) { pochlon(st, g); continue; } } else g.wCzerni = Math.max(0, g.wCzerni - dt * 2); // pełna czerń: CZERN_ZABIJA s; półczerń o wiele dłużej; po wyjściu siły wracają
      if (g.czerwony) g.wSwietle = wc > BALANS.PROG_SWIATLA ? g.wSwietle + dt : 0; // wilk w świetle: po WILK_MIGOT s migocze
      if (st.cel && g.czerwony && g.bot && g.wSwietle > BALANS.WILK_W_SWIETLE) { g.zycia = 0; g.wSwietle = 0; zdarzenie(st, { typ: 'zgasniecie', x: g.x, y: g.y, ofiara: g.id, kolor: 'czerwony' }); zabij(st, g); continue; } // single: wilk zbyt długo w „1” gaśnie, wraca z mroku
      if (g.tylkoSzary) { g.blask = Math.min(1, (g.blask || 0) + dt / BALANS.BLASK_CZAS); g.wSw = (wc > BALANS.PROG_SWIATLA && !g.polaczenie) ? (g.wSw || 0) + dt : Math.max(0, (g.wSw || 0) - dt * 4); if (g.wSw >= BALANS.SWIATLO_ZABIJA) { zgasnij(st, g); continue; } } // single (18.10 21:40): gracz żyje na „0”; w „1” bez pary po SWIATLO_ZABIJA s gaśnie (po wyjściu zegar szybko wraca do zera)
      // wilk w świetle: po CZAS_ROZPUSZCZANIA s zaczyna rozpuszczać „1” w „0” wokół siebie (nie w mrok); po tym można go poznać
      var wSwietle = g.czerwony && swiatlo(st, g.x, g.y) > BALANS.PROG_SWIATLA;
      g.rozpuszcza = wSwietle ? g.rozpuszcza + dt : 0;
      if (wSwietle && BALANS.TEMPO_ROZPUSZCZANIA > 0 && g.rozpuszcza >= BALANS.CZAS_ROZPUSZCZANIA) {
        if (g.rozpuszcza - dt < BALANS.CZAS_ROZPUSZCZANIA) zdarzenie(st, { typ: 'rozpuszczanie', x: g.x, y: g.y, dla: g.id });
        rozpuszcz(st, g.x, g.y, BALANS.PROMIEN_ROZPUSZCZANIA, BALANS.TEMPO_ROZPUSZCZANIA * dt);
      }
      nacisk(st, g, 'spacja', !!zm.spacja, akcjaSpacja);
      nacisk(st, g, 'shift', !!zm.shift, akcjaShift); // Shift w parze = odłączenie (i od razu sprint do ucieczki)
      if (!g.martwy) nacisk(st, g, 'e', !!zm.e, akcjaE);
    }
    // pary: spójność i limit czasu bez rozstrzygnięcia
    for (i = 0; i < st.gracze.length; i++) {
      g = st.gracze[i]; if (!g.polaczenie || g.martwy) continue;
      var p = gracz(st, g.polaczenie);
      if (!p || p.martwy || p.polaczenie !== g.id) { rozlacz(st, g, null, 'brak'); continue; }
      if (nierozerwalna(st, g, p)) { if (g.lider) { var dsm = odl(g, p); if (dsm > BALANS.ZASIEG_POLACZENIA) { var fsm = (dsm - BALANS.ZASIEG_POLACZENIA) / dsm; p.x += (g.x - p.x) * fsm; p.y += (g.y - p.y) * fsm; koliduj(st, p, BALANS.R); } } continue; } // single: smycz dociąga podczepionego zamiast zrywać
      if (g.lider && st.czas - g.polaczonyOd > BALANS.LIMIT_PARY) rozlacz(st, g, p, 'rozwiazanie');
      else if (g.lider && odl(g, p) > BALANS.ZASIEG_POLACZENIA) rozlacz(st, g, p, 'odleglosc'); // smycz: kto odejdzie, zrywa parę
    }
    for (i = 0; i < st.gracze.length; i++) if (!st.gracze[i].martwy) koliduj(st, st.gracze[i], BALANS.R); // po rozsuwaniu wszystkich: przeszkody mają ostatnie słowo
    if (!st.cel) for (i = 0; i < st.gracze.length; i++) { // sfora (tylko multi, stan bez celu): dwa połączone wilki dotykając psa poza światłem pożerają go
      g = st.gracze[i]; if (g.martwy || !g.czerwony || !g.polaczenie) continue; var pw2 = gracz(st, g.polaczenie); if (!pw2 || pw2.martwy || !pw2.czerwony) continue;
      for (var pi = 0; pi < st.gracze.length; pi++) { var ps = st.gracze[pi]; if (!ps.pies || ps.martwy || swiatlo(st, ps.x, ps.y) > BALANS.PROG_SWIATLA) continue; if (odl(ps, g) <= BALANS.R * 2 + 2) { zjedzPsa(st, g, ps, 'sfora'); break; } }
    }
    // żółte: liczba żywych dąży do celu zależnego od ciemności planszy; odrodzenie tylko, gdy brakuje do celu
    var zywe = 0, celZ = celZoltych(st);
    for (i = 0; i < st.zolte.length; i++) if (!st.zolte[i].martwa) zywe++;
    for (i = 0; i < st.zolte.length; i++) {
      z = st.zolte[i];
      if (z.martwa) { if (z.odrodzenie > 0) z.odrodzenie -= dt; if (z.odrodzenie <= 0 && zywe < celZ) { var przyZ = z.przyOdrodzeniu ? mrokPrzy(st, z.przyOdrodzeniu, BALANS.ZOLTE_PRZY_MIN, BALANS.ZOLTE_PRZY_MAKS) : null; z.przyOdrodzeniu = null; umiescZolta(st, z, przyZ || undefined); zywe++; zdarzenie(st, { typ: 'narodziny', x: z.x, y: z.y, zolta: z.id }); } continue; } // przyOdrodzeniu: wraca blisko gracza (single)
      if (z.trawienie > 0) z.trawienie -= dt;
      if (st.ai && st.ai.zolta) st.ai.zolta(st, z, dt, POMOC); else { z.vx = z.vy = 0; }
      var sp = Math.sqrt(z.vx * z.vx + z.vy * z.vy), maks = z.goni != null ? BALANS.PREDKOSC_GONU : BALANS.PREDKOSC_ZOLTEJ;
      if (z.trawienie > 0) maks *= 0.35;
      if (sp > maks) { z.vx *= maks / sp; z.vy *= maks / sp; }
      if (sp > 1) { // płynny skręt: kierunek obraca się najwyżej SKRET_ZOLTEJ rad/s, prędkość dochodzi łagodnie; zamiar AI (vx, vy) zostaje nietknięty
        var kN = Math.atan2(z.vy, z.vx), sN = Math.min(sp, maks), kS = z.kat == null ? kN : z.kat, rozK = Math.atan2(Math.sin(kN - kS), Math.cos(kN - kS)), maxK = BALANS.SKRET_ZOLTEJ * dt;
        kS += Math.max(-maxK, Math.min(maxK, rozK)); var sS = (z.sp || 0) + (sN - (z.sp || 0)) * Math.min(1, dt * 4); z.kat = kS; z.sp = sS; z.sx = Math.cos(kS) * sS; z.sy = Math.sin(kS) * sS;
      } else { z.sp = (z.sp || 0) * Math.max(0, 1 - dt * 4); if (z.kat != null && z.sp > 1) { z.sx = Math.cos(z.kat) * z.sp; z.sy = Math.sin(z.kat) * z.sp; } else { z.sx = z.sy = 0; } }
      var nx = z.x + z.sx * dt, ny = z.y + z.sy * dt;
      if (swiatlo(st, z.x, z.y) > BALANS.PROG_SWIATLA) { // znalazła się w świetle (np. rozbłysło wokół niej): ucieka w najciemniejszą stronę
        var naja = 0, najw = 1e9;
        for (var ka = 0; ka < 8; ka++) { var aa = ka / 8 * Math.PI * 2, wv = swiatlo(st, z.x + Math.cos(aa) * 70, z.y + Math.sin(aa) * 70); if (wv < najw) { najw = wv; naja = aa; } }
        z.vx = Math.cos(naja) * BALANS.PREDKOSC_GONU; z.vy = Math.sin(naja) * BALANS.PREDKOSC_GONU; z.goni = null; z.cel = null;
        z.x += z.vx * dt; z.y += z.vy * dt;
      } else if (swiatlo(st, nx, ny) > BALANS.PROG_SWIATLA) { z.vx = z.vy = 0; z.cel = null; z.ai.swiatlo = st.czas; } else { z.x = nx; z.y = ny; }
      rozsun(st, z, st.zolte, BALANS.ZOLTA_R * 2); koliduj(st, z, BALANS.ZOLTA_R); // żółte nie nachodzą na siebie, a przeszkody mają ostatnie słowo
      if (z.trawienie <= 0 && z.goni != null) {
        var cel = gracz(st, z.goni);
        if (!cel || cel.martwy || cel.polaczenie || cel.ukryty || swiatlo(st, cel.x, cel.y) > BALANS.PROG_SWIATLA) z.goni = null; // w świetle nietykalny
        else if (odl(z, cel) <= BALANS.ZOLTA_R + BALANS.R) ugryz(st, z, cel);
      }
      // dotyk połączonego gracza pokonuje żółtą (para jest bezpieczna i razem ją pokonuje)
      for (var gi = 0; gi < st.gracze.length && !z.martwa; gi++) {
        var pg = st.gracze[gi]; if (pg.martwy || !pg.polaczenie) continue;
        var pp = gracz(st, pg.polaczenie); if (!pp || pp.martwy || pp.polaczenie !== pg.id) continue;
        if (odl(z, pg) <= BALANS.ZOLTA_R + BALANS.R + 2) rozstrzygnij(st, z, pg.lider ? pg : pp, pg.lider ? pp : pg);
      }
    }
    krokDziur(st, dt);
    gasnijPole(st, dt);
    if (st.tick % 15 === 0) udzialPola(st);
    if (st.cel && st.tick % 150 === 75) zalewaj(st);
    if (st.cel) { st.szaraZegar = (st.szaraZegar || 0) + dt; if (st.szaraZegar >= BALANS.SZARE_CO) { st.szaraZegar = 0; var czlS = null; for (var cs = 0; cs < st.gracze.length; cs++) if (st.gracze[cs].tylkoSzary && !st.gracze[cs].martwy) czlS = st.gracze[cs]; if (liczbaSzarych(st) < BALANS.SZARE_MAKS) nowaSzara(st, czlS || { x: BALANS.SWIAT / 2, y: BALANS.SWIAT / 2 }); } } // single: co SZARE_CO s nowa szara przy graczu
    // epoka co EPOKA s: wpis, kto prowadzi
    if (Math.floor(st.czas / BALANS.EPOKA) > st.epoka) {
      st.epoka++; var u = udzialPola(st), prow = u.jasne > u.ciemne ? 'budowanie' : u.ciemne > u.jasne ? 'pożeranie' : 'remis';
      var wpis = { nr: st.epoka, jasne: u.jasne, ciemne: u.ciemne, prowadzi: prow, czas: st.czas };
      st.dziennikEpok.push(wpis); zdarzenie(st, { typ: 'epoka', wszedzie: true, wpis: wpis });
    }
    return st;
  }

  // pomoc dla AI żółtych (boty.js): tylko to, co żółta ma prawo wiedzieć
  var POMOC = {
    B: BALANS, odl: odl, liniaWzroku: liniaWzroku, swiatlo: swiatlo, wKole: wKole, gracz: gracz,
    wezwanie: function (st, z) { // dokąd idzie przywołana żółta: środek pary; gdy para pękła, wezwanie znika
      var w = z.wezwanie; if (!w) return null;
      var a = gracz(st, w.a), b = gracz(st, w.b);
      if (!a || !b || a.martwy || b.martwy || a.polaczenie !== b.id) { z.wezwanie = null; return null; }
      return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    },
    cele: function (st, z) { // widoczni, pojedynczy (niepołączeni), nieukryci SZARZY w zasięgu i w linii wzroku; wilków i psów żółte nie atakują
      var w = [];
      for (var i = 0; i < st.gracze.length; i++) {
        var g = st.gracze[i];
        if (g.martwy || g.ukryty || g.polaczenie || g.czerwony || g.pies) continue;
        if (swiatlo(st, g.x, g.y) > BALANS.PROG_SWIATLA) continue; // w przystani („1”) nikt nie jest celem
        if (odl(z, g) > (g.tylkoSzary ? BALANS.WIDZENIE_GRACZA : BALANS.WIDZENIE_ZOLTEJ)) continue;
        if (liniaWzroku(st, z, g)) w.push(g);
      }
      return w;
    }
  };

  // ---------- gracze przychodzą i odchodzą (pokój online, rotacja botów) ----------
  function dodajGracza(st, o) { var g = nowyGracz(o); if (o.zdala) g.smierc = o.zdala; st.gracze.push(g); umiesc(st, g); zdarzenie(st, { typ: 'przybycie', x: g.x, y: g.y, kto: g.id }); return g; }
  function usunGracza(st, id) {
    var g = gracz(st, id); if (!g) return false;
    if (g.polaczenie) rozlacz(st, g, gracz(st, g.polaczenie), 'odejscie');
    st.zolte.forEach(function (z) { if (z.goni === id) z.goni = null; if (z.wezwanie && (z.wezwanie.a === id || z.wezwanie.b === id)) z.wezwanie = null; });
    st.gracze.splice(st.gracze.indexOf(g), 1); zdarzenie(st, { typ: 'odejscie', x: g.x, y: g.y, kto: id }); return true;
  }
  // ---------- widok: jedyne, co dostaje klient ----------
  function statyczne(st) { return { B: BALANS, przeszkody: st.przeszkody, kryjowki: st.kryjowki, swiat: BALANS.SWIAT, pole: { n: st.pole.n, k: st.pole.k, baza: st.pole.baza, widoczne: st.pole.widoczne } }; }
  function widok(st, id, odNr) {
    var g = gracz(st, id); if (!g) return null;
    var inni = [], zolte = [], zd = [], i, o;
    for (i = 0; i < st.gracze.length; i++) {
      o = st.gracze[i]; if (o === g || o.martwy) continue;
      var partner = o.id === g.polaczenie;
      if (o.ukryty && !partner) continue; // ukryty nie istnieje w danych innych klientów
      if (!partner && wMroku(st, o)) continue; // wilk w pełnej czerni jest niewidzialny: mrok to jego przystań
      if (!partner && odl(o, g) > BALANS.ZASIEG_WZROKU) continue; // ciemny las: dane tylko o pobliskich
      var jaSingle = st.cel && g.tylkoSzary; if (jaSingle && !partner && !o.czerwony && !o.pies && !o.polaczenie && !(wola(st, o) && swiatlo(st, o.x, o.y) > BALANS.PROG_SWIATLA)) continue; // single: szare widać, gdy nadają z „1” albo są w parze (przechwycone przez wilka, także poza „1”)
      // kolor innych: szary dla wszystkich; wilk widzi pary jako niebieskie; gracz single widzi wilki (czerwone) i psy (niebieskie), tylko on; para: z kim połączony (single: nitka splątanej pary)
      inni.push({ id: o.id, x: o.x, y: o.y, vx: o.vx, vy: o.vy, kolor: jaSingle ? (o.czerwony ? 'czerwony' : o.pies ? 'niebieski' : 'szary') : (g.czerwony && o.polaczenie ? 'niebieski' : 'szary'), para: jaSingle ? (o.polaczenie || null) : null, ukryty: o.ukryty, partner: partner, wola: wola(st, o), wCzerni: o.wCzerni || 0, migocze: !!((o.czerwony && o.wSwietle > BALANS.WILK_MIGOT) || (!o.czerwony && o.wCzerni > 0)) });
    }
    for (i = 0; i < st.zolte.length; i++) {
      o = st.zolte[i]; if (o.martwa || odl(o, g) > BALANS.ZASIEG_WZROKU) continue;
      zolte.push({ id: o.id, x: o.x, y: o.y, vx: o.sx != null ? o.sx : o.vx, vy: o.sy != null ? o.sy : o.vy, goni: o.goni != null, goniKogo: o.goni, goniMnie: o.goni === g.id, trawi: o.trawienie > 0, wezwana: !!o.wezwanie, wezwanaDoMnie: !!o.wezwanie && (o.wezwanie.a === g.id || o.wezwanie.b === g.id) }); // goniKogo: pogoń widać gołym okiem
    }
    for (i = 0; i < st.zdarzenia.length; i++) {
      o = st.zdarzenia[i]; if (odNr != null && o.nr <= odNr) continue;
      if (o.dla != null ? o.dla !== g.id : !(o.wszedzie || odl(o, g) <= BALANS.ZASIEG_WZROKU)) continue;
      zd.push(o);
    }
    return {
      czas: st.czas, tick: st.tick, nr: st.nrZdarzenia, epoka: st.epoka, wynik: st.wynik, cel: st.cel, runda: st.runda, pozostalo: st.runda ? Math.max(0, st.runda - st.czas) : null, koniec: st.koniec, rekordJasne: st.rekordJasne,
      ja: { id: g.id, x: g.x, y: g.y, vx: g.vx, vy: g.vy, zycia: g.zycia, kolor: g.czerwony ? 'czerwony' : g.pies ? 'niebieski' : 'szary', pies: g.pies,
        polaczony: !!g.polaczenie, partner: g.polaczenie, lider: g.lider, podczepiony: !!g.polaczenie && !g.lider, wolam: wola(st, g), zjadl: g.zjadl,
        sprint: g.sprint, sprintuje: g.sprintuje, partnerzy: Object.keys(g.partnerzy).length, niewidzialny: wMroku(st, g), wMroku: st.pole.w[komorka(st.pole, g.x, g.y)] < -BALANS.PROG_SWIATLA,
        wCzerni: g.wCzerni, wSw: g.wSw || 0, nadaje: g.nadaje > st.czas, blask: g.blask || 0, migocze: !!((g.czerwony && g.wSwietle > BALANS.WILK_MIGOT) || (!g.czerwony && g.wCzerni > 0) || (g.tylkoSzary && g.wSw > 0)),
        przerwy: (function () { var o = {}; for (var k in g.ostatniaPara) { var r = BALANS.PRZERWA_PARY - (st.czas - g.ostatniaPara[k]); if (r > 0) o[k] = r; } return o; })(), // z kim jeszcze nie można się połączyć i ile sekund zostało
        ukryty: g.ukryty, wKryjowce: g.kryjowka >= 0, martwy: g.martwy, odrodzenie: g.odrodzenie, stat: g.stat },
      inni: inni, zolte: zolte, zdarzenia: zd,
      dziury: st.dziury.filter(function (d) { return odl(d, g) <= BALANS.ZASIEG_WZROKU + d.r; }).map(function (d) { return { id: d.id, x: d.x, y: d.y, r: d.r }; }),
      pole: { w: st.pole.w, wersja: st.pole.wersja, udzial: st.pole.udzial }, // prototyp: odwołanie do tablicy; serwer wyśle tylko zmienione komórki
      dziennikEpok: st.dziennikEpok
    };
  }
  // pełny podgląd stanu ukrytego: TYLKO do testów i podsumowania po wyjściu, nigdy do klienta w trakcie gry
  function prawda(st) { return st.gracze.map(function (g) { return { id: g.id, bot: g.bot, osobowosc: g.osobowosc, czerwony: g.czerwony, pies: g.pies, zycia: g.zycia, polaczenie: g.polaczenie, martwy: g.martwy, stat: g.stat }; }); }

  return { BALANS: BALANS, rng: rng, nowyStan: nowyStan, krok: krok, widok: widok, statyczne: statyczne, prawda: prawda, odl: odl, liniaWzroku: liniaWzroku, udzialPola: udzialPola, dodajGracza: dodajGracza, usunGracza: usunGracza,
    _test: { zmienPole: zmienPole, odswiezPlame: odswiezPlame, podczep: podczep, gracz: gracz, swiatlo: swiatlo, POMOC: POMOC, celZoltych: celZoltych, wola: wola } };
});
