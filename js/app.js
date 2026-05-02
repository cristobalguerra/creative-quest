// ═══════════════════════════════════════════ DATA — loaded from JSON
let ARCHS = [];
let MISSIONS = [];
let MB_IMAGES = {free:[], premium:[]};
let PALETTES = [];
let SILHOUETTES = {M:[], F:[]};
let CLOTHING = {tops:[], bottoms:[], shoes:[], acc:[]};
let OUTFIT_COLORS = [];
let SPACES = [];
let SPACE_ELEMENTS = [];
let OBJECTS = {tech:[], fashion:[], craft:[], sport:[]};

async function loadData() {
  const [archs, missions, banks, outfit, spaces, objects] = await Promise.all([
    fetch('./data/archetypes.json').then(r => r.json()),
    fetch('./data/missions.json').then(r => r.json()),
    fetch('./data/banks.json').then(r => r.json()),
    fetch('./data/outfit.json').then(r => r.json()),
    fetch('./data/spaces.json').then(r => r.json()),
    fetch('./data/objects.json').then(r => r.json())
  ]);
  ARCHS = archs;
  MISSIONS = missions;
  MB_IMAGES = banks.mbImages;
  PALETTES = banks.palettes;
  SILHOUETTES = outfit.silhouettes;
  CLOTHING = outfit.clothing;
  OUTFIT_COLORS = outfit.outfitColors;
  SPACES = spaces.spaces;
  SPACE_ELEMENTS = spaces.spaceElements;
  OBJECTS = objects;
}

const DATA_READY = loadData();

// ═══════════════════════════════════════════ STATE
const G={
  arch:null,aIdx:0,secs:5400,running:false,
  cred:{v:0,f:0,n:0,t:0},
  mst:[1,0,0,0,0],mActive:0,
  entries:[],penalties:0,
  retoOk:[false,false,false,false,false],
  retoSel:[null,null,null,null,null],
  decSel:[[null,null],[null,null],[null,null],[null,null],[null]],
  decJust:[[null,null],[null,null],[null,null],[null,null],[null]],
  premiumUnlocked:[false,false,false,false,false],
  bankTab:[0,0,0,0,0],
  // M1 state
  mbBoard:[null,null,null,null,null,null],
  m5imgs:[null,null,null,null],
  mbSelected:null,
  selectedPal:null,
  // M2 state
  silGender:'M',
  silBase:'A',
  silTop:null,silBottom:null,silShoes:null,silAcc:null,
  silColor:'#2A3A5C',
  // M3 state
  selectedSpace:null,
  selectedEls:[],
  // M4 state
  selectedObjs:[],
  objCat:'tech',
  // M5 state
  routePick:null,
  storyScenes:['','','',''],
  animType:0,
  // BREAKOUT ROOMS — Firebase
  room:null,
  roomRole:null,
  roomName:null,
  teammates:{},
  _fbUnsub:false,
  _fbListenCode:null,
  _roomMax:6,
  _evalAuthed:false,
  rubric:{d:0,e:0,s:0,t:0,com:0},
  rubricNotes:'',
  // ENTREGABLE / IDENTIDAD
  identity:null,        // {nombre, prepa, estado}
  _submissionId:null,   // slug en Firebase
  _iniciadoTs:null,
  _entregadoTs:null,
  _carreraSugerida:null,
  _carrerasSugeridas:null,
  fraseUniverso:''
};

// ═══════════════════════════════════════════ TIMER
setInterval(()=>{
  if(!G.running)return;
  G.secs=Math.max(0,G.secs-1);
  const m=Math.floor(G.secs/60),s=G.secs%60;
  const el=document.getElementById('timer');
  if(el){el.textContent=m+':'+(s<10?'0':'')+s;el.style.color=G.secs<600?'var(--co-l)':G.secs<1800?'var(--go-l)':'var(--cy-l)';}
  if(G.secs===0){G.running=false;goS('voz');}
},1000);

// ═══════════════════════════════════════════ CREDITS
function gain(obj){Object.keys(obj).forEach(k=>{G.cred[k]=(G.cred[k]||0)+(obj[k]||0);});syncC();}
function spendC(obj){Object.keys(obj).forEach(k=>{G.cred[k]=Math.max(0,(G.cred[k]||0)-(obj[k]||0));});syncC();}
function syncC(){
  const MAX=20; // Increased to accommodate all possible credits
  ['v','f','n','t'].forEach(k=>{
    const v=G.cred[k]||0;
    ['e'+k,'iv'+k].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=v;});
    const b=document.getElementById('eb'+k);
    if(b)b.style.width=Math.min(Math.round(v/MAX*100),100)+'%';
  });
}

// ═══════════════════════════════════════════ TOAST
let toastQ=[];
function showToast(msg,type='t-ok',dur=2800){
  const wrap=document.getElementById('toast-wrap');
  const div=document.createElement('div');
  div.className='toast '+type;
  div.innerHTML=msg;
  wrap.appendChild(div);
  setTimeout(()=>{div.style.opacity='0';div.style.transition='opacity .4s';setTimeout(()=>div.remove(),400);},dur);
}

// ═══════════════════════════════════════════ NAV
function goS(id){
  document.querySelectorAll('.scr').forEach(s=>s.classList.remove('on'));
  document.querySelectorAll('.nb').forEach(b=>b.classList.remove('on'));
  const s=document.getElementById('s-'+id);
  if(s)s.classList.add('on');
  const nb=document.getElementById('nb-'+id);
  if(nb)nb.classList.add('on');
  document.getElementById('content').scrollTop=0;
  if(id==='tablero')renderTab();
  if(id==='inventario')renderInv();
  if(id==='onepager')renderOP();
  // Timer info banner — show when timer is running but user is outside the mission flow
  const timerInfoIds=['inventario','voz','sala'];
  const wrap=document.getElementById('s-'+id);
  if(wrap&&G.running&&timerInfoIds.includes(id)){
    let banner=wrap.querySelector('.timer-info');
    if(!banner){
      banner=document.createElement('div');
      banner.className='timer-info';
      banner.innerHTML='<span style="font-size:14px">⏱</span><span>El reloj sigue corriendo · vuelve a tu misión cuando estés listo</span>';
      wrap.insertBefore(banner, wrap.children[2]||null);
    }
  }
}

function jumpM(idx){
  if(G.mst[idx]===0)return;
  G.mActive=idx;
  G.mst[idx]=Math.max(G.mst[idx],2);
  updateMtrack();
  renderMission(idx);
  goS('mision');
}

function updateMtrack(){
  MISSIONS.forEach((_,i)=>{
    const nd=document.getElementById('mn'+i);
    if(!nd)return;
    nd.className='mn';
    if(G.mst[i]===3)nd.classList.add('done');
    else if(G.mst[i]===2)nd.classList.add('act');
    else if(G.mst[i]===1)nd.classList.add('avail');
    else nd.classList.add('locked');
  });
  const op=document.getElementById('mn5');
  if(op){op.className='mn mn-fin';op.classList.add(G.mst.every(s=>s===3)?'done':'locked');}
}

// ═══════════════════════════════════════════ CHARACTER RENDERER
// Cada arquetipo puede tener un campo `image` en el JSON. Si existe se renderiza
// como <img>. Si no, se muestra un placeholder limpio con código + tag.
// (Sistema previo de SVG drawn + eye-tracking removido — calidad insuficiente.)
function getCharacterMedia(a){
  if(a.image){
    return `<img class="ac-char-img" src="${a.image}" alt="${a.name}" loading="lazy"/>`;
  }
  // Placeholder: marca de espera limpia con código del arquetipo
  return `<div class="ac-char-placeholder" style="--ax:${a.hex}">
    <span class="ac-char-placeholder-code">${a.code||'—'}</span>
    <span class="ac-char-placeholder-lbl">Ilustración<br>en proceso</span>
  </div>`;
}

// ═══════════════════════════════════════════ ARCH SLIDER (editorial)
function buildSlider(){
  const track=document.getElementById('atrack');
  const dots=document.getElementById('sdots');
  track.innerHTML='';
  const tot=String(ARCHS.length).padStart(2,'0');
  dots.innerHTML='<span class="counter-cur">01</span><span class="counter-sep"> / </span><span class="counter-tot">'+tot+'</span>';
  ARCHS.forEach((a,i)=>{
    const slide=document.createElement('div');slide.className='aslide';
    const num=String(i+1).padStart(2,'0');
    slide.innerHTML=`<article class="acard" style="--ax:${a.hex}" data-code="${a.code||''}">
      <header class="ac-tab">
        <span class="ac-num">${num} / ${tot}</span>
        <span class="ac-code">${a.code||''}</span>
        <span class="ac-emoji">${a.icon}</span>
      </header>
      <div class="ac-character">
        <div class="ac-char-stage">${getCharacterMedia(a)}</div>
        <div class="ac-char-meta">
          <span class="ac-char-label">Personaje · ${num} / ${tot}</span>
          <h2 class="ac-name">${a.name}</h2>
          <p class="ac-vibe">${a.sub}</p>
          <p class="ac-tags">${a.tags.map(t=>`<span class="ac-tag">${t}</span>`).join('')}</p>
        </div>
      </div>
      <hr class="ac-rule">
      <section class="ac-meta">
        <span class="ac-label">Créditos base</span>
        <div class="ac-creds">
          <div class="ac-cred"><span class="ac-cred-icon" style="color:var(--pu-l)">◆</span><span class="ac-cred-num">${String(a.cr.v).padStart(2,'0')}</span><span class="ac-cred-lbl">Visión</span></div>
          <div class="ac-cred"><span class="ac-cred-icon" style="color:var(--cy-l)">⬡</span><span class="ac-cred-num">${String(a.cr.f).padStart(2,'0')}</span><span class="ac-cred-lbl">Forma</span></div>
          <div class="ac-cred"><span class="ac-cred-icon" style="color:var(--go-l)">★</span><span class="ac-cred-num">${String(a.cr.n).padStart(2,'0')}</span><span class="ac-cred-lbl">Narrativa</span></div>
          <div class="ac-cred"><span class="ac-cred-icon" style="color:var(--gr-l)">⬟</span><span class="ac-cred-num">${String(a.cr.t).padStart(2,'0')}</span><span class="ac-cred-lbl">Técnica</span></div>
        </div>
      </section>
      <hr class="ac-rule">
      <section class="ac-meta">
        <span class="ac-label">Paleta</span>
        <div class="ac-pal">
          <div class="ac-swatches">${a.pal.map(c=>`<span class="ac-pd" style="background:${c}"></span>`).join('')}</div>
          <span class="ac-pal-txt">${a.palTxt}</span>
        </div>
      </section>
      <button class="ac-toggle" data-arch="${i}" onclick="toggleArchDetails(${i})">
        <span class="ac-toggle-arrow">▸</span>
        <span class="ac-toggle-lbl">Herramientas y orden sugerido</span>
      </button>
      <div class="ac-details" data-arch="${i}">
        <div class="ac-col">
          <div class="ac-col-t">Herramientas</div>
          <ol class="ac-list">${a.tools.map((t,n)=>`<li><span class="ac-list-n">${String(n+1).padStart(2,'0')}</span><span>${t}</span></li>`).join('')}</ol>
        </div>
        <div class="ac-col">
          <div class="ac-col-t">Orden sugerido</div>
          <ol class="ac-list">${a.order.map((o,n)=>`<li><span class="ac-list-n">${String(n+1).padStart(2,'0')}</span><span>${o}</span></li>`).join('')}</ol>
        </div>
      </div>
    </article>`;
    track.appendChild(slide);
  });
}

function toggleArchDetails(i){
  const details=document.querySelector('.ac-details[data-arch="'+i+'"]');
  const toggle=document.querySelector('.ac-toggle[data-arch="'+i+'"]');
  if(!details||!toggle)return;
  const open=details.classList.contains('open');
  details.classList.toggle('open');
  toggle.querySelector('.ac-toggle-arrow').textContent=open?'▸':'▾';
  toggle.querySelector('.ac-toggle-lbl').textContent=open?'Herramientas y orden sugerido':'Ocultar';
}

function aMove(d){aGo(Math.max(0,Math.min(4,G.aIdx+d)));}
function aGo(i){
  G.aIdx=i;
  document.getElementById('atrack').style.transform=`translateX(-${i*100}%)`;
  const cur=document.querySelector('.counter-cur');
  if(cur)cur.textContent=String(i+1).padStart(2,'0');
  document.getElementById('sap').disabled=i===0;
  document.getElementById('san').disabled=i===4;
  // Sincroniza el color del CTA con el arquetipo visible
  const sel=document.getElementById('s-select');
  if(sel&&ARCHS[i])sel.style.setProperty('--ax',ARCHS[i].hex);
}

function confirmArch(){
  // Guard: si ya hay un arquetipo elegido y créditos acumulados, pedir confirmación
  const totalCred=(G.cred.v||0)+(G.cred.f||0)+(G.cred.n||0)+(G.cred.t||0);
  if(G.arch&&totalCred>0){
    const ok=confirm('Ya tenés un personaje elegido y progreso acumulado.\n\nCambiar de arquetipo va a REINICIAR todo: créditos, misiones, decisiones y justificaciones.\n\n¿Querés empezar de cero?');
    if(!ok)return;
  }
  // Full state reset when confirming archetype
  G.arch=ARCHS[G.aIdx];
  G.mst=[1,0,0,0,0];G.running=true;
  G.cred={v:0,f:0,n:0,t:0};
  G.entries=[];G.penalties=0;
  G.retoOk=[false,false,false,false,false];
  G.retoSel=[null,null,null,null,null];
  G.decSel=[[null,null],[null,null],[null,null],[null,null],[null]];
  G.decJust=[[null,null],[null,null],[null,null],[null,null],[null]];
  G.premiumUnlocked=[false,false,false,false,false];
  G.bankTab=[0,0,0,0,0];
  G.mbBoard=[null,null,null,null,null,null];
  G.m5imgs=[null,null,null,null];
  G.selectedPal=null;G.customPal=null;G.palNote='';
  G.selectedSpace=null;G.selectedEls=[];
  G.selectedObjs=[];G.objCat='tech';G.objOther=null;
  G.routePick=null;G.m5preq=null;G.storyScenes=['','','',''];
  G.synthDone=false;G.synthAns=null;
  G.silGender='M';G.silBase='MA';
  G.silTop=null;G.silBottom=null;G.silShoes=null;G.silAcc=null;
  G.silColor='#2A3A5C';
  gain(G.arch.cr);
  const pill=document.getElementById('arch-pill');
  pill.style.display='flex';
  pill.style.setProperty('--ax',G.arch.hex);
  pill.innerHTML=`
    <div class="arch-pill-face">${getCharacterMedia(G.arch)}</div>
    <div class="arch-pill-meta">
      <span class="arch-pill-code">${G.arch.code||''}</span>
      <span class="arch-pill-nm">${G.arch.name}</span>
    </div>`;
  pill.style.borderColor='rgba(255,255,255,.1)';
  updateMtrack();
  setTimeout(broadcastState,300);
  saveSubmission(true);
  goS('tablero');
}

