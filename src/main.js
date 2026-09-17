import * as THREE from 'three';
import './style.css';
import { CASE, COMMUNITY_NOISE } from './case-data.js';

const root = document.querySelector('#game');
root.innerHTML = `
  <div id="stage"></div>
  <div id="hud">
    <div class="hint">Q : 컴퓨터 보기<br>E : 사무실 보기<br>SPACE : 대화 넘기기</div>
    <div class="clock"><span id="dateText">1999. 11. 14</span><br><span id="timeText">22:37</span></div>
    <div id="status" class="status"></div>
    <div id="subtitle" class="subtitle"></div>
  </div>
  <div id="start">
    <div class="start-inner">
      <div class="title">LAST LOGIN</div>
      <div class="tag">CASE 01 — 새벽 1시 47분</div>
      <button class="start-btn" id="startBtn">사무소 문을 연다</button>
      <div class="warning">헤드폰 권장 · Q/E로 시점 전환 · 진행 상황 자동 저장</div>
    </div>
  </div>
  <div id="computer">
    <div class="crt-shell">
      <div class="crt-screen glitch">
        <div class="desktop" id="desktop">
          <div class="icons" id="icons"></div>
          <div class="taskbar">
            <button class="startmenu">▣ 시작</button>
            <div class="task-items" id="taskItems"></div>
            <div class="tray" id="trayClock">오후 10:37</div>
          </div>
          <div id="boot" class="boot"></div>
        </div>
      </div>
    </div>
    <div class="computer-tip">E : 컴퓨터에서 시선 떼기</div>
  </div>
  <div class="grain"></div><div class="scan"></div><div class="vignette"></div>
  <div id="ending" class="ending"><div class="ending-inner"><h2>CASE CLOSED?</h2><p id="endingText"></p><div class="small">LAST LOGIN / CASE 01<br>저장된 기록은 브라우저에 남습니다.</div></div></div>
`;

const $ = (s) => document.querySelector(s);
const stage = $('#stage');
const start = $('#start');
const subtitle = $('#subtitle');
const statusEl = $('#status');
const computer = $('#computer');
const desktop = $('#desktop');
const icons = $('#icons');
const taskItems = $('#taskItems');
const boot = $('#boot');
const ending = $('#ending');

const STORAGE = 'last-login-case01-v3';
let state = loadState();
let mode = 'office';
let started = false;
let introIndex = -1;
let introTimer = null;
let bootedThisSession = false;
let zCounter = 120;

function defaultState(){
  return {
    discovered: [...CASE.initial],
    read: [],
    searches: [],
    notes: '',
    reportSolved: false,
    bootSeen: false
  };
}
function loadState(){
  try { return { ...defaultState(), ...JSON.parse(localStorage.getItem(STORAGE) || '{}') }; }
  catch { return defaultState(); }
}
function save(){ localStorage.setItem(STORAGE, JSON.stringify(state)); }
function toast(t){ statusEl.textContent=t; statusEl.classList.add('show'); clearTimeout(toast.t); toast.t=setTimeout(()=>statusEl.classList.remove('show'),1800); }

