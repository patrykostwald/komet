/* Komety: proceduralne przeszkody. Szesnaście rodzin, otwarte przejścia i geometryczne kryjówki.
   INTERFEJS (nie zmieniać): generuj(los, B) -> [{ rodzina, kola: [{x, y, r}], kryjowki: [{x, y}] }]
   - los(): liczba z [0,1) z ziarna (jedyne źródło losowości), B: BALANS silnika (R, ZOLTA_R, SWIAT).
   - Przeszkoda = suma kół w jednym szarym (kolizje i linia wzroku liczą się po kołach).
   - Kryjówka = punkt, w którym koło o promieniu R (gracz) styka się z dwoma kołami przeszkody i nie zachodzi na żadne inne:
     gracz „dokładnie się mieści” i wygląda jak kolejna kropka kształtu. Każda przeszkoda ma 1-4 kryjówki, każda osiągalna z zewnątrz.
   - Między przeszkodami korytarz >= 2*ZOLTA_R + 30; środek planszy (promień 220) wolny pod motyw 0101. */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.K_ksztalty = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var TAU = Math.PI * 2;
  function los2(los, a, b) { return a + los() * (b - a); }

  // punkty styczne koła o promieniu R do dwóch kół (przecięcie okręgów o promieniach r1+R i r2+R)
  function styczne(k1, k2, R) {
    var r1 = k1.r + R + 0.4, r2 = k2.r + R + 0.4, dx = k2.x - k1.x, dy = k2.y - k1.y, d = Math.sqrt(dx * dx + dy * dy);
    if (d < 1e-6 || d > r1 + r2 || d < Math.abs(r1 - r2)) return [];
    var a = (r1 * r1 - r2 * r2 + d * d) / (2 * d), h2 = r1 * r1 - a * a; if (h2 < 0) return [];
    var h = Math.sqrt(h2), mx = k1.x + a * dx / d, my = k1.y + a * dy / d;
    return [{ x: mx + h * -dy / d, y: my + h * dx / d }, { x: mx - h * -dy / d, y: my - h * dx / d }];
  }
  function wolne(p, kola, R, pomin) {
    for (var i = 0; i < kola.length; i++) {
      if (pomin && pomin.indexOf(i) >= 0) continue;
      var k = kola[i], dx = p.x - k.x, dy = p.y - k.y; if (dx * dx + dy * dy < (k.r + R + 0.2) * (k.r + R + 0.2)) return false;
    }
    return true;
  }
  // kryjówki z geometrii: styczne do par kół, wolne od reszty, z otwartym dojściem (punkty 2,2R i 4,5R dalej też wolne), rozsunięte o 3R
  function znajdzKryjowki(kola, R, los, maks) {
    var kand = [], i, j, k;
    for (i = 0; i < kola.length; i++) for (j = i + 1; j < kola.length; j++) {
      var pts = styczne(kola[i], kola[j], R);
      for (k = 0; k < pts.length; k++) {
        var p = pts[k]; if (!wolne(p, kola, R)) continue;
        var cx = (kola[i].x + kola[j].x) / 2, cy = (kola[i].y + kola[j].y) / 2, dx = p.x - cx, dy = p.y - cy, d = Math.sqrt(dx * dx + dy * dy) || 1;
        if (!wolne({ x: p.x + dx / d * 2.2 * R, y: p.y + dy / d * 2.2 * R }, kola, R)) continue;
        if (!wolne({ x: p.x + dx / d * 4.5 * R, y: p.y + dy / d * 4.5 * R }, kola, R)) continue;
        if (!odcinek(p, { x: p.x + dx / d * 4.5 * R, y: p.y + dy / d * 4.5 * R }, kola, R)) continue;
        kand.push(p);
      }
    }
    for (i = kand.length - 1; i > 0; i--) { j = Math.floor(los() * (i + 1)); var t = kand[i]; kand[i] = kand[j]; kand[j] = t; }
    var wyb = [];
    for (i = 0; i < kand.length && wyb.length < maks; i++) {
      var ok = true;
      for (j = 0; j < wyb.length; j++) { var ddx = wyb[j].x - kand[i].x, ddy = wyb[j].y - kand[i].y; if (ddx * ddx + ddy * ddy < (3 * R) * (3 * R)) { ok = false; break; } }
      if (ok) wyb.push(kand[i]);
    }
    return wyb;
  }

  // Rodziny budujemy w jednostkach umownych, a potem centrujemy i skalujemy.
  var NAZWY = ['kleks', 'łańcuch', 'pierścień', 'grzebień', 'ziarno',
    'spirala', 'fala', 'konstelacja', 'półksiężyc', 'rozeta', 'drabina',
    'przerywana', 'orbity', 'kometa', 'krzak', 'glif'];
  function forma(typ, los) {
    var k = [], i, j, t, r, n = 7 + Math.floor(los() * 5);
    function dodaj(x, y, r) { k.push({ x: x, y: y, r: r }); }
    function luk(rad, od, doA, ile, rozmiar) {
      for (var q = 0; q < ile; q++) {
        var a = od + (doA - od) * q / (ile - 1);
        dodaj(rad * Math.cos(a), rad * Math.sin(a), rozmiar);
      }
    }
    if (typ === 0) {
      dodaj(0, 0, 40);
      for (i = 0; i < 5; i++) { t = i * TAU / 5 + los() * 0.3; dodaj(33 * Math.cos(t), 33 * Math.sin(t), los2(los, 18, 30)); }
    } else if (typ === 1 || typ === 6) {
      for (i = 0; i < n; i++) dodaj(i * 26, Math.sin(i * (typ === 1 ? 0.3 : 0.7)) * 38, typ === 1 ? 12 + i * 1.4 : 17);
    } else if (typ === 2) {
      luk(82, 0.55, TAU - 0.55, 17, 13);
    } else if (typ === 3) {
      for (i = 0; i < 6; i++) { dodaj(i * 29, 0, 18); if (i % 2 === 0) { dodaj(i * 29, 25, 14); dodaj(i * 29, 46, 11); } }
    } else if (typ === 4) {
      dodaj(-23, 0, 32); dodaj(23, 0, 32 * los2(los, 0.8, 1.15));
    } else if (typ === 5) {
      for (i = 0; i < 23; i++) { t = i / 22; r = 105 - 67 * t; dodaj(r * Math.cos(t * 5.1), r * Math.sin(t * 5.1), 16 - 9 * t); }
    } else if (typ === 7) {
      // Rozgałęzione skupisko: bez zamkniętej obwódki wokół pustego środka.
      dodaj(0, 0, 18);
      for (i = 0; i < 4; i++) for (j = 1; j <= 3; j++) {
        t = i * TAU / 4 + 0.2 * los(); dodaj(Math.cos(t) * j * 28, Math.sin(t) * j * 28, los2(los, 9, 16));
      }
    } else if (typ === 8) {
      for (i = 0; i < 13; i++) { t = -2.1 + i * 4.2 / 12; dodaj(Math.cos(t) * 90, Math.sin(t) * 90, 10 + 15 * Math.sin(Math.PI * i / 12)); }
    } else if (typ === 9) {
      dodaj(0, 0, 29);
      for (i = 0; i < 6; i++) { t = i * TAU / 6; dodaj(38 * Math.cos(t), 38 * Math.sin(t), 22); dodaj(65 * Math.cos(t), 65 * Math.sin(t), 12); }
    } else if (typ === 10) {
      // Szczeble są otwarte z jednej strony; nie tworzą zamkniętych oczek.
      for (i = 0; i < 6; i++) { dodaj(i * 25, 0, 16); if (i % 2 === 0) { dodaj(i * 25 + 10, 25, 14); dodaj(i * 25 + 20, 49, 12); } }
    } else if (typ === 11) {
      for (i = 0; i < 4; i++) { dodaj(i * 68, 0, 14); dodaj(i * 68 + 25, 0, 14); }
    } else if (typ === 12) {
      luk(105, 0.65, TAU - 0.65, 19, 13); luk(51, 0.85, TAU - 0.85, 10, 10);
    } else if (typ === 13) {
      dodaj(0, 0, 38);
      for (i = 1; i < 9; i++) dodaj(-28 - i * 22, Math.sin(i * 0.4) * 22, 22 - i * 1.8);
    } else if (typ === 14) {
      dodaj(0, 0, 25);
      for (i = 0; i < 3; i++) { t = i * TAU / 3; dodaj(37 * Math.cos(t), 37 * Math.sin(t), 20);
        for (j = -1; j <= 1; j += 2) dodaj(37 * Math.cos(t) + 29 * Math.cos(t + j * 0.65), 37 * Math.sin(t) + 29 * Math.sin(t + j * 0.65), 13);
      }
    } else {
      var wzory = [['1111','0001','0010','0100','1111'], ['0111','1100','0110','0011','1110'], ['010','110','010','010','111']];
      var wzor = wzory[Math.floor(los() * wzory.length)];
      for (i = 0; i < wzor.length; i++) for (j = 0; j < wzor[i].length; j++) if (wzor[i].charAt(j) === '1') dodaj(j * 24, i * 24, 14);
    }
    return k;
  }
  function przeksztalc(k, rozmiar, kat, cx, cy, odbicie) {
    var x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, i;
    for (i = 0; i < k.length; i++) { x0 = Math.min(x0, k[i].x - k[i].r); x1 = Math.max(x1, k[i].x + k[i].r); y0 = Math.min(y0, k[i].y - k[i].r); y1 = Math.max(y1, k[i].y + k[i].r); }
    var mx = (x0 + x1) / 2, my = (y0 + y1) / 2, ro = 0;
    for (i = 0; i < k.length; i++) ro = Math.max(ro, Math.sqrt(Math.pow(k[i].x - mx, 2) + Math.pow(k[i].y - my, 2)) + k[i].r);
    return k.map(function (c) { var x = (c.x - mx) * rozmiar / ro, y = (c.y - my) * rozmiar / ro * odbicie;
      return { x: cx + x * Math.cos(kat) - y * Math.sin(kat), y: cy + x * Math.sin(kat) + y * Math.cos(kat), r: c.r * rozmiar / ro }; });
  }
  // Dokładna odległość od odcinka: przejście między węzłami nie przecina koła.
  function odcinek(a, b, kola, R) {
    var dx = b.x - a.x, dy = b.y - a.y, dd = dx * dx + dy * dy;
    for (var i = 0; i < kola.length; i++) {
      var c = kola[i], t = dd ? Math.max(0, Math.min(1, ((c.x - a.x) * dx + (c.y - a.y) * dy) / dd)) : 0;
      var x = a.x + t * dx - c.x, y = a.y + t * dy - c.y;
      if (x * x + y * y < Math.pow(c.r + R + 0.2, 2)) return false;
    }
    return true;
  }
  // Lokalna siatka jest wyrównana do siatki świata. Obwód leży poza kształtem.
  // Rozłączne otoczki z szerokimi korytarzami łączą te lokalne obszary w całość.
  function dostepne(kola, kryj, R, cx, cy, ro) {
    var x0 = Math.floor((cx - ro - R - 50) / 25) * 25, y0 = Math.floor((cy - ro - R - 50) / 25) * 25;
    var n = Math.ceil((2 * ro + 2 * R + 125) / 25) + 1, pts = [], wol = [], seen = [], queue = [0], head = 0, i, j;
    for (j = 0; j < n; j++) for (i = 0; i < n; i++) { var p = { x: x0 + i * 25, y: y0 + j * 25 }; pts.push(p); wol.push(wolne(p, kola, R)); }
    seen[0] = true;
    while (head < queue.length) {
      var v = queue[head++], ns = [];
      if (v % n) ns.push(v - 1); if (v % n < n - 1) ns.push(v + 1); if (v >= n) ns.push(v - n); if (v < n * (n - 1)) ns.push(v + n);
      for (i = 0; i < ns.length; i++) { var u = ns[i]; if (wol[u] && !seen[u] && odcinek(pts[v], pts[u], kola, R)) { seen[u] = true; queue.push(u); } }
    }
    for (i = 0; i < wol.length; i++) if (wol[i] && !seen[i]) return false;
    for (j = 0; j < kryj.length; j++) {
      var jest = false;
      for (i = 0; i < pts.length; i++) if (seen[i] && Math.abs(pts[i].x - kryj[j].x) < 75 && Math.abs(pts[i].y - kryj[j].y) < 75 && odcinek(kryj[j], pts[i], kola, R)) { jest = true; break; }
      if (!jest) return false;
    }
    return true;
  }
  function generuj(los, B) {
    var rodz = [], miejsca = [], wynik = [], otoczki = [], i, j, S = B.SWIAT, R = B.R, kor = 2 * B.ZOLTA_R + 30;
    for (i = 0; i < NAZWY.length; i++) rodz.push(i);
    for (i = 0; i < 4; i++) for (j = 0; j < 4; j++) if (i === 0 || i === 3 || j === 0 || j === 3) miejsca.push({ x: 300 + (S - 600) * i / 3, y: 300 + (S - 600) * j / 3 });
    function tasuj(a) { for (var q = a.length - 1; q > 0; q--) { var z = Math.floor(los() * (q + 1)), t = a[q]; a[q] = a[z]; a[z] = t; } }
    tasuj(rodz); tasuj(miejsca);
    for (i = 0; i < miejsca.length; i++) {
      var proba = 0;
      while (true) {
        // Po nieudanych próbach zmniejszamy tę samą rodzinę, bez preferowania kleksów.
        var ro = proba < 24 ? (i === 0 ? los2(los, 230, 260) : los2(los, 60, 185)) : 60;
        var cx = miejsca[i].x + (proba < 24 ? los2(los, -65, 65) : 0), cy = miejsca[i].y + (proba < 24 ? los2(los, -65, 65) : 0);
        proba++;
        if (proba > 500) throw new Error("Limit: " + i + " " + NAZWY[rodz[i]]);
        if (cx - ro < 90 || cy - ro < 90 || cx + ro > S - 90 || cy + ro > S - 90 || Math.sqrt(Math.pow(cx - S / 2, 2) + Math.pow(cy - S / 2, 2)) < 220 + ro) continue;
        var ok = true;
        for (j = 0; j < otoczki.length; j++) { var o = otoczki[j]; if (Math.sqrt(Math.pow(cx - o.x, 2) + Math.pow(cy - o.y, 2)) < ro + o.r + kor) { ok = false; break; } }
        for (j = i + 1; j < miejsca.length; j++) {
          if (Math.sqrt(Math.pow(cx - miejsca[j].x, 2) + Math.pow(cy - miejsca[j].y, 2)) < ro + 60 + kor) ok = false;
        }
        if (!ok) continue;
        var kola = przeksztalc(forma(rodz[i], los), ro, los() * TAU, cx, cy, los() < 0.5 ? -1 : 1);
        var kryj = znajdzKryjowki(kola, R, los, 1 + Math.floor(los() * 4));
        if (!kryj.length || !dostepne(kola, kryj, R, cx, cy, ro)) continue;
        wynik.push({ rodzina: NAZWY[rodz[i]], kola: kola, kryjowki: kryj }); otoczki.push({ x: cx, y: cy, r: ro }); break;
      }
    }
    return wynik;
  }
  return { generuj: generuj, _test: { styczne: styczne, znajdzKryjowki: znajdzKryjowki, wolne: wolne, odcinek: odcinek, rodziny: NAZWY } };
});
