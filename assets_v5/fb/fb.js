/* pp-engine v4.4 (마일스톤 2.1: 등급 재설계 — 'lite' = 프레임 수를 줄여도 스크롤에 따라 계속 움직이는 시퀀스, 정지 끝 프레임은 'static'(움직임 줄이기·GSAP 없음)뿐. 마일스톤 1 확장: data-pp-sticky 장면 지원·data-pp-lite 끝 대신 보여 줄 프레임·el._ppp 진행도 콜백 — 기존 pin·순수 함수는 그대로): 스크롤 감기 엔진(프레임 시퀀스 canvas · 영상 currentTime) + 성능 등급(full/lite). 장면에 [data-pp-seq]·[data-pp-vscrub] 가 없으면 즉시 종료.
   네트워크: 프레임·영상 파일을 읽을 뿐 보내는 데이터 없음(fetch·XHR·beacon 없음). 합성 없음 — 실촬 프레임만 canvas 에 그린다.
   효과가 꺼져도(lite·reduced-motion·JS 꺼짐) 포스터/끝 프레임이 남아 이야기·구매 버튼은 그대로 읽힌다. */
(function(){
var d=document,w=window,nav=w.navigator;

/*pure:start*/
/* 기준값(한 곳) — 바꾸면 테스트가 같이 본다 */
var PPK={NEAR:4,SEVERE_MED_MS:50,SEVERE_P95_MS:100,MEM_LOW:1,STRIDE:2,DEG_MED_MS:66,DEG_SLOW_MS:100,DEG_SLOW_FRAC:.5,DEG_MIN_SAMPLES:24,SEEK_MEAN_MS:220,SEEK_MAX_MS:900,SEEK_MIN_N:6};
/* iPhone 대응(11-13 실측): 저전력 모드는 rAF 가 30fps(간격 33ms)로 고정되고, 로딩 직후엔 간격이 튄다. 예전 기준(중앙값>22ms·코어≤2)은 이를 '느린 기기'로 오판해 움직임을 껐다.
   그래서 '심각한 지연'(중앙값>50ms = 20fps 미만, p95>100ms)일 때만 lite(프레임 수를 줄인 시퀀스, 그래도 움직인다)로 내리고, 코어 수 규칙은 없앴다. 정지(static)는 움직임 줄이기·GSAP 없음뿐. */
/* 거친 단계: 1·9·17…(8칸 간격)과 마지막 프레임이 0단계(전체 윤곽), 4칸·2칸·나머지가 1·2·3단계 */
function levelOf(i,n){var k=i-1;return(k%8===0||i===n)?0:k%4===0?1:k%2===0?2:3}
/* 처음부터 끝까지 받는 순서(진행도 정보가 없을 때): 0단계 -> 1 -> 2 -> 3 */
function loadOrder(n){var a=[],i,L;for(L=0;L<4;L++)for(i=1;i<=n;i++)if(levelOf(i,n)===L)a.push(i);return a}
/* 다음에 받을 프레임. have: 번호->받았거나 받는 중. cur: 지금 진행도의 프레임(0 = 아직 스크롤 안 함).
   cur 이 있으면 cur±NEAR 안의 빈 프레임을 가까운 순으로 먼저, 그 밖은 (단계 * (n+1) + cur 과의 거리) 가 작은 것부터. 0 = 다 받음 */
function nextFrame(n,have,cur){var i,j,best=0,bs=1e9,s,K=n+1,c=cur||1;
 if(cur)for(j=0;j<=PPK.NEAR;j++){i=cur-j;if(i>=1&&i<=n&&!have[i])return i;i=cur+j;if(i>=1&&i<=n&&!have[i])return i}
 for(i=1;i<=n;i++){if(have[i])continue;s=levelOf(i,n)*K+Math.abs(i-c);if(s<bs){bs=s;best=i}}
 return best}
/* 받은 프레임 중 k 에 가장 가까운 것(같은 거리면 앞쪽). 0 = 하나도 없음 */
function nearestLoaded(ok,n,k){var j,a,b;for(j=0;j<=n;j++){a=k-j;if(a>=1&&a<=n&&ok[a])return a;b=k+j;if(b>=1&&b<=n&&ok[b])return b}return 0}
/* 진행도 p(0~1)를 [from,to] 구간으로 늘려 프레임 번호(1~n) 로 */
function progressToFrame(p,n,from,to){var q=to>from?(p-from)/(to-from):0;q=q<0?0:q>1?1:q;return 1+Math.round(q*(n-1))}
function percentile(a,p){if(!a.length)return 0;var s=a.slice().sort(function(x,y){return x-y}),i=Math.min(s.length-1,Math.max(0,Math.ceil(p/100*s.length)-1));return s[i]}
/* 성능 등급. s: {rm, forced('lite'|'full'|'static'), saveData, eff(effectiveType), mem(deviceMemory), med, p95}. 움직임 줄이기는 항상 static(접근성이 우선, 강제 full 도 따르지 않음). lite 도 스크롤에 따라 움직인다 */
function tierDecide(s){
 if(s.rm)return{tier:'static',reason:'reduced-motion'};
 if(s.forced==='lite'||s.forced==='full'||s.forced==='static')return{tier:s.forced,reason:'forced'};
 if(s.saveData)return{tier:'lite',reason:'save-data'};
 if(s.eff&&/^(slow-2g|2g|3g)$/.test(s.eff))return{tier:'lite',reason:'slow-network:'+s.eff};
 if(s.mem&&s.mem<=PPK.MEM_LOW)return{tier:'lite',reason:'low-memory:'+s.mem};
 if(s.med&&s.med>PPK.SEVERE_MED_MS)return{tier:'lite',reason:'slow-frames-median:'+Math.round(s.med)};
 if(s.p95&&s.p95>PPK.SEVERE_P95_MS)return{tier:'lite',reason:'slow-frames-p95:'+Math.round(s.p95)};
 return{tier:'full',reason:'ok'}}
/* 실행 중 보호 장치: 스크롤 감는 동안의 프레임 간격(ms) 목록이 계속 길면 true */
function shouldDegrade(dts){if(dts.length<PPK.DEG_MIN_SAMPLES)return false;var slow=0,i;for(i=0;i<dts.length;i++)if(dts[i]>PPK.DEG_SLOW_MS)slow++;return percentile(dts,50)>PPK.DEG_MED_MS||slow/dts.length>=PPK.DEG_SLOW_FRAC}
/* 영상 감기 보호: seeked 까지 걸린 시간(ms) 목록이 느리면 true -> 시퀀스로 폴백 */
function seekSlow(lats){if(lats.length&&Math.max.apply(null,lats)>PPK.SEEK_MAX_MS)return true;if(lats.length<PPK.SEEK_MIN_N)return false;var s=0,i;for(i=0;i<lats.length;i++)s+=lats[i];return s/lats.length>PPK.SEEK_MEAN_MS}
/*pure:end*/

var SQ=[].slice.call(d.querySelectorAll('[data-pp-seq]')),VS=[].slice.call(d.querySelectorAll('[data-pp-vscrub]'));
if(!SQ.length&&!VS.length)return;

var RM=!!(w.matchMedia&&w.matchMedia('(prefers-reduced-motion: reduce)').matches),G=w.gsap,T=w.ScrollTrigger,H=d.documentElement,
 DBG=/[?&]ppdebug=1/.test(w.location.search)||!!w.PP_DEBUG,
 Q=(w.location.search.match(/[?&]pp=(lite|full|static)(&|$)/)||[])[1]||'',MT=d.querySelector('meta[name=pp-tier]'),
 FORCED=Q||(MT&&/^(lite|full|static)$/.test(MT.getAttribute('content'))?MT.getAttribute('content'):''),
 C=nav.connection||{},SIG={rm:RM,forced:FORCED,saveData:!!C.saveData,eff:C.effectiveType||'',mem:nav.deviceMemory||0,cores:nav.hardwareConcurrency||0},
 ST={tier:'full',reason:'',phase:'',log:[],probe:null,degraded:0,maxAlive:0,seqs:[],vids:[],sts:[]},
 NETMAX=4,DECMAX=2,CAPFULL=24,NETLITE=2,PIXFULL=110e6,PIXLITE=60e6,TAU=.14,idle=function(f){(w.requestIdleCallback||function(g){setTimeout(g,50)})(f,{timeout:900})};

function setTier(tier,reason,phase){ST.tier=tier;ST.reason=reason;ST.phase=phase;H.setAttribute('data-pp-tier',tier);H.setAttribute('data-pp-tier-reason',reason);
 var LR=d.querySelector('.pp-landing'),els=LR?[H,LR]:[H];els.forEach(function(e){e.classList[tier==='lite'?'add':'remove']('pp-lite');e.classList[tier==='static'?'add':'remove']('pp-static')});
 try{d.dispatchEvent(new CustomEvent('pp:tier',{detail:{tier:tier,reason:reason,phase:phase,signals:SIG,probe:ST.probe}}))}catch(x){}
 if(w.console&&console.info)console.info('pp_v44 tier='+tier+' ('+reason+', '+phase+')')}
function log(o){if(DBG){o.t=Math.round(w.performance.now());ST.log.push(o)}}

/* ───── 프레임 시퀀스 ───── */
function Seq(el,cfg,id){var s=this;s.el=el;s.id=id;s.base=cfg.base;s.n=cfg.n;s.ext=cfg.ext;s.pad=cfg.pad||3;s.W=cfg.W;s.H=cfg.H;s.map=cfg.map||[0,1];s.pin=cfg.pin||0;s.lf=cfg.lf||cfg.n;
 s.cv=cfg.cv||el.querySelector('canvas');if(!s.cv){s.cv=d.createElement('canvas');s.cv.setAttribute('aria-hidden','true');el.appendChild(s.cv)}
 s.cx=s.cv.getContext('2d');s.cv.width=s.W;s.cv.height=s.H;s.cache={};s.ok={};s.have={};s.bad={};s.alive=0;s.act=0;s.dec=0;s.dq=[];s.cur=0;s.want=1;s.shown=0;s.started=false;s.lite=false;s.stat=false;s.marked=false;s.vis=false;s.rq=0;s.curf=1;s.wantf=1;s.anim=0;s.tm=0;s.init=false;s.dkey='';s.dir=0;s.endDone=false;s.st=null;s.reqs=0}
/* Image 를 놓아줄 때: 핸들러를 먼저 떼야 src='' 가 onerror 를 일으켜 진행 중 개수를 잘못 깎지 않는다 */
function freeImg(im){if(im){im.onload=im.onerror=null;im.src=''}}
Seq.prototype.url=function(k){return this.base+('00000'+k).slice(-this.pad)+this.ext};
/* 디코드된 프레임 메모리 상한: 화면 크기별 픽셀 예산(전체 110M·lite 60M 픽셀 ≈ 440·240MB)으로 장수를 정한다. 작은 프레임(가로 띠)은 많이, 큰 프레임(세로 전체)은 적게 */
function capOf(s){var c=Math.floor((s.lite?PIXLITE:PIXFULL)/(s.W*s.H*4));return Math.max(12,Math.min(s.n,c))}
function netOf(s){return s.lite?NETLITE:NETMAX}
/* lite: 프레임을 STRIDE 칸마다 한 장만 받는다(받지 않을 프레임은 '이미 있음'으로 표시) — 장면은 그대로 sticky 로 붙고 스크롤에 따라 계속 움직인다 */
Seq.prototype.mark=function(){var s=this,k;if(s.marked||!s.lite)return;s.marked=true;for(k=1;k<=s.n;k++)if(k!==1&&k!==s.n&&(k-1)%PPK.STRIDE!==0)s.have[k]=1};
Seq.prototype.reduce=function(){var s=this;if(s.lite||s.stat)return;s.lite=true;var was=s.started;s.release();s.marked=false;s.mark();if(was||s.vis)s.start()};
Seq.prototype.start=function(){if(this.started||this.stat)return;this.started=true;this.mark();this.pump()};
Seq.prototype.pump=function(){var s=this,k;if(!s.started||s.stat)return;
 while(s.act<netOf(s)&&(k=nextFrame(s.n,s.have,s.cur))){
  /* 메모리 상한에 닿으면 지금 진행도 근처(±NEAR) 프레임만 더 받는다 — 상한 밖 프레임을 받았다 지웠다 하며 되풀이하지 않는다 */
  if(s.alive+s.act>=capOf(s)&&!(s.cur&&Math.abs(k-s.cur)<=PPK.NEAR))break;
  s.request(k)}};
Seq.prototype.request=function(k){var s=this,im=new Image();s.have[k]=1;s.act++;s.reqs++;im.decoding='async';log({ev:'req',seq:s.id,k:k});
 im.onload=function(){s.dq.push([im,k]);s.dpump()};
 im.onerror=function(){s.bad[k]=1;s.act--;s.pump()};
 im.src=s.url(k)};
Seq.prototype.dpump=function(){var s=this,e;
 while(s.dec<DECMAX&&(e=s.dq.shift())){(function(im,k){s.dec++;
  var fin=function(){s.dec--;s.act--;if(s.started&&!s.stat||k===s.n){s.cache[k]=im;s.ok[k]=1;s.alive++;ST.maxAlive=Math.max(ST.maxAlive,seqAlive());s.evict();if(k===s.n)s.onLast();s.render()}else{freeImg(im)}s.dpump();s.pump()};
  if(im.decode)im.decode().then(fin,fin);else fin()})(e[0],e[1])}};
/* 메모리 상한: 받은(디코드된) 프레임이 CAPFULL 을 넘으면 지금 진행도에서 가장 먼 프레임부터(0단계 윤곽 프레임은 마지막에) 해제 */
Seq.prototype.evict=function(){var s=this,k,v,vd,dd,pass;
 while(s.alive>capOf(s)){v=0;vd=-1;
  for(pass=0;pass<2&&!v;pass++)for(k in s.ok){if(!s.ok[k])continue;k=+k;if(pass===0&&levelOf(k,s.n)===0)continue;dd=Math.abs(k-(s.cur||s.want));if(dd>vd){vd=dd;v=k}}
  if(!v)break;s.drop(v)}};
Seq.prototype.drop=function(k){var s=this;if(s.cache[k]){freeImg(s.cache[k]);delete s.cache[k]}s.ok[k]=0;s.have[k]=0;s.alive--;log({ev:'drop',seq:s.id,k:k})};
/* 받은 프레임 중 f(소수 프레임 위치) 를 감싸는 두 장 [아래, 위]. 하나도 없으면 [0,0] */
function bracket(ok,n,f){var lo=0,hi=0,a=Math.floor(f),k;for(k=Math.min(n,Math.max(1,a));k>=1;k--)if(ok[k]){lo=k;break}
 for(k=Math.max(1,Math.min(n,Math.ceil(f)));k<=n;k++)if(ok[k]){hi=k;break}
 if(!lo)lo=hi;if(!hi)hi=lo;return[lo,hi]}
/* 그리기: 받은 프레임 두 장을 위치에 비례해 알파 블렌딩(인접 프레임 크로스페이드) — 프레임이 덜 받아졌거나 lite 로 솎아도 뚝뚝 끊겨 보이지 않는다 */
Seq.prototype.draw=function(f){var s=this,b=bracket(s.ok,s.n,f),lo=b[0],hi=b[1],t,key;if(!lo)return;
 t=lo===hi?0:Math.max(0,Math.min(1,(f-lo)/(hi-lo)));if(t<.03)t=0;else if(t>.97)t=1;
 key=lo+':'+hi+':'+Math.round(t*24);if(key===s.dkey)return;s.dkey=key;
 s.cx.globalAlpha=1;
 if(t===1){s.cx.drawImage(s.cache[hi],0,0,s.W,s.H)}else{s.cx.drawImage(s.cache[lo],0,0,s.W,s.H);if(t>0&&hi!==lo){s.cx.globalAlpha=t;s.cx.drawImage(s.cache[hi],0,0,s.W,s.H);s.cx.globalAlpha=1}}
 s.shown=t>.5?hi:lo;s.el.classList.add('pp-seq-on');if(w.__ppdl)w.__ppdl.push([w.performance.now(),s.id])};
/* 스크롤 완충: 진행도가 바뀌면 목표 위치만 정하고, 그리기는 rAF 에서 지수 보간(τ≈0.14초 ≈ 0.4초에 거의 도달)으로 따라간다 — 빠르게 넘겨도 한 번에 건너뛰지 않는다 */
Seq.prototype.kick=function(){var s=this;if(s.anim)return;s.anim=1;s.tm=w.performance.now();s.rq=w.requestAnimationFrame(function f(now){
 var dt=Math.min(.1,Math.max(.001,(now-s.tm)/1000)),df;s.tm=now;df=s.wantf-s.curf;
 if(Math.abs(df)<.02){s.curf=s.wantf;s.draw(s.curf);s.anim=0;s.rq=0;return}
 s.curf+=df*(1-Math.exp(-dt/TAU));s.draw(s.curf);s.rq=w.requestAnimationFrame(f)})};
Seq.prototype.render=function(){var s=this;s.dkey='';s.kick()};
Seq.prototype.setProgress=function(p){var s=this,q=s.map[1]>s.map[0]?(p-s.map[0])/(s.map[1]-s.map[0]):0,f;q=q<0?0:q>1?1:q;f=1+q*(s.n-1);
 s.dir=f>s.wantf?1:f<s.wantf?-1:s.dir;s.wantf=f;if(!s.init){s.init=true;s.curf=f}
 s.want=Math.round(f);if(p>0)s.cur=Math.max(1,Math.min(s.n,Math.round(f+s.dir*5)));      /* 진행 방향 앞쪽 프레임을 먼저 받는다 */
 s.kick();s.pump()};
/* 장면을 멀리 벗어나면 받은 프레임을 전부 놓아준다(캔버스에 그려진 마지막 그림은 남는다). 다시 가까워지면 처음 순서부터 다시 받는다 */
Seq.prototype.release=function(){var s=this,k;for(k in s.cache){freeImg(s.cache[k])}s.cache={};s.ok={};s.have={};s.bad={};s.alive=0;s.dq=[];s.started=false;s.marked=false;s.dkey='';log({ev:'release',seq:s.id})};
/* lite: 스크롤 감기·핀 없이 끝 프레임만 받아 장면에 들어올 때 페이드. 프레임 요청은 마지막 한 장 */
Seq.prototype.toStatic=function(){var s=this;s.stat=true;if(s.st){s.st.kill(true);s.st=null}s.release();s.started=false;s.liteWatch()};
Seq.prototype.liteWatch=function(){var s=this;if(s.endDone)return;
 function go(){if(s.endDone)return;s.endDone=true;s.want=s.lf;s.have[s.lf]=1;s.act++;s.reqs++;log({ev:'req',seq:s.id,k:s.lf,lite:1});var im=new Image();im.decoding='async';
  im.onload=function(){s.act--;s.cache[s.lf]=im;s.ok[s.lf]=1;s.alive++;s.draw(s.lf);s.onLast();s.el.classList.add('pp-end')};im.onerror=function(){s.act--}; im.src=s.url(s.lf)}
 if(RM||!w.IntersectionObserver)return go();
 new w.IntersectionObserver(function(es,o){if(es[0].isIntersecting){o.disconnect();go()}},{threshold:.3}).observe(s.el)};
Seq.prototype.onLast=function(){var f=this.onlast;if(f)f()};

function seqAlive(){var a=0,i;for(i=0;i<ST.seqs.length;i++)a+=ST.seqs[i].alive;return a}
function num(el,k,dv){var v=el.getAttribute(k);return v===null||v===''?dv:+v}
function seqCfg(el,pre){var m=(el.getAttribute(pre+'map')||'0,1').split(',');pre=pre||'data-pp-';
 return{base:el.getAttribute(pre+'base'),n:num(el,pre+'count',0),ext:el.getAttribute(pre+'ext')||'.webp',pad:num(el,pre+'pad',3),W:num(el,'data-pp-w',720),H:num(el,'data-pp-h',720),map:[+m[0]||0,m[1]===undefined?1:+m[1]],pin:num(el,'data-pp-pin',0),lf:num(el,'data-pp-lite',0)}}

/* ScrollTrigger 묶기: 핀이 있으면 장면 전체를 고정하고 pin% 만큼 스크롤 동안 진행, 없으면 요소가 화면을 지나는 동안 진행 */
function bind(el,pin,onp){var tg=pin?(el.closest('[data-pp-scene]')||el.parentNode):el,sk=pin?null:el.closest('[data-pp-sticky]'),
 cfg={trigger:tg,start:pin?'top top':'top bottom',end:pin?'+='+pin+'%':'bottom top',scrub:true,pin:pin?tg:false,anticipatePin:1,onUpdate:function(self){onp(self.progress);if(el._ppp)el._ppp(self.progress);act()}},st;
 /* v4.4: CSS sticky 장면(data-pp-sticky = 키 큰 구간 안에서 화면에 붙는 장면) — 핀(pin-spacer)을 쓰지 않고 구간 전체를 진행도 0~1 로 */
 if(sk){cfg.trigger=sk;cfg.start='top top';cfg.end='bottom bottom'}
 st=T.create(cfg);ST.sts.push(st);return st}

/* 시퀀스 요소 하나 */
function initSeq(el,i){var c=seqCfg(el,'data-pp-'),s;if(!c.base||!c.n)return;s=new Seq(el,c,'seq'+i);ST.seqs.push(s);return s}
function runSeq(s){
 if(RM||ST.tier==='static'){s.stat=true;s.liteWatch();return}
 if(ST.tier==='lite'){s.lite=true}
 s.st=bind(s.el,s.pin,function(p){s.setProgress(p)});
 if(w.IntersectionObserver){
  new w.IntersectionObserver(function(es){s.vis=es[0].isIntersecting;if(s.vis)s.start()},{rootMargin:Math.round(w.innerHeight*1.6)+'px 0px'}).observe(s.el);
  new w.IntersectionObserver(function(es){if(!es[0].isIntersecting&&s.started)s.release()},{rootMargin:Math.round(w.innerHeight*3)+'px 0px'}).observe(s.el)
 }else s.start()}

/* ───── 영상 감기(video currentTime) → 느리면 시퀀스로 폴백 ───── */
function Vid(el,i){var v=this;v.el=el;v.id='vid'+i;v.vd=el.querySelector('video');v.fb=null;v.lat=[];v.seeking=0;v.t0=0;v.last=0;v.dur=0;v.lastp=0;v.ready=false;v.dead=false;v.st=null;v.tm=0;v.pin=num(el,'data-pp-pin',0);v.rq=0;v.src=false}
Vid.prototype.fbCfg=function(){return seqCfg(this.el,'data-pp-fb-')};
Vid.prototype.mkFb=function(){var v=this,c=v.fbCfg();if(!c.base||!c.n)return null;if(!v.fb){c.pin=v.pin;c.cv=null;v.fb=new Seq(v.el,c,v.id+'-fb');ST.seqs.push(v.fb)}return v.fb};
Vid.prototype.fallback=function(reason){var v=this,f;if(v.dead)return;v.dead=true;clearTimeout(v.tm);
 if(v.vd){try{v.vd.pause()}catch(x){}v.vd.removeAttribute('src');while(v.vd.firstChild)v.vd.removeChild(v.vd.firstChild);try{v.vd.load()}catch(x2){}v.vd.hidden=true}
 v.el.classList.remove('pp-vid-on');f=v.mkFb();
 if(w.console&&console.info)console.info('pp_v44 vscrub -> sequence ('+reason+')');
 try{d.dispatchEvent(new CustomEvent('pp:vscrub-fallback',{detail:{id:v.id,reason:reason,sequence:!!f}}))}catch(x3){}
 if(!f)return;
 if(ST.tier==='static'||RM){f.stat=true;f.liteWatch();return}
 if(ST.tier==='lite')f.lite=true;
 f.start();if(v.lastp!==undefined)f.setProgress(v.lastp)};
Vid.prototype.load=function(){var v=this,vd=v.vd,mp4=v.el.getAttribute('data-pp-src-mp4'),wb=v.el.getAttribute('data-pp-src-webm'),ok=false,so;if(v.src||v.dead||!vd)return;v.src=true;
 if(vd.canPlayType){ok=(mp4&&vd.canPlayType('video/mp4'))||(wb&&vd.canPlayType('video/webm'))}else ok=true;
 if(!ok)return v.fallback('no-codec');
 vd.muted=true;vd.setAttribute('muted','');vd.playsInline=true;vd.setAttribute('playsinline','');vd.preload='auto';
 [[mp4,'video/mp4'],[wb,'video/webm']].forEach(function(t){if(t[0]){so=d.createElement('source');so.src=t[0];so.type=t[1];vd.appendChild(so)}});
 vd.addEventListener('loadedmetadata',function(){clearTimeout(v.tm);v.dur=vd.duration||0;v.ready=v.dur>0;if(!v.ready)v.fallback('no-duration');else v.tick()});
 vd.addEventListener('error',function(){v.fallback('video-error')},true);
 vd.addEventListener('seeked',function(){var l=w.performance.now()-v.t0;v.seeking=0;v.lat.push(l);if(v.lat.length>12)v.lat.shift();log({ev:'seeked',seq:v.id,ms:Math.round(l)});v.el.classList.add('pp-vid-on');
  if(seekSlow(v.lat))return v.fallback('slow-seek');v.tick()});
 v.tm=setTimeout(function(){if(!v.ready)v.fallback('metadata-timeout')},4000);
 try{vd.load()}catch(x){v.fallback('load-throw')}};
/* scroll -> currentTime: rAF 로 모으고, seeked 를 기다린 뒤 다음 seek(최대 30fps), 1.2초 안에 seeked 가 안 오면 폴백 */
Vid.prototype.setProgress=function(p){var v=this;v.lastp=p;if(v.dead&&v.fb){v.fb.setProgress(p);return}v.tick()};
Vid.prototype.tick=function(){var v=this;if(v.rq||v.dead||!v.ready)return;v.rq=w.requestAnimationFrame(function(){v.rq=0;var now=w.performance.now(),vd=v.vd;
 var tg=(v.lastp||0)*v.dur;
 if(v.dead)return;
 if(v.seeking){if(now-v.t0>1200)v.fallback('seek-timeout');return}
 if(Math.abs(vd.currentTime-tg)>.03&&now-v.last>=33){v.last=now;v.t0=now;v.seeking=1;try{vd.currentTime=tg}catch(x){v.fallback('seek-throw')}}})};
Vid.prototype.toLite=function(){var v=this;if(v.st){v.st.kill(true);v.st=null}if(!v.dead){v.dead=true;clearTimeout(v.tm);if(v.vd){try{v.vd.pause()}catch(x){}}v.el.classList.remove('pp-vid-on')}
 var f=v.mkFb();if(f){f.stat=true;f.liteWatch()}};
function runVid(v){
 if(RM||ST.tier==='static'){v.toLite();return}
 v.st=bind(v.el,v.pin,function(p){v.setProgress(p)});
 if(w.IntersectionObserver)new w.IntersectionObserver(function(es,o){if(es[0].isIntersecting){o.disconnect();v.load()}},{rootMargin:w.innerHeight+'px 0px'}).observe(v.el);else v.load()}

/* ───── 등급 판정: 정적 신호 -> 첫 1초 rAF 간격 실측 -> 실행 중 보호 ───── */
var ring=[],lastScroll=0,lastT=0;
function act(){lastScroll=w.performance.now()}
/* 심각하게 느릴 때만: 스크롤 감기는 끄지 않고 프레임 수만 줄인다(lite). 장면은 그대로 붙고 스크롤에 따라 계속 움직인다 */
function degrade(reason,phase){if(ST.degraded)return;ST.degraded=1;
 ST.seqs.forEach(function(s){s.reduce()});
 setTier('lite',reason,phase)}
/* 첫 1초: rAF 간격을 잰다. 한 프레임마다 장면 크기 캔버스에 포스터를 몇 번 그려(감기와 비슷한 일) 느린 기기를 드러낸다 */
function probe(done){var t0=w.performance.now(),prev=0,dts=[],cv=d.createElement('canvas'),cx=cv.getContext('2d'),p0=d.querySelector('[data-pp-seq] img,[data-pp-vscrub] img'),n=w.PP_PROBE_LOAD||PROBE_LOAD,W=(SQ[0]&&+SQ[0].getAttribute('data-pp-w'))||720,Hh=(SQ[0]&&+SQ[0].getAttribute('data-pp-h'))||720,hid=false;
 cv.width=W;cv.height=Hh;
 function f(now){if(d.hidden)hid=true;if(prev&&dts.length<200)dts.push(now-prev);prev=now;
  if(p0&&p0.naturalWidth){for(var i=0;i<n;i++){cx.globalAlpha=.99;cx.drawImage(p0,i,0,W,Hh)}}
  if(now-t0<1000)return w.requestAnimationFrame(f);
  dts=dts.slice(2);done({med:percentile(dts,50),p95:percentile(dts,95),n:dts.length,hidden:hid,load:n})}
 w.requestAnimationFrame(f)}
var PROBE_LOAD=10;
/* 스크롤로 감는 동안만 프레임 간격을 모아, 계속 느리면 한 번만 lite 로 내려간다 */
function watch(now){if(ST.degraded)return;if(lastT&&now-lastScroll<150){ring.push(now-lastT);if(ring.length>40)ring.shift();if(ring.length>=PPK.DEG_MIN_SAMPLES&&shouldDegrade(ring))return degrade('runtime-slow-frames:'+Math.round(percentile(ring,50))+'ms','runtime')}
 lastT=now;w.requestAnimationFrame(watch)}

/* ───── 시작 ───── */
var s0=tierDecide(SIG);
SQ.forEach(function(el,i){var s=initSeq(el,i);if(s)el._pp=s});
VS.forEach(function(el,i){var v=new Vid(el,i);ST.vids.push(v);el._pp=v});
if(s0.tier!=='static'&&!(G&&T&&G.registerPlugin&&T.create))s0={tier:'static',reason:'no-gsap'};
if(s0.tier!=='static'){G.registerPlugin(T);if(T.config)T.config({ignoreMobileResize:true})}
setTier(s0.tier,s0.reason,'static');
SQ.forEach(function(el){if(el._pp)runSeq(el._pp)});
VS.forEach(function(el){runVid(el._pp)});
/* 측정은 페이지 load 가 끝나고 0.8초 뒤에(로딩 중 끊김을 느린 기기로 오판하지 않게), 30fps 고정(저전력)은 정상으로 본다 */
function afterLoad(f){if(d.readyState==='complete')setTimeout(f,800);else w.addEventListener('load',function(){setTimeout(f,800)})}
if(s0.tier!=='static'&&!RM){
 w.addEventListener('load',function(){if(T&&T.refresh)T.refresh()});
 w.addEventListener('orientationchange',function(){setTimeout(function(){if(T&&T.refresh)T.refresh()},300)});
 if(s0.tier==='full'&&!FORCED)afterLoad(function(){probe(function(r){ST.probe=r;if(ST.degraded)return;
  if(r.hidden){log({ev:'probe-skipped'});return}
  var t=tierDecide({forced:FORCED,rm:RM,med:r.med,p95:r.p95});
  if(t.tier==='lite')degrade(t.reason,'measure');else{ST.reason='ok';try{d.dispatchEvent(new CustomEvent('pp:tier',{detail:{tier:'full',reason:'ok',phase:'measure',probe:r}}))}catch(x){}}
  if(ST.tier==='full')w.requestAnimationFrame(watch)})})
}
w.PPEngine={pure:{PPK:PPK,levelOf:levelOf,loadOrder:loadOrder,nextFrame:nextFrame,nearestLoaded:nearestLoaded,progressToFrame:progressToFrame,percentile:percentile,tierDecide:tierDecide,shouldDegrade:shouldDegrade,seekSlow:seekSlow},
 state:ST,tier:function(){return ST.tier},stats:function(){return{tier:ST.tier,reason:ST.reason,phase:ST.phase,probe:ST.probe,degraded:ST.degraded,maxAlive:ST.maxAlive,alive:seqAlive(),
  seqs:ST.seqs.map(function(s){return{id:s.id,n:s.n,reqs:s.reqs,alive:s.alive,shown:s.shown,started:s.started,lite:s.lite,endDone:s.endDone}}),log:ST.log}}};
})();