// ---------- THREE.JS OFFICE ----------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050707);
scene.fog = new THREE.FogExp2(0x050707, 0.075);
const camera = new THREE.PerspectiveCamera(56, innerWidth/innerHeight, .1, 50);
camera.position.set(0, 1.55, 5.5);
const renderer = new THREE.WebGLRenderer({ antialias:false, powerPreference:'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.35));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
stage.appendChild(renderer.domElement);

const ambient = new THREE.HemisphereLight(0x627078, 0x18130f, .25); scene.add(ambient);
const lamp = new THREE.PointLight(0xffd49a, 2.1, 7, 2); lamp.position.set(-2.2,2.15,1.4); lamp.castShadow=true; scene.add(lamp);
const fluorescent = new THREE.RectAreaLight(0xbad8d9, 1.25, 2.8, .18); fluorescent.position.set(.2,2.75,.25); fluorescent.rotation.x=-Math.PI/2; scene.add(fluorescent);

const mat = (c, r=.9) => new THREE.MeshStandardMaterial({ color:c, roughness:r, metalness:.03 });
const wallMat = mat(0x252723,1), floorMat=mat(0x1b1916,1), wood=mat(0x2b1c15,1), metal=mat(0x2b2c29,.7);
function box(name, size, pos, material, rot=[0,0,0]){
  const g=new THREE.BoxGeometry(...size), m=new THREE.Mesh(g,material); m.name=name; m.position.set(...pos); m.rotation.set(...rot); m.castShadow=m.receiveShadow=true; scene.add(m); return m;
}
box('floor',[9,.15,8],[0,-.08,0],floorMat);
box('backWall',[9,3.4,.18],[0,1.62,-2.15],wallMat);
box('leftWall',[.18,3.4,8],[-4.4,1.62,1.7],wallMat);
box('rightWall',[.18,3.4,8],[4.4,1.62,1.7],wallMat);
box('ceiling',[9,.12,8],[0,3.28,1.5],mat(0x181917));

// window and rainy alley
box('windowFrame',[2.55,1.78,.08],[-2.7,1.9,-2.03],metal);
const glass=new THREE.Mesh(new THREE.PlaneGeometry(2.28,1.5),new THREE.MeshPhysicalMaterial({color:0x17262b,transparent:true,opacity:.42,roughness:.2,transmission:.1}));
glass.position.set(-2.7,1.9,-1.98); scene.add(glass);
for(let i=0;i<3;i++) box('bar',[.055,1.52,.07],[-3.27+i*.58,1.9,-1.92],metal);
const alleyGlow=new THREE.PointLight(0x993326,2.8,5,2); alleyGlow.position.set(-2.4,1.3,-3.4); scene.add(alleyGlow);

// desk + clutter
box('desk',[4.4,.16,1.4],[.55,.72,.72],wood);
box('deskL',[.18,1.45,1.2],[-1.45,.0,.75],wood); box('deskR',[.18,1.45,1.2],[2.55,.0,.75],wood);
for(let i=0;i<10;i++) box('paper',[.55,.012,.36],[-1.15+i*.09,.82,.45+i*.015],mat(i%2?0x8c8878:0xaaa38e),[0,(i-5)*.03,0]);
box('ashtray',[.48,.06,.34],[1.9,.84,.35],metal);
const mug=box('mug',[.32,.42,.32],[-.75,1.02,.42],mat(0x80755e)); mug.rotation.z=.02;

// CRT monitor
box('monitor',[1.85,1.38,.75],[.75,1.48,.12],mat(0x4b4a42,.95));
const screenMesh=new THREE.Mesh(new THREE.PlaneGeometry(1.48,1.02),new THREE.MeshStandardMaterial({color:0x073c38,emissive:0x06352f,emissiveIntensity:.55,roughness:.4}));
screenMesh.position.set(.75,1.5,.505); scene.add(screenMesh);
box('keyboard',[1.45,.08,.42],[.75,.87,.8],mat(0x4b4a42),[-.12,0,0]);

// filing cabinets / cork board
for(let i=0;i<3;i++) box('cabinet',[.86,1.75,.75],[3.45-i*.9,.87,-1.68],mat(0x333630));
const board=box('cork',[2.5,1.25,.06],[1.25,2.25,-2.01],mat(0x5a3a27));
for(let i=0;i<8;i++) box('note',[.3+.12*(i%2),.22+.05*(i%3),.012],[.35+(i%4)*.55,2.0+Math.floor(i/4)*.42,-1.965],mat(i%3===0?0x9c9270:0x625c50),[0,0,(i-4)*.04]);

// door
box('door',[1.25,2.55,.12],[-3.52,1.28,-2.01],mat(0x201915));

// client: intentionally anonymous black silhouette
const client = new THREE.Group();
const silhouetteMat = new THREE.MeshStandardMaterial({color:0x050505,roughness:1});
const torso=new THREE.Mesh(new THREE.CapsuleGeometry(.32,.9,4,8),silhouetteMat); torso.position.y=1.0; client.add(torso);
const head=new THREE.Mesh(new THREE.SphereGeometry(.24,10,8),silhouetteMat); head.position.y=1.75; client.add(head);
const coat=new THREE.Mesh(new THREE.ConeGeometry(.58,1.55,8,1,true),silhouetteMat); coat.position.y=.75; client.add(coat);
client.position.set(-3.45,0,-1.78); client.rotation.y=.25; scene.add(client);

// rain particles outside
const rainCount=900, rainPositions=new Float32Array(rainCount*3);
for(let i=0;i<rainCount;i++){ rainPositions[i*3]=-4+Math.random()*3; rainPositions[i*3+1]=Math.random()*4; rainPositions[i*3+2]=-2.5-Math.random()*3; }
const rainGeo=new THREE.BufferGeometry(); rainGeo.setAttribute('position',new THREE.BufferAttribute(rainPositions,3));
const rain=new THREE.Points(rainGeo,new THREE.PointsMaterial({color:0x9bb7c5,size:.018,transparent:true,opacity:.65})); scene.add(rain);

const officeCam={pos:new THREE.Vector3(0,1.55,5.5),look:new THREE.Vector3(-.1,1.35,.0)};
const pcCam={pos:new THREE.Vector3(.74,1.54,2.2),look:new THREE.Vector3(.74,1.48,.15)};
let camFrom=officeCam, camTo=officeCam, camT=1;
const mouse={x:0,y:0};
addEventListener('mousemove',e=>{mouse.x=(e.clientX/innerWidth-.5)*2;mouse.y=(e.clientY/innerHeight-.5)*2});
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});

