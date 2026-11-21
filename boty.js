/* Komety: boty ES5. Żółta (AI po stronie silnika) zapisuje tylko prędkość, cel pogoni (z.goni, z.pamiec) i pamięć z.ai;
   czyta wyłącznie pomoc.* (cele, światło, geometria, wezwanie). Bot-gracz (szary) korzysta tylko z widoku i geometrii statycznej.
   Losowość: los(). Przepływ gry: Spacja trzymana = nawołuję, C = dołączam uczciwie, E = dołączam, żeby pożreć; Shift w parze = odłączam;
   rozstrzygnięcie przy żółtej. Bot-gracz działa w trybach z histerezą (decyzja trwa co najmniej chwilę) i z wygładzonym ruchem. */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.K_boty = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  function odl(a, b) { var x = a.x - b.x, y = a.y - b.y; return Math.sqrt(x*x+y*y); }
  function norm(x, y) { var d = Math.sqrt(x*x+y*y) || 1; return { dx:x/d, dy:y/d }; }
  function drozna(a, b, kola, r) {
    var x=b.x-a.x, y=b.y-a.y, ll=x*x+y*y;
    for(var i=0;i<kola.length;i++) {
      var k=kola[i], t=ll ? Math.max(0,Math.min(1,((k.x-a.x)*x+(k.y-a.y)*y)/ll)) : 0;
      var dx=a.x+t*x-k.x, dy=a.y+t*y-k.y;
      if(dx*dx+dy*dy < (k.r+r)*(k.r+r)-0.001) return false;
    }
    return true;
  }
  // ---------- żółta ----------
  function zolta(st,z,dt,p) {
    var B=p.B, a=z.ai, now=st.czas;
    if(z.trawienie>0) { z.vx=0; z.vy=0; z.pamiec=null; z.goni=null; return; }
    var cele=p.cele(st,z), cel=null, nd=1e9, i;
    for(i=0;i<cele.length;i++) { var d=odl(z,cele[i]); if(cele[i].tylkoSzary) d-=1e6; if(d<nd) {nd=d;cel=cele[i];} } // gracz zawsze pierwszy (19.10 02:40)
    if(cel) nd=odl(z,cel); z.goni=cel ? cel.id : null;
    if(cel) {
      z.pamiec={x:cel.x,y:cel.y,czas:now};
      var ahead=Math.min(0.45,nd/500), q={x:cel.x+(cel.vx||0)*ahead,y:cel.y+(cel.vy||0)*ahead};
      cel=drozna(z,q,st.kola,B.ZOLTA_R) ? q : z.pamiec;
    } else if(z.pamiec && now-z.pamiec.czas<1.5) cel=z.pamiec;
    else z.pamiec=null;
    var wz=p.wezwanie ? p.wezwanie(st,z) : null; // przywołana przez parę: idzie na środek pary, chyba że widzi samotnego
    if(!cel && wz) cel=wz;
    if(!cel) {
      if(!a.cel || odl(z,a.cel)<45 || now-a.celOd>6) {
        var best=null, score=-1e9;
        for(i=0;i<18;i++) {
          var q2={x:60+st.los()*(B.SWIAT-120),y:60+st.los()*(B.SWIAT-120)};
          if(i<5 && st.kola.length) { var k=st.kola[Math.floor(st.los()*st.kola.length)], an=st.los()*Math.PI*2; q2={x:k.x+Math.cos(an)*(k.r+B.ZOLTA_R+18),y:k.y+Math.sin(an)*(k.r+B.ZOLTA_R+18)}; }
          if(q2.x<45 || q2.y<45 || q2.x>B.SWIAT-45 || q2.y>B.SWIAT-45 || p.wKole(st,q2,B.ZOLTA_R) || p.swiatlo(st,q2.x,q2.y)>B.PROG_SWIATLA) continue;
          var s=-odl(z,q2)*0.15-p.swiatlo(st,q2.x,q2.y)*100;
          for(var j=0;j<st.zolte.length;j++) {var other=st.zolte[j]; if(other!==z && !other.martwa) s-=Math.max(0,400-odl(other,q2));}
          if(s>score) {score=s;best=q2;}
        }
        a.cel=best || {x:B.SWIAT/2,y:B.SWIAT/2}; a.celOd=now;
      }
      cel=a.cel;
    }
    if(!a.ost || now-a.ost.t>2) { a.klinS = (a.ost && odl(z,a.ost)<15) ? (a.klinS||0)+1 : 0; a.ost={x:z.x,y:z.y,t:now}; } // zaklinowanie (19.10 05:00): brak przesunięcia przez 2 s
    var base=Math.atan2(cel.y-z.y,cel.x-z.x), bestAngle=base, value=-1e9, bliskie=[];
    for(i=0;i<st.kola.length;i++) {
      var przeszkoda=st.kola[i], zasieg=75+B.ZOLTA_R+0.1+przeszkoda.r;
      if(Math.abs(przeszkoda.x-z.x)<=zasieg && Math.abs(przeszkoda.y-z.y)<=zasieg) bliskie.push(przeszkoda);
    }
    for(i=0;i<16;i++) {
      var angle=base+i*Math.PI/8, ux=Math.cos(angle), uy=Math.sin(angle), end={x:z.x+ux*75,y:z.y+uy*75};
      if(end.x<B.ZOLTA_R || end.y<B.ZOLTA_R || end.x>B.SWIAT-B.ZOLTA_R || end.y>B.SWIAT-B.ZOLTA_R) continue;
      if(!drozna(z,end,bliskie,B.ZOLTA_R+0.1)) continue;
      var sonda=z.goni!=null ? 36 : 75; if(p.swiatlo(st,z.x+ux*sonda,z.y+uy*sonda)>B.PROG_SWIATLA || p.swiatlo(st,z.x+ux*20,z.y+uy*20)>B.PROG_SWIATLA) continue; // w pogoni krótsza sonda: przeciska się furtkami między plamami
      var val=Math.cos(angle-base)*2 + (a.kat==null?0:Math.cos(angle-a.kat)*1.5);
      for(var n=0;n<st.zolte.length;n++) { var zz=st.zolte[n]; if(zz!==z && !zz.martwa) val-=Math.max(0,180-odl(end,zz))/70; }
      if(val>value) {value=val;bestAngle=angle;}
    }
    if(value===-1e9 || a.klinS>=1) { // zaklinowana albo osaczona światłem: szuka innej drogi
      if(value===-1e9 && z.goni!=null && p.swiatlo(st,z.x+Math.cos(base)*12,z.y+Math.sin(base)*12)<=B.PROG_SWIATLA) { a.kat=base; z.vx=Math.cos(base)*B.PREDKOSC_GONU*0.5; z.vy=Math.sin(base)*B.PREDKOSC_GONU*0.5; return; } // cel blisko: wprost na niego, wolniej
      var naj=null, najv=-1e9; for(i=0;i<16;i++) { var an2=i*Math.PI/8, ux2=Math.cos(an2), uy2=Math.sin(an2), e2={x:z.x+ux2*40,y:z.y+uy2*40}; if(e2.x<B.ZOLTA_R||e2.y<B.ZOLTA_R||e2.x>B.SWIAT-B.ZOLTA_R||e2.y>B.SWIAT-B.ZOLTA_R) continue; if(p.swiatlo(st,z.x+ux2*20,z.y+uy2*20)>B.PROG_SWIATLA || p.swiatlo(st,e2.x,e2.y)>B.PROG_SWIATLA) continue; if(!drozna(z,e2,bliskie,B.ZOLTA_R+0.1)) continue; var v2=0; for(var n2=0;n2<st.zolte.length;n2++) { var z2=st.zolte[n2]; if(z2!==z && !z2.martwa) v2+=Math.min(400,odl(e2,z2)); } if(v2>najv){najv=v2;naj=an2;} } // krótkie sondy, najdalej od innych żółtych
      if(naj!=null) { a.kat=naj; a.cel=null; a.celOd=now; a.klin=0; z.vx=Math.cos(naj)*B.PREDKOSC_ZOLTEJ; z.vy=Math.sin(naj)*B.PREDKOSC_ZOLTEJ; return; }
      a.klin=(a.klin||0)+dt; a.celOd=-100; z.vx=0; z.vy=0; if(a.klin>2) { a.klin=0; a.klinS=0; z.martwa=true; z.odrodzenie=B.ODRODZENIE_ZOLTEJ; z.goni=null; z.wezwanie=null; z.smierc={x:z.x,y:z.y}; } return; } // bez wyjścia przez 2 s: odradza się w mroku daleko (ODRODZENIE_ZOLTEJ_DALEKO)
    a.klin=0;
    a.kat=bestAngle; var v=(z.goni!=null||wz)?B.PREDKOSC_GONU:B.PREDKOSC_ZOLTEJ;
    z.vx=Math.cos(bestAngle)*v; z.vy=Math.sin(bestAngle)*v;
  }
  // ---------- nawigacja bota-gracza (siatka 50, BFS; bez przeszkód: prosto) ----------
  var ostatnieStat=null, ostatniaMapa=null;
  function mapa(stat) {
    if(stat===ostatnieStat) return ostatniaMapa;
    var kola=[], pts=[], edges=[], i,j,n=Math.floor(stat.B.SWIAT/50);
    for(i=0;i<stat.przeszkody.length;i++) kola=kola.concat(stat.przeszkody[i].kola);
    for(i=0;i<n*n;i++) pts.push({x:(i%n)*50+25,y:Math.floor(i/n)*50+25});
    for(i=0;i<pts.length;i++) {
      edges[i]=[]; if(!drozna(pts[i],pts[i],kola,stat.B.R+1)) continue;
      for(var dy=-1;dy<=1;dy++) for(var dx=-1;dx<=1;dx++) {
        var xx=i%n+dx, yy=Math.floor(i/n)+dy; j=yy*n+xx;
        if((dx||dy) && xx>=0 && yy>=0 && xx<n && yy<n && drozna(pts[i],pts[j],kola,stat.B.R+1)) edges[i].push(j);
      }
    }
    ostatnieStat=stat; ostatniaMapa={kola:kola,pts:pts,edges:edges}; return ostatniaMapa;
  }
  function wezly(m,p,r) {
    var out=[], i; for(i=0;i<m.pts.length;i++) if(odl(p,m.pts[i])<110 && m.edges[i].length && drozna(p,m.pts[i],m.kola,r)) out.push(i);
    return out;
  }
  function droga(pm,ja,cel) {
    var m=pm.mapa, r=pm.statyczne.B.R;
    if(!m.kola.length || drozna(ja,cel,m.kola,r)) {pm.trasa=null;return cel;}
    if(!pm.trasa || pm.t>pm.przelicz || odl(cel,pm.koniec)>75) {
      var start=wezly(m,ja,r), end=wezly(m,cel,r), queue=[], prev=new Int32Array(m.pts.length), targets={}, i, head=0, found=-1;
      for(i=0;i<prev.length;i++) prev[i]=-2;
      for(i=0;i<end.length;i++) targets[end[i]]=true;
      for(i=0;i<start.length;i++) {prev[start[i]]=-1;queue.push(start[i]);}
      while(head<queue.length) {
        var u=queue[head++]; if(targets[u]) {found=u;break;}
        var es=m.edges[u]; for(i=0;i<es.length;i++) if(prev[es[i]]===-2) {prev[es[i]]=u;queue.push(es[i]);}
      }
      pm.trasa=[]; while(found>=0) {pm.trasa.unshift(m.pts[found]);found=prev[found];}
      pm.koniec={x:cel.x,y:cel.y}; pm.przelicz=pm.t+1;
    }
    while(pm.trasa.length>1 && drozna(ja,pm.trasa[1],m.kola,r)) pm.trasa.shift();
    if(!pm.trasa.length) { pm.trasa=null; return cel; } // brak trasy (np. bot w kącie siatki): idź prosto, kolizja i tak zsunie
    return pm.trasa[0];
  }
  // ---------- bot-gracz ----------
  // wola: skłonność do nawoływania; odpowiada: do podchodzenia do nawołującego; pozera: szansa zdrady (Shift tuż przed żółtą); uciekaOd: dystans ucieczki;
  // prog: minimalne zaufanie do kropki, żeby z nią nawoływać albo do niej dołączyć (0,15 = nieznajomy, 1 = widziano, jak goni ją żółta)
  var OSOBOWOSCI={
    ostrozny:   {wola:0.12, odpowiada:0.75, pozera:0,    uciekaOd:260, mrok:0,   prog:0.9},
    budowniczy: {wola:0.45, odpowiada:0.95, pozera:0,    uciekaOd:200, mrok:0,   prog:0.15},
    zdrajca:    {wola:0.2,  odpowiada:1,    pozera:1,    uciekaOd:190, mrok:0.6, prog:-1}, // wilk od startu w single: udaje szarego, nawołuje jak przynęta
    chciwy:     {wola:0.25, odpowiada:0.9,  pozera:0.35, uciekaOd:200, mrok:0.3, prog:0.15},
    'przynęta': {wola:0.7,  odpowiada:0.9,  pozera:0,    uciekaOd:150, mrok:0,   prog:0.5}
  };
  // nieufność: ocena każdej kropki z tego, co widać. Dowód szarości: żółta ją goni. Podejrzenie: stoi przy żółtej i nie jest goniona.
  function zaufanie(pm,id) { return pm.zaufanie[id]==null ? (pm.nieufny ? 0 : 0.15) : pm.zaufanie[id]; } // single (nieufny): bazowo 0, nikt nie jest zaufany z góry
  function obserwuj(w,pm,dt) {
    var i,j,o,zz; pm.zaufanie=pm.zaufanie||{}; pm.podejrzenie=pm.podejrzenie||{}; pm.wSwietle=pm.wSwietle||{}; pm.swPod=pm.swPod||{};
    var B=pm.statyczne.B, pw=w.pole.w, pn=Math.round(B.SWIAT/B.KOMORKA);
    for(i=0;i<w.inni.length;i++) { // dowód szarości: stoi w świetle „1” ponad 6 s, a światło się nie rozpada (wilk by je rozpuścił)
      o=w.inni[i]; var ci=Math.max(0,Math.min(pn-1,Math.floor(o.x/B.KOMORKA))), cj=Math.max(0,Math.min(pn-1,Math.floor(o.y/B.KOMORKA)));
      var wpod=pw[cj*pn+ci]; if(wpod>B.PROG_SWIATLA) { pm.wSwietle[o.id]=(pm.wSwietle[o.id]||0)+dt; if(pm.wSwietle[o.id]>6) pm.zaufanie[o.id]=1; else if(pm.wSwietle[o.id]>1.5 && zaufanie(pm,o.id)>=0) pm.zaufanie[o.id]=Math.max(zaufanie(pm,o.id),0.95); }
      else pm.wSwietle[o.id]=0;
      if(o.migocze && wpod>B.PROG_SWIATLA) pm.zaufanie[o.id]=-1; // migocze w „1”: to wilk
    }
    for(i=0;i<w.zolte.length;i++) { zz=w.zolte[i]; if(zz.goniKogo && zz.goniKogo!==w.ja.id) pm.zaufanie[zz.goniKogo]=1; }
    for(i=0;i<w.inni.length;i++) {
      o=w.inni[i]; var przyZoltej=false, goniona=false;
      for(j=0;j<w.zolte.length;j++) { zz=w.zolte[j]; if(zz.goniKogo===o.id) goniona=true; if(!zz.trawi && odl(o,zz)<170) przyZoltej=true; }
      if(przyZoltej && !goniona && !o.partner) { pm.podejrzenie[o.id]=(pm.podejrzenie[o.id]||0)+dt; if(pm.podejrzenie[o.id]>1.5 && zaufanie(pm,o.id)>0) pm.zaufanie[o.id]=0; }
      else pm.podejrzenie[o.id]=0;
    }
    for(i=0;i<w.zdarzenia.length;i++) {
      var ev=w.zdarzenia[i];
      if(ev.typ==='zapalenie') { if(ev.kto) pm.zaufanie[ev.kto]=Math.min(1,zaufanie(pm,ev.kto)+0.35); if(ev.partner) pm.zaufanie[ev.partner]=Math.min(1,zaufanie(pm,ev.partner)+0.35); }
      if(ev.typ==='ujawnienie' && ev.kolor==='czerwony' && ev.kto) pm.zaufanie[ev.kto]=-1;
      if(ev.typ==='zdrada' && ev.kto) pm.zaufanie[ev.kto]=-1; // zerwał tuż przed żółtą: zdrajca, choćby pozostał szary (gracz w single)
      if(ev.typ==='odpychanie' && ev.pies) { pm.psy=pm.psy||{}; pm.psy[ev.pies]=true; } // pies się ze mną nie łączy: nie odpowiadam mu więcej
      if(ev.typ==='odpychanie' && ev.dla===w.ja.id && ev.pies===w.ja.id && ev.drugi) { pm.odepchnieci=pm.odepchnieci||{}; pm.odepchnieci[ev.drugi]=pm.t; } // jestem psem: ta szara się ze mną nie łączy
      if(ev.typ==='zapalenie' && pm.ofiaraId && (ev.kto===pm.ofiaraId || ev.partner===pm.ofiaraId)) { var dr=ev.kto===pm.ofiaraId?ev.partner:ev.kto; pm.lacznie=pm.lacznie||{}; if(dr) pm.lacznie[dr]=(pm.lacznie[dr]||0)+1; } // wilk liczy wspólne zapalenia gracza z daną szarą
    }
    var baza=pm.nieufny?0:0.15; for(var id in pm.zaufanie) { var v=pm.zaufanie[id]; if(v>baza) pm.zaufanie[id]=Math.max(baza,v-dt/90); else if(v>-1 && v<baza) pm.zaufanie[id]=Math.min(baza,v+dt/60); } // ocena blaknie do bazy; -1 (wilk) zostaje
  }
  function wedrowka(pm,ja,B,los,okres) {
    var m0=B.BRZEG_MROKU+80; // cel wędrówki poza czarną obwódką
    if(!pm.cel || odl(ja,pm.cel)<30 || pm.t>pm.celDo) {pm.cel={x:m0+los()*(B.SWIAT-2*m0),y:m0+los()*(B.SWIAT-2*m0)};pm.celDo=pm.t+okres;}
    return pm.cel;
  }
  function wDziurze(w,p,marg) { if(!w.dziury) return false; for(var i=0;i<w.dziury.length;i++) if(odl(p,w.dziury[i])<w.dziury[i].r+marg) return true; return false; }
  function wokol(w,p,r) { var n=0; for(var i=0;i<w.inni.length;i++) { var o=w.inni[i]; if(o.id!==p.id && odl(o,p)<r) n++; } return n; } // ile innych kropek w promieniu r od p
  function najblizszaDziura(w,ja) { var nh=null, nhd=1e9; for(var i=0;i<w.dziury.length;i++){ var hd=odl(ja,w.dziury[i]); if(hd<nhd){nhd=hd;nh=w.dziury[i];} } return nh; }
  function najblizszyMrok(w,ja,B,zas) { // najbliższa ciemna komórka (wilk ucieka ze światła nawet z wnętrza wielkiej plamy)
    var pw=w.pole.w, pn=Math.round(B.SWIAT/B.KOMORKA), ci=Math.floor(ja.x/B.KOMORKA), cj=Math.floor(ja.y/B.KOMORKA), best=1e9, pt=null, Z=zas||80;
    for(var jj=Math.max(0,cj-Z);jj<=Math.min(pn-1,cj+Z);jj++) for(var ii=Math.max(0,ci-Z);ii<=Math.min(pn-1,ci+Z);ii++) { if(pw[jj*pn+ii]<=B.PROG_SWIATLA) { var q={x:(ii+.5)*B.KOMORKA,y:(jj+.5)*B.KOMORKA}, dd=odl(ja,q); if(dd<best){best=dd;pt=q;} } }
    return pt;
  }
  function najblizszeSwiatlo(w,ja,B,zas) {
    var pw=w.pole.w, pn=Math.round(B.SWIAT/B.KOMORKA), ci=Math.floor(ja.x/B.KOMORKA), cj=Math.floor(ja.y/B.KOMORKA), best=1e9, pt=null, Z=zas||9;
    for(var jj=Math.max(0,cj-Z);jj<=Math.min(pn-1,cj+Z);jj++) for(var ii=Math.max(0,ci-Z);ii<=Math.min(pn-1,ci+Z);ii++) { if(pw[jj*pn+ii]>B.PROG_SWIATLA) { var q={x:(ii+.5)*B.KOMORKA,y:(jj+.5)*B.KOMORKA}, dd=odl(ja,q); if(dd<best){best=dd;pt=q;} } }
    return pt;
  }
  function wnetrzeSwiatla(w,ja,B) { // najgłębsza jasna komórka w pobliżu (±4): najwięcej jasnych sąsiadów, potem najbliższa; tam żółta nie sięga
    var pw=w.pole.w, pn=Math.round(B.SWIAT/B.KOMORKA), ci=Math.floor(ja.x/B.KOMORKA), cj=Math.floor(ja.y/B.KOMORKA), best=null, bs=-1e9;
    for(var jj=Math.max(1,cj-4);jj<=Math.min(pn-2,cj+4);jj++) for(var ii=Math.max(1,ci-4);ii<=Math.min(pn-2,ci+4);ii++) { if(pw[jj*pn+ii]<=B.PROG_SWIATLA) continue; var n=0; for(var dy=-1;dy<=1;dy++) for(var dx=-1;dx<=1;dx++) if((dx||dy) && pw[(jj+dy)*pn+ii+dx]>B.PROG_SWIATLA) n++; var q={x:(ii+.5)*B.KOMORKA,y:(jj+.5)*B.KOMORKA}, s=n*100-odl(ja,q); if(s>bs){bs=s;best=q;} }
    return best;
  }
  function brzegSwiatla(w,ja,B,zas) { // jasna komórka tuż przy krawędzi plamy: sąsiedzi jasni, ale w odległości 2 jest ciemno; nadawanie przy krawędzi (żółta nie dosięgnie, gracz wpada szybko); zas: promień szukania w komórkach
    var pw=w.pole.w, pn=Math.round(B.SWIAT/B.KOMORKA), ci=Math.floor(ja.x/B.KOMORKA), cj=Math.floor(ja.y/B.KOMORKA), best=null, bd=1e9, Z=zas||14;
    for(var jj=Math.max(2,cj-Z);jj<=Math.min(pn-3,cj+Z);jj++) for(var ii=Math.max(2,ci-Z);ii<=Math.min(pn-3,ci+Z);ii++) { if(pw[jj*pn+ii]<=B.PROG_SWIATLA) continue; var dobra=true, ciemno=false; for(var dy=-2;dy<=2 && dobra;dy++) for(var dx=-2;dx<=2;dx++) { var v=pw[(jj+dy)*pn+ii+dx]>B.PROG_SWIATLA, m=Math.max(Math.abs(dx),Math.abs(dy)); if(m===1 && !v) { dobra=false; break; } if(m===2 && !v) ciemno=true; } if(!dobra || !ciemno) continue; var q={x:(ii+.5)*B.KOMORKA,y:(jj+.5)*B.KOMORKA}, d=odl(ja,q); if(d<bd){bd=d;best=q;} }
    return best;
  }
  function szary(w,pm,los,dt) {
    var ja=w.ja, B=pm.statyczne.B, os=OSOBOWOSCI[pm.osobowosc]||OSOBOWOSCI.ostrozny;
    var out={dx:0,dy:0,spacja:false,c:false,e:false,shift:false}, i, cel=null, stoje=false;
    pm.t=(pm.t||0)+dt; pm.mapa=pm.mapa||mapa(pm.statyczne); pm.ost=pm.ost||{dx:0,dy:0}; pm.cd=pm.cd||{};
    if(ja.martwy) {pm.trasa=null;pm.tryb=null;pm.ost.dx=pm.ost.dy=0;return out;}
    var wilk=ja.kolor==='czerwony', pies=ja.kolor==='niebieski';
    obserwuj(w,pm,dt);
    var ufa=function(o){ if(ja.przerwy && ja.przerwy[o.id]) return false; return wilk || pies || zaufanie(pm,o.id)>=os.prog; }; // przerwa po ostatniej parze; wilk i pies nie wybrzydzają
    // otoczenie
    var z=null, nd=1e9, hunt=null, wolajacy=null, dw=1e9, inny=null, di=1e9, partner=null, podejrzany=null, dp=1e9;
    for(i=0;i<w.zolte.length;i++) {var zz=w.zolte[i], dz=odl(ja,zz); if(dz<nd){nd=dz;z=zz;} if(zz.wezwanaDoMnie && (!hunt||dz<odl(ja,hunt))) hunt=zz;}
    var wrog=null, dwr=1e9;
    for(i=0;i<w.inni.length;i++) {var o=w.inni[i], d2=odl(ja,o); if(o.partner) partner=o; if(o.wola && ufa(o) && !(pm.nieufny && !wilk) && !(pm.psy && pm.psy[o.id]) && !(pm.odepchnieci && pm.odepchnieci[o.id]) && d2<dw){dw=d2;wolajacy=o;} if(d2<di){di=d2;inny=o;} if(!wilk && !pies && zaufanie(pm,o.id)<=0 && d2<dp){dp=d2;podejrzany=o;} if(!wilk && !pies && zaufanie(pm,o.id)<=-1 && d2<dwr){dwr=d2;wrog=o;}}
    var unikaj = (wrog && dwr<(pm.nieufny?450:150)) ? wrog : (podejrzany && dp<150 ? podejrzany : null);
    if(pies && pm.odepchnieci) for(i=0;i<w.inni.length;i++) { var oo=w.inni[i]; if(pm.odepchnieci[oo.id] && pm.t-pm.odepchnieci[oo.id]<30 && odl(ja,oo)<220) unikaj=oo; } // pies oddala się od szarej, z którą nie może się połączyć
    var czlowiek=null; for(i=0;i<w.inni.length;i++) if(w.inni[i].id===pm.ofiaraId) czlowiek=w.inni[i];
    pm.wolaOd=pm.wolaOd||{}; for(i=0;i<w.inni.length;i++) { var ow=w.inni[i]; if(ow.wola) { if(pm.wolaOd[ow.id]==null) pm.wolaOd[ow.id]=pm.t; } else delete pm.wolaOd[ow.id]; } // od kiedy kto nadaje (zwłoka wilka w single)
    var agres=0; if(pm.lacznie) for(var la in pm.lacznie) agres=Math.max(agres,pm.lacznie[la]); // wilk: najwięcej wspólnych zapaleń gracza z jedną szarą
    var zolteBlisko=0; for(i=0;i<w.zolte.length;i++) if(odl(ja,w.zolte[i])<260) zolteBlisko++;
    var osaczony=!wilk && !pies && zolteBlisko>=2, wolaCzl=null; if(osaczony && pm.ofiaraId) for(i=0;i<w.inni.length;i++) { var oc2=w.inni[i]; if(oc2.id===pm.ofiaraId && oc2.wola && !oc2.partner && odl(ja,oc2)<450 && !(ja.przerwy && ja.przerwy[oc2.id])) wolaCzl=oc2; } // single: od znanego wilka uciekam, póki go widzę (450); poza single i nieznajomi: z bliska (150)
    var pw=w.pole.w, pn=Math.round(B.SWIAT/B.KOMORKA), swiatloPod=function(x,y){ var ci=Math.max(0,Math.min(pn-1,Math.floor(x/B.KOMORKA))), cj=Math.max(0,Math.min(pn-1,Math.floor(y/B.KOMORKA))); return pw[cj*pn+ci]; };
    // tryb z histerezą: decyzja trwa co najmniej chwilę; ucieczka ma pierwszeństwo, para jest stanem
    var tryb=pm.tryb, trwa=pm.trybDo>pm.t;
    var zagr=!wilk && !pies && z && !(pm.nieufny && swiatloPod(ja.x,ja.y)>B.PROG_SWIATLA) && (z.goniMnie || (!(pm.uSpokoj>pm.t) && (nd<os.uciekaOd || (tryb==='ucieczka' && nd<os.uciekaOd+140)))); // uSpokoj: po długiej ucieczce przed niegoniącą żółtą chwila spokoju
    function ustaw(t,czas) { tryb=t; pm.tryb=t; pm.trybDo=pm.t+czas; pm.trybOd=pm.t; pm.cel=null; pm.trasa=null; }
    // czerń: szary (nie wilk, nie pies) ucieka z mroku i od dziur; cel ucieczki = najjaśniejszy z 8 kierunków
    var czern=!wilk && (swiatloPod(ja.x,ja.y)<-B.PROG_SWIATLA*0.5 || ja.wCzerni>0); // szary i pies: czerń pochłania
    if(!czern && !wilk && w.dziury && !(swiatloPod(ja.x,ja.y)>B.PROG_SWIATLA)) for(i=0;i<w.dziury.length;i++) if(odl(ja,w.dziury[i])<w.dziury[i].r+50) { czern=true; break; } // chmury nie wchodzą na „1”: w świetle nie ma przed czym uciekać
    // przyjaciele: każdy, z kim bot rozświetlił pole (zapalenie), na stałe: zaufanie 1 (nie blaknie), bot trzyma się go; zapomina tylko po zdradzie albo 120 s bez kontaktu
    pm.przyjaciele=pm.przyjaciele||{};
    for(i=0;i<w.zdarzenia.length;i++) { var evz=w.zdarzenia[i]; if(evz.typ==='zapalenie' && (evz.kto===ja.id || evz.partner===ja.id)) { var pid=evz.kto===ja.id?evz.partner:evz.kto; if(pid) { pm.przyjaciele[pid]=pm.t; pm.zaufanie[pid]=1; } } }
    var przyjaciel=null, dprz=1e9;
    for(var pid2 in pm.przyjaciele) { if(zaufanie(pm,pid2)<=0 || pm.t-pm.przyjaciele[pid2]>120) { delete pm.przyjaciele[pid2]; continue; } pm.zaufanie[pid2]=1; }
    if(!wilk && !pies && !pm.nieufny) for(i=0;i<w.inni.length;i++) { var oi=w.inni[i]; if(!(oi.id in pm.przyjaciele)) continue; pm.przyjaciele[oi.id]=pm.t; var doi=odl(ja,oi); if(oi.id===pm.ofiaraId) doi-=1e6; if(doi<dprz){dprz=doi;przyjaciel=oi;} } // człowiek (ofiaraId) ma pierwszeństwo
    // zainteresowanie: kropka stojąca w „1” (niepołączona, niepodejrzana) jest warta obserwacji; człowiek (ofiaraId) najpierw, potem najbliższa
    var obserwowany=null; if(!wilk && !pies) { var dob=1e9; for(i=0;i<w.inni.length;i++) { var ob=w.inni[i]; if(!(pm.wSwietle[ob.id]>0) || zaufanie(pm,ob.id)<=0 || ob.partner || wokol(w,ob,380)>=3 || (pm.dystans && ob.id===pm.ofiaraId) || (pm.nieufny && ob.id!==pm.ofiaraId)) continue; var dd2=odl(ja,ob); if(ob.id===pm.ofiaraId) dd2-=1e6; if(dd2<dob){dob=dd2;obserwowany=ob;} } }
    pm.faza=pm.faza||los()*6.28;
    // single: wilk poluje na gracza (ofiaraId), nie na boty: odpowiada tylko na jego nawoływanie, nawołuje tylko przy nim, krąży w jego pobliżu
    var ofiara=null, kradziez=false, zasW=600, zwlokaW=0; if(wilk && pm.ofiaraId) { // single: cel to gracz; gdy graczowi idzie dobrze (światło > 6 % albo po 4 min), także kropki przy nim (podkradanie)
      var jas=w.pole.udzial||{jasne:0}; kradziez = jas.jasne/(pn*pn) > 0.06 || w.czas > 240; zasW = 350 + 850*Math.min(1, jas.jasne/(pn*pn)/0.5); zwlokaW = 2.5*(1-Math.min(1, jas.jasne/(pn*pn)/0.5));
      var czl=null; for(i=0;i<w.inni.length;i++) if(w.inni[i].id===pm.ofiaraId) czl=w.inni[i];
      var celeW=[]; if(czl) { celeW.push(czl); for(i=0;i<w.inni.length;i++) { var oc=w.inni[i]; if(oc.id!==czl.id && ((kradziez && odl(oc,czl)<320) || (pm.lacznie && pm.lacznie[oc.id]>=1))) celeW.push(oc); } } // szara, która zrobiła z graczem 5 żółtych, też jest celem
      var dof=1e9; for(i=0;i<celeW.length;i++) { var dc=odl(ja,celeW[i]), n5=celeW[i].id===pm.ofiaraId?5:((pm.lacznie&&pm.lacznie[celeW[i].id])||0); dc-=200*Math.min(1,n5/5); if(dc<dof){dof=dc;ofiara=celeW[i];} } // gracz ma pierwszeństwo; jego szara zyskuje je z każdym wspólnym zapaleniem, od 5 równo
      if(wolajacy) { var wok=false; for(i=0;i<celeW.length;i++) if(celeW[i].id===wolajacy.id) wok=true; if(!wok && !(pm.wSwietle[wolajacy.id]>0)) wolajacy=null; } // wilk odpowiada graczowi, jego kropkom i każdej szarej nadającej z „1”
    }
    if(ja.polaczony && !czern) { if(tryb!=='para') { ustaw('para',1); pm.paraOd=pm.t; pm.zdradze=!wilk && !pies && los()<os.pozera; } } // zdradze: plan zerwania tuż przed żółtą
    else if(czern) {
      if(tryb!=='czern') ustaw('czern',0.6);
      if(!pm.czernCel || pm.t>pm.czernDo) { var najw=-1e9, najk=0, mc=B.BRZEG_MROKU+60;
        for(var ka=0;ka<8;ka++){ var aa=ka/8*Math.PI*2, px=ja.x+Math.cos(aa)*160, py=ja.y+Math.sin(aa)*160; if(px<mc||py<mc||px>B.SWIAT-mc||py>B.SWIAT-mc) continue; if(!drozna(ja,{x:px,y:py},pm.mapa.kola,B.R)) continue; var wv=swiatloPod(px,py); for(var hi=0;hi<(w.dziury||[]).length;hi++) if(odl({x:px,y:py},w.dziury[hi])<w.dziury[hi].r+40) wv-=1; if(wv>najw){najw=wv;najk=aa;} }
        pm.czernCel={x:ja.x+Math.cos(najk)*220,y:ja.y+Math.sin(najk)*220}; pm.czernDo=pm.t+0.5; }
    }
    else if(pm.dystans && !wilk && !pies && czlowiek && odl(ja,czlowiek)<800 && !ja.polaczony) { if(tryb!=='dystans') ustaw('dystans',2); } // reżyser: przy graczu są już 2 szare, trzymam dystans
    else if(wilk && tryb!=='odpowiedz' && swiatloPod(ja.x,ja.y)>B.PROG_SWIATLA) { // wilk w „1” zaraz zacznie migotać: ucieka w najciemniejszą stronę (chyba że właśnie dopada nadającą szarą)
      if(tryb!=='zswiatla') ustaw('zswiatla',0.8);
      if(!pm.zswCel || pm.t>pm.zswDo) { var najc=1e9, najkk=0; for(var kw=0;kw<8;kw++) { var aw=kw/8*Math.PI*2, pxw=ja.x+Math.cos(aw)*160, pyw=ja.y+Math.sin(aw)*160; if(pxw<B.R+2||pyw<B.R+2||pxw>B.SWIAT-B.R-2||pyw>B.SWIAT-B.R-2) continue; var wvw=swiatloPod(pxw,pyw); if(wvw<najc){najc=wvw;najkk=aw;} } pm.zswCel={x:ja.x+Math.cos(najkk)*200,y:ja.y+Math.sin(najkk)*200}; if(najc>B.PROG_SWIATLA) { var mrokC=najblizszyMrok(w,ja,B,80); if(mrokC) pm.zswCel=mrokC; } pm.zswDo=pm.t+0.5; } // wszystko jasne wokół: do najbliższego mroku na planszy (19.10 06:00)
    }
    else if(!wilk && !pies && wolajacy && pm.wSwietle[wolajacy.id]>0 && dw<450 && !(pm.cd.odpowiedz>pm.t)) { if(tryb!=='odpowiedz') ustaw('odpowiedz',9); }
    else if(osaczony && wolaCzl) { wolajacy=wolaCzl; dw=odl(ja,wolaCzl); if(tryb!=='odpowiedz') ustaw('odpowiedz',9); } // osaczony przez żółte: nawołujący gracz to ostatnia szansa, bez względu na zaufanie // zaufany nawołuje z „1”: idę do niego mimo żółtych (w świetle jestem bezpieczny)
    else if(zagr) { if(tryb!=='ucieczka') { ustaw('ucieczka',0.8); pm.uStart={x:ja.x,y:ja.y}; pm.uOd=pm.t; } }
    else if(tryb==='para' || tryb==='czern' || !tryb || !trwa || (wolajacy && dw<zasW && pm.t-(pm.wolaOd[wolajacy.id]||pm.t)>=zwlokaW && tryb!=='odpowiedz' && tryb!=='unik') || (tryb==='odpowiedz' && !wolajacy) || (tryb==='unik' && !unikaj) || (tryb==='towarzysz' && !przyjaciel) || (tryb==='tropienie' && !ofiara) || (tryb==='czajenie' && ofiara && odl(ja,ofiara)<450) || (tryb==='obserwacja' && !obserwowany) || (tryb==='ucieczka' && !z) || (tryb==='dystans' && !czlowiek) || (tryb==='wolanie' && pm.nieufny && !ja.wolam && pm.t-pm.trybOd>0.5) || (tryb==='czekanie' && !wolajacy)) { // wilk wychodzi z dziury, gdy gracz blisko
      if(tryb && tryb!=='para' && tryb!=='wedrowka' && tryb!=='ucieczka') { pm.cd[tryb]=pm.t+10; if((tryb==='wolanie' && !pm.nieufny)||tryb==='czajenie'||tryb==='rozpuszczanie') pm.ruszDo=pm.t+3; } // po staniu chwila marszu
      if(unikaj) ustaw('unik',1.2);
      else if(pm.ruszDo>pm.t) ustaw('wedrowka',3);
      else if(wolajacy && dw<zasW && pm.t-(pm.wolaOd[wolajacy.id]||pm.t)>=zwlokaW && ((pm.wSwietle[wolajacy.id]>0 || (wolajacy.id in pm.przyjaciele)) || (!(pm.cd.odpowiedz>pm.t) && los()<0.4+os.odpowiada*0.6))) ustaw('odpowiedz',9); // nawołuje z „1” albo przyjaciel: idę na pewno
      else if(wilk && wolajacy && dw<zasW) ustaw('czekanie',0.5); // wilk w oknie zwłoki: czai się nieruchomo przy nadającej, nie odchodzi (19.10 06:20)
      else if(przyjaciel && !(ja.przerwy && ja.przerwy[przyjaciel.id]) && odl(ja,przyjaciel)<320 && !(pm.cd.wolanie>pm.t) && los()<0.7) ustaw('wolanie',8); // do przyjaciela: nawołuję, gdy minie przerwa
      else if(przyjaciel) ustaw('towarzysz',1.5+los());
      else if(obserwowany) ustaw('obserwacja',2+los()*2); // kropka w „1”: podchodzę i obserwuję
      else if(ofiara && !ofiara.partner && odl(ja,ofiara)>360-20*Math.min(5,agres) && los()<0.85) ustaw('tropienie',2+los()*2); // wilk wymyka się z chmury do celu, gdy ten nie jest w parze
      else if(wilk && w.dziury && w.dziury.length && !(pm.cd.czajenie>pm.t) && (!ofiara || ofiara.partner) && los()<0.3) ustaw('czajenie',6+los()*3);
      else if(wilk && os.mrok>0 && B.TEMPO_ROZPUSZCZANIA>0 && !(pm.cd.rozpuszczanie>pm.t) && los()<0.3 && najblizszeSwiatlo(w,ja,B)) ustaw('rozpuszczanie',7);
      else if(os.wola>0 && !(pm.cd.wolanie>pm.t) && !pm.nieufny && ((wilk||pies) ? (!(wilk && pm.ofiaraId) && los()<0.4+0.08*Math.min(5,agres)) : (inny && di<320 && !inny.wola && ufa(inny) && los()<0.6))) { ustaw('wolanie',pm.nieufny?1e9:8); if(pies && pm.nieufny) pm.cd.wolanie=pm.t+20+los()*10; } // wilk w single nie nawołuje; pies w single nadaje tylko z „1” (pułapka na wilka)
      else if(pm.nieufny && !wilk && !zagr && swiatloPod(ja.x,ja.y)>B.PROG_SWIATLA && !(pm.cd.wolanie>pm.t)) { ustaw('wolanie',1e9); pm.cd.wolanie=pm.t+((czlowiek && (czlowiek.id in pm.przyjaciele) && odl(ja,czlowiek)<500) ? 3 : 10+los()*6); } // single: szara nadaje z „1” (bez limitu, nieruchoma), dołącza gracz albo wilk (kto pierwszy); przyjacielowi gracza nadaje częściej
      else if(!wilk && (!pies || pm.nieufny) && (pm.schr=najblizszeSwiatlo(w,ja,B,60)) && los()<(pm.nieufny && swiatloPod(ja.x,ja.y)>B.PROG_SWIATLA ? 0.92 : 0.75)) ustaw('schronienie',4+los()*4); // w „1” chowa się na chwilę; single: szara żyje w „1” (92 % zostaje, czasem idzie do innej plamy)
      else if(pm.nieufny && !wilk) ustaw('poszukiwanie',6+los()*6); // single: szara (i pies) wędruje do „1”
      else ustaw('wedrowka',2+los()*3);
    }
    switch(tryb) {
      case 'para': {
        // zdrada przez zerwanie: zdrajca puszcza (Shift) tuż przed żółtą, gdy partner jest bliżej niej niż on; potem sprint w drugą stronę
        if(pm.zdradze && z && partner && odl(partner,z)<B.ZOLTA_R+B.R+60 && odl(partner,z)<odl(ja,z)-10) { out.shift=true; pm.zdradze=false; pm.sprintDo=pm.t+1.2; break; }
        if(!ja.lider) { if(partner && odl(ja,partner)>26) cel=partner; else stoje=true; } // dołączony trzyma się nadawcy
        else {
          if(pm.t-pm.paraOd>40 && (!z || nd>300)) out.shift=true; // zbyt długo bez żółtej: Shift odłącza (nie przy żółtej)
          var celZ=hunt ? hunt : z;
          if(partner && odl(ja,partner)>44) cel=partner;
          else if(celZ && (swiatloPod(celZ.x,celZ.y)<-B.PROG_SWIATLA*0.5 || wDziurze(w,celZ,40))) cel = odl(ja,celZ)>300 ? celZ : {x:ja.x+Math.cos(pm.t)*60,y:ja.y+Math.sin(pm.t)*60}; // żółta w czerni: krążę na skraju, aż wyjdzie
          else cel=celZ ? celZ : wedrowka(pm,ja,B,los,8); // para jest dla żółtych bezpieczna
        }
        break; }
      case 'obserwacja': { var dobs=odl(ja,obserwowany), ro=pm.wSwietle[obserwowany.id]>0 ? 55 : 200; if(zagr && ja.sprint>0.3) out.shift=true; if(pm.obsKogo!==obserwowany.id) { pm.obsKogo=obserwowany.id; pm.obsOd=pm.t; }
        if(obserwowany.id===pm.ofiaraId && !obserwowany.migocze && !obserwowany.partner && !obserwowany.wola && pm.t-pm.obsOd>2 && dobs<220 && !(pm.cd.wolanie>pm.t) && !(ja.przerwy && ja.przerwy[obserwowany.id]) && (!pm.nieufny || swiatloPod(ja.x,ja.y)>B.PROG_SWIATLA)) { ustaw('wolanie',pm.nieufny?1e9:8); pm.cd.wolanie=pm.t+20; stoje=true; break; } cel = dobs>ro+60 ? obserwowany : {x:obserwowany.x+Math.cos(pm.t*0.35+pm.faza)*ro,y:obserwowany.y+Math.sin(pm.t*0.35+pm.faza)*ro}; if(ro<100 && swiatloPod(cel.x,cel.y)<=B.PROG_SWIATLA) cel={x:obserwowany.x+Math.cos(pm.t*0.35+pm.faza)*30,y:obserwowany.y+Math.sin(pm.t*0.35+pm.faza)*30}; break; } // krążę tylko po „1”; mała plama: tuż przy graczu // podchodzę na ok. 180-240 i krążę, patrząc
      case 'poszukiwanie': { if(!pm.celP || odl(ja,pm.celP)<60 || pm.t>pm.celPDo) { var bestP=null, bdP=1e9; for(var sp=0;sp<80;sp++) { var ciP=Math.floor(los()*pn), cjP=Math.floor(los()*pn); if(pw[cjP*pn+ciP]<=B.PROG_SWIATLA) continue; var qP={x:(ciP+.5)*B.KOMORKA,y:(cjP+.5)*B.KOMORKA}, dqP=odl(ja,qP); if(dqP>=200 && dqP<bdP){bdP=dqP;bestP=qP;} } if(!bestP) bestP=najblizszeSwiatlo(w,ja,B,80); if(!bestP) { var mp=80; bestP={x:mp+los()*(B.SWIAT-2*mp),y:mp+los()*(B.SWIAT-2*mp)}; } pm.celP=bestP; pm.celPDo=pm.t+25; } cel=pm.celP; break; } // single: szara szuka „1” (tylko stamtąd nadaje): najbliższa z 80 wylosowanych jasnych komórek, inaczej daleka wędrówka
      case 'schronienie': { if(!pm.schrCel || pm.t>pm.schrDo) { pm.schrCel=brzegSwiatla(w,ja,B,14)||brzegSwiatla(w,ja,B,80)||wnetrzeSwiatla(w,ja,B)||pm.schr||null; pm.schrDo=pm.t+1.5; } if(!pm.schrCel) { cel=wedrowka(pm,ja,B,los,7); break; } cel = odl(ja,pm.schrCel)>16 ? pm.schrCel : {x:pm.schrCel.x+Math.cos(pm.t*0.5+pm.faza)*10,y:pm.schrCel.y+Math.sin(pm.t*0.5+pm.faza)*10}; break; } // do głębi plamy, tam lekkie kołysanie (nie dryfuje na skraj)
      case 'zswiatla': cel=pm.zswCel; if(ja.sprint>0.3) out.shift=true; break; // ze światła sprintem
      case 'dystans': { if(!czlowiek) { cel=wedrowka(pm,ja,B,los,3); break; } var ud=norm(ja.x-czlowiek.x,ja.y-czlowiek.y); cel={x:ja.x+ud.dx*300,y:ja.y+ud.dy*300}; break; }
      case 'czern': cel=pm.czernCel; if(ja.sprint>0.2) out.shift=true; break; // z czerni sprintem
      case 'towarzysz': { var dpz=odl(ja,przyjaciel), prowadze=przyjaciel.id!==pm.ofiaraId && ja.id<przyjaciel.id; // człowieka bot nigdy nie prowadzi: idzie przy nim
        if(prowadze) { if(dpz>260) cel={x:(ja.x+przyjaciel.x)/2,y:(ja.y+przyjaciel.y)/2}; else { if(!pm.celT || odl(ja,pm.celT)<40 || pm.t>pm.celTDo) { var kt=los()*Math.PI*2, mt=B.BRZEG_MROKU+80; pm.celT={x:Math.max(mt,Math.min(B.SWIAT-mt,ja.x+Math.cos(kt)*350)),y:Math.max(mt,Math.min(B.SWIAT-mt,ja.y+Math.sin(kt)*350))}; pm.celTDo=pm.t+10; } cel=pm.celT; } }
        else cel = dpz>90 ? przyjaciel : {x:przyjaciel.x+(ja.x-przyjaciel.x)/Math.max(1,dpz)*70,y:przyjaciel.y+(ja.y-przyjaciel.y)/Math.max(1,dpz)*70};
        break; }
      case 'tropienie': { if(!pm.tropCel || pm.t>pm.tropDo) { var ka2=los()*Math.PI*2; var rt=260-20*Math.min(5,agres); pm.tropCel={dx:Math.cos(ka2)*rt,dy:Math.sin(ka2)*rt}; pm.tropDo=pm.t+2; } cel={x:ofiara.x+pm.tropCel.dx,y:ofiara.y+pm.tropCel.dy}; if(pm.t-pm.trybOd<1.5 && ja.sprint>0.3) out.shift=true; break; } // wymknięcie sprintem
      case 'ucieczka': { if(!z) { cel=wedrowka(pm,ja,B,los,3); break; } var u=norm(ja.x-z.x,ja.y-z.y); cel={x:ja.x+u.dx*240,y:ja.y+u.dy*240};
        var sw=najblizszeSwiatlo(w,ja,B); if(sw && odl(ja,sw)<350 && odl(sw,z)>odl(ja,z)*0.7) cel=sw; // przystań „1” blisko: tam żółta nie sięga
        if(pm.sprintDo>pm.t || (nd<os.uciekaOd*0.8 && ja.sprint>0.25)) out.shift=true; // sprint, gdy żółta blisko
        if(pm.uStart && pm.t-pm.uOd>2 && odl(ja,pm.uStart)<40) { pm.uStart={x:ja.x,y:ja.y}; pm.uOd=pm.t; pm.uKlin=pm.t+2.5; } // zaklinowany: przez 2,5 s idę drożnym kierunkiem
        if(z && !z.goniMnie && pm.t-pm.uOd>6) pm.uSpokoj=pm.t+5; // żółta nie goni, a ja uciekam 6 s: przestaję na 5 s
        if(pm.uKlin>pm.t) { var najl=null, bdl=-1e9; for(var zas3=200;zas3>=100 && !najl;zas3-=100) for(var ka3=0;ka3<8;ka3++) { var a3=ka3/8*Math.PI*2, p3={x:ja.x+Math.cos(a3)*zas3,y:ja.y+Math.sin(a3)*zas3}; if(p3.x<B.R+2||p3.y<B.R+2||p3.x>B.SWIAT-B.R-2||p3.y>B.SWIAT-B.R-2) continue; if(!drozna(ja,p3,pm.mapa.kola,B.R)) continue; var sc3=odl(p3,z); if(sc3>bdl){bdl=sc3;najl=p3;} } cel=najl||wedrowka(pm,ja,B,los,3); } // zaklinowany (przeszkoda, róg): drożny kierunek najdalej od żółtej
        break; }
      case 'unik': { var od0=unikaj||podejrzany||wrog; if(!od0) { cel=wedrowka(pm,ja,B,los,3); break; } var un=norm(ja.x-od0.x,ja.y-od0.y); cel={x:ja.x+un.dx*180,y:ja.y+un.dy*180}; if(wrog && ja.sprint>0.3) out.shift=true; break; }
      case 'odpowiedz':
        if(dw<=B.ZASIEG_ODPOWIEDZI-4) { // w zasięgu: jedna odpowiedź; jeśli para nie powstała w 1 s (odepchnięcie, nieufność), idę dalej
          if(!pm.odpowiedzialem) { out.e=true; pm.odpowiedzialem=pm.t; } // E: jedyny klawisz zgody
          else if(pm.t-pm.odpowiedzialem>1) { pm.odpowiedzialem=null; pm.cd.odpowiedz=pm.t+6; ustaw('wedrowka',3); }
          stoje=true;
        } else { pm.odpowiedzialem=null; cel=wolajacy; if((zagr || (wilk && pm.t-pm.trybOd<1.5)) && ja.sprint>0.3) out.shift=true; } // żółta blisko: sprint do nawołującego
        break;
      case 'czajenie': { if(!pm.czaiCel) pm.czaiCel=najblizszaDziura(w,ofiara||ja); if(pm.czaiCel && odl(ja,pm.czaiCel)>pm.czaiCel.r*0.4) cel=pm.czaiCel; else stoje=true; break; }
      case 'rozpuszczanie': { if(!pm.swiatlo) pm.swiatlo=najblizszeSwiatlo(w,ja,B); if(pm.swiatlo && odl(ja,pm.swiatlo)>12) cel=pm.swiatlo; else stoje=true; break; }
      case 'wolanie': out.spacja=true; stoje=true; break;
      case 'czekanie': stoje=true; break; // czai się przed skokiem do nadającej
      default: cel=wedrowka(pm,ja,B,los,7);
    }
    if(tryb!=='czajenie') pm.czaiCel=null; if(tryb!=='rozpuszczanie') pm.swiatlo=null;
    if(wilk && z && nd<110 && !ja.polaczony && cel) { var uz=norm(ja.x-z.x,ja.y-z.y); cel={x:ja.x+uz.dx*140,y:ja.y+uz.dy*140}; } // wilk udaje, że unika żółtych (żółte go nie tkną, ale szary by uciekał)
    // wykrywanie utknięcia (celowe stanie się nie liczy)
    if(stoje || !pm.kotwica || odl(ja,pm.kotwica)>12) {pm.kotwica={x:ja.x,y:ja.y};pm.ruchOd=pm.t;}
    if(cel && pm.t-pm.ruchOd>2) {
      if(!pm.awaryjny || pm.t>pm.awaryjnyDo) {
        var an=los()*Math.PI*2; pm.awaryjny=null;
        for(var ai=0;ai<16;ai++) { var kat=an+ai*Math.PI/8, aw={x:ja.x+Math.cos(kat)*140,y:ja.y+Math.sin(kat)*140};
          if(aw.x<B.R+2||aw.y<B.R+2||aw.x>B.SWIAT-B.R-2||aw.y>B.SWIAT-B.R-2) continue;
          if(drozna(ja,aw,pm.mapa.kola,B.R)) {pm.awaryjny=aw;break;} }
        if(!pm.awaryjny && pm.mapa.kola.length) { var nk=null, nkd=1e9; for(var ki=0;ki<pm.mapa.kola.length;ki++) { var kd=odl(ja,pm.mapa.kola[ki]); if(kd<nkd){nkd=kd;nk=pm.mapa.kola[ki];} } if(nk) { var uk=norm(ja.x-nk.x,ja.y-nk.y); pm.awaryjny={x:ja.x+uk.dx*140,y:ja.y+uk.dy*140}; } } // żaden kierunek niedrożny: od środka najbliższej przeszkody
        pm.awaryjnyDo=pm.t+1.5; pm.trasa=null;
      }
      if(pm.awaryjny) cel=pm.awaryjny;
    }
    // ruch wygładzony: kierunek zmienia się płynnie, bez skoków; przy celu zwalnia zamiast drgać
    if(cel && !stoje && !ja.polaczony && tryb!=='odpowiedz') { for(i=0;i<w.inni.length;i++) { var ob2=w.inni[i], d4=odl(ja,ob2); if(d4<48 && d4>0.1 && !(przyjaciel && ob2.id===przyjaciel.id)) { cel={x:cel.x+(ja.x-ob2.x)/d4*70,y:cel.y+(ja.y-ob2.y)/d4*70}; } } } // bez zderzeń: od obcych kropek odsuwam się ruchem
    var chceX=0, chceY=0;
    if(cel && !stoje) {
      cel={x:Math.max(B.R,Math.min(B.SWIAT-B.R,cel.x)),y:Math.max(B.R,Math.min(B.SWIAT-B.R,cel.y))};
      var wp=droga(pm,ja,cel);
      if(wp) { var dd=odl(ja,wp); if(dd>4) { var v=norm(wp.x-ja.x,wp.y-ja.y), sp=Math.min(1,dd/40); chceX=v.dx*sp; chceY=v.dy*sp; } }
    }
    var f=Math.min(1,dt*9); pm.ost.dx+=(chceX-pm.ost.dx)*f; pm.ost.dy+=(chceY-pm.ost.dy)*f;
    if(Math.abs(pm.ost.dx)<0.03 && Math.abs(pm.ost.dy)<0.03) {pm.ost.dx=0;pm.ost.dy=0;}
    out.dx=pm.ost.dx; out.dy=pm.ost.dy;
    pm.spacja=out.spacja; return out;
  }
  return {zolta:zolta,szary:szary,OSOBOWOSCI:OSOBOWOSCI};
});
