const content = document.getElementById('content');
const backBtn = document.getElementById('backBtn');

const MONTHS = {
  ENERO:1,FEBRERO:2,MARZO:3,ABRIL:4,MAYO:5,JUNIO:6,
  JULIO:7,AGOSTO:8,SEPTIEMBRE:9,OCTUBRE:10,NOVIEMBRE:11,DICIEMBRE:12
};
const MONTH_NAMES = Object.keys(MONTHS);
let days = [];
let months = [];
let specialEvents = { competencia:[], eventos:[], descansos:[] };
let selectedDate = null;

const esc = v => String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const clean = v => String(v ?? '').trim();
const upper = v => clean(v).toUpperCase();
const dateKey = d => `${d.year}-${String(d.month).padStart(2,'0')}-${String(d.day).padStart(2,'0')}`;

function init(){
  fetch('./MACRO_26_27.xlsx',{cache:'no-store'})
    .then(r=>{if(!r.ok) throw Error('No se encontró MACRO_26_27.xlsx'); return r.arrayBuffer();})
    .then(buf=>{
      const wb = XLSX.read(buf,{type:'array',cellDates:true});
      days = readCalendar(wb);
      buildMonths();
      buildSpecialEvents();
      renderHome();
    })
    .catch(err=>{
      content.innerHTML = `<div class="error"><h2>No se pudo cargar el Plan Anual</h2><p>${esc(err.message)}</p></div>`;
    });
}

function readCalendar(wb){
  const ws = wb.Sheets['macro gral'];
  if(!ws) throw Error('No existe la hoja "macro gral"');
  const matrix = XLSX.utils.sheet_to_json(ws,{header:1,defval:''});
  const fillRow = row => {
    let last='';
    return row.map(v=>{if(!['',null,undefined].includes(v)) last=clean(v); return last;});
  };
  const monthRow = fillRow(matrix[0]||[]);
  const dayRow = matrix[1]||[];
  const dowRow = matrix[2]||[];
  const periodRow = fillRow(matrix[3]||[]);
  const stageRow = fillRow(matrix[4]||[]);
  const weekRow = fillRow(matrix[6]||[]);
  const unitRow = fillRow(matrix[8]||[]);
  const descRow = fillRow(matrix[9]||[]);
  const techRow = fillRow(matrix[10]||[]);
  const forceRow = fillRow(matrix[14]||[]);

  let year=2026, previousMonth=0;
  const out=[];
  for(let c=1;c<monthRow.length;c++){
    const monthName=upper(monthRow[c]);
    const month=MONTHS[monthName];
    const dayNum=Number(dayRow[c]);
    if(!month || !Number.isFinite(dayNum) || dayNum<1 || dayNum>31) continue;
    if(previousMonth && month < previousMonth) year++;
    previousMonth=month;
    const d = {year,month,monthName,day:dayNum,dow:clean(dowRow[c]),period:clean(periodRow[c]),stage:clean(stageRow[c]),week:clean(weekRow[c]),unit:clean(unitRow[c]),description:clean(descRow[c]),technical:clean(techRow[c]),force:clean(forceRow[c])};
    d.key=dateKey(d);
    out.push(d);
  }
  return out;
}

function buildMonths(){
  const map=new Map();
  for(const d of days){
    const key=`${d.year}-${d.month}`;
    if(!map.has(key)) map.set(key,{key,year:d.year,month:d.month,name:d.monthName,days:[]});
    map.get(key).days.push(d);
  }
  months=[...map.values()].sort((a,b)=>a.year-b.year||a.month-b.month);
}

function classify(d){
  const t=upper(d.description);
  if(d.unit==='D' || /DESCANS|VACACION/.test(t)) return 'descansos';
  if(d.unit==='C' || /COPA|COMPETENCIA|CAMPEONATO|OLIMPIADA|ESTATAL|TORNEO/.test(t)) return 'competencia';
  if(/CONTROL|EVENTO|PRUEBA|CEREMONIA/.test(t)) return 'eventos';
  return null;
}