function switchMode(next){
  if(!started || mode===next) return;
  mode=next; camT=0; camFrom=next==='computer'?officeCam:pcCam; camTo=next==='computer'?pcCam:officeCam;
  if(next==='computer') setTimeout(()=>{computer.classList.add('on'); firstBoot();},430);
  else computer.classList.remove('on');
}

// ---------- AUDIO ----------
let audioCtx, master, rainNode, humOsc;
function startAudio(){
  if(audioCtx) return;
  audioCtx=new (window.AudioContext||window.webkitAudioContext)(); master=audioCtx.createGain();master.gain.value=.16;master.connect(audioCtx.destination);
  humOsc=audioCtx.createOscillator(); const hg=audioCtx.createGain(); humOsc.type='sine';humOsc.frequency.value=58;hg.gain.value=.035;humOsc.connect(hg).connect(master);humOsc.start();
  const seconds=2, buffer=audioCtx.createBuffer(1,audioCtx.sampleRate*seconds,audioCtx.sampleRate), data=buffer.getChannelData(0);
  for(let i=0;i<data.length;i++) data[i]=(Math.random()*2-1)*.23;
  rainNode=audioCtx.createBufferSource(); rainNode.buffer=buffer;rainNode.loop=true;const filter=audioCtx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=2800;const rg=audioCtx.createGain();rg.gain.value=.28;rainNode.connect(filter).connect(rg).connect(master);rainNode.start();
}
function clickSound(freq=520,d=.035){ if(!audioCtx)return; const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type='square';o.frequency.value=freq;g.gain.setValueAtTime(.025,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.0001,audioCtx.currentTime+d);o.connect(g).connect(master);o.start();o.stop(audioCtx.currentTime+d); }

// ---------- INTRO ----------
$('#startBtn').addEventListener('click',()=>{
  startAudio(); started=true; start.classList.add('fade'); setTimeout(()=>start.remove(),900);
  introIndex=-1; nextIntro();
});
function nextIntro(){
  clearTimeout(introTimer);
  introIndex++;
  if(introIndex>=CASE.intro.length){ subtitle.classList.remove('show'); toast('의뢰가 등록되었습니다. Q를 눌러 컴퓨터를 확인하십시오.'); return; }
  if(introIndex===0) client.userData.walkStart=performance.now();
  subtitle.innerHTML=`<b>의뢰인</b>　${CASE.intro[introIndex]}`; subtitle.classList.add('show');
  introTimer=setTimeout(nextIntro,3200);
}
addEventListener('keydown',e=>{
  if(e.repeat)return;
  if(e.code==='Space' && started && introIndex<CASE.intro.length){e.preventDefault();nextIntro();}
  if(e.key.toLowerCase()==='q') switchMode('computer');
  if(e.key.toLowerCase()==='e') switchMode('office');
});

// ---------- FAUX DESKTOP ----------
const apps=[
  ['db','사건 DB','▤'],['board','어둠의 게시판','◎'],['archive','복구 자료','▣'],['evidence','증거 자료함','◇'],['memo','메모장','▧'],['report','사건 보고서','✎']
];
icons.innerHTML=apps.map(([id,name,ico])=>`<div class="desktop-icon" data-app="${id}"><div class="ico">${ico}</div><span>${name}</span></div>`).join('');
icons.addEventListener('dblclick',e=>{const el=e.target.closest('[data-app]');if(el)openApp(el.dataset.app)});

