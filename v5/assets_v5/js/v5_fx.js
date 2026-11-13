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
  /* ── 사진 눌러서 크게(라이트박스): 닫기 단추·Esc·바깥 누르기, 열린 동안 페이지 스크롤 막고 닫으면 원래 자리·초점 복구 ── */
  var lb = null;
  function closeLB() {
    if (!lb) return; var o = lb; lb = null; d.removeEventListener('keydown', o.key, true); o.el.removeEventListener('wheel', o.stop, { passive: false }); o.el.removeEventListener('touchmove', o.stop, { passive: false });
    if (o.el.parentNode) o.el.parentNode.removeChild(o.el); H.classList.remove('pp-lb'); if (w.scrollY !== o.y) w.scrollTo(0, o.y); try { o.opener.focus({ preventScroll: true }); } catch (x) { }
  }
  function openLB(opener) {
    if (lb) return; var src = opener.getAttribute('data-zoom'), img0 = opener.querySelector('img'), el = d.createElement('div'), o = { el: el, opener: opener, y: w.scrollY };
    el.id = 'lb'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', opener.getAttribute('aria-label') || '사진 크게 보기');
    el.innerHTML = '<button type="button" class="lb-close" aria-label="닫기">닫기 ✕</button><div class="lb-scroll"><img class="lb-img" alt=""></div>';
    var im = el.querySelector('img'); im.src = src; im.alt = img0 ? img0.alt : ''; var sc = el.querySelector('.lb-scroll');
    im.addEventListener('click', function (ev) { ev.stopPropagation(); sc.classList.toggle('z2'); });
    el.addEventListener('click', function (ev) { if (ev.target === el || ev.target === sc) closeLB(); });
    el.querySelector('.lb-close').addEventListener('click', closeLB);
    o.key = function (ev) { if (ev.key === 'Escape') { ev.preventDefault(); closeLB(); } else if (ev.key === 'Tab') { ev.preventDefault(); el.querySelector('.lb-close').focus(); } };
    o.stop = function (ev) { if (!sc.contains(ev.target) || !sc.classList.contains('z2')) ev.preventDefault(); };   // 확대 안 했을 때는 배경 스크롤 차단, 확대했을 때만 사진 안에서 밀기
    d.addEventListener('keydown', o.key, true); el.addEventListener('wheel', o.stop, { passive: false }); el.addEventListener('touchmove', o.stop, { passive: false });
    d.body.appendChild(el); H.classList.add('pp-lb'); lb = o; el.querySelector('.lb-close').focus({ preventScroll: true });
  }
  qa('.zoomable').forEach(function (b) { b.addEventListener('click', function () { openLB(b); }); });
  w.PPLightbox = { open: openLB, close: closeLB, isOpen: function () { return !!lb; } };
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
  /* ── 설명 쪽 공통 틀(.fr, v8) ──
     움직임판(html.pp-stk): 쪽이 박자 수만큼 길어지고 화면은 고정(sticky). 보이는 박자 = 고정 구간에서 스크롤한 거리 / (화면 높이 × STEP). 이전 박자는 바로 사라지고 새 박자만 들어온다(같은 시점에 한 박자).
     그림 움직임 3종(flow 좌→우 12~18% · zoomout 약 1.3배→제자리 · rise 아래→위 8~10%)은 쪽 진행도 t 의 순수 함수(되감아도 같은 상태). 영상은 소리 없이 반복(보일 때만 받고 재생), 정지판(움직임 줄이기·저사양)은 포스터. */
  var STEP = 0.6;            // pages_v5.FR_STEP 과 같은 값
  function setStk(on) { H.classList[on ? 'add' : 'remove']('pp-stk'); }
  function goStill() { H.classList.add('pp-still'); setStk(false); try { w.dispatchEvent(new w.Event('resize')); } catch (e) { } }
  var STILL = RM || (w.V5 && w.V5.tier === 'lite'); if (STILL) goStill();
  d.addEventListener('pp:tier', function (e) { if (e.detail && e.detail.tier === 'lite') goStill(); });
  w.addEventListener('pp:lite-runtime', goStill);
  var frames = qa('.cpage.fr');
  function easeOut(x) { return 1 - (1 - x) * (1 - x); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  frames.forEach(function (pg) {
    var mv = pg.querySelector('.fr-mv'), m = pg.getAttribute('data-motion'), a = +pg.getAttribute('data-amt') || 0;
    if (mv && !mv.classList.contains('fr-pinbox') && !mv.classList.contains('fr-cert')) {   // 흐름·올라옴: 그림 상자를 그만큼 키워 움직여도 가장자리가 안 비게
      if (m === 'flow') { mv.style.left = (-a / 2) + '%'; mv.style.right = 'auto'; mv.style.width = (100 + a) + '%'; }
      if (m === 'rise') { mv.style.top = (-a / 2) + '%'; mv.style.bottom = 'auto'; mv.style.height = (100 + a) + '%'; }
      mv.style.transformOrigin = pg.getAttribute('data-origin') || '50% 50%';
    }
  });
  function layoutFrames() {   // 사진 위 이름표 핀(B6)·사진 상자: 사진 좌표 → 화면 좌표
    frames.forEach(function (pg) {
      var bar0 = d.querySelector('.bar'); if (bar0 && pg.hasAttribute('data-below-bar')) pg.style.setProperty('--fr-top', Math.ceil(bar0.getBoundingClientRect().bottom) + 'px');
      var pbx = pg.querySelector('.fr-pinbox'), media = pg.querySelector('.fr-media'); if (!pbx || !media) return;
      var q = pbx.getAttribute('data-pb').split(',').map(Number), mw = media.clientWidth, mh = media.clientHeight, pw = mw * q[0] / 100, ph = pw * q[4] / q[3];
      var top = Math.max(8, (mh - 316 - ph) / 2 + 22), left = mw * q[1] / 100;
      pbx.style.left = left + 'px'; pbx.style.top = top + 'px'; pbx.style.width = pw + 'px'; pbx.style.height = ph + 'px'; pbx.style.right = 'auto'; pbx.style.bottom = 'auto';
      var sc = clamp(mw / 430, .8, 1);
      qa('.fr-pin', pg).forEach(function (p) { p.style.left = (left + pw * (+p.getAttribute('data-x')) / 100) + 'px'; p.style.top = (top + ph * (+p.getAttribute('data-y')) / 100) + 'px'; p.style.fontSize = (13 * sc).toFixed(1) + 'px'; p.style.padding = (5 * sc).toFixed(1) + 'px ' + (11 * sc).toFixed(1) + 'px'; });
    });
  }
  w.addEventListener('resize', layoutFrames); layoutFrames(); w.addEventListener('load', layoutFrames);
  function setBeat(pg, idx, on) {
    qa('.fr-lb', pg).forEach(function (lb, i) { lb.classList.toggle('on', on && i === idx); });
    qa('.fr-shade', pg).forEach(function (sh, i) { sh.classList.toggle('on', i === idx); });
    var cur = qa('.fr-lb', pg)[idx]; if (!cur) return;
    pg.style.setProperty('--fr-fh', cur.getAttribute('data-frame')); pg.style.setProperty('--fr-sh', cur.getAttribute('data-sh') + 'px');
    var cb = pg.querySelector('.fr-cert');
    if (cb) {   // 증명서: 박자 3 은 전파인증 필증, 누르면 그 증명서 전체 보기
      var im = qa('.fr-cimg', cb), k = idx >= 2 ? 1 : 0; im.forEach(function (x, i) { x.classList.toggle('on', i === k); }); cb.setAttribute('data-zoom', cb.getAttribute('data-zoom' + k));
    }
  }
  function frameTick() {
    var vh = w.innerHeight, stk = H.classList.contains('pp-stk'), bar = d.querySelector('.bar'), barY = 22, theme = '';
    if (bar) { var br = bar.getBoundingClientRect(); barY = br.top + br.height / 2; }
    frames.forEach(function (pg) {
      var r = pg.getBoundingClientRect(), nb = +pg.getAttribute('data-nb') || 1;
      if (r.top <= barY && r.bottom > barY) theme = pg.classList.contains('fr-light') ? 'lt' : 'dk';   // 바 뒤에 놓인 틀 쪽의 어두움/밝음
      var near = r.bottom > -vh * 0.6 && r.top < vh * 1.6;
      var vid = pg.querySelector('video.fr-img');
      if (vid) {   // 영상: 가까워지면 받고, 화면에 보이는 동안만 소리 없이 반복 재생. 정지판은 포스터만.
        if (!stk) { if (!vid.paused) vid.pause(); }
        else {
          if (near && !vid.getAttribute('src')) { vid.muted = true; vid.defaultMuted = true; vid.setAttribute('src', vid.getAttribute('data-src')); }
          var vis = r.bottom > 0 && r.top < vh;
          if (vis && vid.paused && vid.getAttribute('src')) { var pr = vid.play(); if (pr && pr.catch) pr.catch(function () { }); } else if (!vis && !vid.paused) vid.pause();
        }
      }
      if (!near) return;
      var inView = !stk || (r.top < vh * .72 && r.bottom > vh * .35);
      pg.classList.toggle('in', inView);
      if (!stk) return;
      var pin = clamp(-r.top, 0, Math.max(0, r.height - vh)), f = nb > 1 ? clamp(pin / (STEP * vh), 0, nb - 1) : 0, idx = nb > 1 ? clamp(Math.floor(f + 0.35), 0, nb - 1) : 0;
      if (pg._bi !== idx || pg._bo !== inView) { pg._bi = idx; pg._bo = inView; setBeat(pg, idx, inView); }
      pg.setAttribute('data-beat', idx);
      var t = clamp((vh - r.top) / Math.max(r.height, 1), 0, 1), m = pg.getAttribute('data-motion'), a = +pg.getAttribute('data-amt') || 0, mv = pg.querySelector('.fr-mv'), media = pg.querySelector('.fr-media');
      if (mv && media && !mv.classList.contains('fr-cert')) {
        var tr = '';
        if (m === 'flow') tr = 'translate3d(' + ((0.5 - t) * a / 100 * media.clientWidth).toFixed(1) + 'px,0,0)';
        else if (m === 'rise') tr = 'translate3d(0,' + ((0.5 - t) * a / 100 * media.clientHeight).toFixed(1) + 'px,0)';
        else if (m === 'zoomout') { var zm = +pg.getAttribute('data-zoom') || 1.3; tr = 'scale(' + (zm - (zm - 1) * easeOut(Math.min(1, t * 1.2))).toFixed(4) + ')'; }
        mv.style.transform = tr;
      }
      var cb = pg.querySelector('.fr-cert');
      if (cb && media) {   // 증명서 흐름: 프레임 가운데가 놓이는 증명서 높이 비율(c) 을 쪽 진행도 P(0=들어오는 순간 … 박자 수)로 보간. 제조업자명 칸 아래로는 안 내려온다(maxb)
        var P = clamp((vh - r.top) / vh, 0, 1) + f, trk = cb.getAttribute('data-track').split(';').map(function (x) { return x.split(',').map(Number); }), k = idx >= 2 ? 1 : 0, ps = trk.filter(function (x) { return x[1] === k; }), c = ps[0][2];
        for (var i = 0; i < ps.length - 1; i++) if (P >= ps[i][0] && P <= ps[i + 1][0]) c = lerp(ps[i][2], ps[i + 1][2], (P - ps[i][0]) / (ps[i + 1][0] - ps[i][0]));
        if (P > ps[ps.length - 1][0]) c = ps[ps.length - 1][2]; if (P < ps[0][0]) c = ps[0][2];
        var cw = media.clientWidth, mh = media.clientHeight, W1 = cw * (+cb.getAttribute('data-w') / 100);
        qa('.fr-cimg', cb).forEach(function (im, i) {
          var ih = W1 * (+im.getAttribute('data-ah')) / (+im.getAttribute('data-aw')), top = c * ih - mh / 2;
          if (i === 0) top = Math.min(top, +cb.getAttribute('data-maxb') * ih - mh);
          top = clamp(top, 0, Math.max(0, ih - mh));
          im.style.width = W1 + 'px'; im.style.left = (cw * (+im.getAttribute('data-left')) / 100) + 'px'; im.style.transform = 'translate3d(0,' + (-top).toFixed(1) + 'px,0)';
        });
      }
      pg.classList.toggle('pins-on', inView && t >= 0.9);
    });
    if (bar) { if (theme) bar.classList.add('fr-tr'); bar.classList.toggle('fr-dk', theme === 'dk'); bar.classList.toggle('fr-lt', theme === 'lt'); }
  }
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
  function cmpTick() {   // 3D 무대판 비교표: 줄마다 우리 칸(core 가 .pc.on 을 켬)이 먼저 → 다른 두 칸이 뒤따른다(tr.go)
    stageCmp.forEach(function (b) { qa('tr', b).forEach(function (tr) { var pc = tr.querySelector('.pc'); if (pc) tr.classList.toggle('go', pc.classList.contains('on')); }); });
  }
  function tick() {
    raf = 0; var vh = w.innerHeight;
    counts.forEach(function (el) { var p = RM ? 1 : ease(prog(el, 1.0, 0.78)), to = +el.getAttribute('data-to'); if (el.firstChild && el.firstChild.nodeType === 3) fmt(el, to * p); });
    cells.forEach(function (g) { var p = RM ? 1 : prog(g, 0.9, 0.35), cs = g.children; for (var i = 0; i < cs.length; i++) cs[i].classList.toggle('on', p > 0.12 + i * 0.1); });
    wipes.forEach(function (el, i) { var p = RM ? 1 : prog(el, 0.95, 0.6); el.style.clipPath = p >= 1 ? 'none' : 'inset(0 0 ' + ((1 - p) * 100).toFixed(1) + '% 0)'; el.style.transform = p >= 1 ? '' : 'translateY(' + ((1 - p) * 14).toFixed(1) + 'px)'; });
    rises.forEach(function (el) { var p = RM ? 1 : ease(prog(el, 0.97, 0.7)); el.style.transform = p >= 1 ? '' : 'translateY(' + ((1 - p) * 22).toFixed(1) + 'px)'; el.style.clipPath = p >= 1 ? 'none' : 'inset(0 0 ' + ((1 - p) * 100).toFixed(1) + '% 0)'; });
    zfigs.forEach(function (f) { var p = RM ? 1 : prog(f, 1.0, 0.3), s = 0.9 + 0.1 * ease(p); f.style.transform = RM || p >= 1 ? '' : 'scale(' + s.toFixed(3) + ') translateY(' + ((1 - p) * 30).toFixed(1) + 'px)'; });
    cols.forEach(function (t) { qa('tr', t).forEach(function (tr) { tr.classList.toggle('go', RM || tr.getBoundingClientRect().top < vh * 0.78); }); });   // 흐름판 비교표: 줄이 화면에 올라오면 우리 칸 → 다른 칸
    zimgs.forEach(function (im) { var pg = im.parentNode, r = pg.getBoundingClientRect(), q = clamp((vh - r.top) / (vh + r.height), 0, 1); im.style.transform = RM ? '' : 'scale(' + (1.04 + 0.1 * q).toFixed(3) + ') translateY(' + ((0.5 - q) * 30).toFixed(1) + 'px)'; });
    if (noCore() && !RM) qa('.cpage .bgimg:not(.zoomimg)').forEach(function (pg) { var r = pg.parentNode.getBoundingClientRect(), q = (r.top + r.height / 2 - vh / 2) / vh, k = clamp(1 - Math.abs(q), 0, 1); pg.style.transform = 'translateY(' + (q * -26).toFixed(1) + 'px) scale(' + (1.04 + 0.1 * k).toFixed(3) + ')'; });
    bars.forEach(function (b) { var p = RM ? 1 : ease(prog(b, 1.0, 0.7)), w1 = +getComputedStyle(b).getPropertyValue('--w') || 1; b.style.transform = 'scaleX(' + (w1 * p).toFixed(3) + ')'; });
    cmpTick();
    frameTick();
    hl();
  }
  /* ── 소리·독스탠드 쪽: 우상단 작은 아이팟 고리 강조(3D 판, 폰 폭) ── */
  var ring = null;
  function hl() {
    var V5 = w.V5, on = false;
    if (!V5 || V5.tier === 'static' || H.classList.contains('pp-no3d') || RM) { if (ring) ring.style.opacity = 0; return; }
    var pk = w.__proto && w.__proto.parkRect && w.__proto.parkRect();   // 3D 쪽이 실제로 두는 작은 아이팟 자리를 그대로 따른다(자세가 바뀌어도 고리가 어긋나지 않음)
    if (!pk) { if (ring) ring.style.opacity = 0; return; }
    qa('.cpage.snd, .cpage.dock6b').forEach(function (p) { var r = p.getBoundingClientRect(), vh = w.innerHeight; if (r.top < vh * 0.3 && r.bottom > vh * 0.7) on = true; });
    if (!ring) { ring = d.createElement('div'); ring.id = 'parkhl'; ring.setAttribute('aria-hidden', 'true'); (d.getElementById('stage') || d.body).appendChild(ring); }
    var pad = 6, bar = d.querySelector('.bar'), top = Math.max(pk.cy - pk.h / 2 - pad, bar ? bar.getBoundingClientRect().bottom + 2 : 0);
    ring.style.cssText = 'left:' + (pk.cx - pk.w / 2 - pad) + 'px;top:' + top + 'px;width:' + (pk.w + 2 * pad) + 'px;height:' + (pk.cy + pk.h / 2 + pad - top) + 'px;opacity:' + (on ? 1 : 0);
  }
  function req() { if (!raf) raf = w.requestAnimationFrame(tick); }
  w.addEventListener('scroll', req, { passive: true }); w.addEventListener('resize', req); w.addEventListener('load', req);
  stageCmp = qa('.stage .cmpbox');
  tick(); if (stageCmp.length && !RM) (function loop() { if (w.V5 && w.V5.stopped) return; cmpTick(); w.requestAnimationFrame(loop); })();
  /* 비교표(폴백 흐름판) 열 채움: 같은 표를 data-fx=cols 로 */
  qa('#cmpflow table.c3').forEach(function (t) { t.setAttribute('data-fx', 'cols'); cols.push(t); });
  req();
})();