function buildSpecialEvents(){
  const result={competencia:[],eventos:[],descansos:[]};
  const consumed=new Set();
  const sorted=days.slice().sort((a,b)=>a.key.localeCompare(b.key));

  // Descriptions are the anchor for named events. The event end includes following
  // consecutive competition days (unit C), which matches the calendar workbook.
  for(let i=0;i<sorted.length;i++){
    const start=sorted[i];
    const type=classify(start);
    if(!type || !start.description) continue;
    let end=start;
    if(type==='competencia'){
      // Some competitions have a setup/start description a day or two before
      // the C (competition) block. Include that block in the displayed range.
      let firstC=-1;
      for(let j=i+1;j<Math.min(sorted.length,i+8);j++){
        const next=sorted[j];
        const gap=(new Date(next.year,next.month-1,next.day)-new Date(start.year,start.month-1,start.day))/86400000;
        if(gap>4) break;
        if(next.unit==='C'){ firstC=j; break; }
      }
      if(firstC>=0){
        end=sorted[firstC];
        for(let j=firstC+1;j<sorted.length;j++){
          const next=sorted[j];
          const consecutive=(new Date(next.year,next.month-1,next.day)-new Date(end.year,end.month-1,end.day))===86400000;
          if(consecutive && next.unit==='C') end=next; else break;
        }
      }
    }
    const event={id:`${type}-${start.key}`,type,title:start.description,start,end,days:sorted.filter(x=>x.key>=start.key&&x.key<=end.key)};
    result[type].push(event);
    event.days.forEach(x=>consumed.add(`${type}|${x.key}`));
  }

  // Any unlabeled C day(s) form a chronological competition block.
  let i=0;
  while(i<sorted.length){
    const d=sorted[i];
    if(d.unit!=='C' || result.competencia.some(e=>e.days.some(x=>x.key===d.key))){i++;continue;}
    let end=d, j=i+1;
    while(j<sorted.length){
      const n=sorted[j];
      if(n.unit==='C' && (new Date(n.year,n.month-1,n.day)-new Date(end.year,end.month-1,end.day))===86400000){end=n;j++;}else break;
    }
    result.competencia.push({id:`competencia-${d.key}`,type:'competencia',title:'Competencia',start:d,end,days:sorted.filter(x=>x.key>=d.key&&x.key<=end.key)});
    i=j;
  }

  Object.keys(result).forEach(k=>result[k].sort((a,b)=>a.start.key.localeCompare(b.start.key)));
  specialEvents=result;
}

function formatDate(d,withYear=true){
  const base=`${d.day} de ${d.monthName.toLowerCase()}`;
  return withYear ? `${base} de ${d.year}` : base;
}
function formatRange(e){
  if(e.start.key===e.end.key) return formatDate(e.start);
  return `${formatDate(e.start)} al ${formatDate(e.end)}`;
}
function monthLabel(m){return `${m.name[0]+m.name.slice(1).toLowerCase()} ${m.year}`;}

function shell(title,subtitle=''){
  content.innerHTML=`<section class="hero"><div class="eyebrow">PLAN ANUAL 2026–2027</div><h2>${esc(title)}</h2>${subtitle?`<p>${esc(subtitle)}</p>`:''}</section>`;
}

function renderHome(){
  backBtn.style.visibility='hidden';
  content.innerHTML=`
    <section class="hero">
      <div class="eyebrow">PLAN ANUAL 2026–2027</div>
      <h2>Calendario de entrenamiento</h2>
      <p>Consulta cada mes por día y accede directamente a competencias, eventos y descansos.</p>
    </section>
    <section class="quick-actions">
      <button class="quick competition" data-list="competencia"><strong>COMPETENCIAS</strong><span>${specialEvents.competencia.length} registradas</span><b>›</b></button>
      <button class="quick event" data-list="eventos"><strong>EVENTOS</strong><span>${specialEvents.eventos.length} registrados</span><b>›</b></button>
      <button class="quick rest" data-list="descansos"><strong>DESCANSOS</strong><span>${specialEvents.descansos.length} registrados</span><b>›</b></button>
    </section>
    <section class="month-list">
      <div class="section-title"><span>MESES</span><small>Orden cronológico</small></div>
      ${months.map((m,i)=>`<button class="month-card" data-month-key="${esc(m.key)}"><span>${String(i+1).padStart(2,'0')}</span><strong>${esc(monthLabel(m))}</strong><em>${m.days.length} días</em><b>›</b></button>`).join('')}
    </section>`;
  document.querySelectorAll('[data-month-key]').forEach(b=>b.onclick=()=>showMonth(b.dataset.monthKey));
  document.querySelectorAll('[data-list]').forEach(b=>b.onclick=()=>showSpecialList(b.dataset.list));
}