(function(){
var d=document,w=window,S=d.querySelectorAll('[data-pp-scene]');
if(!S.length)return;
var R=d.querySelector('.pp-landing')||d.body,M=d.querySelector('[data-pp-buy]'),G=w.gsap,T=w.ScrollTrigger,SP=w.SplitText,
 RM=!!(w.matchMedia&&w.matchMedia('(prefers-reduced-motion: reduce)').matches),
 A=1,B,L,seen={},i,F1,busy=0,slice=Array.prototype.slice,PR,EV,evDone=0;
function emit(n,s,a,x){var o={event:n,scene:s,act:a},e,t=n=='pp_scene'?'pp:scene':'pp:buy';
 if(x)o.target=x;
 if(w.dataLayer&&w.dataLayer.push)w.dataLayer.push(o);
 try{e=new CustomEvent(t,{detail:o})}catch(x2){e=d.createEvent('CustomEvent');e.initCustomEvent(t,false,false,o)}
 d.dispatchEvent(e)}
function ev2(t,o){try{d.dispatchEvent(new CustomEvent(t,{detail:o}))}catch(x){}}
function setAct(a){var c=a!=A;A=a;if(B){B.classList[a>1?'add':'remove']('pp-on');if(c&&a>1&&!RM){B.classList.remove('pp-flash');void B.offsetWidth;B.classList.add('pp-flash')}L.firstChild.nodeValue=M.getAttribute('data-pp-label-'+a)||''}}
function sceneAct(s){return(s.getAttribute('data-pp-act')=='2'||(s.id&&M&&s.id==M.getAttribute('data-pp-act-from')))?2:1}
function hit(s){var id=s.getAttribute('data-pp-scene');if(!seen[id]){seen[id]=1;s.className+=' pp-in';emit('pp_scene',id,sceneAct(s))}setAct(sceneAct(s))}
function go(el){if(el&&el.scrollIntoView){busy=1;setTimeout(function(){busy=0},1800);el.scrollIntoView({behavior:RM?'auto':'smooth',block:'start'})}}
function idle(f){(w.requestIdleCallback||function(g){setTimeout(g,50)})(f,{timeout:900})}

/*tag:start*/
/* 주소 꼬리표: 이미 있는 키는 건드리지 않고(중복 금지) 없는 키만 붙인다. 쿼리가 있으면 &, 없으면 ?. #해시는 맨 뒤에 그대로. */
function tagUrl(u,tg){var h='',i=u.indexOf('#'),q,ps,m,k,have={},add=[],c;
 if(i>=0){h=u.slice(i);u=u.slice(0,i)}
 q=u.indexOf('?');ps=q>=0?u.slice(q+1).split('&'):[];
 for(m=0;m<ps.length;m++){k=ps[m].split('=')[0];try{k=decodeURIComponent(k)}catch(x){}if(k)have[k]=1}
 for(k in tg)if(Object.prototype.hasOwnProperty.call(tg,k)&&!have[k])add.push(encodeURIComponent(k)+'='+encodeURIComponent(tg[k]));
 if(!add.length)return u+h;
 c=q<0?'?':(/[?&]$/.test(u)?'':'&');
 return u+c+add.join('&')+h}
/*tag:end*/

/*ev:start*/
/* 행사 종료 판정: ends(ISO, 오프셋 포함) 가 속한 그 1초까지 행사, 다음 순간부터 종료. 해석 못 하면 종료로 본다(평시 표시가 안전). */
function evEnded(now,ends){var e=Date.parse(ends);return e!==e||now>=e+1000}
/*ev:end*/

/* 서버 시간: 같은 출처 HEAD 의 Date 헤더(방문자 PC 시계에 의존하지 않기 위해). 실패·file:·시간 초과면 null -> 클라이언트 시계 폴백. 보내는 데이터 없음. */
function srvNow(cb){var done=0,ac=w.AbortController?new w.AbortController():null,tm;
 function fin(ms){if(done)return;done=1;clearTimeout(tm);cb(ms)}
 if(!w.fetch||!/^https?:$/.test(w.location.protocol))return fin(null);
 tm=setTimeout(function(){if(ac)ac.abort();fin(null)},2500);
 w.fetch(w.location.href.split('#')[0],{method:'HEAD',cache:'no-store',credentials:'omit',signal:ac?ac.signal:undefined}).then(function(r){var h=r.headers.get('Date'),ms=h?Date.parse(h):NaN;fin(ms===ms?ms:null)},function(){fin(null)})}

/* 행사 구간 표시 — 위 제품 줄(또는 하단 버튼)의 가격 칸: 라벨 + 취소선 평시가 → 라벨 문구 + 행사가. 작은 화면에서는 행사가만 보이고 전체 문구는 보조기기용으로 남긴다. 글자는 전부 마커의 data-pp-ev 값(코드에 문구 없음). */
function mk(t,c,x){var e=d.createElement(t);if(c)e.className=c;if(x)e.appendChild(d.createTextNode(x));return e}
function won(n){return '₩'+n.toLocaleString('ko-KR')}
/* 평시 가격 칸: [앞 글자] + 가격. 앞 글자(예: 판매처 이름)는 좁은 화면에서 보조기기용으로만 남는다. */
function plain(pr,n,pf){pr.className='pp-price';while(pr.firstChild)pr.removeChild(pr.firstChild);if(pf)pr.appendChild(mk('span','pp-pfx',pf));pr.appendChild(d.createTextNode(won(n)))}
function evPrice(pr,ev){var f=mk('span','pp-evf'),sv=mk('s','',won(ev.normal)),sm=mk('span','pp-evs',won(ev.coupon));
 pr.className='pp-price pp-ev';while(pr.firstChild)pr.removeChild(pr.firstChild);
 f.appendChild(sv);f.appendChild(d.createTextNode(' → '+ev.label+' '+won(ev.coupon)+(ev.until?' ('+ev.until+')':'')));sm.setAttribute('aria-hidden','true');
 if(ev.badge)pr.appendChild(mk('span','pp-evb',ev.badge));pr.appendChild(f);pr.appendChild(sm);R.classList.add('pp-event')}
/* 행사 끝: 행사 전용 노드 제거 + 가격 칸을 평시가로 + 제목·설명을 평시 값으로(값은 마커에 실려 있다). 한 번만. */
function evOff(ev){if(evDone)return;evDone=1;R.classList.remove('pp-event');
 slice.call(d.querySelectorAll('[data-pp-evnode]')).forEach(function(n){if(n.parentNode)n.parentNode.removeChild(n)});
 if(PR)plain(PR,ev.normal,ev.prefix||'')
 if(ev.title)d.title=ev.title;var m=d.querySelector('meta[name=description]');if(m&&ev.desc)m.setAttribute('content',ev.desc);
 if(M)M.removeAttribute('data-pp-ev');ev2('pp:event',{on:false})}
function evInit(){var ev=M&&EV;if(!ev)return;
 srvNow(function(ms){var now=ms===null?Date.now():ms,left;
  if(evEnded(now,ev.ends))return evOff(ev);
  left=Date.parse(ev.ends)+1000-now;if(left>0&&left<2147483647)setTimeout(function(){evOff(ev)},left)})}

/* 구매 버튼. 도착지는 마커의 data-pp-dest 한 곳: "naver"(기본) = 네이버 64GB 상품 주소로 새 창(target=_blank rel="noopener noreferrer"), "cafe24" = 기존 동작(product_submit 또는 구매 영역으로 스크롤).
   위 제품 줄 버튼·하단 고정 버튼·[data-pp-cta] 링크 전부 같은 도착지를 쓴다. 가격: naver 면 마커의 data-pp-naver-price(없으면 칸 자체를 안 그림), cafe24 면 #ec-product-price-info 의 ec-data-price.
   위 얇은 제품 줄(기본, 알약 버튼) 또는 하단 고정 버튼 — 마커의 data-pp-buy-ui="top|bottom" 한 줄로 전환. */
function buy(){if(!M)return;
 var top=(M.getAttribute('data-pp-buy-ui')||'top')=='top',nv=M.getAttribute('data-pp-dest')=='naver',W,P=d.getElementById('ec-product-price-info'),pr,pfx,nu='';
 var u0=M.getAttribute('data-pp-naver-url')||'',tg=pj(M,'data-pp-naver-tags'),kw=pj(M,'data-pp-naver-kw');
 function nuf(k){var t={},x;for(x in tg)t[x]=tg[x];t.nt_keyword=k;return tagUrl(u0,t)}
 if(nv){nv=!!u0;if(nv)nu=nuf(top?(kw.top||'top'):(kw.bottom||'bottom'))}
 B=d.createElement('a');B.className=top?'pp-pill':'pp-buy';B.href=nv?nu:'#';
 if(nv){B.target='_blank';B.rel='noopener noreferrer'}else B.setAttribute('role','button');
 L=d.createElement('span');L.appendChild(d.createTextNode(''));B.appendChild(L);
 P=nv?parseInt(M.getAttribute('data-pp-naver-price'),10):parseInt(P&&P.getAttribute('ec-data-price'),10);
 if(P>0){pr=d.createElement('span');pr.className='pp-price';pfx=nv?M.getAttribute('data-pp-price-prefix')||'':'';plain(pr,P,pfx);PR=pr;
  EV=nv?pj(M,'data-pp-ev'):null;if(EV&&!(EV.coupon>0&&EV.normal>0&&EV.ends))EV=null;if(EV)evPrice(pr,EV)}
 if(top){W=d.createElement('div');W.className='pp-nav';var nm=d.createElement('span');nm.className='pp-nm';nm.appendChild(d.createTextNode(M.getAttribute('data-pp-name')||''));
  W.appendChild(nm);if(pr)W.appendChild(pr);W.appendChild(B);R.classList.add('pp-ui-top');
  var sl=function(){W.classList[w.scrollY>8?'add':'remove']('pp-solid')};w.addEventListener('scroll',sl,{passive:true});sl()}
 else{if(pr)B.appendChild(pr);W=B}
 B.addEventListener('click',function(e){
  if(nv){try{emit('pp_buy_click',null,A,'naver')}catch(x){}return}
  e.preventDefault();try{emit('pp_buy_click',null,A);
  if(M.getAttribute('data-pp-buy-mode')=='submit'&&typeof w.product_submit=='function'){w.product_submit(1,'/exec/front/order/basket/',B);return}
  go(d.querySelector('.xans-product-action')||d.getElementById('fixedActionButton'))
 }catch(x){w.console&&console.warn('pp_v43',x&&x.message)}});
 R.appendChild(W);setAct(1);
 slice.call(d.querySelectorAll('[data-pp-cta]')).forEach(function(a){
  if(nv){var sc=a.closest&&a.closest('[data-pp-scene]'),id=sc?sc.getAttribute('data-pp-scene'):'';a.href=nuf(a.classList.contains('pp-btn')?(kw.end||'cta_end'):(kw.link||'cta_{scene}').replace('{scene}',id));a.target='_blank';a.rel='noopener noreferrer';a.addEventListener('click',function(){try{emit('pp_buy_click',null,A,'naver')}catch(x){}})}
  else a.addEventListener('click',function(e){e.preventDefault();B.click()})})}

/* 소리 켜기: 기본 무음. 누른 뒤에만 pp:sound 이벤트(오디오 파일은 아직 없음 — 리스너를 붙일 자리). */
function sound(){var b=d.querySelector('[data-pp-sound]');if(!b)return;
 b.addEventListener('click',function(){var on=b.getAttribute('aria-pressed')!='true';b.setAttribute('aria-pressed',on);
  b.setAttribute('aria-label',on?'소리 끄기':'소리 켜기');ev2('pp:sound',{on:on})})}

/* S1: 스크롤 -> 프레임(이웃 프레임 크로스페이드). 첫 프레임이 포스터, 나머지는 load 뒤 idle 에 단계 로드. */
function s1(el){
 var N=+el.getAttribute('data-pp-frames')||1,base=el.getAttribute('data-pp-base'),ext=el.getAttribute('data-pp-ext')||'.webp',
  p0=el.querySelector('img'),An=el.parentNode.querySelectorAll('[data-pp-ang]'),Ln=el.parentNode.querySelector('[data-pp-line]'),aa=-1,
  cv=d.createElement('canvas'),cx=cv.getContext&&cv.getContext('2d'),Fr=[p0],ck='',lp=0,q=2,C=w.navigator.connection;
 if(!cx||!base||!p0)return;
 cv.width=+el.getAttribute('data-pp-w')||720;cv.height=+el.getAttribute('data-pp-h')||720;cv.setAttribute('aria-hidden','true');el.appendChild(cv);
 function lab(p){var k=0,m;for(m=0;m<An.length;m++)if(p>=Math.min(+An[m].getAttribute('data-pp-ang')/360,.97))k=m;
  if(k!=aa){aa=k;for(m=0;m<An.length;m++)An[m].classList[m==k?'add':'remove']('pp-act')}if(Ln)Ln.style.transform='scaleX('+p+')'}
 function draw(p){lp=p;lab(p);var f=Math.max(0,Math.min(N-1,p*(N-1))),j=Math.floor(f),t=f-j,a=j,b=Fr[j+1]&&Fr[j+1].naturalWidth&&t>.04?j+1:0,key;
  while(a>0&&!Fr[a])a--;if(!Fr[a]||!Fr[a].naturalWidth)return;
  key=a+':'+(b?Math.round(t*10):0);if(key===ck)return;ck=key;
  cx.globalAlpha=1;cx.drawImage(Fr[a],0,0,cv.width,cv.height);
  if(b){cx.globalAlpha=t;cx.drawImage(Fr[b],0,0,cv.width,cv.height);cx.globalAlpha=1}
  el.classList.add('pp-ready')}
 function nx(){if(q>N)return;var k=q++,im=new Image();
  im.onload=function(){Fr[k-1]=im;ck='';draw(lp);idle(nx)};im.onerror=function(){idle(nx)};im.src=base+('00'+k).slice(-3)+ext}
 function start(){idle(nx);idle(nx);idle(nx)}
 if(!(C&&C.saveData))d.readyState=='complete'?start():w.addEventListener('load',start);
 F1=draw;lab(0);if(p0.complete)draw(0);else p0.addEventListener('load',function(){draw(lp)})}


var SL={};
function pj(el,k){try{return JSON.parse(el.getAttribute(k)||'{}')||{}}catch(x){return{}}}
function slot(el){
 var nm=el.getAttribute('data-pp-slot'),st=(el.getAttribute('data-pp-states')||'').split(','),cu=pj(el,'data-pp-cuts'),cl=pj(el,'data-pp-clips'),
  fi=el.querySelector('img'),sq=(el.getAttribute('data-pp-seq')||'').split(',').filter(Boolean),
  rest=st.indexOf(el.getAttribute('data-pp-rest')||''),Ly=[],cur=-1,pvL=null,tk=0,vis=false,pre=false,go1=0,wn={},ct,k,im,own,c,L;
 function els(L){return L.vd?[L.im,L.vd]:[L.im]}
 function cls(L,n,on){els(L).forEach(function(e){e.classList[on?'add':'remove'](n)})}
 function warn(t){w.console&&console.warn('pp_v43 '+nm+'/'+t)}
 for(k=0;k<st.length;k++)if(cu[st[k]]){
  own=k==0&&fi;im=own?fi:d.createElement('img');
  if(!own){im.alt='';im.setAttribute('aria-hidden','true');im.decoding='async';el.appendChild(im)}
  c=cl[st[k]]||{};L={im:im,src:cu[st[k]],clip:c,ok:null,cb:[],on:0,k:k,vd:null};Ly[k]=L;
  if(c.mp4&&!RM){
   L.vd=d.createElement('video');L.vd.muted=true;L.vd.defaultMuted=true;L.vd.setAttribute('muted','');L.vd.playsInline=true;L.vd.setAttribute('playsinline','');
   L.vd.loop=true;L.vd.setAttribute('loop','');L.vd.preload='none';L.vd.poster=c.poster||L.src;L.vd.setAttribute('aria-hidden','true');L.vd.tabIndex=-1;
   [['mp4','video/mp4'],['webm','video/webm']].forEach(function(t){if(c[t[0]]){var so=d.createElement('source');so.src=c[t[0]];so.type=t[1];L.vd.appendChild(so)}});
   (function(L){
    L.vd.addEventListener('playing',function(){L.vd.classList.add('pp-play')});
    L.vd.addEventListener('error',function(){warn(st[L.k]+': 영상을 못 읽음 - '+(L.clip.webp?'움직이는 WebP':'정지 컷')+' 사용');
     if(L.vd.parentNode)L.vd.parentNode.removeChild(L.vd);L.vd=null;if(vis&&Ly[cur]===L)play(L)},true)})(L);
   el.insertBefore(L.vd,im.nextSibling)}}
 if(fi&&Ly[0])cur=0;
 function ensure(i,cb){var L=Ly[i];
  if(L.ok!==null)return cb(L.ok);
  L.cb.push(cb);if(L.cb.length>1)return;
  function fin(v){L.ok=v;var q=L.cb.splice(0),m;for(m=0;m<q.length;m++)q[m](v)}
  L.im.onload=function(){fin(true)};L.im.onerror=function(){fin(false)};
  if(L.im.getAttribute('src')){if(L.im.complete)fin(L.im.naturalWidth>0)}else L.im.src=L.src}
 function pick(j,cb){if(j<0)return cb(-1);if(!Ly[j])return pick(j-1,cb);ensure(j,function(ok){ok?cb(j):pick(j-1,cb)})}
 function play(L){var p;if(RM)return;
  if(L.vd){p=L.vd.play();if(p&&p.catch)p.catch(function(){if(L.vd)L.vd.classList.remove('pp-play')});return}
  if(!L.clip.webp)return;
  L.im.onerror=function(){L.im.onerror=null;L.clip={};L.im.src=L.src;warn(st[L.k]+': 클립을 못 읽음 - 정지 컷 유지')};
  if(L.on){L.im.src=L.src;w.requestAnimationFrame(function(){if(L.clip.webp)L.im.src=L.clip.webp})}else{L.on=1;L.im.src=L.clip.webp}}
 function pause(L){if(L.vd)L.vd.pause()}
 function retire(L){cls(L,'pp-prev',0);if(L.vd)L.vd.classList.remove('pp-play')}
 function apply(k,j){var N=j>=0?Ly[j]:null,O=cur>=0?Ly[cur]:null,lack=j!==k;
  if(lack&&!wn[k]){wn[k]=1;warn(st[k]+': 컷 없음 - '+(j>=0?'이전 컷('+st[j]+') 유지':'비어 있음'))}
  el.setAttribute('data-pp-cur',st[k]);el.setAttribute('data-pp-shown',j>=0?st[j]:'');
  if(j===cur)return;
  if(pvL&&pvL!==O)retire(pvL);
  if(O){cls(O,'pp-cur',0);cls(O,'pp-prev',1);pvL=O;pause(O)}
  if(N){cls(N,'pp-prev',0);cls(N,'pp-cur',1);if(vis)play(N)}
  cur=j;clearTimeout(ct);ct=setTimeout(function(){if(pvL){retire(pvL);pvL=null}},320)}
 function show(k){k=k<0?0:k>=st.length?st.length-1:k;var t=++tk;pick(k,function(j){if(t===tk)apply(k,j)})}
 function preload(){if(pre)return;pre=true;for(var m=0;m<st.length;m++)if(Ly[m])ensure(m,function(){})}
 function run(){if(!sq.length||RM||go1)return;go1=1;var i=0,e;
  (function nx(){e=sq[i].split(':');show(st.indexOf(e[0]));if(+e[1]>0&&++i<sq.length)setTimeout(nx,+e[1])})()}
 function enter(){vis=true;preload();if(cur>=0)play(Ly[cur]);run()}
 function leave(){vis=false;if(cur>=0)pause(Ly[cur])}
 SL[nm]={show:show};
 show(RM&&sq.length&&rest>=0?rest:0);
 if(w.IntersectionObserver){
  new w.IntersectionObserver(function(es,o){if(es[0].isIntersecting){preload();o.disconnect()}},{rootMargin:'400px 0px'}).observe(el);
  new w.IntersectionObserver(function(es){if(es[0].isIntersecting)enter();else leave()},{threshold:.3}).observe(el)
 }else enter()}

/* 영상 프레임 타일: 프레임 이미지(base+번호+확장자)를 캔버스에 시간 순서대로 한 번 그리고 마지막 프레임에서 멈춘다. 정지 이미지는 영상이 뜨기 전·JS 꺼짐·읽기 실패의 폴백.
   화면에 30% 이상 들어오면 시작(프레임이 다 모이거나 2.5초 뒤 첫 프레임이 있으면). 못 읽은 프레임은 직전 프레임으로 이어 간다. 움직임 줄이기: 마지막 프레임만 읽어 정지로 보여 준다. */
function seqclip(el){
 var n=+el.getAttribute('data-pp-count')||0,base=el.getAttribute('data-pp-base')||'',ext=el.getAttribute('data-pp-ext')||'.webp',fps=+el.getAttribute('data-pp-fps')||12,
  W=+el.getAttribute('data-pp-w')||720,H=+el.getAttribute('data-pp-h')||900,cv=el.querySelector('canvas'),cx=cv&&cv.getContext&&cv.getContext('2d'),
  Fr=[],loaded=0,nx=1,act=0,vis=false,started=0,late=0,last=0,tw=0,t0=0;
 if(!cx||!n||!base)return;cv.width=W;cv.height=H;
 function nm(k){return base+('000'+k).slice(-3)+ext}
 function load(k,cb){var im=new Image();im.decoding='async';im.onload=function(){Fr[k]=im;cb()};im.onerror=function(){Fr[k]=0;cb()};im.src=nm(k)}
 function draw(k){var f;while(k>0&&!(Fr[k]&&Fr[k].naturalWidth))k--;if(k<1||k===last)return;f=Fr[k];last=k;cx.drawImage(f,0,0,W,H);el.classList.add('pp-run')}
 function frame(now){var k=Math.min(n,1+Math.floor((now-t0)/1000*fps));draw(k);if(k<n)w.requestAnimationFrame(frame)}
 function go(){if(started)return;started=1;clearTimeout(tw);t0=w.performance.now();w.requestAnimationFrame(frame)}
 function check(){if(started||!vis)return;if(loaded>=n||(late&&Fr[1]))go()}
 function pump(){while(act<6&&nx<=n){act++;load(nx++,function(){act--;loaded++;pump();check()})}}
 if(RM){load(n,function(){draw(n)});return}
 if(el.getAttribute('data-pp-eager')=='1')pump();
 function enter(){vis=true;pump();if(!tw&&!started)tw=setTimeout(function(){late=1;check()},2500);check()}
 if(w.IntersectionObserver){
  new w.IntersectionObserver(function(es,o){if(es[0].isIntersecting){pump();o.disconnect()}},{rootMargin:'400px 0px'}).observe(el);
  new w.IntersectionObserver(function(es,o){if(es[0].isIntersecting){enter();o.disconnect()}},{threshold:.3}).observe(el)
 }else enter()}

/* S2: 클릭휠. 각도 누적 -> 메뉴 이동(+틱) -> 슬롯 상태 번호. 휠은 이미지에 그려진 휠 위의 보이지 않는 히트 영역뿐(그리지 않는다). 메뉴는 JS 없이도 <a href> 목록. */
function wheel(){
 var W=d.querySelector('[data-pp-wheel]'),Mn=d.querySelector('[data-pp-menu]'),SLt=W&&W.parentNode.querySelector('[data-pp-slot]');if(!W||!(Mn||SLt))return;
 /* v4.4.1: 메뉴 글자 목록이 없어도(휠 손맛만) 슬롯 상태 수만큼 선택 줄이 움직인다 */
 var Li=Mn?Mn.querySelectorAll('a'):[],n=Mn?Li.length:(SLt.getAttribute('data-pp-states')||'').split(',').length,sel=0,acc=0,last=0,pid=null,mv=0,ST=Math.PI/6,j;
 d.addEventListener('pointerdown',function(){ev2('pp:armed')},{once:true});
 function show(k){sel=k;for(var m=0;Mn&&m<n;m++){var on=m==k;Li[m].parentNode.classList[on?'add':'remove']('pp-sel');on?Li[m].setAttribute('aria-current','true'):Li[m].removeAttribute('aria-current')}
  if(SL.wheel)SL.wheel.show(k)}
 function mvSel(dir){var k=sel+dir;if(k<0||k>=n)return;show(k);ev2('pp:tick');if(w.navigator.vibrate)try{w.navigator.vibrate(10)}catch(x){}}
 function jump(){if(Mn)go(d.getElementById(Li[sel].hash.slice(1)))}
 function ang(e){var r=W.getBoundingClientRect();return Math.atan2((e.clientY-r.top-r.height/2)/r.height,(e.clientX-r.left-r.width/2)/r.width)}
 W.addEventListener('pointerdown',function(e){if(pid!==null)return;pid=e.pointerId;last=ang(e);mv=0;try{W.setPointerCapture(pid)}catch(x){}W.classList.add('pp-down')});
 W.addEventListener('pointermove',function(e){if(e.pointerId!==pid)return;var a=ang(e),da=a-last;
  if(da>Math.PI)da-=2*Math.PI;if(da<-Math.PI)da+=2*Math.PI;last=a;acc+=da;mv+=Math.abs(da);
  while(acc>ST){mvSel(1);acc-=ST}while(acc<-ST){mvSel(-1);acc+=ST}});
 function up(e){if(e.pointerId!==pid)return;pid=null;acc=0;W.classList.remove('pp-down');
  if(e.type=='pointerup'&&mv<.12){var r=W.getBoundingClientRect(),dx=(e.clientX-r.left-r.width/2)/r.width,dy=(e.clientY-r.top-r.height/2)/r.height;
   if(Math.sqrt(dx*dx+dy*dy)<.19)jump()}}
 W.addEventListener('pointerup',up);W.addEventListener('pointercancel',up);
 W.addEventListener('keydown',function(e){var k=e.key;
  if(k=='ArrowDown'||k=='ArrowRight'){e.preventDefault();mvSel(1)}
  else if(k=='ArrowUp'||k=='ArrowLeft'){e.preventDefault();mvSel(-1)}
  else if(k=='Enter'||k==' '){e.preventDefault();jump()}});
 for(j=0;Mn&&j<n;j++)(function(k){Li[k].addEventListener('click',function(e){e.preventDefault();show(k);jump()})})(j);
 show(0)}

/* 제목 글자: 줄 단위 마스크 리빌. data-pp-split="load"(처음 한 번) | "focus"(스크롤에 묶여 지금 읽는 줄만 밝게) | "rev"(스크롤 리빌만). SplitText 가 없으면 건드리지 않는다. */
function split(el){var m=el.getAttribute('data-pp-split');if(!SP||!m)return;
 SP.create(el,{type:'lines',mask:'lines',autoSplit:true,onSplit:function(s){var L2=s.lines,tl;
  if(m=='load')return G.from(L2,{yPercent:110,duration:.9,stagger:.1,ease:'power3.out',delay:.15});
  tl=G.timeline({scrollTrigger:{trigger:el,start:'top 92%',end:'bottom 22%',scrub:true}});
  tl.from(L2,{yPercent:110,duration:.5,stagger:.12,ease:'power3.out'},0);
  if(m=='focus')L2.forEach(function(l,k){var at=.2+k*.7;tl.fromTo(l,{opacity:.28},{opacity:1,duration:.35,ease:'none'},at).to(l,{opacity:.28,duration:.35,ease:'none'},at+1.1)});
  return tl}})}

/* GSAP: 장면마다 문서 순서대로 ScrollTrigger 를 만든다(pin 은 S1 한 곳, 모바일도 짧게). */
function boot(){
 G.registerPlugin(T);if(SP)G.registerPlugin(SP);T.config({ignoreMobileResize:true});
 var bar=d.createElement('div');bar.className='pp-bar';bar.setAttribute('aria-hidden','true');R.appendChild(bar);
 T.create({start:0,end:'max',onUpdate:function(){var r=R.getBoundingClientRect(),p=-r.top/Math.max(1,r.height-w.innerHeight);p=p<0?0:p>1?1:p;
  bar.style.transform='scaleX('+p+')';bar.style.opacity=p>0&&p<1?'1':'0'}});
 G.matchMedia().add({dk:'(min-width:769px)',mb:'(max-width:768px)',rm:'(prefers-reduced-motion: reduce)'},function(c){
  var k=c.conditions,u;
  if(!k.rm)R.classList.add('pp-js');
  for(u=0;u<S.length;u++)(function(s){
   var kd=s.getAttribute('data-pp-kind'),rs=s.querySelectorAll('[data-pp-r]'),
    ev=function(t){if(t.isActive)hit(s)},st={trigger:s,start:'top 75%',end:'bottom 25%',onToggle:ev},tl,tw={p:0};
   if(k.rm){T.create(st);return}
   slice.call(s.querySelectorAll('[data-pp-split]')).forEach(split);
   if(kd=='s1'){
    var sk=s.querySelector('[data-pp-sticky]')||s;
    T.create({trigger:sk,start:'top top',end:'bottom bottom',scrub:.5,onUpdate:function(t){F1&&F1(t.progress)},onToggle:ev})
   }else{
    if(rs.length)G.from(rs,{opacity:0,y:12,duration:.35,stagger:.06,ease:'power1.out',scrollTrigger:st});else T.create(st)
   }
  })(S[u]);
  return function(){R.classList.remove('pp-js')}
 });
 function rf(){clearTimeout(rf.t);rf.t=setTimeout(function(){if(busy)return rf();T.refresh()},busy?600:120)}
 slice.call(R.querySelectorAll('img')).forEach(function(im){if(!im.complete)im.addEventListener('load',rf)});
 w.addEventListener('load',function(){rf();idle(function(){slice.call(R.querySelectorAll('img[loading=lazy]')).forEach(function(im){im.loading='eager';if(!im.complete)im.addEventListener('load',rf)})})})}


function clamp(v,a,b){return v<a?a:v>b?b:v}
function smooth(a,b,v){var t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t)}
function qa(s,r){return slice.call((r||d).querySelectorAll(s))}
function isStatic(){return R.classList.contains('pp-static')||!R.classList.contains('pp-js')}

/* ── 소리: 영상팀 릴 오디오에서 자른 딸깍·휠 틱 한 개씩(assets/audio, 각 1.5KB). 기본 꺼짐(작은 토글 한 줄) · 켜져 있어도 첫 터치 뒤에만 재생(iOS 잠금 해제는 사용자 터치 안에서) · 딸깍은 페이지당 한 번.
   진동 navigator.vibrate 는 iOS 사파리에서 지원되지 않는다 — 있을 때만 쓰고 화면 반응(글자·선)만으로 충분하게 만들었다. 재생 기록은 w.PPSound.log(테스트용). ── */
var SNDON=R.getAttribute('data-pp-snd')==='1',AU=null,armed=0,BUF={},SLOG=[],jackDone=0,lastTick=0,ABASE=R.getAttribute('data-pp-audio')||'';
function sLog(e){SLOG.push([Math.round(w.performance.now()),e])}
function loadBuf(n){if(BUF[n]!==undefined||!AU||!ABASE||!w.fetch)return;BUF[n]=null;
 var a=d.createElement('audio'),ext=(a.canPlayType&&a.canPlayType('audio/mpeg'))?'mp3':'m4a';
 w.fetch(ABASE+n+'.'+ext,{credentials:'omit'}).then(function(r){return r.arrayBuffer()}).then(function(b){return new Promise(function(ok,no){AU.decodeAudioData(b,ok,no)})}).then(function(x){BUF[n]=x;sLog('decoded:'+n+'.'+ext)},function(){BUF[n]=false;sLog('decode-fail:'+n)})}
function unlockAudio(){if(armed)return;armed=1;sLog('first-touch');if(!SNDON||AU)return;openAudio()}
function openAudio(){try{var C=w.AudioContext||w.webkitAudioContext;if(!C)return;AU=AU||new C();if(AU.state==='suspended')AU.resume();var b=AU.createBuffer(1,1,22050),sr=AU.createBufferSource();sr.buffer=b;sr.connect(AU.destination);sr.start(0);loadBuf('jack_click');loadBuf('wheel_tick');sLog('ctx:'+AU.state)}catch(x){AU=null}}
function play(n){if(!SNDON||!armed||!AU)return false;var b=BUF[n];
 if(!b){loadBuf(n);sLog('skip(not-ready):'+n);return false}
 try{var s=AU.createBufferSource(),g=AU.createGain();s.buffer=b;g.gain.value=n==='jack_click'?.9:.6;s.connect(g);g.connect(AU.destination);s.start(0);sLog('play:'+n);return true}catch(x){return false}}
function vib(ms){if(typeof w.navigator.vibrate==='function')try{w.navigator.vibrate(ms)}catch(x){}}
function tick(){var t=w.performance.now();ev2('pp:tick',{});if(t-lastTick<55)return;lastTick=t;vib(10);play('wheel_tick')}
function clickOnce(){ev2('pp:plug',{});vib(10);if(!jackDone&&SNDON&&armed){if(play('jack_click'))jackDone=1}}
w.PPTick=tick;
w.PPSound={log:SLOG,state:function(){return{on:SNDON,armed:armed,ctx:AU?AU.state:'none',bufs:Object.keys(BUF).filter(function(k){return BUF[k]}),jackDone:jackDone}}};
['touchend','pointerdown','click','keydown'].forEach(function(e){d.addEventListener(e,unlockAudio,{once:true,capture:true,passive:true})});
function sndToggle(){if(!ABASE)return;var b=d.createElement('button');b.type='button';b.className='pp-sndtog';b.setAttribute('aria-pressed',SNDON?'true':'false');b.textContent=SNDON?'소리 끄기':'소리 켜기';
 b.addEventListener('click',function(){SNDON=!SNDON;b.setAttribute('aria-pressed',SNDON?'true':'false');b.textContent=SNDON?'소리 끄기':'소리 켜기';armed=1;if(SNDON){openAudio();ev2('pp:sound',{on:true})}else ev2('pp:sound',{on:false})});(d.querySelector('#pp-jack .pp-st')||R).appendChild(b)}

function near(el,f){if(!w.IntersectionObserver){f();return}
 new w.IntersectionObserver(function(es,o){if(es[0].isIntersecting){o.disconnect();f()}},{rootMargin:'700px 0px'}).observe(el)}

/* ── 정면 선명컷 장면(ft): 본체 통째(세로 폰: 폭 94% 한도·글자 자리 120, 가로 화면: 높이 80%·최대 760, 오른쪽 58%) — 화면 크기 규칙. 확대는 가장 큰 크기로 깔고 transform 으로 줄이는 방식이라 끝 상태는 transform 없이 또렷하다. ── */
var BODY=function(){var M=w.IPS_MEASURE;return M?{bw:M.body.w/M.photo.w,bh:M.body.h/M.photo.h,cx:M.body.cx/M.photo.w,cy:M.body.cy/M.photo.h}:{bw:.4466,bh:.74,cx:.5,cy:.4809}};
function ftGeom(st,o){var vw=st.clientWidth,vh=st.clientHeight,B=BODY(),land=vw/vh>1.1,ts=o.ts||120,t=o.title==='t',bwp,bh,cx,cy,P,y0,y1;
 if(land){bh=Math.min((vh-44)*.8,760);bwp=bh*B.bw/B.bh;cx=vw*(o.long?.58:.5);cy=44+(vh-44)/2}
 else if(vw>500){bh=Math.min((vh-44)*.62,760);bwp=bh*B.bw/B.bh;cx=vw/2;y0=44+(t?ts:0);y1=vh-(t?0:ts);cy=(y0+y1)/2}   /* 태블릿 세로: 높이 = (화면 높이−44)의 62%·최대 760(화면 크기 규칙) */
 else{bwp=Math.min(vw*.94,(vh-44-ts-24)*B.bw/B.bh);bh=bwp*B.bh/B.bw;cx=vw/2;y0=44+(t?ts:0);y1=vh-(t?0:ts);cy=(y0+y1)/2}
 P=bwp/B.bw;return{vw:vw,vh:vh,land:land,B:B,P:P,bw:bwp,bh:bh,cx:cx,cy:cy,ts:ts}}
function FtScene(st){var s=this;s.st=st;s.ph=st.querySelector('.ft-ph');s.ti=st.querySelector('.pp-ft-title');s.hint=st.querySelector('.pp-ft-hint');s.o={title:st.getAttribute('data-ft-title')||'b',ts:+st.getAttribute('data-ft-ts')||120,zoom:+st.getAttribute('data-ft-zoom')||1,long:st.getAttribute('data-ft-long')==='1',fit:st.getAttribute('data-ft-fit')||''};s.p=0;s.g=null;s.sel=-1;s.menu=null;s.rows=[];
 s.menu=st.querySelector('.ips-menu');if(s.menu)s.rows=qa('li',s.menu)}
FtScene.prototype.layout=function(){var s=this,st=s.st;if(isStatic()){[s.ph,s.ti,s.hint].forEach(function(e){if(e){e.style.cssText=''}});return}
 var g=ftGeom(st,s.o),z=(g.land||g.vw>500)?1:s.o.zoom,P=g.P;s.g=g;s.z=z;
 s.ph.style.width=s.ph.style.height=P+'px';s.ph.style.left=(g.cx-P*g.B.cx)+'px';s.ph.style.top=(g.cy-P*g.B.cy)+'px';
 s.ph.style.transformOrigin=(P*g.B.cx)+'px '+(P*g.B.cy)+'px';
 if(s.ti){if(g.land){s.ti.style.left='56px';s.ti.style.right='auto';s.ti.style.width=Math.max(160,g.cx-g.bw/2-64-56)+'px';s.ti.style.top='50%';s.ti.style.transform='translateY(-50%)'}
  else{s.ti.style.width='';s.ti.style.right='';s.ti.style.left='0';s.ti.style.transform='';s.ti.style.top=(s.o.title==='t'?(44+14):(g.cy+g.bh/2+14))+'px'}}
 if(s.hint){s.hint.style.top=(g.land?'auto':(s.o.title==='t'?(g.cy+g.bh/2+4):(g.cy+g.bh/2+14+(s.ti?s.ti.offsetHeight:0)+6))+'px');if(g.land){s.hint.style.bottom='14px';s.hint.style.left='auto';s.hint.style.right=(g.vw-g.cx-g.bw/2)+'px';s.hint.style.width=g.bw+'px'}else{s.hint.style.bottom='';s.hint.style.right='';s.hint.style.left='0';s.hint.style.width=''}}
 s.progress(s.p,1)};
FtScene.prototype.progress=function(p,force){var s=this;s.p=p;if(!s.g||isStatic())return;
 if(s.z>1){var k=smooth(.05,.6,p),sc=1+(s.z-1)*k;s.ph.style.transform=(k<=.0005)?'none':'scale('+sc.toFixed(4)+')';
  if(s.ti)s.ti.style.opacity=(1-smooth(.18,.4,p)).toFixed(3)}
 var f=s.fx;if(f)f(s,p,force)};
var FTS=[];
function ftInit(){qa('.pp-ft[data-pp-ft]').forEach(function(st){var s=new FtScene(st),kind=st.getAttribute('data-pp-ft');st._ft=s;FTS.push(s);
  if(kind==='wheel')ftWheel(s);if(kind==='snd')ftHold(s);
  s.layout();if(w.ResizeObserver)new w.ResizeObserver(function(){s.layout()}).observe(st)});
 var rt;w.addEventListener('resize',function(){clearTimeout(rt);rt=setTimeout(function(){FTS.forEach(function(s){s.layout()})},80)});
 d.addEventListener('pp:tier',function(){FTS.forEach(function(s){s.layout()})})}
/* 메뉴: 6줄이 정확히 한 화면(줄 높이 = 화면 안 목록 ÷ 6), 반 줄 잘림 없음 */
function ftSelect(s,k,quiet){k=clamp(k,0,s.rows.length-1);if(k===s.sel)return;s.sel=k;s.rows.forEach(function(li,i){li.classList.toggle('ips-sel',i===k);li.setAttribute('aria-current',i===k?'true':'false')});if(!quiet&&s.ready)tick()}
function ftWheel(s){var wh=s.st.querySelector('.ips-wheel'),btn=s.st.querySelector('.ips-btn-center'),acc=0,last=0,pid=null,N=s.rows.length;
 s.fx=function(s2,p){var k=Math.floor(clamp((p-.1)/.8,0,.999)*N);s2.ready=1;if(!s2.drag)ftSelect(s2,k)};
 ftSelect(s,0,1);
 if(!wh)return;
 function ang(e){var r=wh.getBoundingClientRect();return Math.atan2(e.clientY-r.top-r.height/2,e.clientX-r.left-r.width/2)}
 wh.addEventListener('pointerdown',function(e){if(pid!==null)return;if(e.target.closest&&e.target.closest('.ips-btn-center'))return;pid=e.pointerId;last=ang(e);acc=0;s.drag=1;s.ready=1;try{wh.setPointerCapture(pid)}catch(x){}e.preventDefault()});
 wh.addEventListener('pointermove',function(e){if(e.pointerId!==pid)return;var a=ang(e),da=a-last;if(da>Math.PI)da-=2*Math.PI;if(da<-Math.PI)da+=2*Math.PI;last=a;acc+=da;
  while(acc>Math.PI/6){ftSelect(s,s.sel+1);acc-=Math.PI/6}while(acc<-Math.PI/6){ftSelect(s,s.sel-1);acc+=Math.PI/6}});
 function up(e){if(e.pointerId!==pid)return;pid=null;acc=0;setTimeout(function(){s.drag=0},600)}
 wh.addEventListener('pointerup',up);wh.addEventListener('pointercancel',up);
 wh.addEventListener('keydown',function(e){if(e.key==='ArrowDown'||e.key==='ArrowRight'){e.preventDefault();s.drag=1;ftSelect(s,s.sel+1)}else if(e.key==='ArrowUp'||e.key==='ArrowLeft'){e.preventDefault();s.drag=1;ftSelect(s,s.sel-1)}});
 if(btn)btn.addEventListener('click',function(){tick()})}
/* 1-7: 길게 누르면 메뉴 → 재생 화면(화면 안 내용 교체), 다시 길게 누르면 메뉴 */
function ftHold(s){var ph=s.ph,t=0,fired=0,hint=s.hint;ftSelect(s,0,1);s.fx=function(){};
 function set(on){s.st.classList.toggle('ft-play',on);ph.setAttribute('aria-pressed',on?'true':'false');if(hint)hint.textContent=on?'다시 길게 누르면 메뉴':'길게 눌러 보세요';tick()}
 ph.addEventListener('pointerdown',function(e){if(e.pointerType==='mouse'&&e.button!==0)return;fired=0;clearTimeout(t);t=setTimeout(function(){fired=1;set(!s.st.classList.contains('ft-play'))},380)});
 ['pointerup','pointercancel','pointerleave'].forEach(function(n){ph.addEventListener(n,function(){clearTimeout(t)})});
 ph.addEventListener('keydown',function(e){if((e.key===' '||e.key==='Enter')&&!e.repeat){e.preventDefault();set(!s.st.classList.contains('ft-play'))}});
 ph.addEventListener('contextmenu',function(e){e.preventDefault()})}

/* ── 진행도 → 장면 효과(엔진이 스크롤 감기를 하고, 진행도를 el._ppp 로 알려 준다) ── */
function popJack(sc){sc.classList.remove('pp-pop');void sc.offsetWidth;sc.classList.add('pp-pop');clearTimeout(sc._pt);sc._pt=setTimeout(function(){sc.classList.remove('pp-pop')},320);clickOnce()}
var FX={
 /* 1-0 훅: 한 단어씩(그 단어의 구간이 오면 이전 단어는 위로 사라지고 새 단어가 올라온다) */
 hero:function(el,p){var sc=el.closest('[data-pp-sticky]'),ws=sc&&sc.querySelector('[data-pp-words]');if(!ws)return;
  var sp=ws._sp||(ws._sp=ws.getAttribute('data-pp-words').split(';').map(function(x){var a=x.split(',');return[+a[0],+a[1]]})),c=ws.children,i,st,key='',last=c.length-1;
  for(i=0;i<c.length;i++){st=p<sp[i][0]?0:(p<sp[i][1]||i===last)?1:2;key+=st}
  var st0=sc.querySelector('.pp-st');if(st0)st0.classList.toggle('pp-late',p>.55);
  if(ws._k===key)return;ws._k=key;for(i=0;i<c.length;i++){st=+key.charAt(i);c[i].className='pp-wd'+(st===1?' pp-on':st===2?' pp-off':'')}},
 /* 1-0b 잭: 스크롤로 꽂힘 → 딸깍(글자 + 충격선 + 소리 한 번) → 제목이 작게 내려가고, 0.75~1 에서 '선을 꽂아야…' 줄 단위 */
 jack:function(el,p){var sc=el.closest('.pp-jackst');if(!sc)return;var PJ=+el.getAttribute('data-pp-plugat')||.58,pl=p>=PJ,t2=p>=.75,ls=sc._ls||(sc._ls=qa('.pp-jt2 span',sc)),i;
  if(sc._pl===undefined){sc._pl=false;sc._t2=false}
  if(pl!==sc._pl){sc._pl=pl;sc.classList.toggle('pp-plugged',pl);if(pl)popJack(sc);else sc.classList.remove('pp-pop')}
  if(t2!==sc._t2){sc._t2=t2;sc.classList.toggle('pp-t2',t2)}
  for(i=0;i<ls.length;i++){var on=p>=.76+.085*i;if(ls[i]._on!==on){ls[i]._on=on;ls[i].classList.toggle('pp-on',on)}}},
 /* 1-1 기억: 글자 한 자씩 */
 mem:function(el,p){var sc=el.closest('[data-pp-sticky]'),cs=sc&&(sc._ch||(sc._ch=qa('.pp-ch',sc)));if(!cs||!cs.length)return;
  var n=cs.length,i,on;for(i=0;i<n;i++){on=p>=.06+.5*i/n;if(cs[i]._on!==on){cs[i]._on=on;cs[i].classList.toggle('pp-on',on)}}},
 /* 1-2 등장·1-5 휠·1-7 소리: ft 장면 진행도 */
 ft:function(el,p){var s=(el.closest('.pp-ft')||el)._ft;if(s)s.progress(p)},
 /* 1-3 360: 앞은 화면(0~.3) · 옆은 두께(.4~.6) · 뒤는 거울(.9~1) */
 g360:function(el,p){var sc=el.closest('[data-pp-sticky]'),ls=sc&&(sc._gl||(sc._gl=qa('.pp-g360lab li',sc))),i,r,on;if(!ls)return;
  for(i=0;i<ls.length;i++){r=ls[i].getAttribute('data-r').split(',');on=p>=+r[0]&&p<=+r[1];if(ls[i]._on!==on){ls[i]._on=on;ls[i].classList.toggle('pp-on',on)}}},
 /* 1-8 낭만: 줄이 하나씩, 정면 컷 약한 확대, 곡 수 0 → 약 N(올라간 뒤에만 '약') */
 rom:function(el,p){var sc=el.closest('[data-pp-sticky]');if(!sc)return;var ls=sc._rl||(sc._rl=qa('.pp-rl',sc)),th=[.06,.2,.34],i,on;
  for(i=0;i<ls.length;i++){on=p>=th[i];if(ls[i]._on!==on){ls[i]._on=on;ls[i].classList.toggle('pp-on',on)}}
  sc.style.setProperty('--zs',(1+.07*smooth(0,1,p)).toFixed(4));
  var sg=sc._sg===undefined?(sc._sg=sc.querySelector('[data-pp-songs]')):sc._sg;
  if(sg){var v=+sg.getAttribute('data-pp-songs')||0,t=smooth(.38,.82,p);sg.textContent=(t>=1?'약 ':'')+Math.round(v*t).toLocaleString('ko-KR')+(sg.getAttribute('data-pp-unit')||'')}},
 /* 2-10 비교: 페퍼클럽 칸이 위에서부터 한 줄씩(진행도 .15~.85, 6단계) 켜지고 끝나면 유지 */
 cmp:function(el,p){var sc=el.closest('[data-pp-sticky]');if(!sc)return;var rs=sc._cr||(sc._cr=qa('tbody tr',sc)),i,on;
  for(i=0;i<rs.length;i++){on=p>=.15+.14*i;if(rs[i]._on!==on){rs[i]._on=on;rs[i].classList.toggle('pp-lit',on)}}},
 /* 2-9 패키지: 단계 점 4개가 차례로, 끝에서 제목이 바뀌고 구매 버튼이 나온다 */
 pkg:function(el,p){var sc=el.closest('[data-pp-sticky]');if(!sc)return;var ds=sc._dt||(sc._dt=qa('.pp-dots4 li',sc)),i,on,end=p>=.9,tt=sc.querySelector('.pp-tt'),bt=sc.querySelector('.pp-pkgbtn');
  for(i=0;i<ds.length;i++){on=p>=.04+.24*i;if(ds[i]._on!==on){ds[i]._on=on;ds[i].classList.toggle('pp-on',on)}}
  if(tt&&tt._e!==end){tt._e=end;tt.classList.toggle('pp-end',end)}if(bt&&bt._e!==end){bt._e=end;bt.classList.toggle('pp-on',end)}},
 /* 1-9 넘어가기: 큰 글자가 줄 단위로 걷히고, 끝은 상자 PEPPER CLUB·뒷판 쪽으로 확대 + '페퍼클럽에서.' */
 t9:function(el,p){var sc=el.closest('[data-pp-sticky]');if(!sc)return;var ls=sc._ln||(sc._ln=qa('.pp-t9t span',sc)),en=sc.querySelector('.pp-t9e'),i,out;
  for(i=0;i<ls.length;i++){out=p>=.5+.07*i;if(ls[i]._o!==out){ls[i]._o=out;ls[i].classList.toggle('pp-out',out)}}
  if(en){var on=p>=.78;if(en._on!==on){en._on=on;en.classList.toggle('pp-on',on)}}
  sc.style.setProperty('--z',(1+.5*smooth(.5,.95,p)).toFixed(4))}
};
function fxInit(){qa('[data-pp-seq][data-pp-fx]').forEach(function(el){var f=FX[el.getAttribute('data-pp-fx')];if(!f)return;el._ppp=function(p){f(el,p)};f(el,0)});
 /* 영상이 없는 장면([data-pp-scroll])은 엔진이 진행도를 안 주므로 같은 sticky 구간의 진행도를 직접 받는다(효과 꺼짐·GSAP 없음이면 정지 상태 그대로) */
 qa('[data-pp-scroll][data-pp-fx]').forEach(function(el){var f=FX[el.getAttribute('data-pp-fx')],sk=el.closest('[data-pp-sticky]');
  if(!f||!sk||RM||!G||!T)return;
  try{G.registerPlugin(T);f(el,0);T.create({trigger:sk,start:'top top',end:'bottom bottom',scrub:true,onUpdate:function(t){if(!R.classList.contains('pp-static'))f(el,t.progress)}})}catch(x){}})}

/* ── 1-3 끌어 돌리기: 가로 드래그 = 스크롤 위치(= 360 프레임 진행도)를 옮긴다(스크롤과 같은 매핑). 놓으면 관성 → 앞·옆·뒤 멈춤 자리 근처면 그 자리로. 세로 제스처는 그대로 스크롤. ── */
function rotate(el){var sk=el.closest('[data-pp-sticky]');if(!sk)return;var drag=0,x0=0,vx=0,lx=0,lt=0,raf=0,STOPS=[0,.5,1];
 function inRange(){var r=sk.getBoundingClientRect();return r.top<=2&&r.bottom>=w.innerHeight-2}
 function travel(){return Math.max(1,sk.offsetHeight-w.innerHeight)}
 function prog(){return clamp(-sk.getBoundingClientRect().top/travel(),0,1)}
 function K(){return travel()/Math.max(260,Math.min(w.innerWidth,720)*1.7)}
 function snap(){if(!inRange())return;var p=prog(),b=-1,bd=.05,i;for(i=0;i<STOPS.length;i++)if(Math.abs(STOPS[i]-p)<bd){bd=Math.abs(STOPS[i]-p);b=i}
  if(b>=0&&bd>.004)w.scrollBy({top:(STOPS[b]-p)*travel(),behavior:RM?'auto':'smooth'})}
 function glide(){var v=clamp(vx*K(),-34,34);(function f(){if(Math.abs(v)<.15||!inRange()){snap();return}w.scrollBy(0,v);v*=.93;raf=requestAnimationFrame(f)})()}
 el.addEventListener('pointerdown',function(e){if(e.pointerType==='mouse'&&e.button!==0)return;cancelAnimationFrame(raf);drag=1;x0=lx=e.clientX;vx=0;lt=w.performance.now();el.classList.add('pp-grab');try{el.setPointerCapture(e.pointerId)}catch(x){}});
 el.addEventListener('pointermove',function(e){if(!drag||!inRange())return;var dx=e.clientX-lx,t=w.performance.now(),dt=Math.max(8,t-lt);
  vx=.8*vx+.2*(-dx/dt*16);lx=e.clientX;lt=t;w.scrollBy(0,-dx*K())});
 function up(){if(!drag)return;drag=0;el.classList.remove('pp-grab');if(Math.abs(vx)>.5)glide();else snap()}
 el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up)}

