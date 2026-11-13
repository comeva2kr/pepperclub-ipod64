/* v5 페이지 공통(3D·폴백 둘 다) — 구매 버튼·꼬리표·행사(블프) 자동 전환. 설정은 #pp-buy 마커 한 곳(v4.4 마커 값 그대로).
   tagUrl·evEnded 는 v4.4 소스의 tag/ev 마커 구간을 빌더가 그대로 가져온 것(원본 수정 0). 네트워크: 같은 출처 HEAD(서버 시간) 한 번뿐, 보내는 데이터 없음. */
(function () {
  var d = document, w = window, M = d.getElementById('pp-buy');
  if (!M) return;

/* 주소 꼬리표: 이미 있는 키는 건드리지 않고(중복 금지) 없는 키만 붙인다. 쿼리가 있으면 &, 없으면 ?. #해시는 맨 뒤에 그대로. */
function tagUrl(u,tg){var h='',i=u.indexOf('#'),q,ps,m,k,have={},add=[],c;
 if(i>=0){h=u.slice(i);u=u.slice(0,i)}
 q=u.indexOf('?');ps=q>=0?u.slice(q+1).split('&'):[];
 for(m=0;m<ps.length;m++){k=ps[m].split('=')[0];try{k=decodeURIComponent(k)}catch(x){}if(k)have[k]=1}
 for(k in tg)if(Object.prototype.hasOwnProperty.call(tg,k)&&!have[k])add.push(encodeURIComponent(k)+'='+encodeURIComponent(tg[k]));
 if(!add.length)return u+h;
 c=q<0?'?':(/[?&]$/.test(u)?'':'&');
 return u+c+add.join('&')+h}


/* 행사 종료 판정: ends(ISO, 오프셋 포함) 가 속한 그 1초까지 행사, 다음 순간부터 종료. 해석 못 하면 종료로 본다(평시 표시가 안전). */
function evEnded(now,ends){var e=Date.parse(ends);return e!==e||now>=e+1000}

  function pj(el, k) { try { return JSON.parse(el.getAttribute(k) || '{}') || {}; } catch (e) { return {}; } }
  function won(n) { return '₩' + n.toLocaleString('ko-KR'); }
  var u0 = M.getAttribute('data-pp-naver-url') || '', tg = pj(M, 'data-pp-naver-tags'), kw = pj(M, 'data-pp-naver-kw'), EV = pj(M, 'data-pp-ev'),
    normal = parseInt(M.getAttribute('data-pp-naver-price'), 10) || 0, done = 0;
  function key(k) { return k === 'top' ? (kw.top || 'top') : k === 'end' ? (kw.end || 'cta_end') : (kw.link || 'cta_{scene}').replace('{scene}', k); }
  function nuf(k) { var t = {}, x; for (x in tg) t[x] = tg[x]; t.nt_keyword = key(k); return tagUrl(u0, t); }
  [].slice.call(d.querySelectorAll('[data-pp-buylink]')).forEach(function (a) {
    var k = a.getAttribute('data-pp-buylink'); if (u0) { a.href = nuf(k); a.target = '_blank'; a.rel = 'noopener noreferrer'; }
    a.addEventListener('click', function () { try { d.dispatchEvent(new CustomEvent('pp:buy', { detail: { event: 'pp_buy_click', where: k, target: 'naver' } })); } catch (x) { } });
  });
  var evOk = !!(EV && EV.coupon > 0 && EV.normal > 0 && EV.ends);
  function paint(on) {
    [].slice.call(d.querySelectorAll('[data-pp-price]')).forEach(function (p) { p.textContent = won(on ? EV.coupon : normal); });
    [].slice.call(d.querySelectorAll('[data-pp-chip]')).forEach(function (c) { c.hidden = !on; if (on) c.textContent = EV.badge || ''; });
    [].slice.call(d.querySelectorAll('[data-pp-evnode]')).forEach(function (n) { n.hidden = !on; });
    [].slice.call(d.querySelectorAll('[data-pp-plain]')).forEach(function (n) { n.hidden = on; });
    d.documentElement.classList[on ? 'add' : 'remove']('pp-event');
  }
  function off() { if (done) return; done = 1; paint(false); if (EV.title) d.title = EV.title; var m = d.querySelector('meta[name=description]'); if (m && EV.desc) m.setAttribute('content', EV.desc); try { d.dispatchEvent(new CustomEvent('pp:event', { detail: { on: false } })); } catch (x) { } }
  /* 서버 시간: 같은 출처 HEAD 의 Date 헤더. 실패·file:·시간 초과면 클라이언트 시계. */
  function srvNow(cb) {
    var fin = 0, ac = w.AbortController ? new w.AbortController() : null, tm;
    function f(ms) { if (fin) return; fin = 1; clearTimeout(tm); cb(ms); }
    if (!w.fetch || !/^https?:$/.test(w.location.protocol)) return f(null);
    tm = setTimeout(function () { if (ac) ac.abort(); f(null); }, 2500);
    w.fetch(w.location.href.split('#')[0], { method: 'HEAD', cache: 'no-store', credentials: 'omit', signal: ac ? ac.signal : undefined }).then(function (r) { var h = r.headers.get('Date'), ms = h ? Date.parse(h) : NaN; f(ms === ms ? ms : null); }, function () { f(null); });
  }
  if (!evOk) { paint(false); return; }
  paint(true);
  srvNow(function (ms) {
    var now = ms === null ? Date.now() : ms, left;
    if (evEnded(now, EV.ends)) return off();
    left = Date.parse(EV.ends) + 1000 - now;
    if (left > 0 && left < 2147483647) setTimeout(off, left);
  });
})();
