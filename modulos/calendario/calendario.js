/* Calendario AKC: competencias y eventos del MACRO + ASIGNACION (Plan Anual)
   con datos manuales guardados en la nube (horarios por nivel, viáticos, etc.) */
const FB_CONFIG={apiKey:"AIzaSyBNRAkDXLlw5fyiT01-ZfUyB0A7ShsAxyg",authDomain:"akc-con-reporte.firebaseapp.com",projectId:"akc-con-reporte"};
const COLLECTION='calendarioAKC', DOC='estado';
const PASS_HASH='edef2f146f863341daae63d0bf0b1e8aa49b805e273a6e6ca559e40dbb22e6d6';
const SRC_MACRO='../plan-anual/MACRO_26_27.xlsx', SRC_ASIG='../plan-anual/ASIGNACION DE COMPETENCIAS.xlsx';
const MES=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const MES3=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const root=document.getElementById('cal');
let EVENTS=[], MAN={}, cloud=null, saveTimer=null, syncState=['','Cargando…'];
let ui={view:'agenda',filter:'todo',month:null,sel:null,editing:null,editor:false};
try{ui.view=localStorage.getItem('akcCalVista')||'agenda';}catch(e){}
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const toDate=d=>new Date(d.year,d.month-1,d.day);
const keyOf=e=>e.type+'|'+eventTitleKey(e.title)+'|'+e.start.year;
const isoToday=()=>{const t=new Date();return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;};
const fmtD=d=>`${d.day} de ${MES[d.month-1]}`;
const fmtRange=e=>e.start.key===e.end.key?`${fmtD(e.start)} de ${e.start.year}`:(e.start.month===e.end.month?`${e.start.day} al ${e.end.day} de ${MES[e.end.month-1]} de ${e.end.year}`:`${fmtD(e.start)} al ${fmtD(e.end)} de ${e.end.year}`);
const fmtIso=s=>{if(!s)return'';const [y,m,d]=s.split('-').map(Number);return `${d} de ${MES[m-1]}`;};
const money=v=>{const n=Number(String(v).replace(/[^0-9.]/g,''));return Number.isFinite(n)&&n>0?n.toLocaleString('es-MX',{style:'currency',currency:'MXN',maximumFractionDigits:0}):'';};
const KEEP=new Set(['CDI','BKA','GUEM','FMG','CONADE','CODE','ON','USA','AKC','GAV','FIG','UPAF','CDMX']);
function titleCase(t){return String(t).split(/(\s+)/).map(w=>{const u=w.toUpperCase();if(KEEP.has(u.replace(/[^A-Z]/g,'')))return u;if(/^\s+$/.test(w))return w;const l=w.toLowerCase();return ['de','del','la','el','en','y'].includes(l)?l:l.charAt(0).toUpperCase()+l.slice(1);}).join('');}
function setSync(c,t){syncState=[c,t];const el=document.querySelector('.sync');if(el){el.className='sync '+c;el.textContent=t;}}

/* ---------- datos ---------- */
function buildEvents(){
  const out=[];
  for(const type of ['competencia','eventos','descansos'])for(const e of specialEvents[type]){
    const ev={type,title:e.title,start:e.start,end:e.end,days:e.days};
    if(eventHasAssignment(e)){
      ev.athletes=athletesForEvent(e);ev.venues=venuesForEvent(e);
      ev.levels=[...new Set(ev.athletes.map(a=>clean(a.level)).filter(l=>/^\d+$|^FIG$/i.test(l)))].sort((a,b)=>(+a||99)-(+b||99));
    }
    ev.key=keyOf(ev);out.push(ev);
  }
  out.sort((a,b)=>a.start.key.localeCompare(b.start.key));
  EVENTS=out;
}
function man(e){return MAN[e.key]||{};}