// ═══════════════════════════════════════════ TABLERO
function renderTab(){
  if(!G.arch)return;
  const a=G.arch;
  const mini=document.getElementById('arch-mini');
  if(mini){
    mini.style.borderColor=a.hex+'55';
    mini.innerHTML=`<div class="arch-mini-av" style="background:${a.hex}20;border-color:${a.hex}">${a.icon}</div>
    <div><div class="arch-mini-nm" style="color:${a.hex}">${a.name}</div>
    <div style="display:flex;gap:5px;margin-top:5px">${a.tags.map(t=>`<span class="ac-tag" style="background:${a.hex}20;color:${a.hex};border:.5px solid ${a.hex}44;font-size:11px;padding:2px 9px">${t}</span>`).join('')}</div></div>`;
  }
  const mc=document.getElementById('mcards');if(!mc)return;mc.innerHTML='';

  // Rhythm indicator
  const elapsed=5400-G.secs;
  const mDoneT=G.mst.filter(s=>s===3).length;
  const mLeft=5-mDoneT;
  if(mDoneT>0&&mLeft>0){
    const avgSecs=elapsed/mDoneT;
    const estLeft=Math.round(avgSecs*mLeft/60);
    const secsLeft=Math.round(G.secs/60);
    const ok=estLeft<=secsLeft;
    const rDiv=document.createElement('div');
    rDiv.style.cssText='background:'+(ok?'rgba(31,174,128,.08)':'rgba(200,64,48,.08)')+';border:.5px solid '+(ok?'rgba(31,174,128,.25)':'rgba(200,64,48,.3)')+';border-radius:9px;padding:9px 14px;margin-bottom:12px;font-size:12px;display:flex;align-items:center;gap:10px';
    rDiv.innerHTML='<span style="font-size:18px">'+(ok?'🟢':'🟡')+'</span><span style="color:var(--wh)">A este ritmo terminarás en <strong>~'+estLeft+' min</strong>. Te quedan <strong>'+mLeft+' misión'+(mLeft!==1?'es':'')+'</strong> y <strong>'+secsLeft+' min</strong>.</span>';
    mc.appendChild(rDiv);
  }

  // Synthesis challenge
  if(mDoneT>=3&&!G.synthDone){
    const syn=document.createElement('div');
    syn.style.cssText='background:rgba(212,150,10,.08);border:1px solid rgba(212,150,10,.35);border-radius:10px;padding:14px;margin-bottom:14px';
    syn.innerHTML='<div style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--go-l);font-weight:700;font-family:var(--fh);margin-bottom:6px">⭐ Reto de síntesis — opcional · +◆ +★</div>'+
      '<div style="font-size:14px;color:var(--wh);margin-bottom:10px;line-height:1.55">Tu look y tu espacio comparten un elemento visual o conceptual. ¿Cuál es y por qué no es casualidad?</div>'+
      '<textarea class="fi" placeholder="Conecta lo que ya creaste — busca el hilo invisible..." rows="3" style="margin-bottom:10px" oninput="G.synthAns=this.value">'+(G.synthAns||'')+'</textarea>'+
      '<button class="btn btn-g" style="width:auto;padding:0 20px;font-size:13px" onclick="completeSynth()">Enviar — ganar ◆ +★</button>';
    mc.appendChild(syn);
  } else if(G.synthDone){
    const syn=document.createElement('div');
    syn.style.cssText='background:rgba(212,150,10,.06);border:.5px solid rgba(212,150,10,.2);border-radius:9px;padding:10px 14px;margin-bottom:12px;font-size:13px;color:var(--go-l)';
    syn.textContent='✓ Reto de síntesis completado — +◆ +★';
    mc.appendChild(syn);
  }
  MISSIONS.forEach((m,i)=>{
    const st=G.mst[i];
    const card=document.createElement('div');
    card.className='mcard'+(st===0?' mlk':'');
    card.style.borderColor=st===3?m.ch:st>=1?m.ch+'66':'rgba(255,255,255,.07)';
    card.style.background=st===3?m.ch+'0D':st===2?m.ch+'07':'var(--bg2)';
    const bdg=st===3?'✓ listo':st===2?'en progreso':st===1?'disponible':'bloqueado';
    const bdgC=st>=1?m.ch:'#505070';
    card.innerHTML=`<div class="mbadge" style="background:${bdgC}22;color:${bdgC}">${bdg}</div>
      <div class="mnum" style="color:${st===0?'var(--mu)':m.ch}">${i+1}</div>
      <div class="mname">${m.name}</div>
      <div class="mbrief">${m.brief.split('.')[0]}.</div>
      <div class="mchips">
        ${m.cr.v?`<span class="mchip" style="background:var(--pu-x);color:var(--pu-l)">◆${m.cr.v}</span>`:''}
        ${m.cr.f?`<span class="mchip" style="background:var(--cy-x);color:var(--cy-l)">⬡${m.cr.f}</span>`:''}
        ${m.cr.n?`<span class="mchip" style="background:var(--go-x);color:var(--go-l)">★${m.cr.n}</span>`:''}
        ${m.cr.t?`<span class="mchip" style="background:var(--gr-x);color:var(--gr-l)">⬟${m.cr.t}</span>`:''}
        <span class="mchip" style="background:rgba(255,255,255,.05);color:var(--gh)">${m.time}min</span>
      </div>
      ${st===2?`<div class="mprog"><div class="mpf" style="background:${m.ch};width:35%"></div></div>`:''}`;
    if(st>=1)card.onclick=()=>jumpM(i);
    mc.appendChild(card);
  });
}

// ═══════════════════════════════════════════ RENDER MISSION
function renderMission(idx){
  const m=MISSIONS[idx];
  const a=G.arch||ARCHS[0];
  const rOk=G.retoOk[idx];
  const d0=G.decSel[idx][0];
  const d1=G.decSel[idx][1];
  const nd=m.decs.length;
  const step=!rOk?0:d0===null?1:(nd>1&&d1===null)?2:3;
  const lls=['Entiende el reto','Decide','Crea','Exporta'];
  let html=`<div class="m-hdr">
    <div class="m-num" style="color:${m.ch}">Misión ${idx+1}</div>
    <div class="m-ttl">— ${m.name}</div>
    <div class="m-time">${m.time} min</div>
  </div>
  <div class="brief-box">
    <div class="brief-lbl">¿Qué estás construyendo?</div>
    <div class="brief-txt">${m.brief}</div>
  </div>
  <div class="loop-row">
    ${lls.map((l,i)=>`<div class="lstep${i<step?' done':i===step?' cur':''}"><span class="ls-n">0${i+1}</span>${l}</div>`).join('')}
  </div>`;

  // RETO
  if(!rOk){
    html+=`<div class="reto-box" style="background:${m.ch}0C;border:.5px solid ${m.ch}44">
      <div class="reto-lbl" style="color:${m.ch}">Reto de apertura — elige y argumenta tu postura</div>
      <div class="reto-hint">💡 Cualquier respuesta desbloquea la herramienta. La opción con el argumento más sólido en diseño da créditos extra.</div>
      <div class="reto-q">${m.reto.q}</div>
      <div class="ropts">${m.reto.opts.map((o,i)=>`<button class="ropt${G.retoSel[idx]===i?(i===m.reto.corr?' ok':' sel'):''}" onclick="ansReto(${idx},${i})">${o}</button>`).join('')}</div>
      ${G.retoSel[idx]!==null?`<div class="reto-just" style="background:${G.retoSel[idx]===m.reto.corr?'rgba(31,174,128,.08)':'rgba(139,127,232,.08)'};border-color:${G.retoSel[idx]===m.reto.corr?'rgba(31,174,128,.3)':'rgba(139,127,232,.3)'}"><strong style="color:#CCCCEE">Argumento de referencia en diseño:</strong> ${m.reto.just}</div>`:''}
    </div>`;
  } else {
    html+=`<div style="background:var(--cy-x);border:.5px solid rgba(31,174,128,.3);border-radius:9px;padding:10px 14px;margin-bottom:14px;font-size:15px;color:var(--cy-l);font-weight:600">✓ Reto completado — créditos obtenidos. Ahora toma tus decisiones.</div>`;
  }

  // DECISIONES
  if(rOk){
    m.decs.forEach((dec,di)=>{
      if(di===1&&d0===null)return;
      const selOi=G.decSel[idx][di];
      html+=`<div class="dec-block">
        <div class="dec-q">${dec.q}</div>
        <div class="dec-opts">${dec.opts.map((o,oi)=>`<div class="dopt${selOi===oi?' sel':''}" style="${selOi===oi?'border-color:'+m.ch+';background:'+m.ch+'18':''}" onclick="selDec(${idx},${di},${oi})">
          <div class="dopt-t">${o.t}</div>
          <div class="dopt-s">${o.s}</div>
          <span class="dopt-gain" style="background:${m.ch}22;color:${m.ch}">${o.c}</span>
        </div>`).join('')}</div>
        ${selOi!==null?`<div class="dec-just" style="margin-top:14px;background:${m.ch}0C;border-left:3px solid ${m.ch};border-radius:0 8px 8px 0;padding:11px 14px">
          <label style="display:block;font-size:13px;color:${m.ch};font-weight:700;font-family:var(--fh);margin-bottom:3px">¿Por qué tomaste esta decisión?</label>
          <div style="font-size:11px;color:var(--gh);margin-bottom:8px;line-height:1.5">El evaluador lee tu razonamiento — articula el porqué, no el qué.</div>
          <input class="fi" style="margin:0;font-size:14px;padding:10px 13px" type="text"
            placeholder="Ej: porque mi personaje vive entre lo análogo y lo digital, y este detalle hace visible esa tensión..."
            value="${(G.decJust[idx]&&G.decJust[idx][di])||''}"
            oninput="saveDecJust(${idx},${di},this.value)">
        </div>`:''}
      </div>`;
    });
  }

  // HERRAMIENTA DE CREACIÓN
  const showTool=rOk&&d0!==null; // Tool unlocks after first decision
  if(showTool) html+=buildTool(idx,m,a);

  // CREDITS PANEL — visible inside mission when tool is shown
  if(showTool){
    const cv=G.cred.v||0,cf=G.cred.f||0,cn=G.cred.n||0,ct=G.cred.t||0;
    const total=cv+cf+cn+ct;
    if(total>0){
      html+='<div style="background:var(--bg2);border:.5px solid var(--bd);border-radius:8px;padding:9px 14px;margin-bottom:12px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">'+
        '<span style="font-size:11px;color:var(--gh);font-weight:600">Créditos en esta misión:</span>'+
        (cv?'<span style="background:var(--pu-x);color:var(--pu-l);padding:2px 8px;border-radius:4px;font-size:11px;font-family:var(--fm)">◆'+cv+'</span>':'')+
        (cf?'<span style="background:var(--cy-x);color:var(--cy-l);padding:2px 8px;border-radius:4px;font-size:11px;font-family:var(--fm)">⬡'+cf+'</span>':'')+
        (cn?'<span style="background:var(--go-x);color:var(--go-l);padding:2px 8px;border-radius:4px;font-size:11px;font-family:var(--fm)">★'+cn+'</span>':'')+
        (ct?'<span style="background:var(--gr-x);color:var(--gr-l);padding:2px 8px;border-radius:4px;font-size:11px;font-family:var(--fm)">⬟'+ct+'</span>':'')+
        '</div>';
    }
  }

  // BOTONES
  if(showTool){
    html+=`<div class="btn-row">
      <button class="btn btn-p btn-sm" style="flex:1" onclick="goS('tablero')">← Tablero</button>
      <button class="btn btn-c" style="flex:2" onclick="tryComplete(${idx})">✓ Guardar y completar misión ${idx+1}</button>
    </div>`;
  } else {
    html+=`<button class="btn btn-p btn-sm" style="max-width:200px" onclick="goS('tablero')">← Volver al tablero</button>`;
  }

  document.getElementById('m-content').innerHTML=html;
}