function makeWindow(id,title,bodyClass=''){
  const w=document.createElement('section'); w.className='window';w.dataset.app=id;w.innerHTML=`
  <div class="titlebar"><span>${title}</span><span class="controls"><button class="winbtn" data-min="1">_</button><button class="winbtn" data-close="1">×</button></span></div>
  <div class="toolbar"><button class="toolbtn" data-home="1">⌂ 처음</button><div class="address">C:\\NIRIS\\${id.toUpperCase()}\\</div></div>
  <div class="winbody ${bodyClass}"></div>`;desktop.appendChild(w);
  const bar=w.querySelector('.titlebar'); let drag=null;
  bar.addEventListener('mousedown',ev=>{focusWindow(w); const r=w.getBoundingClientRect();drag={x:ev.clientX-r.left,y:ev.clientY-r.top};w.style.transform='none';});
  addEventListener('mousemove',ev=>{if(!drag)return;w.style.left=Math.max(0,Math.min(innerWidth-200,ev.clientX-drag.x))+'px';w.style.top=Math.max(0,Math.min(innerHeight-100,ev.clientY-drag.y))+'px'});
  addEventListener('mouseup',()=>drag=null);
  w.querySelector('[data-close]').onclick=()=>closeApp(id);w.querySelector('[data-min]').onclick=()=>closeApp(id);w.querySelector('[data-home]').onclick=()=>renderApp(id);
  w.addEventListener('mousedown',()=>focusWindow(w)); return w;
}
apps.forEach(([id,name])=>makeWindow(id,name,id==='board'?'board':id==='archive'?'archive':id==='memo'?'memo':''));

function openApp(id){clickSound();const w=document.querySelector(`.window[data-app="${id}"]`);w.classList.add('open');focusWindow(w);renderApp(id);renderTasks()}
function closeApp(id){document.querySelector(`.window[data-app="${id}"]`).classList.remove('open');renderTasks()}
function focusWindow(w){zCounter++;document.querySelectorAll('.window').forEach(x=>x.classList.remove('active'));w.classList.add('active');w.style.zIndex=zCounter}
function renderTasks(){taskItems.innerHTML=[...document.querySelectorAll('.window.open')].map(w=>`<button class="task-item" data-task="${w.dataset.app}">${apps.find(a=>a[0]===w.dataset.app)?.[1]||w.dataset.app}</button>`).join('');taskItems.querySelectorAll('button').forEach(b=>b.onclick=()=>focusWindow(document.querySelector(`.window[data-app="${b.dataset.task}"]`)))}

function firstBoot(){
  if(bootedThisSession){return}
  bootedThisSession=true;boot.classList.remove('hide');
  const lines=['SAMIL BIOS v1.7','Memory test ........ 32768 KB OK','IDE-0 .............. SAMSUNG 2.1GB','Checking file system...','NIRIS Detective Workstation','Restoring previous session...','Connection: LOCAL/56K','',`CASE ${CASE.id.toUpperCase()} LOADED`];
  boot.textContent='';let i=0;const timer=setInterval(()=>{boot.textContent+=lines[i++]+'\n';clickSound(330,.02);if(i>=lines.length){clearInterval(timer);setTimeout(()=>boot.classList.add('hide'),550);state.bootSeen=true;save();}},130);
}

function normalize(s){return s.toLowerCase().replace(/[\s\-_.:]/g,'')}
function searchRecords(q){
  const n=normalize(q); if(!n)return [];
  const found=new Set();
  Object.entries(CASE.keywords).forEach(([key,ids])=>{if(n.includes(normalize(key))||normalize(key).includes(n)){ids.forEach(id=>found.add(id))}});
  if(!state.searches.includes(q)){state.searches.push(q);save()}
  let newly=0;found.forEach(id=>{if(!state.discovered.includes(id)){state.discovered.push(id);newly++}});if(newly){save();toast(`새 기록 ${newly}건을 찾았습니다.`)}
  return [...found].map(id=>CASE.records[id]).filter(Boolean);
}
function recordId(record){return Object.keys(CASE.records).find(k=>CASE.records[k]===record)}
function markRead(id){if(!state.read.includes(id)){state.read.push(id);save();toast('증거 자료함에 기록했습니다.')}}
function recordCard(id){const r=CASE.records[id];return `<article class="record-card" data-record="${id}"><h3>${r.title}</h3><div class="meta">${r.date||''} ${r.author?' · '+r.author:''}</div><div>${r.body.split('\n')[0]}</div></article>`}
function openRecord(app,id){const r=CASE.records[id];if(!r)return;markRead(id);const body=document.querySelector(`.window[data-app="${app}"] .winbody`);body.innerHTML=`<article class="record-view"><div class="meta">${r.date||''} ${r.author?' · '+r.author:''}</div><h1>${r.title}</h1><pre>${escapeHtml(r.body)}</pre><span class="stamp">EVIDENCE LOGGED</span></article>`}
function escapeHtml(s){return s.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}
function bindRecordClicks(app){document.querySelectorAll(`.window[data-app="${app}"] [data-record]`).forEach(el=>el.onclick=()=>openRecord(app,el.dataset.record))}