/* ── 1-4 폰 기울이기: 보이는 '기울여 보기' 버튼을 눌렀을 때만 권한을 요청한다(iOS 의 DeviceOrientationEvent.requestPermission 은 사용자 터치 안에서만 열린다 — 첫 터치 자동 요청 안 함).
   거절·미지원·신호 없음이면 손가락 따라 보는 각도 이동으로. 이미지는 이동·확대(시차)만 — 합성·가짜 반사 없음. ── */
function tilt(st){var par=st.querySelector('.pp-parin'),hint=st.querySelector('.pp-mir-hint'),btn=st.querySelector('.pp-tilt-btn'),ox=0,oy=0,mode='',got=0,drag=0,x0=0,y0=0,bx=0,by=0,asked=0;if(!par)return;
 function apply(x,y){ox=clamp(x,-1,1);oy=clamp(y,-1,1);par.style.setProperty('--tx',(-ox*3.6).toFixed(2)+'%');par.style.setProperty('--ty',(-oy*2.2).toFixed(2)+'%')}
 function setHint(t){if(hint)hint.textContent=t}
 function onOri(e){if(e.gamma===null||e.gamma===undefined)return;got=1;mode='tilt';apply(clamp(e.gamma/24,-1,1),clamp((e.beta-50)/30,-1,1));setHint('폰을 기울이는 대로 반사가 움직입니다');if(btn)btn.hidden=true}
 function listen(){w.addEventListener('deviceorientation',onOri);setTimeout(function(){if(!got){setHint('손가락으로 밀어 보세요');if(btn)btn.hidden=false;asked=0}},1800)}
 function ask(){if(asked)return;asked=1;var D=w.DeviceOrientationEvent;
  if(D&&typeof D.requestPermission==='function'){try{D.requestPermission().then(function(r){if(r==='granted')listen();else{setHint('손가락으로 밀어 보세요');if(btn)btn.hidden=true}},function(){setHint('손가락으로 밀어 보세요');asked=0})}catch(x){setHint('손가락으로 밀어 보세요')}}
  else if(D)listen();else setHint('손가락으로 밀어 보세요')}
 var can=!!w.DeviceOrientationEvent&&(w.matchMedia&&w.matchMedia('(pointer:coarse)').matches||'ontouchstart' in w);
 if(btn){if(can){btn.hidden=false;btn.addEventListener('click',function(e){e.preventDefault();ask()})}else btn.hidden=true}
 setHint(can?'‘기울여 보기’를 누르거나 손가락으로 밀어 보세요':'손가락으로 밀어 보세요');
 st.addEventListener('pointerdown',function(e){if(e.target.closest&&e.target.closest('.pp-tilt-btn'))return;drag=1;x0=e.clientX;y0=e.clientY;bx=ox;by=oy;try{st.setPointerCapture(e.pointerId)}catch(x){}});
 st.addEventListener('pointermove',function(e){if(!drag||mode==='tilt')return;apply(bx+(e.clientX-x0)/Math.max(160,st.clientWidth*.5),by)});
 function up(){drag=0}st.addEventListener('pointerup',up);st.addEventListener('pointercancel',up)}