// ═══════════════════════════════════════════ BUILD TOOLS
function buildTool(idx,m,a){
  const ac=m.ch;
  let h=`<div class="tool-block" style="border-color:${ac}33">`;
  h+=`<div class="tool-lbl" style="color:${ac}">Herramienta — ${m.disc}</div>`;

  if(idx===0){
    // Moodboard — subida de imágenes propias (6 slots)
    h+='<div style="font-size:13px;color:var(--gh);line-height:1.6;background:var(--bg2);border:.5px solid var(--bd);border-radius:8px;padding:11px 14px;margin-bottom:14px">'+
      '<strong style="color:var(--wh)">Tu moodboard personal</strong> — Sube hasta 6 imágenes de tu propia colección: fotos, capturas, recortes digitales o ilustraciones que representen la identidad visual de tu personaje.'+
    '</div>';
    h+='<div class="mb-board" style="margin-bottom:14px">';
    for(var _si=0;_si<6;_si++){
      var _slot=G.mbBoard[_si];
      h+='<div class="mb-slot'+(_slot?' filled':'')+'" style="cursor:default;position:relative">';
      if(_slot&&_slot.dataUrl){
        h+='<img src="'+_slot.dataUrl+'" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:6px">'+
          '<button class="sl-rm" onclick="mbRemove('+_si+')">✕</button>'+
          '<div style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,.55);border-radius:0 0 6px 6px;padding:3px 5px;font-size:9px;color:rgba(255,255,255,.85);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:center">'+(_slot.lbl||'')+'</div>';
      } else {
        h+='<label style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;gap:5px">'+
          '<span style="font-size:22px">📷</span>'+
          '<span style="font-size:9px;color:var(--mu);text-align:center;line-height:1.3">Subir<br>imagen</span>'+
          '<input type="file" accept="image/*" style="display:none" onchange="mbUpload(event,'+_si+')">'+
          '</label>';
      }
      h+='</div>';
    }
    h+='</div>';
    h+='<div style="font-size:11px;color:var(--mu);margin-bottom:14px">Formatos: JPG, PNG, GIF, WEBP · Max. 5 MB por imagen</div>';

    // Paletas
    h+=`<div class="sec-lbl">Paleta de color — elige una o crea la tuya</div>
    <div class="pal-grid">
      ${PALETTES.map((p,pi)=>`<div class="pal-card${G.selectedPal===pi?' sel':''}" onclick="selPal(${pi})">
        <div class="pal-swatches">${p.colors.map(c=>`<div class="pal-swatch" style="background:${c}"></div>`).join('')}</div>
        <div class="pal-name">${p.name}</div>
      </div>`).join('')}
      <div class="pal-card${G.selectedPal===-1?' sel':''}" onclick="selPal(-1)" style="border-style:dashed">
        <div class="pal-swatches" id="custom-pal-swatches">
          ${(G.customPal||['#333333','#666666','#999999','#CCCCCC','#FFFFFF']).map((col,ci)=>`<div class="pal-swatch" style="background:${col};position:relative"><input type="color" value="${col}" style="position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%" oninput="setCustomPal(${ci},this.value)" onclick="event.stopPropagation()"></div>`).join('')}
        </div>
        <div class="pal-name">✏ Mi paleta</div>
      </div>
    </div>
    ${G.selectedPal!=null?`<input class="fi" type="text" placeholder="¿Qué dice esta paleta sobre tu personaje?" style="margin-bottom:10px" oninput="G.palNote=this.value" value="${G.palNote||''}">`:``}`;

    h+=`<label class="fl">¿Qué dice tu paleta sobre el personaje?</label>
    <input class="fi" type="text" placeholder="Ej: agresivo y tecnológico, como si el color tuviera electricidad...">
    <label class="fl">Concepto del logo en una línea</label>
    <input class="fi" type="text" placeholder="Ej: una X geométrica que parece una ventana hacia otro mundo...">`;
  }
  else if(idx===1){
    const gSlils=(SILHOUETTES[G.silGender]||SILHOUETTES['M']);
    const isF=G.silGender==='F';
    const svgBody=isF
      ?`<svg viewBox="0 0 80 180" width="72" height="162" xmlns="http://www.w3.org/2000/svg">
          <ellipse cx="40" cy="16" rx="12" ry="14" fill="${G.silColor}" opacity=".9"/>
          <path d="M27 32 Q40 28 53 32 L57 82 Q50 78 40 80 Q30 78 23 82 Z" fill="${G.silColor}" opacity=".88"/>
          <rect x="16" y="34" width="11" height="46" rx="5" fill="${G.silColor}" opacity=".75"/>
          <rect x="53" y="34" width="11" height="46" rx="5" fill="${G.silColor}" opacity=".75"/>
          <path d="M23 82 Q33 86 40 84 Q47 86 57 82 L54 152 Q47 150 42 152 L40 152 L38 152 Q33 150 26 152 Z" fill="${G.silColor}" opacity=".82"/>
          <rect x="27" y="152" width="11" height="22" rx="5" fill="${G.silColor}" opacity=".75"/>
          <rect x="42" y="152" width="11" height="22" rx="5" fill="${G.silColor}" opacity=".75"/>
        </svg>`
      :`<svg viewBox="0 0 80 180" width="72" height="162" xmlns="http://www.w3.org/2000/svg">
          <ellipse cx="40" cy="16" rx="12" ry="14" fill="${G.silColor}" opacity=".9"/>
          <rect x="22" y="32" width="36" height="54" rx="8" fill="${G.silColor}" opacity=".88"/>
          <rect x="14" y="34" width="12" height="48" rx="6" fill="${G.silColor}" opacity=".75"/>
          <rect x="54" y="34" width="12" height="48" rx="6" fill="${G.silColor}" opacity=".75"/>
          <rect x="24" y="84" width="14" height="68" rx="7" fill="${G.silColor}" opacity=".78"/>
          <rect x="42" y="84" width="14" height="68" rx="7" fill="${G.silColor}" opacity=".78"/>
        </svg>`;
    const tintStyle=`filter:drop-shadow(0 0 5px ${ac}99)`;
    h+=`<div class="sil-system">
      <div class="sil-viewer">
        <div class="sil-canvas" id="sil-canvas" style="background:linear-gradient(180deg,${G.silColor}28 0%,${G.silColor}08 100%)">
          <div style="position:relative;display:flex;align-items:center;justify-content:center;height:100%">
            <div style="position:relative;display:inline-block">
              ${svgBody}
              ${G.silTop?`<div style="position:absolute;top:26px;left:50%;transform:translateX(-50%);font-size:36px;line-height:1;${tintStyle}">${G.silTop}</div>`:''}
              ${G.silBottom?`<div style="position:absolute;top:${isF?'84px':'90px'};left:50%;transform:translateX(-50%);font-size:30px;line-height:1;${tintStyle}">${G.silBottom}</div>`:''}
              ${G.silShoes?`<div style="position:absolute;bottom:${isF?'2px':'4px'};left:50%;transform:translateX(-50%);font-size:26px;line-height:1;${tintStyle}">${G.silShoes}</div>`:''}
              ${G.silAcc?`<div style="position:absolute;top:1px;left:50%;transform:translateX(-50%);font-size:22px;line-height:1;${tintStyle}">${G.silAcc}</div>`:''}
            </div>
          </div>
        </div>
        <div class="sil-controls">
          <div class="sil-ctrl-lbl">Género / morfología</div>
          <div class="sil-btns" style="margin-bottom:7px">
            <button class="sil-btn${G.silGender==='M'?' on':''}" style="${G.silGender==='M'?'border-color:'+ac+';background:'+ac+'20;color:#fff':''}" onclick="setGender('M')">♂ Hombre</button>
            <button class="sil-btn${G.silGender==='F'?' on':''}" style="${G.silGender==='F'?'border-color:'+ac+';background:'+ac+'20;color:#fff':''}" onclick="setGender('F')">♀ Mujer</button>
          </div>
          <div class="sil-btns">
            ${gSlils.map(s=>`<button class="sil-btn${G.silBase===s.id?' on':''}" title="${s.desc}" style="${G.silBase===s.id?'border-color:'+ac+';background:'+ac+'18;color:#fff':''}" onclick="setSilBase('${s.id}')">${s.label}</button>`).join('')}
          </div>
          <div class="sil-ctrl-lbl" style="margin-top:8px">Color base del outfit</div>
          <div class="color-dots">${OUTFIT_COLORS.map(c=>`<div class="col-dot${G.silColor===c?' on':''}" style="background:${c};border-color:${G.silColor===c?'#FFFFFF':'transparent'}" onclick="setSilColor('${c}')"></div>`).join('')}</div>
        </div>
      </div>
      <div class="sil-panel">
        <div class="clothing-cat">
          <div class="cat-lbl">👕 Parte superior</div>
          <div class="cloth-opts">${CLOTHING.tops.map(c=>`<div class="cloth-item${G.silTop===c.ico?' on':''}" style="${G.silTop===c.ico?'border-color:'+ac+';background:'+ac+'18':''}" onclick="setCloth('top','${c.ico}')"><span class="cloth-item-ico" style="${G.silTop===c.ico?'filter:drop-shadow(0 0 5px '+ac+'99)':''}">${c.ico}</span><span class="cloth-item-nm" style="${G.silTop===c.ico?'color:'+ac:''}">${c.nm}</span></div>`).join('')}</div>
        </div>
        <div class="clothing-cat">
          <div class="cat-lbl">👖 Parte inferior</div>
          <div class="cloth-opts">${CLOTHING.bottoms.map(c=>`<div class="cloth-item${G.silBottom===c.ico?' on':''}" style="${G.silBottom===c.ico?'border-color:'+ac+';background:'+ac+'18':''}" onclick="setCloth('bottom','${c.ico}')"><span class="cloth-item-ico" style="${G.silBottom===c.ico?'filter:drop-shadow(0 0 5px '+ac+'99)':''}">${c.ico}</span><span class="cloth-item-nm" style="${G.silBottom===c.ico?'color:'+ac:''}">${c.nm}</span></div>`).join('')}</div>
        </div>
        <div class="clothing-cat">
          <div class="cat-lbl">👟 Calzado</div>
          <div class="cloth-opts">${CLOTHING.shoes.map(c=>`<div class="cloth-item${G.silShoes===c.ico?' on':''}" style="${G.silShoes===c.ico?'border-color:'+ac+';background:'+ac+'18':''}" onclick="setCloth('shoes','${c.ico}')"><span class="cloth-item-ico" style="${G.silShoes===c.ico?'filter:drop-shadow(0 0 5px '+ac+'99)':''}">${c.ico}</span><span class="cloth-item-nm" style="${G.silShoes===c.ico?'color:'+ac:''}">${c.nm}</span></div>`).join('')}</div>
        </div>
        <div class="clothing-cat">
          <div class="cat-lbl">💍 Accesorios</div>
          <div class="cloth-opts">${CLOTHING.acc.map(c=>`<div class="cloth-item${G.silAcc===c.ico?' on':''}" style="${G.silAcc===c.ico?'border-color:'+ac+';background:'+ac+'18':''}" onclick="setCloth('acc','${c.ico}')"><span class="cloth-item-ico" style="${G.silAcc===c.ico?'filter:drop-shadow(0 0 5px '+ac+'99)':''}">${c.ico}</span><span class="cloth-item-nm" style="${G.silAcc===c.ico?'color:'+ac:''}">${c.nm}</span></div>`).join('')}</div>
        </div>
        <div class="clothing-cat">
          <div class="cat-lbl">📝 3 palabras que definen el look</div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">
            <input class="fi" type="text" placeholder="Palabra 1" style="margin:0;padding:9px 10px;font-size:13px">
            <input class="fi" type="text" placeholder="Palabra 2" style="margin:0;padding:9px 10px;font-size:13px">
            <input class="fi" type="text" placeholder="Palabra 3" style="margin:0;padding:9px 10px;font-size:13px">
          </div>
          <textarea class="fi" placeholder="¿Por qué cada prenda justifica su presencia en el look?" style="margin-top:8px;margin-bottom:0" rows="2"></textarea>
        </div>
      </div>
    </div>`;
  }
  else if(idx===2){
    h+=`<div class="sec-lbl">Tipo de espacio — elige con referencia visual real</div>
    <div class="space-grid">
      ${SPACES.map(sp=>`<div class="space-card${G.selectedSpace===sp.id?' sel':''}" onclick="selSpace('${sp.id}')">
        <div class="space-card-img">
          <img src="${sp.url}" alt="${sp.name}" loading="lazy">
          <div class="sel-ov">✓</div>
        </div>
        <div class="space-card-body">
          <div class="space-card-name">${sp.emoji} ${sp.name}</div>
          <div class="space-card-vibe">${sp.vibe}</div>
        </div>
      </div>`).join('')}
    </div>
    <div class="sec-lbl">Elementos del espacio — clic para incluir</div>
    <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:7px;margin-bottom:12px">
      ${SPACE_ELEMENTS.map(el=>`<div onclick="toggleEl('${el.id}')" style="border-radius:9px;border:1.5px solid ${G.selectedEls.includes(el.id)?ac:'rgba(255,255,255,.12)'};background:${G.selectedEls.includes(el.id)?ac+'18':'rgba(255,255,255,.02)'};padding:10px 6px;cursor:pointer;text-align:center;transition:all .18s">
        <div style="font-size:22px;margin-bottom:4px;${G.selectedEls.includes(el.id)?'filter:drop-shadow(0 0 5px '+ac+'88)':''}">${el.ico}</div>
        <div style="font-size:10px;font-weight:600;color:${G.selectedEls.includes(el.id)?ac:'#C0C0E0'};font-family:var(--fh);line-height:1.2">${el.nm}</div>
      </div>`).join('')}
    </div>
    <label class="fl">¿Qué dice este espacio de quien vive ahí?</label>
    <textarea class="fi" placeholder="Describe la atmósfera y lo que revela del personaje..." rows="3"></textarea>`;
  }
  else if(idx===3){
    const cat=G.objCat;
    const objs=OBJECTS[cat]||[];
    h+=`<div class="sec-lbl">Categoría de objeto</div>
    <div class="obj-cats">
      ${Object.keys(OBJECTS).map(k=>`<button class="obj-cat-btn${cat===k?' on':''}" onclick="setObjCat('${k}')">${{'tech':'⚡ Tech','fashion':'👟 Fashion','craft':'🎨 Craft','sport':'🏋️ Sport'}[k]}</button>`).join('')}
    </div>
    <div class="sec-lbl">Selecciona tu objeto — referencias visuales reales</div>
    <div class="obj-grid">
      ${objs.map(o=>`<div class="obj-card${G.selectedObjs.includes(o.id)?' sel':''}" onclick="toggleObj('${o.id}')">
        <div class="obj-card-img">
          <img src="${o.url}" alt="${o.nm}" loading="lazy" onerror="this.style.display='none';this.parentElement.innerHTML='<span style=font-size:32px>${o.ico}</span>'">
          <div class="sel-check">✓</div>
        </div>
        <div class="obj-card-body"><div class="obj-card-name">${o.nm}</div><div class="obj-card-sub">${o.sub}</div></div>
      </div>`).join('')}
    </div>
    <div class="sec-lbl">Anotaciones del objeto</div>
    <div class="anotaciones">
      <input class="anot-fi" type="text" placeholder="Nombre específico del objeto">
      <input class="anot-fi" type="text" placeholder="Material principal">
      <input class="anot-fi" type="text" placeholder="Característica única">
    </div>
    <label class="fl">¿Por qué solo este personaje tendría este objeto?</label>
    <textarea class="fi" placeholder="La razón de fondo — cultural, funcional o histórica..." rows="3"></textarea>`;
    // Other object section — concatenation to avoid nested template issues
    var ooSlotContent=G.objOther&&G.objOther.dataUrl?
      '<img src="'+G.objOther.dataUrl+'" style="width:100%;height:100%;object-fit:cover;border-radius:6px"><button class="sl-rm" onclick="clearObjOtherImg()">✕</button>'
      :'<label style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;gap:4px">'+
        '<span style="font-size:20px">📎</span>'+
        '<span style="font-size:9px;color:var(--mu);text-align:center">Imagen<br>opcional</span>'+
        '<input type="file" accept="image/*" style="display:none" onchange="objOtherUpload(event)">'+
        '</label>';
    h+='<div style="border-top:.5px solid var(--bd);margin-top:14px;padding-top:14px">'+
      '<div style="font-size:12px;color:var(--go-l);font-weight:700;margin-bottom:8px">⭐ ¿No está en el catálogo? Crea el tuyo — gana ◆◆ extra</div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-bottom:9px">'+
        '<input class="fi" id="obj-other-name" type="text" placeholder="Nombre del objeto" style="margin:0" value="'+(G.objOther?G.objOther.name:'')+'" oninput="setObjOther(&quot;name&quot;,this.value)">'+
        '<input class="fi" id="obj-other-desc" type="text" placeholder="¿Qué lo hace único?" style="margin:0" value="'+(G.objOther?G.objOther.desc:'')+'" oninput="setObjOther(&quot;desc&quot;,this.value)">'+
      '</div>'+
      '<div class="mb-slot'+(G.objOther&&G.objOther.dataUrl?' filled':'')+'" style="width:120px;height:90px;cursor:default">'+ooSlotContent+'</div>'+
    '</div>';
  }
  else if(idx===4){
    const ruta=G.routePick;
    if(!ruta){
      // Pre-question before revealing route names
      if(G.m5preq===null||G.m5preq===undefined){
        var preqOpts=[
          'En secuencias visuales — momentos conectados que forman una historia con inicio y fin',
          'En movimiento — loops, gestos y ritmo que se sienten más que se leen',
          'En páginas — composición editorial donde cada elemento ocupa un lugar deliberado',
          'En espacio — una experiencia que el espectador entra y recorre físicamente'
        ];
        h+='<div class="reto-box" style="background:'+ac+'0A;border:.5px solid '+ac+'44;margin-bottom:14px">'+
          '<div class="reto-lbl" style="color:'+ac+'">Antes de elegir tu ruta — una pregunta</div>'+
          '<div class="reto-q">¿Cómo te imaginas que tu personaje cuenta lo que vive?</div>'+
          '<div class="ropts">'+
          preqOpts.map(function(q,qi){return '<button class="ropt" onclick="setM5Preq('+qi+')">'+q+'</button>';}).join('')+
          '</div></div>';
      } else {
        var suggested=G.m5preq;
        var routeNames=['Ruta A','Ruta B','Ruta C','Ruta D'];
        h+='<div style="background:'+ac+'10;border:.5px solid '+ac+'33;border-radius:9px;padding:11px 14px;margin-bottom:12px;font-size:13px">'+
          '<span style="color:'+ac+';font-weight:700">Sugerida para ti: '+routeNames[suggested]+'</span>'+
          '<span style="color:var(--gh);margin-left:8px">— basado en tu respuesta. Puedes elegir cualquier ruta.</span>'+
          '</div>';
        h+='<div class="sec-lbl">Confirma tu ruta</div><div class="route-grid">';
        m.decs[0].opts.forEach(function(o,ri){
          var isSug=ri===suggested;
          h+='<div class="route-opt'+(isSug?' suggested':'')+'" style="'+(isSug?'border-color:'+ac+';background:'+ac+'14':'')+
            '" onclick="setRoute('+ri+')">'+
            '<div class="route-t">'+routeNames[ri]+' — '+o.t+(isSug?' ★':'')+'</div>'+
            '<div class="route-s">'+o.s+'</div>'+
            '<span class="route-gain" style="background:'+ac+'20;color:'+ac+'">'+o.c+'</span>'+
          '</div>';
        });
        h+='</div>';
      }
    } else {
      var rNm=['Narrativa + UX','Animación','Editorial visual','Experiencia física'][ruta];
      h+='<div style="font-size:13px;color:'+ac+';font-weight:700;margin-bottom:12px;font-family:var(--fh)">Ruta '+['A','B','C','D'][ruta]+' — '+rNm+' <button onclick="setRoute(null)" style="font-size:11px;color:var(--gh);background:transparent;border:none;cursor:pointer;margin-left:8px">cambiar</button></div>';
      if(ruta===0||ruta===1){
        const nf=ruta===0?4:3;
        const prompts=ruta===0
          ?['APERTURA — ¿Quién es y en qué mundo vive?','CONFLICTO — ¿Qué tensión o deseo lo mueve?','CLÍMAX — ¿Qué decisión toma? ¿Qué lo define?','CIERRE — ¿Cómo queda el mundo tras su acción?']
          :['ESTADO BASE — Personaje en forma neutra / inicial','TRANSFORMACIÓN — Algo cambia, se activa, se revela','LOOP FINAL — El resultado que se repite y comunica'];
        var archN=G.arch?G.arch.name:'tu personaje';
        h+='<div style="background:'+ac+'0A;border:.5px solid '+ac+'30;border-radius:10px;padding:11px 14px;margin-bottom:12px">'+
          '<div style="font-size:10px;text-transform:uppercase;letter-spacing:.09em;color:'+ac+';font-weight:700;font-family:var(--fh);margin-bottom:4px">'+(ruta===0?'Storyboard narrativo — 4 escenas':'Storyboard de animación — 3 frames')+'</div>'+
          '<div style="font-size:13px;color:var(--gh)">Cada cuadro construye la historia de '+archN+'. Describe qué se ve, qué se siente y por qué ese momento importa.</div>'+
          '</div>'+
          '<div class="sgrid" style="margin-bottom:12px">';
        Array.from({length:nf},function(_,n){
          h+='<div class="sf" style="border-color:'+(G.storyScenes[n]?ac+'66':'rgba(255,255,255,.1)')+'">'+
            '<div class="sf-n" style="display:flex;align-items:center;gap:5px;margin-bottom:4px">'+
              '<span style="background:'+ac+'22;color:'+ac+';border-radius:4px;padding:1px 7px;font-size:9px;font-weight:700;font-family:var(--fh)">'+(n+1)+'</span>'+
              '<span style="font-size:9px;color:'+ac+';font-weight:600;font-family:var(--fh)">'+prompts[n].split('—')[0].trim()+'</span>'+
            '</div>'+
            '<div class="sf-area" style="background:'+ac+'06;border-radius:4px;display:flex;align-items:center;justify-content:center;color:var(--mu);font-size:10px;font-style:italic;text-align:center;padding:5px">'+(prompts[n].split('—')[1]||'').trim()+'</div>'+
            '<input class="sf-inp" type="text" placeholder="Describe la imagen concreta que verías..." onclick="event.stopPropagation()" oninput="saveScene('+n+',this.value)" value="'+(G.storyScenes[n]||'')+'">'+
          '</div>';
        });
        h+='</div>'+
          '<div style="background:'+ac+'08;border:.5px solid '+ac+'22;border-radius:9px;padding:11px 14px;margin-bottom:10px">'+
            '<label class="fl">'+(ruta===0?'¿En qué tipo de pantalla vive esta historia?':'¿Cuál es el ritmo de la animación?')+'</label>'+
            '<select class="fi" style="margin-bottom:8px">'+(ruta===0?'<option>App móvil</option><option>Canal streaming</option><option>Red social — scroll</option><option>Dashboard</option><option>Sitio web</option>':'<option>Loop rápido — menos de 2 seg</option><option>Loop medio — 3 a 5 seg</option><option>Loop lento — 6 a 10 seg</option><option>Única — no repite</option>')+'</select>'+
            '<label class="fl">¿Qué emoción provoca en quien lo ve?</label>'+
            '<input class="fi" type="text" placeholder="'+(ruta===0?'Ej: curiosidad que se convierte en deseo de explorar más...':'Ej: inquietud suave, como ver algo que debería ser estático pero no...')+'">'+
          '</div>'+
          '<label class="fl">¿Por qué este formato es el correcto para '+archN+'?</label>'+
          '<textarea class="fi" placeholder="Razona tu elección: ¿qué tiene este medio que ningún otro le daría a este personaje?" rows="3"></textarea>';
      } else {
        // Rutas C y D
        h+='<label class="fl">Tipo de '+(ruta===2?'contenido editorial':'experiencia')+'</label>'+
          '<select class="fi">'+(ruta===2?'<option>Editorial de revista</option><option>Zine independiente</option><option>Newsletter visual</option><option>Lookbook</option>':'<option>Experiencia inmersiva</option><option>Pop-up / exhibit</option><option>Instalación artística</option><option>Híbrida digital-física</option>')+'</select>'+
          '<label class="fl">Concepto en una frase</label>'+
          '<input class="fi" type="text" placeholder="El concepto que rige todo...">'+
          '<label class="fl">¿Por qué este formato es el correcto para tu personaje?</label>'+
          '<textarea class="fi" placeholder="Razona tu elección de medio..." rows="3"></textarea>';
      }
      // Upload de desarrollo — aplica a TODAS las rutas
      h+='<div style="margin-top:14px;background:var(--bg2);border:.5px solid var(--bd);border-radius:10px;padding:14px">'+
        '<div style="font-size:10px;text-transform:uppercase;letter-spacing:.09em;color:var(--gh);font-weight:700;font-family:var(--fh);margin-bottom:6px">Sube tus imágenes de desarrollo</div>'+
        '<div style="font-size:13px;color:var(--gh);margin-bottom:12px;line-height:1.6">Bocetos, storyboard fotografiado, collage digital, layouts. Se mostrarán en tu ficha final.</div>'+
        '<div class="mb-board" style="margin-bottom:8px">'+
          Array.from({length:4},function(_,i){
            var sl=G.m5imgs&&G.m5imgs[i];
            return '<div class="mb-slot'+(sl?' filled':'')+'" style="cursor:default;position:relative">'+
              (sl?
                '<img src="'+sl.dataUrl+'" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:6px">'+
                '<button class="sl-rm" onclick="m5Remove('+i+')">✕</button>'+
                '<div style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,.55);border-radius:0 0 6px 6px;padding:3px 5px;font-size:9px;color:rgba(255,255,255,.85);text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+(sl.lbl||'')+'</div>'
                :
                '<label style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;gap:5px">'+
                '<span style="font-size:22px">📎</span>'+
                '<span style="font-size:9px;color:var(--mu);text-align:center;line-height:1.3">Subir<br>imagen</span>'+
                '<input type="file" accept="image/*" style="display:none" onchange="m5Upload(event,'+i+')">'+
                '</label>'
              )+'</div>';
          }).join('') +
        '</div>'+
        '<div style="font-size:11px;color:var(--mu)">Formatos: JPG, PNG, GIF, WEBP · Max. 5 MB · Hasta 4 imágenes</div>'+
        '</div>';
    }
  }
  h+='</div>';
  return h;
}