function renderApp(id){
  const body=document.querySelector(`.window[data-app="${id}"] .winbody`);
  if(id==='db'){
    const initial=state.discovered.filter(x=>CASE.records[x]?.app==='db');
    body.innerHTML=`<div class="searchbar"><input id="dbSearch" placeholder="인물, 장소, 시간, 문서번호 검색"><button id="dbGo">검색</button></div><div class="meta">내부 사건·시설 기록. 정확한 단어가 더 많은 결과를 엽니다.</div><hr><div class="results">${initial.map(recordCard).join('')}</div>`;
    const go=()=>{const q=$('#dbSearch').value;const rs=searchRecords(q).filter(r=>r.app==='db');body.querySelector('.results').innerHTML=rs.length?rs.map(r=>recordCard(recordId(r))).join(''):'<div class="meta">NO RESULTS FOUND.</div>';bindRecordClicks('db')};$('#dbGo').onclick=go;$('#dbSearch').addEventListener('keydown',e=>{if(e.key==='Enter')go()});bindRecordClicks('db');
  }
  if(id==='board'){
    const discovered=state.discovered.filter(x=>CASE.records[x]?.app==='board');
    body.innerHTML=`<div class="searchbar"><input id="boardSearch" placeholder="게시판 검색"><button id="boardGo">검색</button></div><div class="results">${COMMUNITY_NOISE.map((p,i)=>`<article class="record-card noise"><h3>${p.title}</h3><div class="meta">${p.author}</div><div>${p.body}</div></article>`).join('')}${discovered.map(recordCard).join('')}</div>`;
    const go=()=>{const q=$('#boardSearch').value;const rs=searchRecords(q).filter(r=>r.app==='board');body.querySelector('.results').innerHTML=rs.length?rs.map(r=>recordCard(recordId(r))).join(''):'<div class="meta">검색 결과 없음. 글은 지워졌거나 처음부터 없었음.</div>';bindRecordClicks('board')};$('#boardGo').onclick=go;$('#boardSearch').addEventListener('keydown',e=>{if(e.key==='Enter')go()});bindRecordClicks('board');
  }
  if(id==='archive'){
    const discovered=state.discovered.filter(x=>CASE.records[x]?.app==='archive');
    body.innerHTML=`<div class="searchbar"><input id="arcSearch" placeholder="복구 파일명 / 문서번호"><button id="arcGo">복구</button></div><div class="meta">삭제 파일 인덱스 일부만 복구됨. 키워드 또는 번호 필요.</div><hr><div class="results">${discovered.map(recordCard).join('')}</div>`;
    const go=()=>{const q=$('#arcSearch').value;const rs=searchRecords(q).filter(r=>r.app==='archive');body.querySelector('.results').innerHTML=rs.length?rs.map(r=>recordCard(recordId(r))).join(''):'<div class="meta">0개 파일 복구.</div>';bindRecordClicks('archive')};$('#arcGo').onclick=go;$('#arcSearch').addEventListener('keydown',e=>{if(e.key==='Enter')go()});bindRecordClicks('archive');
  }
  if(id==='evidence'){
    const read=state.read.map(k=>[k,CASE.records[k]]).filter(x=>x[1]);
    body.innerHTML=`<h2>증거 자료함</h2><div class="meta">읽은 기록만 등록됩니다. ${read.length}/${Object.keys(CASE.records).length}</div><div class="evidence-list">${read.map(([k,r])=>`<div class="evidence"><strong>${r.title}</strong><span>${r.evidence||'기록됨'}</span><div class="meta">#${k}</div></div>`).join('')||'<div class="meta">아직 기록된 증거가 없습니다.</div>'}</div>`;
  }
  if(id==='memo'){
    body.innerHTML=`<textarea id="memoText" placeholder="검색어, 시간, 이상한 점을 적어두세요...">${escapeHtml(state.notes||'')}</textarea>`;const ta=$('#memoText');ta.addEventListener('input',()=>{state.notes=ta.value;save()});
  }
  if(id==='report') renderReport(body);
}