/* ---------- vista ---------- */
function render(){
  if(ui.editor)return renderEditor();
  const today=isoToday();
  const next=EVENTS.find(e=>e.type==='competencia'&&e.end.key>=today);
  let h=`<div class="top"><img src="../../logo.png" alt=""><h1>Calendario AKC</h1><small>Temporada ${EVENTS[0]?.start.year||''}–${EVENTS.at(-1)?.end.year||''}</small></div>`;
  if(next){const m=man(next);const dd=Math.ceil((toDate(next.start)-new Date(today+'T00:00'))/86400000);
    h+=`<section class="next"><div class="lbl">Próxima competencia</div><h2>${esc(titleCase(next.title))}</h2>
      <div class="when">${esc(m.convocatoria||fmtRange(next))}</div>
      <div class="count"><b>${Math.max(0,dd)}</b><span>${dd===1?'día':'días'}</span></div>
      <div class="meta">${pills(next)}</div>${horarios(next)}</section>`;}
  h+=season(today);
  h+=`<div class="tabs"><button class="${ui.view==='agenda'?'on':''}" data-a="view" data-v="agenda">Agenda</button><button class="${ui.view==='mes'?'on':''}" data-a="view" data-v="mes">Mes</button></div>`;
  h+=`<div class="filters">${[['todo','Todo'],['competencia','Competencias'],['eventos','Eventos'],['descansos','Descansos']].map(([k,l])=>`<button class="chipbtn ${ui.filter===k?'on':''}" data-a="filter" data-v="${k}">${l}</button>`).join('')}</div>`;
  h+=ui.view==='mes'?monthView(today):agenda(today);
  h+=`<div class="foot"><button class="btn ghost" data-a="editor">Editar calendario</button></div>`;
  root.innerHTML=h;
}
function pills(e){const m=man(e);let p='';
  if(e.type==='competencia'){p+=`<span class="pill ${m.estatus==='Definitivo'?'ok':'ten'}">${esc(m.estatus||'Tentativo')}</span>`;
    const sede=m.ubicacion||(e.venues||[]).join(' / ');if(sede)p+=`<span class="pill">${esc(sede)}</span>`;
    if(e.levels?.length)p+=`<span class="pill gold">Niveles ${esc(e.levels.join(', '))}</span>`;}
  else{p+=`<span class="pill">${e.type==='eventos'?'Evento':'Descanso'}</span>`;
    const sede=m.ubicacion||(e.venues||[]).join(' / ');if(e.type==='eventos'&&sede)p+=`<span class="pill">${esc(sede)}</span>`;}
  return p;}
function horarios(e){const m=man(e);const hs=(m.horarios||[]).filter(x=>x.nivel||x.fecha||x.hora);let h='';
  if(hs.length)h+=`<div class="blk"><b>Días y horarios por nivel</b><div class="hor">${hs.map(x=>`<span class="lv">${esc(x.nivel||'Todos')}</span><span>${esc([fmtIso(x.fecha),x.hora].filter(Boolean).join(' · '))}${x.link?` · <a href="${esc(x.link)}" target="_blank" rel="noopener">Ver</a>`:''}</span>`).join('')}</div></div>`;
  if(m.familia||m.costo)h+=`<div class="blk"><b>Viáticos</b><div class="sub">${m.familia?`Organiza: ${esc(m.familia)}`:''}${m.familia&&m.costo?' · ':''}${m.costo?`Costo: ${esc(money(m.costo)||m.costo)}`:''}</div></div>`;
  if(m.notas)h+=`<div class="blk"><b>Notas</b><div class="sub">${esc(m.notas)}</div></div>`;
  return h;}