// ═══════════════════════════════════════════ INTERACTIONS
function ansReto(idx,oi){
  if(G.retoOk[idx])return;
  const m=MISSIONS[idx];
  G.retoSel[idx]=oi;
  G.retoOk[idx]=true;
  if(G.mst[idx]<2)G.mst[idx]=2;
  // Any answer unlocks the tool. Correct answer gives bonus credits.
  const total=Object.values(m.cr).reduce((a,b)=>a+b,0);
  if(oi===m.reto.corr){
    gain(m.cr);
    showToast('✓ Respuesta fundamentada — +'+total+' créditos','t-ok');
  } else {
    // Partial credit: 1 credit of the dominant type
    const domKey=Object.keys(m.cr).reduce((a,b)=>m.cr[a]>=m.cr[b]?a:b,'v');
    gain({[domKey]:1});
    showToast('Perspectiva válida — +1 crédito. La opción '+( m.reto.corr+1)+' tiene el argumento más sólido en diseño.','t-warn',3500);
  }
  updateMtrack();
  saveCheckpoint();
  saveSubmission();
  renderMission(idx);
}

function selDec(idx,di,oi){
  const prev=G.decSel[idx][di];
  const m=MISSIONS[idx];
  if(prev!==null){
    const pg=m.decs[di].opts[prev].g;
    Object.keys(pg).forEach(k=>{G.cred[k]=Math.max(0,(G.cred[k]||0)-(pg[k]||0));});
  }
  G.decSel[idx][di]=oi;
  const g=m.decs[di].opts[oi].g;
  gain(g);
  // Credit toast with archetype voice
  const total=Object.values(g).reduce((a,b)=>a+b,0);
  const voices=[
    'el Gamer Futurista lo sabía desde el principio.',
    'el Artista Bohemio siempre sigue el instinto.',
    'el Deportista Urbano actúa rápido y preciso.',
    'el Músico Indie confía en lo que se siente real.',
    'el Tech Entrepreneur elige con datos y convicción.'
  ];
  const voice=G.arch?voices[G.arch.id]:'tu personaje lo confirma.';
  const credTxt=m.decs[di].opts[oi].c;
  showToast('<strong>+'+credTxt+'</strong> — '+voice,'t-ok',2200);
  // Reset justification if option changed
  if(!G.decJust)G.decJust=[[null,null],[null,null],[null,null],[null,null],[null]];
  if(!G.decJust[idx])G.decJust[idx]=[null,null];
  if(G.decJust[idx]&&prev!==oi)G.decJust[idx][di]=null;
  saveCheckpoint();
  saveSubmission();
  renderMission(idx);
}

// M1
function setTab(mIdx,tab){G.bankTab[mIdx]=tab;renderMission(mIdx);}
function isImgInBoard(id){return G.mbBoard.some(s=>s&&s.id===id);}
function bankClick(id){
  if(isImgInBoard(id)){return;}
  const emptyIdx=G.mbBoard.findIndex(s=>!s);
  if(emptyIdx===-1){showToast('Moodboard lleno. Quita una imagen primero.','t-warn');return;}
  const all=[...MB_IMAGES.free,...MB_IMAGES.premium];
  const img=all.find(i=>i.id===id)||{id,g:'var(--bg3)',ico:'🖼',lbl:''};
  G.mbBoard[emptyIdx]=img;renderMission(G.mActive);
}
function removeFromBoard(i){G.mbBoard[i]=null;renderMission(G.mActive);}

// M1 image upload helpers
function mbUpload(evt,idx){
  var file=evt.target.files&&evt.target.files[0];
  if(!file)return;
  if(file.size>5*1024*1024){showToast('Imagen muy grande. Máx. 5 MB.','t-warn');return;}
  var reader=new FileReader();
  reader.onload=function(e){
    G.mbBoard[idx]={dataUrl:e.target.result,lbl:file.name.replace(/\.[^.]+$/,'').substring(0,22)};
    saveCheckpoint();
    renderMission(G.mActive);
  };
  reader.readAsDataURL(file);
}
function mbRemove(i){G.mbBoard[i]=null;renderMission(G.mActive);}

// M5 image upload helpers
function m5Upload(evt,idx){
  var file=evt.target.files&&evt.target.files[0];
  if(!file)return;
  if(file.size>5*1024*1024){showToast('Imagen muy grande. Máx. 5 MB.','t-warn');return;}
  var reader=new FileReader();
  reader.onload=function(e){
    if(!G.m5imgs)G.m5imgs=[null,null,null,null];
    G.m5imgs[idx]={dataUrl:e.target.result,lbl:file.name.replace(/\.[^.]+$/,'').substring(0,22)};
    renderMission(G.mActive);
  };
  reader.readAsDataURL(file);
}
function m5Remove(i){if(G.m5imgs)G.m5imgs[i]=null;renderMission(G.mActive);}

// M2
function setGender(g){G.silGender=g;G.silBase=g==='M'?'MA':'FA';G.silTop=null;G.silBottom=null;G.silShoes=null;G.silAcc=null;renderMission(G.mActive);}
function setSilBase(id){G.silBase=id;renderMission(G.mActive);}
function saveScene(i,v){G.storyScenes[i]=v;}
function setSilColor(c){G.silColor=c;renderMission(G.mActive);}
function setCloth(slot,ico){
  const map={top:'silTop',bottom:'silBottom',shoes:'silShoes',acc:'silAcc'};
  G[map[slot]]=G[map[slot]]===ico?null:ico;
  renderMission(G.mActive);
}

// M3
function selSpace(id){G.selectedSpace=G.selectedSpace===id?null:id;renderMission(G.mActive);}
function toggleEl(id){
  if(G.selectedEls.includes(id))G.selectedEls=G.selectedEls.filter(e=>e!==id);
  else G.selectedEls.push(id);
  renderMission(G.mActive);
}

// M4
function setObjCat(cat){G.objCat=cat;renderMission(G.mActive);}
function toggleObj(id){
  if(G.selectedObjs.includes(id))G.selectedObjs=G.selectedObjs.filter(o=>o!==id);
  else G.selectedObjs.push(id);
  renderMission(G.mActive);
}

// M5
function setRoute(r){G.routePick=r;renderMission(G.mActive);}

// Premium
function unlockPremium(idx){
  spendC({v:2});G.premiumUnlocked[idx]=true;
  showToast('★ Banco premium desbloqueado','t-warn');
  renderMission(idx);
}

// Complete
function completeMission(idx){
  const m=MISSIONS[idx];
  G.mst[idx]=3;
  if(idx+1<5&&G.mst[idx+1]===0)G.mst[idx+1]=1;
  const labels=['Tarjeta de identidad visual','Figurín de vestuario + look','Diseño del espacio + elementos','Boceto y objeto signature','Narrativa y experiencia digital'];
  G.entries.push({idx,name:labels[idx],color:m.ch});
  updateMtrack();
  setTimeout(broadcastState,500);
  saveCheckpoint();
  saveSubmission(true);
  const done=G.mst.filter(s=>s===3).length;
  // Unlock synthesis challenge after 3rd mission
  if(done===3&&!G.synthDone){
    showToast('✓ Misión '+( idx+1)+' completada — <strong>Reto de síntesis desbloqueado</strong> en el Tablero','t-ok',3500);
  } else {
    showToast('✓ Misión '+(idx+1)+' completada','t-ok');
  }
  setTimeout(()=>{if(G.mst.every(s=>s===3))goS('voz');else goS('tablero');},1600);
}

// tryComplete — nudge for incomplete decisions but never block
function tryComplete(idx){
  const m=MISSIONS[idx];
  const nd=m.decs.length;
  const d1=G.decSel[idx][1];
  // If 2 decs and second not answered, show nudge but still allow
  if(nd>1&&d1===null){
    showToast('Tip: hay una segunda decisión sin responder — puedes completarla antes de guardar, o continuar ahora.','t-warn',4000);
    // Allow completion after 1.5s delay so user can see the nudge
    setTimeout(()=>completeMission(idx),1500);
    return;
  }
  completeMission(idx);
}

// ═══════════════════════════════════════════ INVENTARIO
function renderInv(){
  syncC();
  const el=document.getElementById('elist');if(!el)return;
  if(!G.entries.length){el.innerHTML='<div style="font-size:15px;color:var(--gh)">Ninguna misión completada aún.</div>';return;}
  el.innerHTML=G.entries.map(e=>`<div class="eitem" style="border-color:${e.color}33">
    <div class="echk" style="color:${e.color}">✓</div>
    <div><div class="etit">${e.name}</div><div class="esub">Misión ${e.idx+1} · entregable guardado</div></div>
  </div>`).join('');
}