function renderReport(body){
  const evidenceOptions=state.read.map(id=>`<option value="${id}">${CASE.records[id]?.title||id}</option>`).join('');
  body.classList.add('report');body.innerHTML=`
    <h2>사건 보고서 — 초안</h2><div class="meta">추측이 아니라 기록으로 입증하십시오.</div>
    <label>의심 인물</label><select id="suspect"><option>선택</option><option>윤도경</option><option>한서진</option><option>신원불명 새벽지기</option><option>시설 관리소장</option></select>
    <label>핵심 장소</label><select id="place"><option>선택</option><option>백색문</option><option>산월역</option><option>옥상</option><option>전산실</option></select>
    <label>사건의 핵심</label><select id="event"><option>선택</option><option>전원기록을 수동으로 끊은 뒤 방문자를 지하로 유인했다</option><option>동네 전체 정전 때문에 기록이 사라졌다</option><option>피해자가 스스로 잠적했다</option><option>게시판 이용자가 장난으로 기록을 조작했다</option></select>
    <label>근거 자료 1</label><select id="ev1"><option value="">선택</option>${evidenceOptions}</select>
    <label>근거 자료 2</label><select id="ev2"><option value="">선택</option>${evidenceOptions}</select>
    <label>근거 자료 3</label><select id="ev3"><option value="">선택</option>${evidenceOptions}</select>
    <button class="submit-report" id="submitReport">보고서 제출</button><div id="reportResult"></div>`;
  $('#submitReport').onclick=()=>{
    const suspect=$('#suspect').value,place=$('#place').value,event=$('#event').value,evs=[$('#ev1').value,$('#ev2').value,$('#ev3').value];
    const core=CASE.report.requiredEvidence.filter(x=>evs.includes(x)).length;
    const ok=suspect===CASE.report.suspect&&place===CASE.report.place&&event===CASE.report.event&&core>=3;
    const rr=$('#reportResult');rr.className='report-result';
    if(ok){rr.innerHTML='<b>보고서 승인.</b><br>수집된 기록 간 모순 없음. 사건 파일을 봉인합니다.';state.reportSolved=true;save();setTimeout(showEnding,900)}
    else rr.innerHTML='<b>보고서 반려.</b><br>인물·장소·시간대 또는 증거 연결이 충분하지 않습니다.';
  };
}
function showEnding(){
  computer.classList.remove('on');ending.classList.add('on');$('#endingText').innerHTML=`경찰 기록에는 “가출”로 남았던 밤.<br><br>당신은 <b>01:47의 공백</b>이 우연한 정전이 아니라는 것을 밝혀냈다. 윤도경은 폐쇄 시설의 기록 단말기를 수동으로 끊고, 방문자를 백색문 안쪽으로 들였다.<br><br>그러나 한서진의 행방은 아직 확인되지 않았다.<br><br><i>사건 02에서 계속.</i>`;
}

// ---------- CLOCK / RENDER ----------
let fakeMinutes=22*60+37;
setInterval(()=>{fakeMinutes++; const h=Math.floor(fakeMinutes/60)%24,m=fakeMinutes%60;$('#timeText').textContent=`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;$('#trayClock').textContent=`${h>=12?'오후':'오전'} ${h%12||12}:${String(m).padStart(2,'0')}`},10000);

const lookTemp=new THREE.Vector3();
function animate(t){
  requestAnimationFrame(animate);
  if(client.userData.walkStart){const p=Math.min(1,(t-client.userData.walkStart)/4500);client.position.z=-1.78+2.25*p;client.position.x=-3.45+2.15*p;if(p>=1)client.userData.walkStart=null;}
  const rp=rain.geometry.attributes.position.array;for(let i=0;i<rainCount;i++){rp[i*3+1]-=.055;if(rp[i*3+1]<0)rp[i*3+1]=3.8}rain.geometry.attributes.position.needsUpdate=true;
  lamp.intensity=2.05+Math.sin(t*.004)*.08+(Math.random()<.003?-1.2:0);
  if(camT<1)camT=Math.min(1,camT+.045);
  const smooth=camT*camT*(3-2*camT);camera.position.lerpVectors(camFrom.pos,camTo.pos,smooth);lookTemp.lerpVectors(camFrom.look,camTo.look,smooth);
  if(mode==='office'&&camT>=1){camera.position.x+=mouse.x*.04;camera.position.y+=-mouse.y*.025;lookTemp.x+=mouse.x*.08;lookTemp.y+=-mouse.y*.045}
  camera.lookAt(lookTemp);renderer.render(scene,camera);
}
animate(performance.now());

if(state.reportSolved){toast('이 브라우저에는 이미 해결된 사건 기록이 있습니다.');}
