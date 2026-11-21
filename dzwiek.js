/* Komety: miękki dźwięk syntezowany lokalnie, bez plików i zależności. */
(function () {
  'use strict';
  var ctx = null, master, filtr, send, reverb, compressor;
  var wezly = [], zdarzenia = [], pad = null, chwyt = null;
  var chceTlo = false, niebezpieczenstwo = 0, zegarChwytu = null;
  var muz = null, muzOut = null, sendDlugi = null, reverbDlugi = null; // ścieżka tła (akordy, smyczki, arpeggio)
  var API = { start: start, graj: graj, tlo: tlo, zagrozenie: zagrozenie,
    wycisz: wycisz, wyciszone: false, _diag: function () { return wezly.length; } };

  function zakres(x, min, max, domyslna) {
    return typeof x === 'number' && isFinite(x) ? Math.max(min, Math.min(max, x)) : domyslna;
  }
  function node(n, grupa) {
    wezly.push(n);
    if (grupa) grupa.nodes.push(n);
    return n;
  }
  function usun(n) {
    try { n.disconnect(); } catch (e) { /* Starsze implementacje. */ }
    var i = wezly.indexOf(n);
    if (i !== -1) wezly.splice(i, 1);
  }
  function grupa() { return { nodes: [], sources: [], koniec: false }; }
  function sprzataj(g) {
    if (g.koniec) return;
    g.koniec = true;
    g.nodes.forEach(usun);
    var i = zdarzenia.indexOf(g);
    if (i !== -1) zdarzenia.splice(i, 1);
  }
  function gladko(p, cel, czas) {
    var teraz = ctx.currentTime;
    if (p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(teraz);
    else { var v = p.value; p.cancelScheduledValues(teraz); p.setValueAtTime(v, teraz); }
    p.setTargetAtTime(cel, teraz, czas || 0.05);
  }
  function osc(g, typ, hz) {
    var n = node(ctx.createOscillator(), g);
    n.type = typ; n.frequency.value = hz;
    g.sources.push(n);
    return n;
  }
  function zakoncz(g, czas) {
    // Sprzątanie według zegara audio, także po uśpieniu karty.
    var pozostalo = g.sources.length;
    g.sources.forEach(function (n) {
      n.onended = function () { n.onended = null; if (--pozostalo === 0) sprzataj(g); };
      n.stop(czas);
    });
  }
  function wyjscie(g, pan) {
    var gain = node(ctx.createGain(), g), p;
    if (ctx.createStereoPanner) {
      p = node(ctx.createStereoPanner(), g); p.pan.value = pan;
    } else {
      p = node(ctx.createPanner(), g); p.panningModel = 'equalpower';
      p.setPosition(pan, 0, -Math.sqrt(1 - pan * pan));
    }
    gain.connect(p); p.connect(filtr);
    return gain;
  }
  function wznow() {
    if (!ctx || ctx.state === 'closed' || ctx.state === 'running') return;
    try { var p = ctx.resume(); if (p && p.catch) p.catch(function () {}); } catch (e) {}
  }
  function start() {
    if (ctx) { wznow(); return; }
    var Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    try {
      ctx = new Audio();
      master = node(ctx.createGain()); master.gain.value = API.wyciszone ? 0 : 0.5;
      filtr = node(ctx.createBiquadFilter()); filtr.type = 'lowpass'; filtr.frequency.value = 3400; filtr.Q.value = 0.5;
      send = node(ctx.createGain()); send.gain.value = 0.2;
      reverb = node(ctx.createConvolver());
      var len = Math.floor(ctx.sampleRate * 1.6), impulse = ctx.createBuffer(2, len, ctx.sampleRate);
      for (var c = 0; c < 2; c++) {
        var data = impulse.getChannelData(c);
        for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-7 * i / len) * (1 - i / len);
      }
      reverb.buffer = impulse;
      compressor = node(ctx.createDynamicsCompressor());
      compressor.threshold.value = -20; compressor.knee.value = 20;
      compressor.ratio.value = 4; compressor.attack.value = 0.012; compressor.release.value = 0.25;
      filtr.connect(master); filtr.connect(send); send.connect(reverb); reverb.connect(master);
      master.connect(compressor); compressor.connect(ctx.destination);
      // ścieżka tła: własne wyjście i długi pogłos (4,5 s), zakładane raz, żeby liczba węzłów wracała do bazy
      muzOut = node(ctx.createGain()); muzOut.gain.value = 1;
      sendDlugi = node(ctx.createGain()); sendDlugi.gain.value = 0.85;
      reverbDlugi = node(ctx.createConvolver());
      var len2 = Math.floor(ctx.sampleRate * 9), imp2 = ctx.createBuffer(2, len2, ctx.sampleRate);
      for (var c2 = 0; c2 < 2; c2++) { var d2 = imp2.getChannelData(c2); for (var i2 = 0; i2 < len2; i2++) d2[i2] = (Math.random() * 2 - 1) * Math.exp(-4.2 * i2 / len2) * (1 - i2 / len2); }
      reverbDlugi.buffer = imp2;
      muzOut.connect(master); muzOut.connect(sendDlugi); sendDlugi.connect(reverbDlugi); reverbDlugi.connect(master);
      // chorus: dwie modulowane linie opóźnienia (22 i 29 ms, LFO 0,17 i 0,23 Hz) rozrzucone w lewo i prawo, zmieszane z suchym sygnałem: szerokie, obszerne tło
      var chorusy = [[0.022, 0.17, -0.6], [0.029, 0.23, 0.6]];
      for (var ci = 0; ci < 2; ci++) {
        var ch = node(ctx.createDelay(0.1)), lf = node(ctx.createOscillator()), lg = node(ctx.createGain()), wet = node(ctx.createGain()), pn;
        ch.delayTime.value = chorusy[ci][0]; lf.frequency.value = chorusy[ci][1]; lg.gain.value = 0.006; wet.gain.value = 0.6;
        if (ctx.createStereoPanner) { pn = node(ctx.createStereoPanner()); pn.pan.value = chorusy[ci][2]; } else { pn = node(ctx.createGain()); }
        lf.connect(lg); lg.connect(ch.delayTime); lf.start();
        muzOut.connect(ch); ch.connect(wet); wet.connect(pn); pn.connect(master); wet.connect(sendDlugi);
      }
    } catch (e) {
      wezly.slice().forEach(usun);
      if (ctx) { try { var p = ctx.close(); if (p && p.catch) p.catch(function () {}); } catch (err) {} }
      ctx = null; return;
    }
    wznow();
    if (chceTlo) tlo(true);
  }

  // Częstotliwość, opóźnienie, długość, amplituda, typ, częstotliwość końcowa.
  var nuty = {
    propozycja: [[392, 0, 0.28, 0.065], [440, 0.16, 0.36, 0.055]],
    polaczenie: [[196, 0, 0.65, 0.055], [246.94, 0.07, 0.6, 0.045], [293.66, 0.14, 0.6, 0.04]],
    rozlaczenie: [[293.66, 0, 0.35, 0.05], [246.94, 0.12, 0.35, 0.045], [196, 0.24, 0.4, 0.045]],
    kes: [[150, 0, 0.24, 0.09, 'sine', 65], [410, 0, 0.09, 0.025, 'triangle', 210]],
    zdrada: [[493.88, 0, 0.3, 0.045], [523.25, 0.015, 0.25, 0.03]],
    ujawnienieNiebieskie: [[523.25, 0, 0.48, 0.055], [783.99, 0.06, 0.48, 0.025]],
    ugryzienie: [[100, 0, 0.23, 0.1, 'sine', 48], [146, 0, 0.15, 0.025, 'triangle', 70]],
    zapalenie: [[659.25, 0, 0.62, 0.04], [987.77, 0.09, 0.55, 0.022], [1318.5, 0.16, 0.5, 0.01]],
    odrodzenie: [[130.81, 0, 0.95, 0.045, 'triangle', 196], [261.63, 0.1, 0.85, 0.03, 'sine', 293.66]],
    narodziny: [[55, 0, 0.8, 0.08, 'triangle', 65.41], [82.41, 0.06, 0.72, 0.035]],
    epoka: [[220, 0, 0.55, 0.05], [329.63, 0.32, 0.62, 0.045]],
    ukrycie: [[196, 0, 0.32, 0.015, 'sine', 98]]
  };
  function graj(nazwa, o) {
    if (!ctx || ctx.state !== 'running') return;
    o = o || {};
    var sila = zakres(o.sila, 0, 1, 1), pan = zakres(o.pan, -1, 1, 0);
    if (nazwa === 'trzymanie') { trzymaj(o, sila, pan); return; }
    var lista = nuty[nazwa];
    if (!lista || !sila || API.wyciszone || zdarzenia.length >= 16) return;
    var g = grupa(), out = wyjscie(g, pan), teraz = ctx.currentTime, koniec = teraz;
    out.gain.value = sila;
    zdarzenia.push(g);
    lista.forEach(function (n) {
      var s = osc(g, n[4] || 'sine', n[0]), env = node(ctx.createGain(), g);
      var t = teraz + n[1], d = n[2], atak = nazwa === 'odrodzenie' ? 0.25 : Math.min(0.045, d * 0.2);
      env.gain.value = 0; env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(n[3], t + atak);
      env.gain.exponentialRampToValueAtTime(0.00001, t + d);
      env.gain.linearRampToValueAtTime(0, t + d + 0.02);
      if (n[5]) { s.frequency.setValueAtTime(n[0], t); s.frequency.exponentialRampToValueAtTime(n[5], t + d); }
      s.connect(env); env.connect(out); s.start(t);
      koniec = Math.max(koniec, t + d + 0.03);
    });
    zakoncz(g, koniec);
  }
  function pusc() {
    clearTimeout(zegarChwytu); zegarChwytu = null;
    if (!chwyt) return;
    var g = chwyt; chwyt = null;
    gladko(g.out.gain, 0, 0.035); zakoncz(g, ctx.currentTime + 0.3);
  }
  function trzymaj(o, sila, pan) {
    var postep = zakres(o.postep, 0, 1, 0);
    if (API.wyciszone) { pusc(); return; }
    if (!chwyt) {
      chwyt = grupa(); chwyt.out = wyjscie(chwyt, pan); chwyt.out.gain.value = 0;
      chwyt.ton = osc(chwyt, 'sine', 130.81); chwyt.ton.connect(chwyt.out); chwyt.ton.start();
    }
    gladko(chwyt.ton.frequency, 130.81 + 130.82 * postep, 0.07);
    gladko(chwyt.out.gain, sila * (0.008 + 0.025 * postep), 0.06);
    var p = chwyt.nodes[1];
    if (p.pan) gladko(p.pan, pan, 0.05);
    else p.setPosition(pan, 0, -Math.sqrt(1 - pan * pan));
    // Klient nie ma osobnego zdarzenia puszczenia klawisza.
    clearTimeout(zegarChwytu); zegarChwytu = setTimeout(pusc, 180);
  }
  function tlo(wlacz) {
    chceTlo = !!wlacz;
    if (!ctx) return;
    if (!chceTlo) {
      if (pad) { var stary = pad; pad = null; gladko(stary.out.gain, 0, 0.15); zakoncz(stary, ctx.currentTime + 1.2); }
      muzyka(false);
      return;
    }
    muzyka(true);
    if (pad) return;
    pad = grupa(); pad.out = wyjscie(pad, 0); pad.out.gain.value = 0;
    pad.filter = node(ctx.createBiquadFilter(), pad); pad.filter.type = 'lowpass';
    pad.filter.Q.value = 0.4; pad.filter.frequency.value = 700; pad.filter.connect(pad.out);
    [73.42, 110, 146.83].forEach(function (hz, i) { // D2 A2 D3: zgodnie z harmonią ścieżki tła
      var s = osc(pad, i === 1 ? 'triangle' : 'sine', hz); s.detune.value = (i - 1) * 5;
      s.connect(pad.filter); s.start();
    });
    var oddech = osc(pad, 'sine', 0.09), skala = node(ctx.createGain(), pad);
    skala.gain.value = 90; oddech.connect(skala); skala.connect(pad.filter.frequency); oddech.start();
    pad.pulsGain = node(ctx.createGain(), pad); pad.pulsGain.gain.value = 0;
    var basP = osc(pad, 'sine', 36.71); basP.connect(pad.pulsGain); pad.pulsGain.connect(pad.filter); basP.start();
    pad.puls = osc(pad, 'sine', 0.9); pad.depth = node(ctx.createGain(), pad);
    pad.depth.gain.value = 0; pad.puls.connect(pad.depth); pad.depth.connect(pad.pulsGain.gain); pad.puls.start();
    gladko(pad.out.gain, 0.012, 0.45); zagrozenie(niebezpieczenstwo);
  }
  // ---------- ścieżka tła: kosmiczna harmonia. Najniższy ton (bas) zmienia się rzadko (co 2-4 akordy, przenikanie 24 s), górne głosy
  // przenikają się 20 s, wszystko dryfuje, oddycha i zanika; D-dur z nonami i sekstami, bez tercji małych i trytonów ----------
  var AKORDY = [ // górne głosy; bas: litery basów dopuszczalnych pod tym akordem
    { t: [146.83, 220, 329.63, 369.99], bas: 'DA' },  // D A E F#
    { t: [196, 246.94, 293.66, 329.63], bas: 'DG' },   // G B D E
    { t: [220, 246.94, 277.18, 329.63], bas: 'DA' },   // A B C# E
    { t: [164.81, 246.94, 369.99], bas: 'A' },         // E B F#
    { t: [185, 220, 293.66, 329.63], bas: 'DG' },      // F# A D E
    { t: [146.83, 185, 220, 329.63], bas: 'DGA' }];    // D F# A E
  var BASY = { D: 36.71, G: 49, A: 55 };
  function wyjscieMuz(g, pan) {
    var gain = node(ctx.createGain(), g), p;
    if (ctx.createStereoPanner) { p = node(ctx.createStereoPanner(), g); p.pan.value = pan; }
    else { p = node(ctx.createPanner(), g); p.panningModel = 'equalpower'; p.setPosition(pan, 0, -Math.sqrt(1 - pan * pan)); }
    gain.connect(p); p.connect(muzOut); g.out = gain; g.pan = p; return gain;
  }
  function straznik(g, czas) { // sprząta grupę o zadanym czasie zegara audio (źródła mają własne stop)
    var o = node(ctx.createOscillator(), g), z = node(ctx.createGain(), g); z.gain.value = 0; o.connect(z); z.connect(muzOut);
    o.onended = function () { o.onended = null; sprzataj(g); }; o.start(); o.stop(czas);
  }
  function wygas(g, czas, stala) { // wyciszenie (szybkie albo ze stałą czasu) i sprzątnięcie o czasie
    if (g.koniec) return;
    if (g.out) gladko(g.out.gain, 0, stala || 0.12);
    g.sources.forEach(function (n) { try { n.stop(czas); } catch (e) { /* już zatrzymane */ } });
    straznik(g, czas);
  }
  function szum(g) { // oddech: pętla szumu przez filtr pasmowy (powietrze w organach), bardzo cicho
    var len = Math.floor(ctx.sampleRate * 2), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    var s = node(ctx.createBufferSource(), g); s.buffer = buf; s.loop = true; g.sources.push(s); return s;
  }
  function dryft(g, param, hz, glebia, teraz) { // powolny dryf parametru (odstrojenie, filtr, tremolo, panorama): jeden LFO
    var a = osc(g, 'sine', hz), ga = node(ctx.createGain(), g); ga.gain.value = glebia; a.connect(ga); ga.connect(param); a.start(teraz);
  }
  function akord(nr, teraz, dl) { // górne głosy: unisono 3 sinusów na ton (±5 c z dryfem) + cicha oktawa + oddech, atak 12 s, wybrzmienie 15 s; smyczki z trójkątów na dwóch górnych tonach; panorama dryfuje
    var tony = AKORDY[nr % AKORDY.length].t, g = grupa(), out = wyjscieMuz(g, nr % 2 ? -0.2 : 0.2), fl = node(ctx.createBiquadFilter(), g), k = teraz + dl;
    out.gain.value = 1; fl.type = 'lowpass'; fl.frequency.value = 760; fl.Q.value = 0.4; fl.connect(out);
    dryft(g, fl.frequency, 0.03, 120, teraz); if (g.pan && g.pan.pan) dryft(g, g.pan.pan, 0.02 + (nr % 3) * 0.007, 0.35, teraz);
    tony.forEach(function (hz, i) {
      var env = node(ctx.createGain(), g), a = 0.0075 - i * 0.001; env.gain.value = 0;
      env.gain.setValueAtTime(0, teraz); env.gain.linearRampToValueAtTime(a, teraz + 12 + i * 1.2); env.gain.setValueAtTime(a, k - 15); env.gain.linearRampToValueAtTime(0, k - 0.3);
      [-5, 0, 5].forEach(function (c, j) { var s = osc(g, 'sine', hz); s.detune.value = c; dryft(g, s.detune, 0.05 + j * 0.017, 3, teraz); s.connect(env); s.start(teraz); });
      var s2 = osc(g, 'sine', hz * 2), g2 = node(ctx.createGain(), g); g2.gain.value = 0.18; s2.connect(g2); g2.connect(env); s2.start(teraz);
      env.connect(fl);
    });
    var od = szum(g), of = node(ctx.createBiquadFilter(), g), og = node(ctx.createGain(), g); of.type = 'bandpass'; of.frequency.value = 520; of.Q.value = 0.7; og.gain.value = 0;
    og.gain.setValueAtTime(0, teraz); og.gain.linearRampToValueAtTime(0.0012, teraz + 12); og.gain.setValueAtTime(0.0012, k - 15); og.gain.linearRampToValueAtTime(0, k - 0.3);
    od.connect(of); of.connect(og); og.connect(out); od.start(teraz);
    var sf = node(ctx.createBiquadFilter(), g); sf.type = 'lowpass'; sf.frequency.value = 640; sf.Q.value = 0.7; sf.connect(out);
    var vib = osc(g, 'sine', 4.6 + (nr % 3) * 0.25), vg = node(ctx.createGain(), g); vg.gain.value = 4; vib.connect(vg); vib.start(teraz);
    tony.slice(-2).forEach(function (hz, i) {
      var env = node(ctx.createGain(), g); env.gain.value = 0;
      env.gain.setValueAtTime(0, teraz + 3 + i); env.gain.linearRampToValueAtTime(0.0026, teraz + 14 + i); env.gain.setValueAtTime(0.0026, k - 14); env.gain.linearRampToValueAtTime(0, k - 0.3);
      dryft(g, env.gain, 0.5 + i * 0.1, 0.0007, teraz);
      [-7, 0, 7].forEach(function (c) { var tr = osc(g, 'triangle', hz * 2); tr.detune.value = c; vg.connect(tr.detune); tr.connect(env); tr.start(teraz); });
      env.connect(sf);
    });
    zakoncz(g, k); return g;
  }
  function bas(litera, teraz) { // najniższy ton: sinus + cicha oktawa, powolne falowanie głośności (0,11 Hz, ok. 35 %) nadaje tempo; atak 12 s, trwa do zmiany basu
    var g = grupa(), out = wyjscieMuz(g, 0), hz = BASY[litera] || BASY.D, env = node(ctx.createGain(), g), g2 = node(ctx.createGain(), g); out.gain.value = 1; env.gain.value = 0; g2.gain.value = 0.3;
    env.gain.setValueAtTime(0, teraz); env.gain.linearRampToValueAtTime(0.02, teraz + 12); dryft(g, env.gain, 0.11, 0.007, teraz);
    var s = osc(g, 'sine', hz), s2 = osc(g, 'sine', hz * 2); s.connect(env); s2.connect(g2); g2.connect(env); env.connect(out); s.start(teraz); s2.start(teraz);
    g.litera = litera; return g;
  }
  function szklo(nr, teraz) { // 3-5 pojedynczych miękkich tonów z akordu (sinus + cicha oktawa), rozrzucone w czasie, bez biegów; resztę robi pogłos
    var tony = AKORDY[nr % AKORDY.length].t, g = grupa(), out = wyjscieMuz(g, 0), ile = 3 + (nr % 3), t = teraz, ost = -1;
    out.gain.value = 1;
    for (var i = 0; i < ile; i++) {
      var j = Math.floor(Math.random() * tony.length); if (j === ost) j = (j + 1) % tony.length; ost = j;
      var hz = tony[j] * (Math.random() < 0.3 ? 4 : 2), t0 = t + 1.5 + Math.random() * 4, env = node(ctx.createGain(), g); env.gain.value = 0;
      env.gain.setValueAtTime(0, t0); env.gain.linearRampToValueAtTime(0.0036, t0 + 0.12); env.gain.exponentialRampToValueAtTime(0.00001, t0 + 3.5);
      [[1, 0, 1], [2, 5, 0.25]].forEach(function (p) { var s = osc(g, 'sine', hz * p[0]), sg = node(ctx.createGain(), g); sg.gain.value = p[2]; s.detune.value = p[1]; s.connect(sg); sg.connect(env); s.start(t0); s.stop(t0 + 3.8); });
      env.connect(out); t = t0;
    }
    straznik(g, t + 5); return g;
  }
  function klawisz(nr, teraz) { // klawisz (18.10 21:40): 2-3 tony z akordu po 1-5 s w średnim rejestrze (co czwarty oktawę wyżej), lekko minimoogowy: piła + trójkąt (+6 c), filtr dolnoprzepustowy otwiera się powoli (ton się rozchodzi) i domyka, wibrato narasta po 2,5 s; pogłos i chorus z toru tła
    var tony = AKORDY[nr % AKORDY.length].t, g = grupa(), out = wyjscieMuz(g, (Math.random() - 0.5) * 0.5), ile = 2 + (Math.random() < 0.4 ? 1 : 0), t = teraz, ost = -1;
    out.gain.value = 1;
    var vib = osc(g, 'sine', 5.2), vg = node(ctx.createGain(), g); vg.gain.value = 0; vg.gain.setValueAtTime(0, teraz); vg.gain.linearRampToValueAtTime(3.5, teraz + 2.5); vib.connect(vg); vib.start(teraz);
    for (var i = 0; i < ile; i++) {
      var j = Math.floor(Math.random() * tony.length); if (j === ost) j = (j + 1) % tony.length; ost = j;
      var hz = tony[j] * (Math.random() < 0.25 ? 2 : 1), dl = 1 + Math.random() * 4, t0 = t, env = node(ctx.createGain(), g), fl = node(ctx.createBiquadFilter(), g);
      fl.type = 'lowpass'; fl.Q.value = 1.6; fl.frequency.setValueAtTime(hz * 1.1, t0); fl.frequency.linearRampToValueAtTime(hz * 3.2, t0 + dl * 0.6); fl.frequency.linearRampToValueAtTime(hz * 1.4, t0 + dl + 1.6);
      env.gain.value = 0; env.gain.setValueAtTime(0, t0); env.gain.linearRampToValueAtTime(0.0055, t0 + Math.min(0.9, dl * 0.35)); env.gain.setValueAtTime(0.0055, t0 + dl); env.gain.linearRampToValueAtTime(0, t0 + dl + 1.8);
      [['sawtooth', 0, 0.55], ['triangle', 6, 1]].forEach(function (p) { var s = osc(g, p[0], hz), sg = node(ctx.createGain(), g); sg.gain.value = p[2]; s.detune.value = p[1]; vg.connect(s.detune); s.connect(sg); sg.connect(fl); s.start(t0); s.stop(t0 + dl + 2); });
      fl.connect(env); env.connect(out); t = t0 + dl + 0.4 + Math.random() * 1.2;
    }
    vib.stop(t + 3); straznik(g, t + 3); return g;
  }
  function muzyka(wlacz) {
    if (!wlacz) {
      if (!muz) return;
      clearTimeout(muz.zegar); var t = ctx.currentTime + 1.2; muz.grupy.forEach(function (g) { wygas(g, t); }); muz = null; return;
    }
    if (muz || !muzOut) return;
    muz = { bas: 'D', nr: 0, odBasu: 0, basGrupa: null, grupy: [], zegar: null };
    function dalej() {
      if (!muz) return;
      if (ctx.state !== 'running') { muz.zegar = setTimeout(dalej, 2000); return; } // karta uśpiona: nie kolejkuj
      muz.grupy = muz.grupy.filter(function (g) { return !g.koniec; });
      var teraz = ctx.currentTime;
      if (!muz.basGrupa || muz.odBasu >= 2 + Math.floor(Math.random() * 3)) { // bas zmienia się rzadziej niż reszta: co 2-4 akordy, przenika 24 s
        var litery = ['D', 'D', 'G', 'A'], nowa = litery[Math.floor(Math.random() * litery.length)];
        if (muz.basGrupa && nowa === muz.bas) nowa = muz.bas === 'D' ? (Math.random() < 0.5 ? 'G' : 'A') : 'D';
        if (muz.basGrupa) wygas(muz.basGrupa, teraz + 24, 7);
        muz.bas = nowa; muz.basGrupa = bas(nowa, teraz); muz.grupy.push(muz.basGrupa); muz.odBasu = 0;
      }
      var dozw = []; for (var i = 0; i < AKORDY.length; i++) if (AKORDY[i].bas.indexOf(muz.bas) >= 0 && i !== muz.nr) dozw.push(i);
      muz.nr = dozw[Math.floor(Math.random() * dozw.length)]; muz.odBasu++;
      var dl = 42 + Math.random() * 18; muz.grupy.push(akord(muz.nr, teraz, dl));
      if (Math.random() < 0.5) muz.grupy.push(szklo(muz.nr, teraz + 10 + Math.random() * 10));
      if (Math.random() < 0.55) muz.grupy.push(klawisz(muz.nr, teraz + 14 + Math.random() * 18)); // klawisz co jakiś czas, gdy akord już brzmi
      muz.zegar = setTimeout(dalej, (dl - 20) * 1000); // górne głosy przenikają się 20 s
    }
    dalej();
  }
  function zagrozenie(poziom) {
    niebezpieczenstwo = zakres(poziom, 0, 1, 0);
    if (!pad) return;
    gladko(pad.filter.frequency, 700 - 460 * niebezpieczenstwo, 0.35);
    gladko(pad.puls.frequency, 0.9 + niebezpieczenstwo * 1.2, 0.3);
    gladko(pad.pulsGain.gain, niebezpieczenstwo * 0.35, 0.3);
    gladko(pad.depth.gain, niebezpieczenstwo * 0.3, 0.3);
  }
  function wycisz(czy) {
    API.wyciszone = !!czy;
    if (ctx) gladko(master.gain, API.wyciszone ? 0 : 0.5, 0.04);
    if (API.wyciszone) pusc();
  }
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) wznow(); else pusc();
  });
  window.addEventListener('pageshow', wznow);
  window.addEventListener('focus', wznow);
  window.K_dzwiek = API;
})();