// ═══════════════════════════════════════════ ONE PAGER
function updateCard(){renderOP();saveSubmission();}
function renderOP(){
  const a=G.arch;
  const wrap=document.getElementById('arch-card-wrap');
  if(!wrap)return;
  const frase=document.getElementById('op-frase')?.value||'';
  G.fraseUniverso=frase;
  const done=G.mst.filter(s=>s===3).length;
  const status=document.getElementById('op-status');
  if(status){
    status.textContent=done===5?'✓ Todo completo — listo para exportar':`${done}/5 misiones completadas`;
    status.style.color=done===5?'var(--cy-l)':'var(--gh)';
  }
  // Estado del entregable final
  const eStat=document.getElementById('entrega-status');
  const eBtn=document.getElementById('entrega-btn');
  if(eStat&&eBtn){
    if(G._entregadoTs){
      const d=new Date(G._entregadoTs);
      const fecha=d.toLocaleDateString('es-MX',{day:'2-digit',month:'long',year:'numeric'});
      const hora=d.toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'});
      eStat.style.display='block';
      eStat.innerHTML='✓ <strong>Entregado</strong> el '+fecha+' a las '+hora+'. El evaluador ya tiene acceso a tu prueba.';
      eBtn.style.opacity='.5';
      eBtn.style.pointerEvents='none';
      eBtn.querySelector('.btn-confirm-lbl').textContent='Ya entregaste tu prueba';
    } else {
      eStat.style.display='none';
      eBtn.style.opacity='';
      eBtn.style.pointerEvents='';
      eBtn.querySelector('.btn-confirm-lbl').textContent='Entregar mi prueba final';
    }
  }

  if(!a){wrap.innerHTML='<div style="font-size:15px;color:var(--gh)">Elige tu perfil primero para ver la tarjeta.</div>';return;}

  const mNames=['Identidad','Look','Espacio','Objeto','Historia'];
  const mCols=[MISSIONS[0].ch,MISSIONS[1].ch,MISSIONS[2].ch,MISSIONS[3].ch,MISSIONS[4].ch];

  // Infer dominant credit profile
  const credArr=[{k:'v',l:'Visión',hint:'Conceptual, narrativo, identidad'},{k:'f',l:'Forma',hint:'Visual, espacial, formal'},{k:'n',l:'Narrativa',hint:'Editorial, storytelling, contenido'},{k:'t',l:'Técnica',hint:'Maker, sistemas, digital'}];
  const domCred=credArr.reduce((a,b)=>(G.cred[b.k]||0)>(G.cred[a.k]||0)?b:a);
  const totalCred=(G.cred.v||0)+(G.cred.f||0)+(G.cred.n||0)+(G.cred.t||0);
  const mDone=G.mst.filter(s=>s===3).length;
  // Vocational orientation — CRGS UDEM (6 carreras oficiales)
  // Cruza arquetipo (perfil dominante visual/temperamental) con top-2 créditos
  // (perfil de habilidad demostrado en las misiones)
  const credSorted=[...credArr].sort((a,b)=>(G.cred[b.k]||0)-(G.cred[a.k]||0));
  const top2=credSorted[0].k+'_'+credSorted[1].k;
  const archId=G.arch?G.arch.id:0;
  // Top-3 carreras sugeridas por arquetipo (en orden de afinidad base)
  const archCarreras={
    0:['Animación y Efectos Digitales','Diseño Gráfico','Diseño Industrial'], // Gamer Futurista
    1:['Diseño Gráfico','Diseño de Interiores','Diseño de Moda'],              // Artista Bohemio
    2:['Diseño de Moda','Diseño Industrial','Diseño Gráfico'],                  // Deportista Urbano
    3:['Diseño Gráfico','Diseño de Interiores','Animación y Efectos Digitales'], // Músico Indie
    4:['Diseño Industrial','Arquitectura','Animación y Efectos Digitales']      // Tech Entrepreneur
  };
  // Reordena el top-3 según los créditos dominantes para personalizar
  const credCarreraBoost={
    'v':['Diseño Gráfico','Animación y Efectos Digitales','Diseño de Moda'],
    'f':['Diseño de Interiores','Diseño Industrial','Arquitectura'],
    'n':['Diseño Gráfico','Animación y Efectos Digitales','Diseño de Moda'],
    't':['Diseño Industrial','Arquitectura','Animación y Efectos Digitales']
  };
  const baseCarr=archCarreras[archId]||archCarreras[0];
  const boost=credCarreraBoost[domCred.k]||[];
  // Subimos al top las carreras que están boosteadas por el crédito dominante
  const carrerasOrdenadas=[...baseCarr].sort((a,b)=>{
    const ai=boost.indexOf(a),bi=boost.indexOf(b);
    return (ai===-1?99:ai)-(bi===-1?99:bi);
  });
  const carreraTop=carrerasOrdenadas[0];
  const vocHint=carrerasOrdenadas.join(' · ');
  // Guardamos para que el panel admin lo use
  G._carreraSugerida=carreraTop;
  G._carrerasSugeridas=carrerasOrdenadas;

  wrap.innerHTML=`<div class="arch-card-export" id="export-target" style="border-color:${a.hex};max-width:560px">
    <!-- HEADER -->
    <div class="ace-header">
      <div class="ace-av" style="background:${a.hex}20;border-color:${a.hex};font-size:28px">${a.icon}</div>
      <div style="flex:1">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <div class="ace-name" style="color:${a.hex}">${a.name}</div>
          <div style="font-size:11px;padding:2px 9px;border-radius:99px;background:${a.hex}18;color:${a.hex};border:.5px solid ${a.hex}44;font-family:var(--fh);font-weight:600">${mDone}/5 misiones</div>
        </div>
        <div class="ace-sub">Escuela de Arte y Diseño UDEM · ${new Date().toLocaleDateString('es-MX')}</div>
        <div class="ace-tags" style="margin-top:5px">${a.tags.map(t=>`<span class="ac-tag" style="background:${a.hex}18;color:${a.hex};border:.5px solid ${a.hex}44;font-size:10px;padding:2px 8px">${t}</span>`).join('')}</div>
      </div>
    </div>

    <!-- PERFIL CREATIVO -->
    <div style="border-top:.5px solid rgba(255,255,255,.08);padding:12px 14px">
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:var(--gh);font-weight:700;font-family:var(--fh);margin-bottom:8px">Perfil creativo — distribución de créditos</div>
      <div class="ace-radars">
        <div class="ace-cred-card" style="background:var(--pu-x);border-color:rgba(139,127,232,.3)${domCred.k==='v'?';border-width:1.5px;border-color:#AFA9EC':''}">
          <div class="ace-cred-val" style="color:var(--pu-l)">◆${G.cred.v||0}</div><div class="ace-cred-lbl" style="color:var(--pu-l)">VISIÓN</div>
          ${domCred.k==='v'?'<div style="font-size:9px;color:var(--pu-l);margin-top:2px;font-weight:700">★ Dom.</div>':''}
        </div>
        <div class="ace-cred-card" style="background:var(--cy-x);border-color:rgba(31,174,128,.3)${domCred.k==='f'?';border-width:1.5px;border-color:#6DDDB0':''}">
          <div class="ace-cred-val" style="color:var(--cy-l)">⬡${G.cred.f||0}</div><div class="ace-cred-lbl" style="color:var(--cy-l)">FORMA</div>
          ${domCred.k==='f'?'<div style="font-size:9px;color:var(--cy-l);margin-top:2px;font-weight:700">★ Dom.</div>':''}
        </div>
        <div class="ace-cred-card" style="background:var(--go-x);border-color:rgba(212,150,10,.3)${domCred.k==='n'?';border-width:1.5px;border-color:#F7C14A':''}">
          <div class="ace-cred-val" style="color:var(--go-l)">★${G.cred.n||0}</div><div class="ace-cred-lbl" style="color:var(--go-l)">NARRAT.</div>
          ${domCred.k==='n'?'<div style="font-size:9px;color:var(--go-l);margin-top:2px;font-weight:700">★ Dom.</div>':''}
        </div>
        <div class="ace-cred-card" style="background:var(--gr-x);border-color:rgba(58,138,24,.3)${domCred.k==='t'?';border-width:1.5px;border-color:#80D050':''}">
          <div class="ace-cred-val" style="color:var(--gr-l)">⬟${G.cred.t||0}</div><div class="ace-cred-lbl" style="color:var(--gr-l)">TÉCNICA</div>
          ${domCred.k==='t'?'<div style="font-size:9px;color:var(--gr-l);margin-top:2px;font-weight:700">★ Dom.</div>':''}
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px">
        <div style="background:rgba(255,255,255,.03);border:.5px solid rgba(255,255,255,.1);border-radius:7px;padding:7px 10px">
          <div style="font-size:9px;color:var(--gh);font-weight:700;font-family:var(--fh);margin-bottom:2px">PERFIL DOMINANTE</div>
          <div style="font-size:12px;font-weight:600;color:${a.hex}">${domCred.l} — ${domCred.hint}</div>
        </div>
        <div style="background:rgba(255,255,255,.03);border:.5px solid rgba(255,255,255,.1);border-radius:7px;padding:7px 10px">
          <div style="font-size:9px;color:var(--gh);font-weight:700;font-family:var(--fh);margin-bottom:2px">ORIENTACIÓN VOCACIONAL <span style="font-weight:400;color:var(--mu);text-transform:none;letter-spacing:0">— preliminar</span></div>
          <div style="font-size:12px;font-weight:600;color:var(--cy-l)">${vocHint}</div>
          <div style="font-size:9px;color:var(--mu);margin-top:3px;line-height:1.4">Sugerencia inicial basada en distribución de créditos. Refinar en entrevista con base en justificaciones y portafolio.</div>
        </div>
      </div>
    </div>

    <!-- MISIONES -->
    <div style="border-top:.5px solid rgba(255,255,255,.08);padding:10px 14px">
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:var(--gh);font-weight:700;font-family:var(--fh);margin-bottom:7px">Misiones completadas</div>
      <div class="ace-missions">
        ${MISSIONS.map((m,i)=>`<div class="ace-m" style="border-left:3px solid ${G.mst[i]===3?m.ch:'var(--mu)'}">
          <span class="ace-m-num" style="background:${G.mst[i]===3?m.ch+'22':'rgba(255,255,255,.04)'};color:${G.mst[i]===3?m.ch:'var(--mu)'};border-radius:4px;padding:1px 6px">M${i+1}</span>
          <span class="ace-m-name">${m.name}</span>
          <span style="font-size:10px;color:var(--gh);flex:1">${m.disc}</span>
          <span class="ace-m-st" style="color:${G.mst[i]===3?m.ch:'var(--mu)'}">${G.mst[i]===3?'✓ Lista':'—'}</span>
        </div>`).join('')}
      </div>
    </div>

    <!-- INDICADORES PARA EL EVALUADOR -->
    <div style="border-top:.5px solid rgba(255,255,255,.08);padding:10px 14px">
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:var(--gh);font-weight:700;font-family:var(--fh);margin-bottom:7px">Indicadores de evaluación</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px">
        <div style="background:rgba(255,255,255,.03);border:.5px solid rgba(255,255,255,.1);border-radius:7px;padding:7px 9px;text-align:center">
          <div style="font-size:20px;font-weight:500;font-family:var(--fm)">${totalCred}</div>
          <div style="font-size:9px;color:var(--gh);margin-top:1px;font-family:var(--fh);font-weight:600">CRÉDITOS TOTALES</div>
        </div>
        <div style="background:rgba(255,255,255,.03);border:.5px solid rgba(255,255,255,.1);border-radius:7px;padding:7px 9px;text-align:center">
          <div style="font-size:20px;font-weight:500;font-family:var(--fm)">${mDone}/5</div>
          <div style="font-size:9px;color:var(--gh);margin-top:1px;font-family:var(--fh);font-weight:600">MISIONES OK</div>
        </div>
      </div>
      <div style="font-size:11px;color:var(--gh);line-height:1.5;background:rgba(255,255,255,.02);border-radius:6px;padding:7px 10px">
        Total créditos: <strong style="color:var(--wh)">${totalCred}</strong> · Misiones completadas: <strong style="color:var(--wh)">${mDone}/5</strong>
      </div>
    </div>

    <!-- RAZONAMIENTO CREATIVO — justificaciones de decisiones -->
    ${Object.values(G.decJust||{}).some(arr=>Array.isArray(arr)&&arr.some(j=>j))?`
    <div style="border-top:.5px solid rgba(255,255,255,.08);padding:10px 14px">
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:var(--gh);font-weight:700;font-family:var(--fh);margin-bottom:8px">Razonamiento creativo — por qué elegí cada camino</div>
      ${MISSIONS.map((m,mi)=>{
        const justs=G.decJust[mi]||[];
        const lines=m.decs.map((dec,di)=>{
          const j=justs[di];
          return j?`<div style="margin-bottom:5px"><span style="font-size:10px;color:${m.ch};font-weight:700">${dec.q.split('?')[0]}?</span><br><span style="font-size:12px;color:#DDDDEE">${j}</span></div>`:''
        }).filter(Boolean).join('');
        return lines?`<div style="margin-bottom:8px"><span style="font-size:10px;color:var(--gh);font-family:var(--fh)">${m.name} —</span>${lines}</div>`:''
      }).filter(Boolean).join('')}
    </div>`:``}

    <!-- MOODBOARD M1 — imágenes subidas -->
    ${G.mbBoard.some(function(s){return s&&s.dataUrl;})?`
    <div style="border-top:.5px solid rgba(255,255,255,.08);padding:10px 14px">
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:var(--gh);font-weight:700;font-family:var(--fh);margin-bottom:8px">Moodboard — Misión 1</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:5px">
        ${G.mbBoard.filter(function(s){return s&&s.dataUrl;}).map(function(s){return '<div style="aspect-ratio:1;border-radius:5px;overflow:hidden;position:relative"><img src="'+s.dataUrl+'" style="width:100%;height:100%;object-fit:cover"><div style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,.5);font-size:8px;color:rgba(255,255,255,.8);padding:2px 4px;text-overflow:ellipsis;overflow:hidden;white-space:nowrap">'+s.lbl+'</div></div>';}).join('')}
      </div>
    </div>`:``}

    <!-- IMÁGENES M5 — desarrollo de historia -->
    ${G.m5imgs&&G.m5imgs.some(function(s){return s&&s.dataUrl;})?`
    <div style="border-top:.5px solid rgba(255,255,255,.08);padding:10px 14px">
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:var(--gh);font-weight:700;font-family:var(--fh);margin-bottom:8px">Desarrollo visual — Misión 5</div>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:5px">
        ${G.m5imgs.filter(function(s){return s&&s.dataUrl;}).map(function(s){return '<div style="aspect-ratio:16/9;border-radius:5px;overflow:hidden;position:relative"><img src="'+s.dataUrl+'" style="width:100%;height:100%;object-fit:cover"><div style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,.5);font-size:8px;color:rgba(255,255,255,.8);padding:2px 4px;text-overflow:ellipsis;overflow:hidden;white-space:nowrap">'+s.lbl+'</div></div>';}).join('')}
      </div>
    </div>`:``}

    <!-- FRASE + VOZ -->
    ${frase?`<div class="ace-phrase" style="margin:0;border-top:.5px solid rgba(255,255,255,.08);padding:10px 14px"><div class="ace-phrase-lbl">Frase del universo</div><div class="ace-phrase-txt">"${frase}"</div></div>`:''}
    <div class="ace-voz" style="border-top:.5px solid rgba(255,255,255,.08);padding:10px 14px;margin:0">
      <div class="ace-voz-lbl">Voz del candidato — reflexión metacognitiva</div>
      ${document.getElementById('voz1')?.value?`<div class="ace-voz-item"><strong style="color:#CCCCEE">01 /</strong> ${document.getElementById('voz1').value}</div>`:'<div class="ace-voz-item" style="color:var(--mu)">01 / Sin respuesta</div>'}
      ${document.getElementById('voz2')?.value?`<div class="ace-voz-item"><strong style="color:#CCCCEE">02 /</strong> ${document.getElementById('voz2').value}</div>`:'<div class="ace-voz-item" style="color:var(--mu)">02 / Sin respuesta</div>'}
      ${document.getElementById('voz3')?.value?`<div class="ace-voz-item"><strong style="color:#CCCCEE">03 /</strong> ${document.getElementById('voz3').value}</div>`:'<div class="ace-voz-item" style="color:var(--mu)">03 / Sin respuesta</div>'}
    </div>

    <!-- VEREDICTO DEL EVALUADOR — solo visible para evaluador/coordinador -->
    ${(G.roomRole==='evaluator'||G.roomRole==='coordinator'||!G.room)?`
    <div style="border-top:.5px solid rgba(255,255,255,.08);padding:12px 14px">
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:var(--gh);font-weight:700;font-family:var(--fh);margin-bottom:10px">Rúbrica de evaluación</div>
      ${[
        {k:'d',lbl:'Pensamiento Divergente',pct:25,desc:'Originalidad, conexiones inesperadas, rompe lo obvio'},
        {k:'e',lbl:'Ejecución bajo Presión',pct:25,desc:'Toma decisiones con tiempo limitado, no se paraliza'},
        {k:'s',lbl:'Sensibilidad Estética',pct:20,desc:'Coherencia visual, criterio, gusto construido'},
        {k:'t',lbl:'Pensamiento Sistémico',pct:20,desc:'Las partes forman un todo — hay lógica entre misiones'},
        {k:'com',lbl:'Comunicación de la Idea',pct:10,desc:'Justifica, articula, hace visible su proceso'}
      ].map(dim=>{
        const val=G.rubric[dim.k]||0;
        const vetoBoth=(dim.k==='d'||dim.k==='e')&&(G.rubric.d===1&&G.rubric.e===1);
        return '<div style="margin-bottom:10px">'+
          '<div style="display:flex;justify-content:space-between;margin-bottom:3px">'+
            '<span style="font-size:12px;font-weight:700;color:var(--wh)">'+dim.lbl+' <span style="color:var(--gh);font-weight:400">('+dim.pct+'%)</span></span>'+
            '<span style="font-size:13px;font-weight:700;color:'+(val>=3?'var(--cy-l)':val===2?'var(--go-l)':val===1?'var(--co-l)':'var(--mu)')+'">'+['—','1 Bajo','2 Básico','3 Sólido','4 Destacado'][val]+'</span>'+
          '</div>'+
          '<div style="font-size:11px;color:var(--gh);margin-bottom:5px">'+dim.desc+'</div>'+
          '<div style="display:flex;gap:5px">'+
            [1,2,3,4].map(n=>'<button onclick="setRubric(&quot;'+dim.k+'&quot;,'+n+')" style="flex:1;padding:6px 0;border-radius:6px;font-size:12px;font-weight:700;cursor:pointer;border:1.5px solid '+(val===n?'var(--cy)':'rgba(255,255,255,.15)')+';background:'+(val===n?'rgba(31,174,128,.2)':'rgba(255,255,255,.03)')+';color:'+(val===n?'var(--cy-l)':'#AAAACC')+'">'+n+'</button>'
            ).join('')+
          '</div>'+
        '</div>';
      }).join('')}
      ${G.rubric.d===1&&G.rubric.e===1?'<div style="background:rgba(200,64,48,.15);border:1px solid rgba(200,64,48,.4);border-radius:8px;padding:9px 12px;margin-bottom:10px;font-size:13px;color:var(--co-l);font-weight:700">⚠ Criterio de veto activo — ambas dimensiones en nivel 1. Revisar antes de emitir veredicto.</div>':''}
      <div style="font-size:11px;color:var(--go-l);font-weight:600;margin-bottom:8px">
        Puntaje ponderado: ${Math.round((G.rubric.d||0)*25+(G.rubric.e||0)*25+(G.rubric.s||0)*20+(G.rubric.t||0)*20+(G.rubric.com||0)*10)}/400
      </div>
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:var(--gh);font-weight:700;font-family:var(--fh);margin-bottom:8px;margin-top:4px">Veredicto</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
        ${['No admitido','Lista de espera','Admitido','Admitido con mención'].map(v=>`<button onclick="this.parentElement.querySelectorAll('button').forEach(b=>b.style.cssText='');this.style.cssText='border-color:var(--cy);background:rgba(31,174,128,.18);color:var(--cy-l);font-weight:700'" style="font-size:11px;padding:5px 12px;border-radius:6px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.03);color:#C0C0E0;cursor:pointer;font-family:var(--fh);font-weight:600;transition:all .15s">${v}</button>`).join('')}
      </div>
      <textarea style="width:100%;background:rgba(255,255,255,.03);border:.5px solid rgba(255,255,255,.12);border-radius:7px;padding:8px 10px;color:#EEEEFF;font-size:12px;font-family:var(--fb);resize:none;outline:none;min-height:50px" placeholder="Fortalezas, áreas de desarrollo, orientación vocacional específica..." oninput="G.rubricNotes=this.value;saveSubmission()">${G.rubricNotes||''}</textarea>
    </div>`:``}
  </div>`;

  // OP grid
  const og=document.getElementById('op-grid');if(!og)return;
  og.innerHTML=[
    {idx:0,icon:'🎨',nm:'Identidad'},{idx:1,icon:'👕',nm:'Look'},
    {idx:2,icon:'🏛',nm:'Espacio'},{idx:3,icon:'⚡',nm:'Objeto'},{idx:4,icon:'📖',nm:'Historia'}
  ].map(s=>{
    const d=G.mst[s.idx]===3;const c=d?MISSIONS[s.idx].ch:'var(--mu)';
    return `<div class="op-slot${d?' pld':''}" style="${d?'border-color:'+MISSIONS[s.idx].ch+'44;background:'+MISSIONS[s.idx].ch+'09':'border-color:var(--bd)'}">
      <div class="op-slot-ico" style="opacity:${d?1:.2}">${s.icon}</div>
      <div class="op-slot-nm" style="color:${c}">${s.nm}</div>
      <div class="op-slot-sub">Misión ${s.idx+1}${d?' · ✓':' · pendiente'}</div>
    </div>`;
  }).join('')+`<div class="op-slot op-full" style="border-color:${a.hex}33;background:${a.hex}08">
    <div style="font-family:var(--fh);font-size:16px;font-weight:700;color:${a.hex}">${a.icon} ${a.name}</div>
    <div style="font-size:13px;color:var(--gh);margin-top:4px">${a.tags.join(' · ')} · ${done}/5 misiones</div>
  </div>`;
}

function exportCard(){
  const el=document.getElementById('export-target');
  if(!el){showToast('No hay tarjeta aún. Elige tu perfil primero.','t-warn');return;}
  window.print();
}

function printCard(){
  window.print();
}

// ═══════════════════════════════════════════ BREAKOUT ROOMS — Firebase v3
var SALA_MAX_DEFAULT = 6;

function genCode(){
  var chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var code='';
  for(var i=0;i<4;i++) code+=chars[Math.floor(Math.random()*chars.length)];
  return code;
}

function _fbRef(path){
  if(!window._fb) return null;
  return window._fb.ref(window._fb.db, path);
}

function _waitFbThen(fn){
  if(window._fbReady){ fn(); return; }
  document.addEventListener('fb-ready', function handler(){
    document.removeEventListener('fb-ready',handler);
    fn();
  });
}

// Tab switcher
function setSalaTab(tab){
  if((tab==='evaluador'||tab==='coordinador')&&!G._evalAuthed){
    document.getElementById('pin-gate').style.display='block';
    var pi=document.getElementById('pin-input');if(pi)pi.focus();
    return;
  }
  ['aplicante','evaluador','coordinador'].forEach(function(t){
    var btn=document.getElementById('stab-'+t);
    var panel=document.getElementById('spanel-'+t);
    if(btn) btn.classList.toggle('on', t===tab);
    if(panel) panel.style.display=(t===tab)?'block':'none';
  });
}