/* 글자 한 자씩(1-1): 단어는 안 끊기게 단어 span 안에 글자 span. 원문은 aria-label 로 한 번에 읽힌다. */
function charify(el){var t=el.textContent,out=d.createDocumentFragment(),ws=t.split(' '),i,j,w1,s;el.setAttribute('aria-label',t);el.textContent='';
 for(i=0;i<ws.length;i++){w1=d.createElement('span');w1.className='pp-cw';w1.setAttribute('aria-hidden','true');
  for(j=0;j<ws[i].length;j++){s=d.createElement('span');s.className='pp-ch';s.textContent=ws[i].charAt(j);w1.appendChild(s)}
  out.appendChild(w1);if(i<ws.length-1)out.appendChild(d.createTextNode(' '))}
 el.appendChild(out)}

function v44init(){
 qa('[data-pp-chars]').forEach(charify);
 ftInit();
 fxInit();
 qa('[data-pp-rotate]').forEach(rotate);
 qa('.pp-mir-st').forEach(tilt);
 sndToggle()}

try{
 buy();evInit();slice.call(d.querySelectorAll('[data-pp-slot]')).forEach(slot);wheel();sound();v44init();
 if(G&&T&&G.matchMedia){
  boot();FTS.forEach(function(f){f.layout()})
 }else if(w.IntersectionObserver){
  var O=new w.IntersectionObserver(function(es){for(var j=0;j<es.length;j++)if(es[j].isIntersecting)hit(es[j].target)},{threshold:.2});
  for(i=0;i<S.length;i++)O.observe(S[i])
 }else for(i=0;i<S.length;i++)S[i].className+=' pp-in'
}catch(e){
 R.classList.remove('pp-js');w.console&&console.warn('pp_v43',e&&e.message);
 try{if(T)T.getAll().forEach(function(t){t.kill()});if(SP&&SP.revert)slice.call(d.querySelectorAll('[data-pp-split]')).forEach(function(x){var s=SP.get&&SP.get(x);s&&s.revert&&s.revert()});if(G)G.set(R.querySelectorAll('[data-pp-r],.pp-ln'),{clearProps:'all'})}catch(x){}
}
})();