function season(today){
  if(!EVENTS.length)return'';
  const s=toDate(EVENTS[0].start), e=toDate(EVENTS.at(-1).end), span=Math.max(1,e-s);
  const pos=d=>Math.min(100,Math.max(0,(toDate(d)-s)/span*100));
  const months=[];const c=new Date(s.getFullYear(),s.getMonth(),1);while(c<=e){months.push(MES3[c.getMonth()]);c.setMonth(c.getMonth()+1);}
  const t=new Date(today+'T00:00');
  let h=`<section class="season"><h3>Temporada</h3><div class="strip"><div class="bar"></div>`;
  EVENTS.filter(x=>x.type!=='descansos').forEach(x=>{h+=`<button class="mk ${x.type==='eventos'?'ev':''}" style="left:${pos(x.start).toFixed(2)}%" title="${esc(titleCase(x.title))}" aria-label="${esc(titleCase(x.title))}" data-a="goto" data-v="${esc(x.key)}"></button>`;});
  if(t>=s&&t<=e)h+=`<span class="mk today" style="left:${((t-s)/span*100).toFixed(2)}%"></span>`;
  return h+`</div><div class="months">${months.map(m=>`<span>${m}</span>`).join('')}</div></section>`;
}
function shown(){return EVENTS.filter(e=>ui.filter==='todo'?true:e.type===ui.filter);}
function card(e,past){
  const cls=e.type==='competencia'?'comp':e.type==='eventos'?'evt':'rest';
  let h=`<article class="ev ${cls}" id="ev-${esc(e.key)}" style="${past?'opacity:.55':''}"><div class="date"><b>${e.start.day}</b><span>${MES3[e.start.month-1]}</span></div><div>`;
  h+=`<h4>${esc(titleCase(e.title))}</h4><div class="sub">${esc(man(e).convocatoria||fmtRange(e))}</div><div class="meta" style="margin-top:6px;display:flex;flex-wrap:wrap;gap:5px">${pills(e)}</div>${horarios(e)}`;
  if(e.athletes?.length){const by={};e.athletes.forEach(a=>{(by[a.level||'Sin nivel']=by[a.level||'Sin nivel']||[]).push(a.name);});
    h+=`<details><summary>Atletas que asisten (${e.athletes.length})</summary><ul class="ath">${Object.entries(by).map(([l,ns])=>ns.map(n=>`<li>${esc(n)} <span style="color:var(--gold)">N${esc(l)}</span></li>`).join('')).join('')}</ul></details>`;}
  return h+`</div></article>`;
}
function agenda(today){
  const list=shown();if(!list.length)return`<div class="empty">No hay eventos con este filtro.</div>`;
  let h='',cur='';
  for(const e of list){const mk=`${e.start.year}-${e.start.month}`;if(mk!==cur){cur=mk;h+=`<div class="mon">${MES[e.start.month-1]} ${e.start.year}</div>`;}h+=card(e,e.end.key<today);}
  return h;
}
function monthView(today){
  if(!ui.month){const n=EVENTS.find(e=>e.end.key>=today)||EVENTS[0];ui.month=n?{y:n.start.year,m:n.start.month}:{y:new Date().getFullYear(),m:new Date().getMonth()+1};}
  const {y,m}=ui.month, first=new Date(y,m-1,1), off=(first.getDay()+6)%7, nd=new Date(y,m,0).getDate();
  const list=shown();
  const on=k=>list.filter(e=>e.days.some(d=>d.key===k));
  let h=`<div class="mhead"><button data-a="mprev" aria-label="Mes anterior">‹</button><h3>${MES[m-1]} ${y}</h3><button data-a="mnext" aria-label="Mes siguiente">›</button></div><div class="grid">`;
  ['L','M','M','J','V','S','D'].forEach(d=>h+=`<div class="dow">${d}</div>`);
  for(let i=0;i<off;i++)h+=`<div class="d out"></div>`;
  for(let d=1;d<=nd;d++){const k=`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;const es=on(k);
    h+=`<button class="d ${k===today?'today':''} ${ui.sel===k?'sel':''}" data-a="day" data-v="${k}"><b>${d}</b>${es.map(e=>`<i class="${e.type==='eventos'?'ie':e.type==='descansos'?'ir':'ic'}"></i>`).join('')}</button>`;}
  h+=`</div>`;
  if(ui.sel){const es=on(ui.sel);h+=`<div class="mon">${fmtIso(ui.sel)}</div>`+(es.length?es.map(e=>card(e,false)).join(''):`<div class="empty">Sin eventos este día.</div>`);}
  return h;
}

/* ---------- editor ---------- */
async function sha256(t){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(t));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');}
function editorOk(){try{return sessionStorage.getItem('akcCalEditor')==='ok';}catch(e){return false;}}
function renderEditor(){
  if(!editorOk()){
    root.innerHTML=`<div class="top"><button class="back" data-a="close">← Calendario</button><h1>Editar calendario</h1></div>
      <form class="form" id="gate" style="max-width:360px;margin:20px auto"><label>Contraseña<input id="pw" type="password" autocomplete="off" required></label>${ui.gateErr?`<div class="err">${esc(ui.gateErr)}</div>`:''}<button class="btn" type="submit">Entrar</button></form>`;
    document.getElementById('pw').focus();
    document.getElementById('gate').addEventListener('submit',async ev=>{ev.preventDefault();
      try{if(await sha256(document.getElementById('pw').value)===PASS_HASH){try{sessionStorage.setItem('akcCalEditor','ok');}catch(e){}ui.gateErr='';render();}else{ui.gateErr='Contraseña incorrecta.';render();}}
      catch(e){ui.gateErr='No se pudo validar la contraseña en este navegador.';render();}});
    return;}
  if(ui.editing)return renderForm();
  let h=`<div class="top"><button class="back" data-a="close">← Calendario</button><h1>Editar calendario</h1><span class="sync ${syncState[0]}">${esc(syncState[1])}</span></div>
    <div class="sub" style="color:var(--muted);font-size:13px;margin-bottom:12px">Las fechas, competencias y atletas salen del MACRO y de la ASIGNACIÓN DE COMPETENCIAS del Plan Anual. Aquí agregas lo que cambia: días por nivel, horarios, viáticos y notas.</div><div class="elist">`;
  EVENTS.filter(e=>e.type!=='descansos').forEach(e=>{const m=man(e);const n=(m.horarios||[]).length;
    h+=`<article class="ev ${e.type==='competencia'?'comp':'evt'}" data-a="edit" data-v="${esc(e.key)}"><div class="date"><b>${e.start.day}</b><span>${MES3[e.start.month-1]}</span></div><div><h4>${esc(titleCase(e.title))}</h4><div class="sub">${esc(fmtRange(e))}</div>
      <div class="sub" style="margin-top:4px">${[m.estatus||'Tentativo',n?`${n} horario(s)`:'Sin horarios',m.familia?'Viáticos: '+m.familia:''].filter(Boolean).map(esc).join(' · ')}</div></div></article>`;});
  root.innerHTML=h+`</div>`;
}
function renderForm(){
  const e=EVENTS.find(x=>x.key===ui.editing);if(!e){ui.editing=null;return renderEditor();}
  const m=MAN[e.key]=MAN[e.key]||{};m.horarios=m.horarios||[];
  const lv=(e.levels||[]).map(l=>`Nivel ${l}`);
  let h=`<div class="top"><button class="back" data-a="elist">← Eventos</button><h1 style="font-size:16px">${esc(titleCase(e.title))}</h1><span class="sync ${syncState[0]}">${esc(syncState[1])}</span></div>
  <div class="form">
    <div class="sub" style="color:var(--muted);font-size:13px">Según el MACRO: ${esc(fmtRange(e))}${e.venues?.length?' · Sede: '+esc(e.venues.join(' / ')):''}${e.athletes?.length?` · ${e.athletes.length} atletas asignados`:''}</div>
    <div class="two"><label>Estatus<select data-f="estatus"><option ${m.estatus!=='Definitivo'?'selected':''}>Tentativo</option><option ${m.estatus==='Definitivo'?'selected':''}>Definitivo</option></select></label>
    <label>Fechas de la convocatoria<input data-f="convocatoria" value="${esc(m.convocatoria||'')}" placeholder="Ej. 14 al 16 de noviembre"></label></div>
    <label>Sede (si es distinta a la de la asignación)<input data-f="ubicacion" value="${esc(m.ubicacion||'')}" placeholder="${esc((e.venues||[]).join(' / ')||'Ciudad o lugar')}"></label>
    <div class="two"><label>Papá que organiza los viáticos<input data-f="familia" value="${esc(m.familia||'')}"></label>
    <label>Costo de viáticos (MXN)<input data-f="costo" inputmode="decimal" value="${esc(m.costo||'')}"></label></div>
    <div><b style="font-size:13px">Días y horarios por nivel</b>
    <datalist id="lvls">${['Todos los niveles',...lv].map(x=>`<option value="${esc(x)}">`).join('')}</datalist>
    ${m.horarios.map((x,i)=>`<div class="hrow" style="margin-top:8px"><label>Nivel o categoría<input list="lvls" data-h="nivel" data-i="${i}" value="${esc(x.nivel||'')}"></label>
      <label>Día<input type="date" data-h="fecha" data-i="${i}" value="${esc(x.fecha||'')}"></label><label>Hora<input data-h="hora" data-i="${i}" value="${esc(x.hora||'')}" placeholder="8:00 AM"></label>
      <button data-a="hdel" data-i="${i}" aria-label="Quitar">✕</button><label class="full">Enlace (opcional)<input data-h="link" data-i="${i}" value="${esc(x.link||'')}" placeholder="https://"></label></div>`).join('')}
    <button class="btn ghost" data-a="hadd" style="margin-top:8px">Agregar día u horario</button></div>
    <label>Notas para los papás<textarea data-f="notas" rows="3">${esc(m.notas||'')}</textarea></label>
  </div>`;
  root.innerHTML=h;
}
/* Guarda solo el evento que cambió, para que dos dispositivos no se borren cambios */
let DIRTY=new Set(), SAVING=false;
function save(){
  if(ui.editing)DIRTY.add(ui.editing);
  if(!cloud){setSync('warn','Sin conexión: no se guardó');return;}
  setSync('','Guardando…');SAVING=true;clearTimeout(saveTimer);
  saveTimer=setTimeout(async()=>{const keys=[...DIRTY];DIRTY.clear();
    try{const ev={};keys.forEach(k=>{ev[k]=JSON.parse(JSON.stringify(MAN[k]||{}));});
      await cloud.set({eventos:ev,updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});setSync('ok','Guardado en la nube');}
    catch(e){console.error(e);keys.forEach(k=>DIRTY.add(k));setSync('warn','No se pudo guardar en la nube');}
    SAVING=false;},600);
}

/* ---------- eventos de la página ---------- */
root.addEventListener('click',ev=>{
  const el=ev.target.closest('[data-a]');if(!el)return;const a=el.dataset.a,v=el.dataset.v;
  if(a==='view'){ui.view=v;try{localStorage.setItem('akcCalVista',v);}catch(e){}return render();}
  if(a==='filter'){ui.filter=v;return render();}
  if(a==='mprev'||a==='mnext'){let {y,m}=ui.month;m+=a==='mnext'?1:-1;if(m<1){m=12;y--;}if(m>12){m=1;y++;}ui.month={y,m};ui.sel=null;return render();}
  if(a==='day'){ui.sel=ui.sel===v?null:v;return render();}
  if(a==='goto'){ui.view='agenda';ui.filter='todo';render();document.getElementById('ev-'+v)?.scrollIntoView({behavior:'smooth',block:'center'});return;}
  if(a==='editor'){ui.editor=true;ui.editing=null;return render();}
  if(a==='close'){ui.editor=false;return render();}
  if(a==='edit'){ui.editing=v;return render();}
  if(a==='elist'){ui.editing=null;return render();}
  if(a==='hadd'){ev.preventDefault();MAN[ui.editing].horarios.push({nivel:'',fecha:'',hora:'',link:''});save();return render();}
  if(a==='hdel'){ev.preventDefault();MAN[ui.editing].horarios.splice(+el.dataset.i,1);save();return render();}
});
root.addEventListener('change',ev=>{
  const t=ev.target;if(!ui.editing)return;const m=MAN[ui.editing];if(!m)return;
  if(t.dataset.f){m[t.dataset.f]=t.value.trim();save();}
  if(t.dataset.h){m.horarios[+t.dataset.i][t.dataset.h]=t.value.trim();save();}
});

/* ---------- inicio ---------- */
async function init(){
  try{
    const [mb,ab]=await Promise.all([fetch(SRC_MACRO,{cache:'no-cache'}),fetch(encodeURI(SRC_ASIG),{cache:'no-cache'})]);
    if(!mb.ok)throw new Error('No se encontró el MACRO del Plan Anual.');
    days=readCalendar(XLSX.read(await mb.arrayBuffer(),{type:'array',cellDates:true}));
    if(ab.ok)assignmentData=readAssignments(XLSX.read(await ab.arrayBuffer(),{type:'array',cellDates:true}));
    buildSpecialEvents();buildEvents();
  }catch(e){root.innerHTML=`<div class="err">No se pudo cargar el calendario: ${esc(e.message)}</div>`;return;}
  try{if(window.firebase){if(!firebase.apps.length)firebase.initializeApp(FB_CONFIG);cloud=firebase.firestore().collection(COLLECTION).doc(DOC);
    const s=await cloud.get();if(s.exists)MAN=s.data().eventos||{};setSync('ok','Guardado en la nube');
    cloud.onSnapshot(s=>{if(!s.exists||s.metadata.hasPendingWrites||SAVING)return;MAN=s.data().eventos||{};{const ae=document.activeElement?.tagName;if(ae!=='INPUT'&&ae!=='TEXTAREA'&&ae!=='SELECT')render();}},e=>console.error(e));}}
  catch(e){console.error(e);cloud=null;setSync('warn','Sin conexión a la nube');}
  render();
}
init();