// State broadcast
function broadcastState(){
  if(!G.room||!G.roomName||!window._fb) return;
  var key=G.roomName.replace(/[.#$\/\[\]]/g,'_');
  var payload={
    name:G.roomName, ts:Date.now(),
    arch:G.arch?{name:G.arch.name,icon:G.arch.icon,hex:G.arch.hex}:null,
    mst:G.mst.slice(),
    cred:{v:G.cred.v,f:G.cred.f,n:G.cred.n,t:G.cred.t},
    penalties:G.penalties,
    done:G.mst.filter(function(s){return s===3;}).length
  };
  window._fb.set(_fbRef('salas/'+G.room+'/members/'+key), payload)
    .catch(function(e){console.warn('Firebase write:',e);});
}

// Room listener
function _attachRoomListener(code){
  if(G._fbUnsub && G._fbListenCode && window._fb){
    try{ window._fb.off(_fbRef('salas/'+G._fbListenCode+'/members')); }catch(e){}
  }
  G._fbListenCode=code;
  window._fb.onValue(_fbRef('salas/'+code+'/members'), function(snap){
    var data=snap.val()||{};
    G.teammates={};
    Object.keys(data).forEach(function(k){
      var m=data[k]; if(m&&m.name) G.teammates[m.name]=m;
    });
    _refreshRoomUI();
  });
  G._fbUnsub=true;
}

function _refreshRoomUI(){
  var activeSala=document.getElementById('sala-active');
  var evalSection=document.getElementById('sala-eval');
  if(activeSala&&activeSala.style.display!=='none') renderTeamGrid('team-grid');
  if(evalSection&&evalSection.style.display!=='none') renderTeamGrid('eval-team-grid');
  var count=Object.keys(G.teammates).length;
  var max=G._roomMax||SALA_MAX_DEFAULT;
  var txt=count+'/'+max+' miembro'+(count!==1?'s':'');
  var sc=document.getElementById('sala-members-count');
  var ec=document.getElementById('eval-members-count');
  var cb=document.getElementById('capacity-bar');
  if(sc)sc.textContent=txt;
  if(ec)ec.textContent=txt;
  if(cb){
    var pct=Math.round((count/max)*100);
    var col=count>=max?'var(--co)':count>=(max-1)?'var(--go)':'var(--cy)';
    cb.innerHTML='<div style="display:flex;align-items:center;gap:8px;font-size:12px">'+
      '<span style="color:'+col+'">'+count+'/'+max+' lugares</span>'+
      '<div style="flex:1;height:5px;background:var(--bg3);border-radius:3px;overflow:hidden">'+
        '<div style="height:100%;width:'+pct+'%;background:'+col+';border-radius:3px;transition:width .4s"></div>'+
      '</div>'+
      (count>=max?'<span style="color:var(--co);font-weight:700">LLENA</span>':'')+
    '</div>';
  }
}

function _detachListener(){
  if(G._fbUnsub && G._fbListenCode && window._fb){
    try{ window._fb.off(_fbRef('salas/'+G._fbListenCode+'/members')); }catch(e){}
  }
  G._fbUnsub=false; G._fbListenCode=null;
}

// APLICANTE
function joinSala(){
  var name=(document.getElementById('sala-name')?document.getElementById('sala-name').value:'').trim();
  var code=(document.getElementById('sala-code')?document.getElementById('sala-code').value:'').trim().toUpperCase();
  if(!name){showToast('Escribe tu nombre primero','t-warn');return;}
  if(code.length!==4){showToast('El codigo debe tener 4 letras','t-warn');return;}
  _waitFbThen(function(){
    window._fb.onValue(_fbRef('salas/'+code+'/meta'), function(snap){
      window._fb.off(_fbRef('salas/'+code+'/meta'));
      var meta=snap.val()||{};
      var max=meta.max||SALA_MAX_DEFAULT;
      G._roomMax=max;
      window._fb.onValue(_fbRef('salas/'+code+'/members'), function(msnap){
        window._fb.off(_fbRef('salas/'+code+'/members'));
        var members=msnap.val()||{};
        var count=Object.keys(members).length;
        var myKey=name.replace(/[.#$\/\[\]]/g,'_');
        var alreadyIn=!!members[myKey];
        if(!alreadyIn && count>=max){
          showToast('Sala '+code+' llena ('+max+'/'+max+'). Pide otro codigo.','t-warn');
          return;
        }
        _doJoinSala(name, code);
      },{onlyOnce:true});
    },{onlyOnce:true});
  });
}

function _doJoinSala(name, code){
  G.room=code; G.roomName=name; G.roomRole='player';
  document.getElementById('sala-code-display').textContent=code;
  document.getElementById('sala-join').style.display='none';
  document.getElementById('sala-active').style.display='block';
  _attachRoomListener(code);
  broadcastState();
  showToast('Sala '+code+' conectado!','t-ok');
}

function leaveSala(){
  if(G.room&&G.roomName&&window._fb){
    var key=G.roomName.replace(/[.#$\/\[\]]/g,'_');
    window._fb.remove(_fbRef('salas/'+G.room+'/members/'+key)).catch(function(){});
  }
  _detachListener();
  G.room=null; G.roomName=null; G.roomRole=null; G.teammates={};
  document.getElementById('sala-join').style.display='block';
  document.getElementById('sala-active').style.display='none';
  showToast('Saliste de la sala','t-warn');
}

// EVALUADOR
function createAndWatchSala(){
  _waitFbThen(function(){
    var code=genCode();
    var max=6;
    window._fb.set(_fbRef('salas/'+code+'/meta'),{max:max,created:Date.now()}).catch(function(){});
    _openEvalPanel(code, max);
    showToast('Sala '+code+' creada — comparte el codigo por Zoom','t-ok');
  });
}

function openEvalView(){
  var code=(document.getElementById('eval-code')?document.getElementById('eval-code').value:'').trim().toUpperCase();
  if(code.length!==4){showToast('Ingresa un codigo de 4 letras','t-warn');return;}
  _waitFbThen(function(){
    window._fb.onValue(_fbRef('salas/'+code+'/meta'), function(snap){
      window._fb.off(_fbRef('salas/'+code+'/meta'));
      var meta=snap.val()||{};
      var max=meta.max||SALA_MAX_DEFAULT;
      _openEvalPanel(code, max);
      showToast('Vista evaluador - Sala '+code,'t-ok');
    },{onlyOnce:true});
  });
}

function _openEvalPanel(code, max){
  G.room=code; G.roomRole='evaluator'; G._roomMax=max;
  document.getElementById('eval-code-display').textContent=code;
  var showEl=document.getElementById('eval-code-show');
  if(showEl)showEl.textContent=code;
  document.getElementById('eval-join').style.display='none';
  document.getElementById('sala-eval').style.display='block';
  G.teammates={};
  _attachRoomListener(code);
  renderTeamGrid('eval-team-grid');
}

function leaveEval(){
  _detachListener();
  G.room=null; G.roomRole=null; G.teammates={};
  document.getElementById('eval-join').style.display='block';
  document.getElementById('sala-eval').style.display='none';
  showToast('Cerraste la vista de evaluador','t-warn');
}

// COORDINADOR - Batch
var G_batchCodes=[];

function generateBatchSalas(){
  var n=parseInt(document.getElementById('batch-n').value)||5;
  var max=parseInt(document.getElementById('batch-max').value)||6;
  if(n<1||n>20){showToast('Entre 1 y 20 equipos','t-warn');return;}
  if(max<2||max>10){showToast('Entre 2 y 10 por sala','t-warn');return;}
  _waitFbThen(function(){
    G_batchCodes=[];
    var used={};
    while(G_batchCodes.length<n){
      var c=genCode();
      if(!used[c]){used[c]=true;G_batchCodes.push(c);}
    }
    G_batchCodes.forEach(function(code){
      window._fb.set(_fbRef('salas/'+code+'/meta'),{max:max,created:Date.now()}).catch(function(){});
    });
    _renderBatchCodes(max);
    _startMasterPanel();
    showToast(n+' salas generadas (max. '+max+' c/u)','t-ok');
  });
}

function _renderBatchCodes(max){
  var grid=document.getElementById('batch-codes-grid');
  var wrap=document.getElementById('batch-codes');
  if(!grid||!wrap)return;
  wrap.style.display='block';
  grid.innerHTML=G_batchCodes.map(function(code,i){
    return '<div style="background:var(--bg3);border:1px solid var(--bd);border-radius:9px;padding:12px;text-align:center">'+
      '<div style="font-size:10px;color:var(--gh);font-family:var(--fh);text-transform:uppercase;letter-spacing:.08em;margin-bottom:5px">Equipo '+(i+1)+'</div>'+
      '<div style="font-family:var(--fm);font-size:22px;font-weight:700;letter-spacing:.3em;color:var(--wh);margin-bottom:5px">'+code+'</div>'+
      '<div style="font-size:11px;color:var(--mu)">max. '+max+' personas</div>'+
      '<button onclick="copyCode(\''+code+'\')" style="margin-top:7px;background:transparent;border:.5px solid var(--bd);color:var(--gh);border-radius:5px;padding:3px 9px;cursor:pointer;font-size:11px">Copiar</button>'+
    '</div>';
  }).join('');
}

function copyCode(code){
  navigator.clipboard.writeText(code).then(function(){
    showToast('Codigo '+code+' copiado','t-ok');
  }).catch(function(){showToast(code,'t-ok');});
}

function copyAllCodes(){
  var text=G_batchCodes.map(function(c,i){return 'Equipo '+(i+1)+': '+c;}).join('\n');
  navigator.clipboard.writeText(text).then(function(){
    showToast('Todos los codigos copiados','t-ok');
  }).catch(function(){showToast('Copia: '+G_batchCodes.join(', '),'t-ok');});
}

// COORDINADOR - Master panel
var G_masterListeners={};

function _startMasterPanel(){
  var panel=document.getElementById('master-panel');
  if(panel) panel.style.display='block';
  Object.keys(G_masterListeners).forEach(function(code){
    try{ window._fb.off(_fbRef('salas/'+code+'/members')); }catch(e){}
  });
  G_masterListeners={};
  G_batchCodes.forEach(function(code){
    G_masterListeners[code]={members:{}};
    window._fb.onValue(_fbRef('salas/'+code+'/members'), function(snap){
      G_masterListeners[code].members=snap.val()||{};
      _renderMasterPanel();
    });
  });
}

function refreshMasterPanel(){
  _renderMasterPanel();
  showToast('Panel actualizado','t-ok');
}

function _renderMasterPanel(){
  var grid=document.getElementById('master-rooms-grid');
  var countEl=document.getElementById('master-active-count');
  if(!grid)return;
  var activeSalas=0;
  var mColors=['#8B7FE8','#1FAE80','#D4960A','#C84030','#C0308A'];
  var mNames=['ID','Look','Esp','Obj','Hist'];
  grid.innerHTML=G_batchCodes.map(function(code,idx){
    var data=G_masterListeners[code]?G_masterListeners[code].members:{};
    var members=Object.values(data).filter(function(m){return m&&m.name;});
    if(members.length>0) activeSalas++;
    var membersHtml=members.length===0?
      '<span style="font-size:12px;color:var(--mu)">Sin conexiones aun</span>':
      members.map(function(m){
        var hex=(m.arch&&m.arch.hex)||'#8888AA';
        var mst=m.mst||[0,0,0,0,0];
        var dots=mst.map(function(st,i){
          return '<span style="display:inline-block;width:14px;height:14px;border-radius:3px;'+
            'background:'+(st===3?mColors[i]+'33':'rgba(255,255,255,.06)')+';'+
            'border:1px solid '+(st===3?mColors[i]:'rgba(255,255,255,.1)')+';'+
            'font-size:8px;text-align:center;line-height:14px;'+
            'color:'+(st===3?mColors[i]:'var(--mu)')+'" title="'+mNames[i]+'">'+(st===3?'v':'.')+
          '</span>';
        }).join('');
        return '<div style="display:flex;align-items:center;gap:7px;padding:5px 0;border-bottom:.5px solid var(--bd)">'+
          '<span style="font-size:15px">'+((m.arch&&m.arch.icon)||'?')+'</span>'+
          '<span style="font-size:12px;font-weight:600;color:'+hex+';min-width:90px">'+m.name+'</span>'+
          '<div style="display:flex;gap:2px">'+dots+'</div>'+
          '<span style="font-size:11px;color:var(--gh);margin-left:auto">'+(m.done||0)+'/5</span>'+
        '</div>';
      }).join('');
    var hasMem=members.length>0;
    return '<div style="background:var(--bg2);border:1px solid '+(hasMem?'rgba(31,174,128,.3)':'var(--bd)')+';border-radius:10px;padding:13px">'+
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">'+
        '<span style="font-size:10px;color:var(--gh);font-family:var(--fh);text-transform:uppercase">Equipo '+(idx+1)+'</span>'+
        '<span style="font-family:var(--fm);font-size:14px;font-weight:700;letter-spacing:.2em;color:var(--wh)">'+code+'</span>'+
        '<span style="margin-left:auto;font-size:11px;color:'+(hasMem?'var(--cy-l)':'var(--mu)')+'">'+
          members.length+' conectado'+(members.length!==1?'s':'')+
        '</span>'+
      '</div>'+membersHtml+
    '</div>';
  }).join('');
  if(countEl) countEl.textContent=activeSalas;
}

// Shared render
function renderTeamGrid(gridId){
  var grid=document.getElementById(gridId);
  if(!grid)return;
  var members=Object.values(G.teammates);
  var allMembers=members.slice();
  if(G.roomRole==='player'&&G.roomName){
    var selfDone=G.mst.filter(function(s){return s===3;}).length;
    var selfEntry={name:G.roomName,
      arch:G.arch?{name:G.arch.name,icon:G.arch.icon,hex:G.arch.hex}:null,
      mst:G.mst.slice(),cred:Object.assign({},G.cred),
      penalties:G.penalties,done:selfDone,isSelf:true};
    allMembers=allMembers.filter(function(m){return m.name!==G.roomName;});
    allMembers.unshift(selfEntry);
  }
  if(!allMembers.length){
    grid.innerHTML='<div style="font-size:14px;color:var(--gh);padding:10px 0;grid-column:1/-1">'+
      (G.roomRole==='evaluator'?'Esperando que los aplicantes se conecten con el codigo de sala...':'Esperando a tus companeros...')+
    '</div>';
    return;
  }
  var mNames=['Identidad','Look','Espacio','Objeto','Historia'];
  var mColors=['#8B7FE8','#1FAE80','#D4960A','#C84030','#C0308A'];
  grid.innerHTML=allMembers.map(function(m){
    var hex=(m.arch&&m.arch.hex)||'#8888AA';
    var icon=(m.arch&&m.arch.icon)||'?';
    var archName=(m.arch&&m.arch.name)||'Sin arquetipo';
    var done=m.done||0;
    var mstArr=m.mst||[0,0,0,0,0];
    var progDots=mstArr.map(function(st,i){
      return '<div class="team-pd" style="'+
        'background:'+(st===3?mColors[i]+'22':st===2?mColors[i]+'11':'rgba(255,255,255,.03)')+';'+
        'border-color:'+(st===3?mColors[i]:st===2?mColors[i]+'66':'rgba(255,255,255,.1)')+';'+
        'color:'+(st===3?mColors[i]:'var(--mu)')+
        '" title="'+mNames[i]+'">'+(st===3?'v':st===2?'...':'o')+'</div>';
    }).join('');
    return '<div class="team-card" style="border-color:'+hex+(m.isSelf?';border-width:2px':'44')+'">'+
      '<div class="team-card-hdr">'+
        '<div class="team-card-av" style="background:'+hex+'20;border-color:'+hex+'">'+icon+'</div>'+
        '<div>'+
          '<div class="team-card-name">'+m.name+(m.isSelf?' <span style="font-size:10px;opacity:.5">(tu)</span>':'')+'</div>'+
          '<div class="team-card-arch" style="color:'+hex+'">'+archName+'</div>'+
        '</div>'+
      '</div>'+
      '<div class="team-prog">'+progDots+'</div>'+
      '<div class="team-creds">'+
        '<span class="team-cred" style="background:var(--pu-x);color:var(--pu-l)">'+String.fromCodePoint(9670)+((m.cred&&m.cred.v)||0)+'</span>'+
        '<span class="team-cred" style="background:var(--cy-x);color:var(--cy-l)">'+String.fromCodePoint(11041)+((m.cred&&m.cred.f)||0)+'</span>'+
        '<span class="team-cred" style="background:var(--go-x);color:var(--go-l)">'+String.fromCodePoint(9733)+((m.cred&&m.cred.n)||0)+'</span>'+
        '<span class="team-cred" style="background:var(--gr-x);color:var(--gr-l)">'+String.fromCodePoint(11039)+((m.cred&&m.cred.t)||0)+'</span>'+
      '</div>'+
      '<div style="font-size:11px;color:var(--gh);margin-top:6px">'+done+'/5 misiones'+
        (m.penalties>0?' <span style="color:var(--co)">'+m.penalties+' pen.</span>':'')+
      '</div>'+
    '</div>';
  }).join('');
}

// ═══════════════════════════════════════════ NEW v9 HELPERS

// Decision justification
function saveDecJust(idx,di,val){
  if(!G.decJust)G.decJust=[[null,null],[null,null],[null,null],[null,null],[null]];
  if(!G.decJust[idx])G.decJust[idx]=[null,null];
  G.decJust[idx][di]=val;
  saveCheckpoint();
}

// Custom palette
function selPal(pi){
  G.selectedPal=pi;
  if(pi===-1&&!G.customPal)G.customPal=['#333333','#777777','#AAAAAA','#CCCCCC','#FFFFFF'];
  renderMission(G.mActive);
}
function setCustomPal(ci,col){
  if(!G.customPal)G.customPal=['#333333','#777777','#AAAAAA','#CCCCCC','#FFFFFF'];
  G.customPal[ci]=col;
  G.selectedPal=-1;
  renderMission(G.mActive);
}

// M4 other object
function setObjOther(key,val){
  if(!G.objOther)G.objOther={name:'',desc:'',dataUrl:null};
  G.objOther[key]=val;
  // Grant bonus credits once name+desc filled
  if(G.objOther.name&&G.objOther.desc&&!G.objOther.credited){
    gain({v:2});
    G.objOther.credited=true;
    showToast('◆◆ extra — pensamiento divergente: objeto propio','t-ok');
  }
  saveCheckpoint();
}
function objOtherUpload(evt){
  var file=evt.target.files&&evt.target.files[0];
  if(!file)return;
  if(file.size>5*1024*1024){showToast('Máx. 5 MB','t-warn');return;}
  var reader=new FileReader();
  reader.onload=function(e){
    if(!G.objOther)G.objOther={name:'',desc:'',dataUrl:null};
    G.objOther.dataUrl=e.target.result;
    renderMission(G.mActive);
  };
  reader.readAsDataURL(file);
}

function clearObjOtherImg(){
  if(G.objOther)G.objOther.dataUrl=null;
  renderMission(G.mActive);
}

// M5 pre-route question
function setM5Preq(qi){G.m5preq=qi;renderMission(G.mActive);}

// Synthesis challenge
function completeSynth(){
  if(!G.synthAns||G.synthAns.trim().length<10){
    showToast('Escribe al menos una oración completa','t-warn');return;
  }
  G.synthDone=true;
  gain({v:1,n:1});
  saveCheckpoint();
  renderTab();
  showToast('✓ Reto de síntesis completado — +◆ +★','t-ok');
}

// Rubric scoring
function setRubric(key,val){
  G.rubric[key]=val;
  saveSubmission();
  renderOP();
}

// Checkpoint — localStorage (exclude images to stay within quota)
function saveCheckpoint(){
  try{
    var snap={
      aIdx:G.aIdx,mst:G.mst,cred:G.cred,
      decSel:G.decSel,decJust:G.decJust,
      selectedPal:G.selectedPal,customPal:G.customPal,palNote:G.palNote,
      selectedSpace:G.selectedSpace,selectedEls:G.selectedEls,
      selectedObjs:G.selectedObjs,objCat:G.objCat,
      objOther:G.objOther?{name:G.objOther.name,desc:G.objOther.desc,credited:G.objOther.credited}:null,
      routePick:G.routePick,m5preq:G.m5preq,storyScenes:G.storyScenes,
      penalties:G.penalties,synthDone:G.synthDone,synthAns:G.synthAns,
      silGender:G.silGender,silBase:G.silBase,silTop:G.silTop,silBottom:G.silBottom,
      silShoes:G.silShoes,silAcc:G.silAcc,silColor:G.silColor,
      rubric:G.rubric,rubricNotes:G.rubricNotes
    };
    localStorage.setItem('cq_checkpoint',JSON.stringify(snap));
  }catch(e){}
}

function loadCheckpoint(){
  try{
    var raw=localStorage.getItem('cq_checkpoint');
    if(!raw)return false;
    var snap=JSON.parse(raw);
    if(snap.aIdx==null||snap.aIdx===undefined)return false;
    // Restore state
    G.aIdx=snap.aIdx;G.arch=ARCHS[snap.aIdx];
    G.mst=snap.mst||G.mst;G.cred=snap.cred||G.cred;
    G.decSel=snap.decSel||G.decSel;G.decJust=snap.decJust||G.decJust;
    G.selectedPal=snap.selectedPal!=null?snap.selectedPal:null;
    G.customPal=snap.customPal||null;G.palNote=snap.palNote||'';
    G.selectedSpace=snap.selectedSpace||null;G.selectedEls=snap.selectedEls||[];
    G.selectedObjs=snap.selectedObjs||[];G.objCat=snap.objCat||'tech';
    G.objOther=snap.objOther||null;
    G.routePick=snap.routePick!=null?snap.routePick:null;
    G.m5preq=snap.m5preq!=null?snap.m5preq:null;
    G.storyScenes=snap.storyScenes||['','','',''];
    G.penalties=snap.penalties||0;
    G.synthDone=snap.synthDone||false;G.synthAns=snap.synthAns||null;
    G.silGender=snap.silGender||'M';G.silBase=snap.silBase||'MA';
    G.silTop=snap.silTop||null;G.silBottom=snap.silBottom||null;
    G.silShoes=snap.silShoes||null;G.silAcc=snap.silAcc||null;
    G.silColor=snap.silColor||'#2A3A5C';
    G.rubric=snap.rubric||{d:0,e:0,s:0,t:0,com:0};
    G.rubricNotes=snap.rubricNotes||'';
    return true;
  }catch(e){return false;}
}

function clearCheckpoint(){
  try{localStorage.removeItem('cq_checkpoint');}catch(e){}
}


// ══════════════════════════════════════ PIN AUTH SYSTEM

function generateSessionPin(){
  _generatePin('evaluador');
}
function generateCoordPin(){
  _generatePin('coordinador');
}
function _generatePin(role){
  if(!window._fb){showToast('Espera — conectando a Firebase...','t-warn');return;}
  var pin='';for(var i=0;i<6;i++)pin+=Math.floor(Math.random()*10);
  var expires=Date.now()+(4*60*60*1000);
  window._fb.set(window._fb.ref(window._fb.db,'sessions/'+pin),{
    role:role,created:Date.now(),expires:expires
  }).then(function(){
    var roleLabel=role==='coordinador'?'Coordinador':'Evaluador';
    var expiresStr=new Date(expires).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'});
    var el=document.getElementById('generated-pin-display');
    if(el){
      el.style.display='block';
      el.innerHTML=
        '<div style="font-size:11px;color:var(--gh);font-weight:600;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px">PIN '+roleLabel+' generado</div>'+
        '<div id="gpd-pin" style="font-size:38px;font-weight:900;font-family:var(--fm);letter-spacing:.4em;color:var(--wh);margin-bottom:4px">'+pin+'</div>'+
        '<div style="font-size:11px;color:var(--mu);margin-bottom:8px">Expira a las '+expiresStr+' — SOLO para '+roleLabel.toLowerCase()+'es</div>'+
        '<button onclick="copyPin()" style="background:rgba(139,127,232,.2);border:.5px solid var(--pu);color:var(--pu-l);border-radius:6px;padding:5px 14px;cursor:pointer;font-size:12px;font-family:var(--fh);font-weight:600">Copiar PIN</button>';
    }
    showToast('PIN '+pin+' generado — comparte por canal privado','t-ok',4000);
  }).catch(function(e){showToast('Error: '+e.message,'t-warn');});
}

function copyPin(){
  var el=document.getElementById('gpd-pin');
  if(!el)return;
  var pin=el.textContent.trim();
  navigator.clipboard.writeText(pin).then(function(){
    showToast('PIN '+pin+' copiado','t-ok');
  }).catch(function(){showToast('PIN: '+pin,'t-ok',5000);});
}

function verifyPin(){
  var input=document.getElementById('pin-input');
  var pin=(input||{}).value||'';
  pin=pin.trim();
  if(pin.length!==6||isNaN(Number(pin))){
    _pinError('El PIN debe ser de 6 dígitos numéricos');return;
  }
  if(!window._fb){_pinError('Sin conexión. Verifica tu internet.');return;}
  var errEl=document.getElementById('pin-error');
  if(errEl){errEl.style.display='block';errEl.style.color='var(--gh)';errEl.textContent='Verificando...';}
  window._fb.onValue(window._fb.ref(window._fb.db,'sessions/'+pin),function(snap){
    window._fb.off(window._fb.ref(window._fb.db,'sessions/'+pin));
    var data=snap.val();
    if(!data){_pinError('PIN incorrecto — solicítalo al coordinador.');return;}
    if(Date.now()>data.expires){_pinError('Este PIN expiró — pide al coordinador uno nuevo.');return;}
    // Grant access
    G._evalAuthed=true;
    var role=data.role||'evaluador';
    G.roomRole=role;
    document.getElementById('pin-gate').style.display='none';
    if(errEl)errEl.style.display='none';
    if(input)input.value='';
    _injectEvalTabs(role);
    showToast('Acceso verificado como '+(role==='coordinador'?'Coordinador':'Evaluador'),'t-ok');
    setSalaTab(role);
    // Cargar lista de entregables (admin only)
    setTimeout(loadEntregables,200);
  },{onlyOnce:true});
}

function _pinError(msg){
  var errEl=document.getElementById('pin-error');
  if(errEl){errEl.style.display='block';errEl.style.color='var(--co-l)';errEl.textContent=msg;}
  var input=document.getElementById('pin-input');
  if(input){input.style.borderColor='var(--co)';setTimeout(function(){input.style.borderColor='';},1800);}
}

function _injectEvalTabs(role){
  var el=document.getElementById('sala-tabs');
  if(!el)return;
  var html='<button class="sala-tab" id="stab-aplicante" onclick="setSalaTab(&quot;aplicante&quot;)">Aplicante</button>'+
    '<button class="sala-tab on" id="stab-evaluador" onclick="setSalaTab(&quot;evaluador&quot;)">Evaluador</button>'+
    (role==='coordinador'?'<button class="sala-tab" id="stab-coordinador" onclick="setSalaTab(&quot;coordinador&quot;)">Coordinador</button>':'');
  el.innerHTML=html;
}

function revokeEvalAccess(){
  G._evalAuthed=false;G.roomRole=null;
  var el=document.getElementById('sala-tabs');
  if(el){
    el.innerHTML=
      '<button class="sala-tab on" id="stab-aplicante" onclick="setSalaTab(&quot;aplicante&quot;)">🎮 Aplicante</button>'+
      '<span style="flex:1"></span>'+
      '<button class="eval-entry" onclick="document.getElementById(&quot;pin-gate&quot;).style.display=&quot;block&quot;;document.getElementById(&quot;pin-input&quot;).focus()">🔐 Soy evaluador</button>';
  }
  setSalaTab('aplicante');
  showToast('Sesión de evaluador cerrada','t-warn');
}

// Cleanup expired sessions on load
setTimeout(function(){
  if(!window._fb)return;
  try{
    window._fb.onValue(window._fb.ref(window._fb.db,'sessions'),function(snap){
      window._fb.off(window._fb.ref(window._fb.db,'sessions'));
      var data=snap.val();if(!data)return;
      Object.keys(data).forEach(function(pin){
        if(data[pin].expires&&Date.now()>data[pin].expires)
          window._fb.remove(window._fb.ref(window._fb.db,'sessions/'+pin)).catch(function(){});
      });
    },{onlyOnce:true});
  }catch(e){}
},3000);

// ═══════════════════════════════════════════ INIT
// Check for saved checkpoint — runs immediately, doesn't need data
(function(){
  try{
    var raw=localStorage.getItem('cq_checkpoint');
    if(raw){
      var snap=JSON.parse(raw);
      if(snap&&snap.aIdx!=null){
        // Show restore banner
        var banner=document.createElement('div');
        banner.id='restore-banner';
        banner.style.cssText='position:fixed;top:0;left:0;right:0;z-index:9999;background:rgba(10,10,24,.97);border-bottom:1px solid rgba(139,127,232,.4);padding:14px 20px;display:flex;align-items:center;gap:14px;backdrop-filter:blur(20px)';
        banner.innerHTML='<span style="font-size:20px">💾</span>'+
          '<span style="color:#DDDDFF;font-size:14px;flex:1">Hay una sesión guardada. ¿Continuar donde lo dejaste?</span>'+
          '<button onclick="restoreSession()" style="background:rgba(139,127,232,.3);border:1px solid var(--pu);color:var(--pu-l);border-radius:8px;padding:8px 18px;cursor:pointer;font-size:13px;font-weight:700">Continuar sesión</button>'+
          '<button onclick="document.getElementById(\'restore-banner\').remove();clearCheckpoint()" style="background:transparent;border:.5px solid rgba(255,255,255,.2);color:var(--gh);border-radius:8px;padding:8px 14px;cursor:pointer;font-size:13px">Empezar de nuevo</button>';
        document.body.appendChild(banner);
      }
    }
  }catch(e){}
})();

async function restoreSession(){
  await DATA_READY;
  if(loadCheckpoint()){
    document.getElementById('restore-banner')&&document.getElementById('restore-banner').remove();
    buildSlider();syncC();updateMtrack();
    goS('tablero');renderTab();
    showToast('Sesión restaurada','t-ok');
  }
}

// ═══════════════════════════════════════════ IDENTITY + SUBMISSIONS
const ID_KEY='cq_identity_v1';

function initIdentityGate(){
  // Si ya hay identidad guardada, la cargamos y arrancamos directo
  try{
    const saved=localStorage.getItem(ID_KEY);
    if(saved){
      G.identity=JSON.parse(saved);
      G._submissionId=submissionSlug(G.identity);
      G._iniciadoTs=Number(localStorage.getItem(ID_KEY+'_started'))||Date.now();
      // Asegura que existe en Firebase (puede ser primera vez tras refresh)
      saveSubmission(true);
      return;
    }
  }catch(e){}
  // No hay identidad → mostrar modal
  const m=document.getElementById('identity-modal');
  if(m)m.style.display='flex';
}

function submissionSlug(id){
  const raw=(id.nombre+'_'+id.prepa+'_'+id.estado).toLowerCase();
  return raw.replace(/[áàä]/g,'a').replace(/[éèë]/g,'e').replace(/[íìï]/g,'i')
    .replace(/[óòö]/g,'o').replace(/[úùü]/g,'u').replace(/ñ/g,'n')
    .replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,80);
}

function submitIdentity(){
  const nombre=(document.getElementById('id-nombre').value||'').trim();
  const prepa=(document.getElementById('id-prepa').value||'').trim();
  const estado=(document.getElementById('id-estado').value||'').trim();
  if(!nombre||nombre.length<3){showToast('Escribe tu nombre completo','t-warn');return;}
  if(!prepa||prepa.length<3){showToast('Escribe tu preparatoria','t-warn');return;}
  if(!estado){showToast('Selecciona tu estado','t-warn');return;}
  G.identity={nombre,prepa,estado};
  G._submissionId=submissionSlug(G.identity);
  G._iniciadoTs=Date.now();
  try{
    localStorage.setItem(ID_KEY,JSON.stringify(G.identity));
    localStorage.setItem(ID_KEY+'_started',String(G._iniciadoTs));
  }catch(e){}
  document.getElementById('identity-modal').style.display='none';
  saveSubmission(true);
  showToast('Hola '+nombre.split(' ')[0]+' — bienvenido a tu prueba','t-ok');
}

// Auto-guardado en Firebase. Se llama en checkpoints clave.
let _saveTimer=null;
function saveSubmission(immediate){
  if(!G.identity||!G._submissionId)return;
  // Debounce 800ms para no saturar la DB con cada keystroke
  if(_saveTimer)clearTimeout(_saveTimer);
  if(!immediate){_saveTimer=setTimeout(_doSave,800);return;}
  _doSave();
}

function _doSave(){
  if(!window._fb||!G.identity||!G._submissionId)return;
  const tiempoUsado=5400-(G.secs||5400);
  const mDone=G.mst.filter(s=>s===3).length;
  const totalCred=(G.cred.v||0)+(G.cred.f||0)+(G.cred.n||0)+(G.cred.t||0);
  const payload={
    nombre:G.identity.nombre,
    prepa:G.identity.prepa,
    estado:G.identity.estado,
    arquetipo:G.arch?{id:G.arch.id,name:G.arch.name,code:G.arch.code,hex:G.arch.hex,icon:G.arch.icon}:null,
    cred:{v:G.cred.v||0,f:G.cred.f||0,n:G.cred.n||0,t:G.cred.t||0},
    totalCreditos:totalCred,
    misionesCompletadas:mDone,
    mst:G.mst.slice(),
    decSel:G.decSel,
    decJust:G.decJust,
    selectedPal:G.selectedPal||null,
    sil:{gender:G.silGender,base:G.silBase,top:G.silTop,bottom:G.silBottom,shoes:G.silShoes,acc:G.silAcc,color:G.silColor},
    selectedSpace:G.selectedSpace||null,
    selectedEls:G.selectedEls||[],
    selectedObjs:G.selectedObjs||[],
    routePick:G.routePick||null,
    animType:G.animType||null,
    rubrica:G.rubric||null,
    rubricaNotes:G.rubricNotes||'',
    fraseUniverso:G.fraseUniverso||'',
    carreraSugerida:G._carreraSugerida||null,
    carrerasSugeridas:G._carrerasSugeridas||null,
    sala:G.room||null,
    iniciado:G._iniciadoTs||Date.now(),
    actualizado:Date.now(),
    entregado:G._entregadoTs||null,
    tiempoUsadoSegundos:tiempoUsado,
    estado_entrega:G._entregadoTs?'entregado':'en_proceso'
  };
  // Limpia undefined (Firebase no los acepta)
  Object.keys(payload).forEach(k=>{if(payload[k]===undefined)delete payload[k];});
  _waitFbThen(function(){
    window._fb.update(_fbRef('submissions/'+G._submissionId),payload)
      .catch(function(e){console.warn('saveSubmission:',e.message);});
  });
}

function entregarFinal(){
  if(!G.identity){showToast('Falta tu identidad','t-warn');return;}
  const mDone=G.mst.filter(s=>s===3).length;
  if(mDone<5){
    if(!confirm('Aún te faltan misiones por completar ('+mDone+'/5). ¿Entregar de todas formas?'))return;
  }
  G._entregadoTs=Date.now();
  G.running=false;
  saveSubmission(true);
  showToast('Entregable enviado · Gracias '+G.identity.nombre.split(' ')[0],'t-ok',5000);
  // Refrescar one-pager UI
  if(typeof renderOP==='function')renderOP();
}

function resetIdentity(){
  if(!confirm('¿Borrar tu identidad guardada y empezar de cero? (no borra el entregable del servidor)'))return;
  try{localStorage.removeItem(ID_KEY);localStorage.removeItem(ID_KEY+'_started');}catch(e){}
  location.reload();
}

function toggleFootInfo(){
  const wrap=document.getElementById('cq-foot-expand');
  const btn=document.getElementById('cq-foot-toggle');
  if(!wrap||!btn)return;
  const open=wrap.classList.toggle('is-open');
  btn.setAttribute('aria-expanded',open?'true':'false');
  wrap.setAttribute('aria-hidden',open?'false':'true');
  if(open){
    // Scroll suave para que se vea el contenido expandido
    setTimeout(()=>{wrap.scrollIntoView({behavior:'smooth',block:'nearest'})},250);
  }
}

// ═══════════════════════════════════════════ ADMIN — ENTREGABLES PANEL
let ENTREGABLES={};      // cache local del snapshot
let _entListenAttached=false;

function loadEntregables(){
  if(!G._evalAuthed){return;} // protegido por PIN
  _waitFbThen(function(){
    if(_entListenAttached){
      // Forzar refresh: detach + reattach
      try{window._fb.off(_fbRef('submissions'));}catch(e){}
      _entListenAttached=false;
    }
    window._fb.onValue(_fbRef('submissions'),function(snap){
      ENTREGABLES=snap.val()||{};
      renderEntregables();
    });
    _entListenAttached=true;
  });
}

function renderEntregables(){
  const tbl=document.getElementById('entregables-table');
  const empty=document.getElementById('entregables-empty');
  const count=document.getElementById('entregables-count');
  if(!tbl||!empty)return;
  const search=(document.getElementById('entregables-search')?.value||'').toLowerCase().trim();
  const filter=document.getElementById('entregables-filter')?.value||'todos';
  let rows=Object.keys(ENTREGABLES).map(id=>({id,...ENTREGABLES[id]}));
  // Filtros
  rows=rows.filter(r=>{
    if(filter==='entregado'&&r.estado_entrega!=='entregado')return false;
    if(filter==='en_proceso'&&r.estado_entrega==='entregado')return false;
    if(search){
      const hay=((r.nombre||'')+' '+(r.prepa||'')+' '+(r.estado||'')).toLowerCase();
      if(!hay.includes(search))return false;
    }
    return true;
  });
  // Ordena: entregados primero por fecha de entrega desc, después en proceso por última actividad desc
  rows.sort((a,b)=>{
    if(a.estado_entrega!==b.estado_entrega)return a.estado_entrega==='entregado'?-1:1;
    const ta=a.entregado||a.actualizado||0;
    const tb=b.entregado||b.actualizado||0;
    return tb-ta;
  });
  if(count){
    const totales=Object.keys(ENTREGABLES).length;
    const ents=Object.values(ENTREGABLES).filter(r=>r.estado_entrega==='entregado').length;
    count.textContent=`${ents} entregados · ${totales-ents} en proceso`;
  }
  if(rows.length===0){
    empty.style.display='block';
    empty.textContent=Object.keys(ENTREGABLES).length===0?'No hay entregables aún. Los aplicantes aparecerán aquí en cuanto inicien.':'No hay resultados con ese filtro.';
    tbl.style.display='none';
    return;
  }
  empty.style.display='none';
  tbl.style.display='table';
  tbl.innerHTML='<thead><tr>'+
    '<th>Aplicante</th>'+
    '<th>Estado</th>'+
    '<th>Tiempo</th>'+
    '<th>Arquetipo</th>'+
    '<th>Carrera sugerida</th>'+
    '<th>Misiones</th>'+
    '<th>Notas evaluador</th>'+
    '<th></th>'+
    '</tr></thead><tbody>'+rows.map(r=>{
      const t=r.tiempoUsadoSegundos||0;
      const tStr=Math.floor(t/60)+':'+String(t%60).padStart(2,'0');
      const arch=r.arquetipo||{};
      const archHtml=arch.name?'<span class="ent-arch-pill" style="color:'+(arch.hex||'#fff')+';border-color:'+(arch.hex||'var(--bd)')+'40">'+(arch.icon||'')+' '+arch.name+'</span>':'<span style="color:var(--mu);font-size:11px">—</span>';
      const stateHtml=r.estado_entrega==='entregado'?'<span class="ent-badge b-done">✓ ENTREGADO</span>':'<span class="ent-badge b-prog">⏱ EN PROCESO</span>';
      const safeId=r.id.replace(/'/g,'&#39;');
      return '<tr>'+
        '<td><div class="ent-row-name">'+escHtml(r.nombre||'(sin nombre)')+'</div>'+
          '<div class="ent-row-prepa">'+escHtml(r.prepa||'')+(r.estado?' · '+escHtml(r.estado):'')+'</div></td>'+
        '<td>'+stateHtml+'</td>'+
        '<td style="font-family:var(--fm);font-size:12px;color:var(--gh)">'+tStr+'</td>'+
        '<td>'+archHtml+'</td>'+
        '<td style="color:var(--cy-l);font-size:12px;font-weight:600">'+escHtml(r.carreraSugerida||'—')+'</td>'+
        '<td style="font-family:var(--fm);font-weight:700;color:'+(r.misionesCompletadas===5?'var(--cy-l)':'var(--gh)')+'">'+(r.misionesCompletadas||0)+'/5</td>'+
        '<td><textarea class="ent-notes-input" rows="2" oninput="updateEntregableNota(\''+safeId+'\',this.value)" placeholder="—">'+escHtml(r.notas||'')+'</textarea></td>'+
        '<td><div class="ent-actions">'+
          '<button class="ent-btn" onclick="viewEntregable(\''+safeId+'\')">Ver</button>'+
        '</div></td>'+
      '</tr>';
    }).join('')+'</tbody>';
}

function escHtml(s){
  if(s===null||s===undefined)return '';
  return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

let _notesTimer={};
function updateEntregableNota(id,val){
  if(!window._fb)return;
  // Debounce 600ms por aplicante
  if(_notesTimer[id])clearTimeout(_notesTimer[id]);
  _notesTimer[id]=setTimeout(function(){
    window._fb.update(_fbRef('submissions/'+id),{notas:val,notasActualizado:Date.now()})
      .catch(function(e){console.warn('updateNota:',e.message);});
  },600);
}

function viewEntregable(id){
  const r=ENTREGABLES[id];
  if(!r){showToast('Entregable no encontrado','t-warn');return;}
  const wrap=document.getElementById('entregable-detail');
  if(!wrap)return;
  const arch=r.arquetipo||{};
  const cred=r.cred||{v:0,f:0,n:0,t:0};
  const totalCred=(cred.v||0)+(cred.f||0)+(cred.n||0)+(cred.t||0);
  const t=r.tiempoUsadoSegundos||0;
  const tStr=Math.floor(t/60)+' min '+(t%60)+' s';
  const dec=r.decJust||[];
  const decHtml=Array.isArray(dec)?dec.map((arr,mi)=>{
    if(!Array.isArray(arr))return '';
    const ms=MISSIONS[mi]?MISSIONS[mi].name:'Misión '+(mi+1);
    const lines=arr.filter(j=>j).map(j=>'<div style="font-size:13px;color:#DDDDEE;line-height:1.5;margin-bottom:5px">— '+escHtml(j)+'</div>').join('');
    return lines?'<div style="margin-bottom:14px"><div style="font-family:var(--fh);font-size:11px;font-weight:700;color:'+(arch.hex||'#fff')+';margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em">'+escHtml(ms)+'</div>'+lines+'</div>':'';
  }).join(''):'';
  const carreras=Array.isArray(r.carrerasSugeridas)?r.carrerasSugeridas:(r.carreraSugerida?[r.carreraSugerida]:[]);
  const rubrica=r.rubrica||{};
  const score=Math.round((rubrica.d||0)*25+(rubrica.e||0)*25+(rubrica.s||0)*20+(rubrica.t||0)*20+(rubrica.com||0)*10);
  wrap.style.display='block';
  wrap.innerHTML='<div class="tool-block" style="border-color:'+(arch.hex||'var(--bd)')+'66;margin-top:14px">'+
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;gap:12px;flex-wrap:wrap">'+
      '<div>'+
        '<div style="font-family:var(--fh);font-size:22px;font-weight:600;color:var(--wh);margin-bottom:4px">'+escHtml(r.nombre||'(sin nombre)')+'</div>'+
        '<div style="font-size:12px;color:var(--gh)">'+escHtml(r.prepa||'')+(r.estado?' · '+escHtml(r.estado):'')+'</div>'+
      '</div>'+
      '<button onclick="document.getElementById(\'entregable-detail\').style.display=\'none\'" style="background:transparent;border:.5px solid var(--bd);color:var(--gh);padding:5px 12px;border-radius:6px;cursor:pointer;font-size:12px">Cerrar</button>'+
    '</div>'+
    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:14px">'+
      '<div style="background:var(--bg3);border:.5px solid var(--bd);border-radius:8px;padding:10px"><div style="font-size:10px;color:var(--gh);text-transform:uppercase;letter-spacing:.06em;font-family:var(--fh);font-weight:700;margin-bottom:3px">Arquetipo</div><div style="font-size:14px;font-weight:700;color:'+(arch.hex||'#fff')+'">'+(arch.icon||'')+' '+escHtml(arch.name||'—')+'</div></div>'+
      '<div style="background:var(--bg3);border:.5px solid var(--bd);border-radius:8px;padding:10px"><div style="font-size:10px;color:var(--gh);text-transform:uppercase;letter-spacing:.06em;font-family:var(--fh);font-weight:700;margin-bottom:3px">Estado</div><div style="font-size:14px;font-weight:700;color:'+(r.estado_entrega==='entregado'?'var(--cy-l)':'var(--go-l)')+'">'+(r.estado_entrega==='entregado'?'✓ Entregado':'⏱ En proceso')+'</div></div>'+
      '<div style="background:var(--bg3);border:.5px solid var(--bd);border-radius:8px;padding:10px"><div style="font-size:10px;color:var(--gh);text-transform:uppercase;letter-spacing:.06em;font-family:var(--fh);font-weight:700;margin-bottom:3px">Tiempo usado</div><div style="font-size:14px;font-weight:700;color:var(--wh);font-family:var(--fm)">'+tStr+'</div></div>'+
      '<div style="background:var(--bg3);border:.5px solid var(--bd);border-radius:8px;padding:10px"><div style="font-size:10px;color:var(--gh);text-transform:uppercase;letter-spacing:.06em;font-family:var(--fh);font-weight:700;margin-bottom:3px">Misiones</div><div style="font-size:14px;font-weight:700;color:'+(r.misionesCompletadas===5?'var(--cy-l)':'var(--wh)')+'">'+(r.misionesCompletadas||0)+'/5</div></div>'+
    '</div>'+
    '<div style="background:rgba(139,127,232,.06);border:.5px solid rgba(139,127,232,.25);border-radius:8px;padding:12px;margin-bottom:14px">'+
      '<div style="font-size:10px;color:var(--gh);text-transform:uppercase;letter-spacing:.06em;font-family:var(--fh);font-weight:700;margin-bottom:6px">Carrera sugerida</div>'+
      '<div style="font-size:15px;font-weight:700;color:var(--pu-l);margin-bottom:4px">'+escHtml(carreras[0]||'—')+'</div>'+
      (carreras.length>1?'<div style="font-size:12px;color:var(--gh)">Otras: '+carreras.slice(1).map(escHtml).join(' · ')+'</div>':'')+
    '</div>'+
    '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px">'+
      '<div style="background:var(--bg3);border-radius:7px;padding:9px;text-align:center"><div style="font-size:10px;color:var(--pu-l);font-family:var(--fh);font-weight:700">VISIÓN</div><div style="font-size:18px;font-weight:700;color:var(--wh)">'+(cred.v||0)+'</div></div>'+
      '<div style="background:var(--bg3);border-radius:7px;padding:9px;text-align:center"><div style="font-size:10px;color:var(--cy-l);font-family:var(--fh);font-weight:700">FORMA</div><div style="font-size:18px;font-weight:700;color:var(--wh)">'+(cred.f||0)+'</div></div>'+
      '<div style="background:var(--bg3);border-radius:7px;padding:9px;text-align:center"><div style="font-size:10px;color:var(--go-l);font-family:var(--fh);font-weight:700">NARRAT.</div><div style="font-size:18px;font-weight:700;color:var(--wh)">'+(cred.n||0)+'</div></div>'+
      '<div style="background:var(--bg3);border-radius:7px;padding:9px;text-align:center"><div style="font-size:10px;color:var(--gr-l);font-family:var(--fh);font-weight:700">TÉCNICA</div><div style="font-size:18px;font-weight:700;color:var(--wh)">'+(cred.t||0)+'</div></div>'+
    '</div>'+
    (score>0?'<div style="background:rgba(31,174,128,.06);border:.5px solid rgba(31,174,128,.22);border-radius:8px;padding:11px;margin-bottom:14px;font-size:13px;color:var(--cy-l)"><strong>Puntaje rúbrica:</strong> '+score+'/400</div>':'')+
    (r.fraseUniverso?'<div style="background:var(--bg3);border-left:3px solid '+(arch.hex||'var(--pu)')+';padding:11px 14px;border-radius:6px;margin-bottom:14px;font-style:italic;color:#DDDDEE;font-size:14px;line-height:1.5">"'+escHtml(r.fraseUniverso)+'"</div>':'')+
    (decHtml?'<div style="margin-bottom:14px"><div class="sec-lbl" style="margin-bottom:10px">Razonamiento creativo del aplicante</div>'+decHtml+'</div>':'')+
    '<div><div class="sec-lbl" style="margin-bottom:6px">Notas del evaluador</div>'+
      '<textarea class="ent-notes-input" rows="3" style="min-height:70px" oninput="updateEntregableNota(\''+id.replace(/'/g,"&#39;")+'\',this.value)" placeholder="Fortalezas, dudas, justificación del veredicto…">'+escHtml(r.notas||'')+'</textarea>'+
    '</div>'+
  '</div>';
  wrap.scrollIntoView({behavior:'smooth',block:'start'});
}

// ═══════════════════════════════════════════ EXPORT CSV
function downloadEntregablesCSV(){
  if(Object.keys(ENTREGABLES).length===0){showToast('No hay datos para exportar','t-warn');return;}
  const headers=['Nombre','Prepa','Estado','Arquetipo','Carrera sugerida','Otras carreras','Misiones (n/5)','Visión','Forma','Narrativa','Técnica','Total créditos','Tiempo (min:seg)','Estado entrega','Fecha inicio','Fecha entrega','Frase universo','Puntaje rúbrica','Notas evaluador'];
  const rows=Object.values(ENTREGABLES).map(r=>{
    const arch=r.arquetipo||{};
    const cred=r.cred||{};
    const t=r.tiempoUsadoSegundos||0;
    const tStr=Math.floor(t/60)+':'+String(t%60).padStart(2,'0');
    const carreras=Array.isArray(r.carrerasSugeridas)?r.carrerasSugeridas:[];
    const fInicio=r.iniciado?new Date(r.iniciado).toLocaleString('es-MX'):'';
    const fEntrega=r.entregado?new Date(r.entregado).toLocaleString('es-MX'):'';
    const rubrica=r.rubrica||{};
    const score=Math.round((rubrica.d||0)*25+(rubrica.e||0)*25+(rubrica.s||0)*20+(rubrica.t||0)*20+(rubrica.com||0)*10);
    return [
      r.nombre||'',r.prepa||'',r.estado||'',
      arch.name||'',
      r.carreraSugerida||'',
      carreras.slice(1).join(' / '),
      (r.misionesCompletadas||0)+'/5',
      cred.v||0,cred.f||0,cred.n||0,cred.t||0,
      r.totalCreditos||0,
      tStr,
      r.estado_entrega||'',
      fInicio,fEntrega,
      r.fraseUniverso||'',
      score||'',
      r.notas||''
    ];
  });
  const csv=[headers,...rows].map(row=>
    row.map(cell=>{
      const s=String(cell==null?'':cell);
      if(/[",\n;]/.test(s))return '"'+s.replace(/"/g,'""')+'"';
      return s;
    }).join(',')
  ).join('\n');
  // BOM para Excel UTF-8
  const blob=new Blob(['﻿'+csv],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  const fecha=new Date().toISOString().slice(0,10);
  a.download='creative-quest-entregables-'+fecha+'.csv';
  document.body.appendChild(a);a.click();
  setTimeout(()=>{document.body.removeChild(a);URL.revokeObjectURL(url);},100);
  showToast('CSV descargado · '+rows.length+' aplicantes','t-ok');
}

// Initial UI build — wait for data to arrive
DATA_READY.then(()=>{
  buildSlider();
  syncC();
  updateMtrack();
  // Identity gate — bloquea la app hasta capturar nombre+prepa+estado
  initIdentityGate();
}).catch(err=>{
  console.error('Failed to load data:', err);
  document.body.insertAdjacentHTML('afterbegin',
    '<div style="position:fixed;top:0;left:0;right:0;z-index:99999;background:#C84030;color:white;padding:14px;font-family:sans-serif;text-align:center">Error cargando datos. Verifica que estés sirviendo el sitio desde un servidor (no abriendo el archivo directo). Detalle: '+err.message+'</div>'
  );
});