function showMonth(key){
  const m=months.find(x=>x.key===key); if(!m)return;
  backBtn.style.visibility='visible'; backBtn.onclick=renderHome;
  content.innerHTML=`
    <section class="month-head"><div class="eyebrow">PLAN ANUAL</div><h2>${esc(monthLabel(m))}</h2><p>${m.days.length} días registrados</p></section>
    <section class="day-list">
      ${m.days.map(d=>dayCard(d)).join('')}
    </section>`;
  bindDayActions();
  if(selectedDate) focusDate(selectedDate,false);
}

function dayCard(d){
  const hasSpecial=classify(d);
  return `<article class="day-card ${hasSpecial?'special':''}" id="day-${esc(d.key)}" data-date="${esc(d.key)}">
    <div class="date"><strong>${esc(d.day)}</strong><span>${esc(d.dow)}</span></div>
    <div class="day-main">
      <div class="date-label">${esc(d.monthName.toLowerCase())}</div>
      <p class="description">${esc(d.description || 'Sin descripción')}</p>
      <div class="day-meta">
        ${d.technical?`<span><small>Nivel técnico</small>${esc(d.technical)}</span>`:''}
        ${d.force?`<span><small>Carga de fuerza</small>${esc(d.force)}</span>`:''}
      </div>
    </div>
    ${hasSpecial?`<button class="day-link" data-special-date="${esc(d.key)}">${hasSpecial==='competencia'?'Ver competencia':hasSpecial==='eventos'?'Ver evento':'Ver descanso'} ›</button>`:''}
  </article>`;
}

function bindDayActions(){
  document.querySelectorAll('[data-special-date]').forEach(b=>b.onclick=()=>openSpecialByDate(b.dataset.specialDate));
}

function showSpecialList(type){
  const list=specialEvents[type]||[];
  const title=type==='competencia'?'Competencias':type==='eventos'?'Eventos':'Descansos';
  backBtn.style.visibility='visible'; backBtn.onclick=renderHome;
  content.innerHTML=`<section class="hero"><div class="eyebrow">PLAN ANUAL</div><h2>${title}</h2><p>Fechas en orden cronológico.</p></section>
  <section class="special-list">${list.length?list.map(e=>specialCard(e)).join(''):'<div class="empty">No hay registros.</div>'}</section>`;
  document.querySelectorAll('[data-event-id]').forEach(b=>b.onclick=()=>openSpecial(b.dataset.eventId,type));
}

function specialCard(e){
  const label=e.type==='competencia'?'COMPETENCIA':e.type==='eventos'?'EVENTO':'DESCANSO';
  return `<button class="special-card ${esc(e.type)}" data-event-id="${esc(e.id)}"><span class="tag">${label}</span><strong>${esc(e.title)}</strong><small>${esc(formatRange(e))}</small><b>›</b></button>`;
}

function findEvent(id,type){return (specialEvents[type]||[]).find(e=>e.id===id);}
function openSpecialByDate(key){
  for(const type of ['competencia','eventos','descansos']){
    const e=(specialEvents[type]||[]).find(x=>x.days.some(d=>d.key===key));
    if(e){openSpecial(e.id,type);return;}
  }
}
function openSpecial(id,type){
  const e=findEvent(id,type); if(!e)return;
  backBtn.style.visibility='visible'; backBtn.onclick=()=>showSpecialList(type);
  content.innerHTML=`
    <section class="event-detail ${esc(type)}">
      <div class="eyebrow">${type==='competencia'?'COMPETENCIA':type==='eventos'?'EVENTO':'DESCANSO'}</div>
      <h2>${esc(e.title)}</h2>
      <div class="event-range">${esc(formatRange(e))}</div>
      <div class="event-description"><small>DESCRIPCIÓN</small><p>${esc(e.title)}</p></div>
      <button class="calendar-jump" id="calendarJump">VER EN CALENDARIO GENERAL ›</button>
    </section>`;
  document.getElementById('calendarJump').onclick=()=>{
    selectedDate=e.start.key;
    const m=months.find(x=>x.days.some(d=>d.key===e.start.key));
    if(m) showMonth(m.key);
  };
}

function focusDate(key,scroll=true){
  document.querySelectorAll('.day-card.highlight').forEach(x=>x.classList.remove('highlight'));
  const el=document.getElementById(`day-${key}`);
  if(el){el.classList.add('highlight'); if(scroll)el.scrollIntoView({behavior:'smooth',block:'center'});}
}

init();
