/* v5 내용 쪽 움직임(3D·폴백 공통) — 쪽마다 의미 있는 움직임 하나. 전부 스크롤 위치에서 계산하는 순수 함수(되감아도 같은 상태), 시간 애니메이션은 접는 목록의 높이 전환뿐.
   count: 숫자가 스크롤에 맞춰 올라옴 · cells: 칸이 차례로 켜짐 · wipe: 줄이 위에서 아래로 열림 · zoomfig/zoom: 사진이 천천히 다가감 · rise: 값이 아래에서 올라옴 · cols: 비교표 열이 차례로 채워짐
   후기 = 옆 넘기기(CSS 스냅 + 점·중앙 카드 강조) · 접는 목록 = 눌러 펼치기(grid 높이 전환) · 사진 쪽(소리·독스탠드) = 우상단 작은 아이팟에 연동된 고리 강조(고리는 제품 밖 테두리, 제품을 덮지 않는다).
   움직임 줄이기(reduced-motion)·정적 판: 전부 끝 상태로 한 번에 보인다(html.pp-rm). 소리는 접는 목록을 누를 때 '톡' 한 번(있을 때만). */
(function () {
  var d = document, w = window, H = d.documentElement;
  var RM = !!(w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches);
  if (RM) H.classList.add('pp-rm'); H.classList.add('pp-fx');
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function ease(t) { return 1 - Math.pow(1 - t, 3); }
  function qa(s, r) { return [].slice.call((r || d).querySelectorAll(s)); }
  /* ── 접는 목록: 눌러 펼치기 ── */
  qa('.acc').forEach(function (a) {
    var b = a.querySelector('.acc-h');
    b.addEventListener('click', function () {
      var open = !a.classList.contains('open');
      a.classList.toggle('open', open); b.setAttribute('aria-expanded', open ? 'true' : 'false');
      try { if (w.__proto && w.__proto.snd && w.__proto.snd.play) w.__proto.snd.play('tok'); } catch (e) { }
    });
  });
  /* ── 후기: 옆 넘기기 ── */
  qa('.rv').forEach(function (pg) {
    var tr = pg.querySelector('.rtrack'), cards = qa('.rcard', pg), dots = qa('.rdots i', pg), cur = -1;
    function upd() {
      var c = tr.scrollLeft + tr.clientWidth / 2, best = 0, bd = 1e9;
      cards.forEach(function (k, i) { var m = k.offsetLeft + k.offsetWidth / 2, dd = Math.abs(m - c); if (dd < bd) { bd = dd; best = i; } });
      if (best !== cur) { cur = best; cards.forEach(function (k, i) { k.classList.toggle('on', i === best); }); dots.forEach(function (k, i) { k.classList.toggle('on', i === best); }); }
    }
    tr.addEventListener('scroll', upd, { passive: true }); w.addEventListener('resize', upd); upd();
    tr.addEventListener('keydown', function (e) { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { tr.scrollBy({ left: (e.key === 'ArrowRight' ? 1 : -1) * cards[0].offsetWidth, behavior: RM ? 'auto' : 'smooth' }); e.preventDefault(); } });
  });
  /* ── 스크롤 계산 ── */
  var counts = qa('[data-fx=count]'), cells = qa('[data-fx=cells]'), wipes = qa('[data-fx=wipe]'), rises = qa('[data-fx=rise]'), zfigs = qa('[data-fx=zoomfig]'), cols = qa('[data-fx=cols]'),
    big = qa('.cpage .big'), zimgs = qa('.zoomimg');
  var noCore = function () { return H.classList.contains('pp-no3d'); };
  function fmt(el, v) {
    var dec = +el.getAttribute('data-dec') || 0, s = dec ? v.toFixed(dec) : (el.hasAttribute('data-comma') ? Math.round(v).toLocaleString('ko-KR') : String(Math.round(v)));
    el.firstChild.nodeValue = s + (el.getAttribute('data-suffix') || '');
  }
  big.forEach(function (b) {   // 큰 숫자(1950·2·8·180·15)도 같은 방식으로 — 첫 글자 덩어리의 숫자
    var n = b.firstChild; if (!n || n.nodeType !== 3) return; var m = /^(\d+)$/.exec(n.nodeValue.trim()); if (!m) return;
    b.setAttribute('data-fx', 'count'); b.setAttribute('data-to', m[1]); counts.push(b);
  });
  qa('.cpage .nums b').forEach(function (b) {   // 9쪽 '5억+'·'1,200건+' : 숫자 부분만 올라옴
    var n = b.firstChild; if (!n || n.nodeType !== 3) return; var m = /^([\d,.]+)(.*)$/.exec(n.nodeValue.trim()); if (!m) return;
    b.setAttribute('data-fx', 'count'); if (m[1].indexOf(',') >= 0) b.setAttribute('data-comma', '1'); b.setAttribute('data-to', m[1].replace(/,/g, '')); b.setAttribute('data-suffix', m[2]); counts.push(b);
  });
  function prog(el, a, b) { var r = el.getBoundingClientRect(), vh = w.innerHeight; return clamp((vh * a - r.top) / (vh * (a - b)), 0, 1); }
  var bars = qa('[data-fx=bar]');
  var raf = 0, stageCmp = [];
  function cmpTick() {   // 3D 무대판 비교표: PEPPER CLUB 칸이 줄마다 켜지는 것(core)에 이어, 해외직구 열 → 국내 열이 차례로 채워진다
    stageCmp.forEach(function (b) {
      var pcs = qa('.pc', b), n = pcs.length, on = pcs.filter(function (x) { return x.classList.contains('on'); }).length, f = n ? on / n : 0, t = b.querySelector('table.c3');
      if (t) { t.classList.toggle('cf2', f >= 0.6); t.classList.toggle('cf3', f >= 1); }
    });
  }
  function tick() {
    raf = 0; var vh = w.innerHeight;
    counts.forEach(function (el) { var p = RM ? 1 : ease(prog(el, 1.0, 0.78)), to = +el.getAttribute('data-to'); if (el.firstChild && el.firstChild.nodeType === 3) fmt(el, to * p); });
    cells.forEach(function (g) { var p = RM ? 1 : prog(g, 0.9, 0.35), cs = g.children; for (var i = 0; i < cs.length; i++) cs[i].classList.toggle('on', p > 0.12 + i * 0.1); });
    wipes.forEach(function (el, i) { var p = RM ? 1 : prog(el, 0.95, 0.6); el.style.clipPath = p >= 1 ? 'none' : 'inset(0 0 ' + ((1 - p) * 100).toFixed(1) + '% 0)'; el.style.transform = p >= 1 ? '' : 'translateY(' + ((1 - p) * 14).toFixed(1) + 'px)'; });
    rises.forEach(function (el) { var p = RM ? 1 : ease(prog(el, 0.97, 0.7)); el.style.transform = p >= 1 ? '' : 'translateY(' + ((1 - p) * 22).toFixed(1) + 'px)'; el.style.clipPath = p >= 1 ? 'none' : 'inset(0 0 ' + ((1 - p) * 100).toFixed(1) + '% 0)'; });
    zfigs.forEach(function (f) { var p = RM ? 1 : prog(f, 1.0, 0.3), s = 0.9 + 0.1 * ease(p); f.style.transform = RM || p >= 1 ? '' : 'scale(' + s.toFixed(3) + ') translateY(' + ((1 - p) * 30).toFixed(1) + 'px)'; });
    cols.forEach(function (t) { var p = RM ? 1 : prog(t, 0.85, 0.3); t.classList.toggle('cf1', p > 0.2); t.classList.toggle('cf2', p > 0.5); t.classList.toggle('cf3', p > 0.8); });
    zimgs.forEach(function (im) { var pg = im.parentNode, r = pg.getBoundingClientRect(), q = clamp((vh - r.top) / (vh + r.height), 0, 1); im.style.transform = RM ? '' : 'scale(' + (1.04 + 0.1 * q).toFixed(3) + ') translateY(' + ((0.5 - q) * 30).toFixed(1) + 'px)'; });
    if (noCore() && !RM) qa('.cpage .bgimg:not(.zoomimg)').forEach(function (pg) { var r = pg.parentNode.getBoundingClientRect(), q = (r.top + r.height / 2 - vh / 2) / vh, k = clamp(1 - Math.abs(q), 0, 1); pg.style.transform = 'translateY(' + (q * -26).toFixed(1) + 'px) scale(' + (1.04 + 0.1 * k).toFixed(3) + ')'; });
    bars.forEach(function (b) { var p = RM ? 1 : ease(prog(b, 1.0, 0.7)), w1 = +getComputedStyle(b).getPropertyValue('--w') || 1; b.style.transform = 'scaleX(' + (w1 * p).toFixed(3) + ')'; });
    cmpTick();
    hl();
  }
  /* ── 소리·독스탠드 쪽: 우상단 작은 아이팟 고리 강조(3D 판, 폰 폭) ── */
  var ring = null;
  function hl() {
    var V5 = w.V5, on = false;
    if (!V5 || V5.tier === 'static' || H.classList.contains('pp-no3d') || RM || w.innerWidth > 500) { if (ring) ring.style.opacity = 0; return; }
    qa('.cpage.snd, .cpage.dock6b').forEach(function (p) { var r = p.getBoundingClientRect(), vh = w.innerHeight; if (r.top < vh * 0.3 && r.bottom > vh * 0.7) on = true; });
    if (!ring) { ring = d.createElement('div'); ring.id = 'parkhl'; ring.setAttribute('aria-hidden', 'true'); (d.getElementById('stage') || d.body).appendChild(ring); }
    var W = w.innerWidth, Hh = w.innerHeight, s = W / 390, sz = 96 * s * 0.62;   // 시제품 설명 구간 자세(우상단, 높이 96 설계px)에 맞춘 고리
    ring.style.cssText = 'left:' + (335 * s - sz / 2) + 'px;top:' + (Hh / 2 + (98 - 422) * s - sz * 0.8) + 'px;width:' + sz + 'px;height:' + sz * 1.6 + 'px;opacity:' + (on ? 1 : 0);
  }
  function req() { if (!raf) raf = w.requestAnimationFrame(tick); }
  w.addEventListener('scroll', req, { passive: true }); w.addEventListener('resize', req); w.addEventListener('load', req);
  stageCmp = qa('.stage .cmpbox');
  tick(); if (stageCmp.length && !RM) (function loop() { if (w.V5 && w.V5.stopped) return; cmpTick(); w.requestAnimationFrame(loop); })();
  /* 비교표(폴백 흐름판) 열 채움: 같은 표를 data-fx=cols 로 */
  qa('#cmpflow table.c3').forEach(function (t) { t.setAttribute('data-fx', 'cols'); cols.push(t); });
  req();
})();
