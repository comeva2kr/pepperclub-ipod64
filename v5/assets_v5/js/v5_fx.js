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
  /* ── 설명 쪽 공통 틀(.fr): 그림 움직임 3종(flow 좌→우 · zoomout 확대에서 멀어지기 · rise 아래→위, 이동 폭 8%) + 네 박자 등장 + 본문 둘째 박자 ── */
  var STILL = RM || (w.V5 && w.V5.tier === 'lite'); if (STILL) H.classList.add('pp-still');
  d.addEventListener('pp:tier', function (e) { if (e.detail && e.detail.tier === 'lite') H.classList.add('pp-still'); });
  w.addEventListener('pp:lite-runtime', function () { H.classList.add('pp-still'); });
  var frames = qa('.cpage.fr');
  frames.forEach(function (pg) {
    var vid = pg.querySelector('video.fr-img');
    if (vid && w.IntersectionObserver && !RM) new w.IntersectionObserver(function (es) {   // 영상: 보일 때만 받아 소리 없이 반복
      es.forEach(function (x) { if (x.isIntersecting) { if (!vid.getAttribute('src')) vid.setAttribute('src', vid.getAttribute('data-src')); var pr = vid.play(); if (pr && pr.catch) pr.catch(function () { }); } else { try { vid.pause(); } catch (z) { } } });
    }, { threshold: .25 }).observe(pg);
  });
  function frameTick() {
    var vh = w.innerHeight, still = H.classList.contains('pp-still');
    frames.forEach(function (pg) {
      var r = pg.getBoundingClientRect(); if (r.bottom < -50 || r.top > vh + 50) return;
      var p = clamp((vh - r.top) / (vh + r.height), 0, 1), q = p * 2 - 1, m = pg.getAttribute('data-motion'), im = pg.querySelector('.fr-img');
      if (im && !still) {   // q: -1(아래에서 들어옴) → 0(맞춰짐) → +1(위로 나감). 이동 폭 8%
        var t = m === 'flow' ? 'translate3d(' + (q * 8).toFixed(2) + '%,0,0)' : m === 'rise' ? 'translate3d(0,' + (-q * 8).toFixed(2) + '%,0)' : 'scale(' + (1 + (1 - Math.min(1, p * 1.5)) * 0.08).toFixed(3) + ')';
        im.style.transform = t;
      }
      var inView = still || (r.top < vh * .72 && r.bottom > vh * .35);
      pg.classList.toggle('in', inView);
      pg.classList.toggle('beat2', !still && p > .64 && !!pg.querySelector('.fr-body2'));
    });
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
