let workbook;
let macroRows = [];
let monthData = [];
let currentMonth = null;
let currentWeek = null;
let currentEvent = null;

const content = document.getElementById('content');
const backBtn = document.getElementById('backBtn');

function esc(v){
  return String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}
function norm(v){ return String(v ?? '').trim().toUpperCase(); }
function isBlank(v){ return v === null || v === undefined || String(v).trim() === ''; }
function clean(v){ return isBlank(v) ? '' : String(v).trim(); }
function normHeader(v){ return norm(v).replace(/[ÁÀÄ]/g,'A').replace(/[ÉÈË]/g,'E').replace(/[ÍÌÏ]/g,'I').replace(/[ÓÒÖ]/g,'O').replace(/[ÚÙÜ]/g,'U').replace(/Ñ/g,'N'); }

async function init(){
  try{
    const res = await fetch('./MACRO_26_27.xlsx', {cache:'no-store'});
    if(!res.ok) throw new Error('No se encontró MACRO_26_27.xlsx');
    const buf = await res.arrayBuffer();
    workbook = XLSX.read(buf, {type:'array', cellDates:true});
    buildMacroRows();
    buildMonthData();
    renderHome();
  }catch(err){
    content.innerHTML = `<div class="error"><h2>No se pudo cargar el Plan Anual</h2><p>${esc(err.message)}</p></div>`;
  }
}

function buildMacroRows(){
  const ws = workbook.Sheets['macro gral'];
  if(!ws) return;
  const matrix = XLSX.utils.sheet_to_json(ws, {header:1, defval:''});
  if(matrix.length < 3) return;
  const fill = row => {
    let last='';
    return row.map(v => { if(!isBlank(v)) last=clean(v); return last; });
  };
  const monthRow = fill(matrix[0] || []);
  const dayRow = matrix[1] || [];
  const dowRow = matrix[2] || [];
  const labels = matrix.slice(3).map(r => clean(r[0]));
  const valuesByLabel = {};
  for(let r=3;r<matrix.length;r++){
    const label=clean(matrix[r][0]);
    if(label) valuesByLabel[label]=fill(matrix[r].slice(1));
  }
  for(let c=1;c<monthRow.length;c++){
    const day=dayRow[c];
    if(isBlank(day)) continue;
    const obj={month:monthRow[c], day:day, dow:dowRow[c] || '', index:c};
    Object.keys(valuesByLabel).forEach(label=>{ obj[label]=valuesByLabel[label][c-1] ?? ''; });
    macroRows.push(obj);
  }
}

function buildMonthData(){
  const sheet = workbook.Sheets['Hoja1'];
  const rows = sheet ? XLSX.utils.sheet_to_json(sheet,{defval:''}) : [];
  const map = new Map();
  let currentMonthName = '';
  for(const r of rows){
    const month=clean(r.MES);
    if(month) currentMonthName = month;
    const m=month || currentMonthName;
    if(!m) continue;
    if(!map.has(m)) map.set(m,{name:m, items:[], weeks:new Map()});
    const item={day:clean(r.DÍA), week:clean(r.SEMANA), description:clean(r.DESCRIPCION)};
    if(item.day || item.week || item.description) map.get(m).items.push(item);
    if(item.week){
      map.get(m).weeks.set(item.week, {week:item.week, description:item.description, days:[]});
    }
    if(item.day && !item.week){
      const keys=[...map.get(m).weeks.keys()];
      if(keys.length) map.get(m).weeks.get(keys[keys.length-1]).days.push(item.day);
    }
  }
  monthData=[...map.values()];
  const macroMonths=[...new Set(macroRows.map(r=>r.month).filter(Boolean))];
  monthData=monthData.filter(m=>macroMonths.some(x=>norm(x)===norm(m.name)));
  for(const m of monthData){
    m.macroDays=macroRows.filter(r=>norm(r.month)===norm(m.name));
    m.stage=[...new Set(m.macroDays.map(r=>r.Etapa).filter(Boolean))].join(' · ');
    m.period=[...new Set(m.macroDays.map(r=>r.Periodo).filter(Boolean))].join(' · ');
    m.weeksList=[...m.weeks.values()];
  }
}

function classifyEvent(description){
  const s=norm(description);
  if(!s) return null;
  if(/OLIMPIADA|CAMPEONATO|COMPETENCIA|\bCOPA\b|ESTATAL/.test(s)) return 'competencias';
  if(/CONTROL/.test(s)) return 'controles';
  if(/DESCANSO|RECUPERACION ACTIVA|RECUPERACIÓN ACTIVA/.test(s)) return 'descansos';
  if(/SUSPENSION|SUSPENSIÓN|NO HAY CLASE|SIN CLASE|FERIADO|VACACION|VACACIONES/.test(s)) return 'suspensiones';
  return null;
}

function makeEvents(){
  const events=[];
  for(const m of monthData){
    const items=m.items;
    for(let i=0;i<items.length;i++){
      const item=items[i];
      const type=classifyEvent(item.description);
      if(!type) continue;
      const days=[item.day].filter(Boolean);
      let j=i+1;
      while(j<items.length && !items[j].description){
        if(items[j].day) days.push(items[j].day);
        j++;
      }
      const macro = m.macroDays.filter(r => days.some(d=>String(r.day)==String(d)));
      const event={
        id:`${norm(m.name)}-${item.day}-${norm(item.description)}`,
        type,
        month:m.name,
        day:item.day,
        days:[...new Set(days)],
        description:item.description,
        week:macro.map(r=>clean(r.SEMANA)).find(Boolean) || '',
        period:macro.map(r=>clean(r.Periodo)).find(Boolean) || '',
        stage:macro.map(r=>clean(r.Etapa)).find(Boolean) || ''
      };
      // Prevent duplicate event blocks caused by continuation rows.
      if(!events.some(e=>e.month===event.month && e.day===event.day && norm(e.description)===norm(event.description))) events.push(event);
    }
  }
  return events;
}

function monthIndex(name){
  const order=['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
  return order.indexOf(norm(name));
}

function eventDate(event){
  const mi=monthIndex(event.month);
  if(mi<0) return null;
  const firstMonth=monthIndex(monthData[0]?.name);
  const firstYear=2026;
  const year=mi < firstMonth ? firstYear+1 : firstYear;
  return new Date(year, mi, Number(event.day)||1, 12, 0, 0);
}

function eventDistanceFromToday(event){
  const d=eventDate(event);
  if(!d) return Number.MAX_SAFE_INTEGER;
  const today=new Date();
  today.setHours(12,0,0,0);
  return Math.round((d-today)/86400000);
}

function sortEventsChronologically(events){
  return [...events].sort((a,b)=>{
    const da=eventDistanceFromToday(a), db=eventDistanceFromToday(b);
    const aFuture=da>=0, bFuture=db>=0;
    if(aFuture!==bFuture) return aFuture ? -1 : 1;
    if(aFuture) return da-db;
    return Math.abs(da)-Math.abs(db);
  });
}

function isLockedCompetition(event){
  return event.type==='competencias' && /OLIMPIADA/.test(norm(event.description));
}

function typeMeta(type){
  return {
    competencias:{title:'Competencias',icon:'🏆',cls:'event-competencias'},
    controles:{title:'Controles',icon:'🎯',cls:'event-controles'},
    descansos:{title:'Descansos',icon:'💤',cls:'event-descansos'},
    suspensiones:{title:'Suspensiones / vacaciones',icon:'🛑',cls:'event-suspensiones'}
  }[type];
}

function renderHome(){
  currentMonth=null; currentWeek=null; currentEvent=null;
  backBtn.style.visibility='hidden';
  const events=makeEvents();
  const counts=['competencias','controles','descansos','suspensiones'].map(type=>({type,count:events.filter(e=>e.type===type).length}));
  content.innerHTML=`
    <section class="hero">
      <div class="eyebrow">MACROCICLO</div>
      <h2>Plan Anual 2026–2027</h2>
      <p>Consulta el plan por mes o entra directamente a las fechas clave de la temporada.</p>
    </section>
    <section class="quick-grid">
      ${counts.map(x=>{const m=typeMeta(x.type);return `<button class="quick-card ${m.cls}" data-event-type="${x.type}"><span class="quick-icon">${m.icon}</span><strong>${m.title}</strong><small>${x.count} evento${x.count===1?'':'s'} registrados</small><span class="arrow">›</span></button>`}).join('')}
    </section>
    <section class="months-title"><div><span class="eyebrow">NAVEGACIÓN</span><h3>Por mes</h3></div><button class="calendar-link" id="calendarViewBtn">Ver calendario completo</button></section>
    <section class="months">${monthData.map((m,i)=>{
      const cls=`phase-${i%6}`;
      const weeks=m.weeksList.length ? `${m.weeksList.length} bloques` : `${m.macroDays.length} días`;
      return `<button class="month-card ${cls}" data-month="${esc(m.name)}"><span class="month-number">${String(i+1).padStart(2,'0')}</span><strong>${esc(m.name)}</strong><small>${esc(m.stage || 'Planificación')}</small><em>${esc(weeks)}</em><span class="arrow">›</span></button>`;
    }).join('')}</section>`;
  document.querySelectorAll('[data-month]').forEach(b=>b.addEventListener('click',()=>showMonth(b.dataset.month)));
  document.querySelectorAll('[data-event-type]').forEach(b=>b.addEventListener('click',()=>showEventList(b.dataset.eventType)));
  document.getElementById('calendarViewBtn').addEventListener('click',renderCalendar);
}

function showEventList(type){
  const meta=typeMeta(type); const events=sortEventsChronologically(makeEvents().filter(e=>e.type===type));
  backBtn.style.visibility='visible'; backBtn.onclick=renderHome;
  content.innerHTML=`
    <section class="month-head ${meta.cls}"><div class="eyebrow">PLAN ANUAL</div><h2>${meta.icon} ${meta.title}</h2><p>Acceso directo a las fechas importantes sin recorrer mes por mes.</p></section>
    <section class="event-list">${events.length ? events.map(e=>{
      const locked=isLockedCompetition(e);
      const tag=locked ? 'Solo fecha y calendario' : (e.type==='competencias' ? 'Sin información adicional' : 'Abrir detalle');
      const card=`<div class="event-card ${meta.cls} ${locked?'event-locked':''}" ${locked?'':'data-event-id="'+esc(e.id)+'"'}><div class="event-date"><strong>${esc(e.day)}</strong><span>${esc(e.month)}</span></div><div class="event-info"><strong>${esc(e.description)}</strong><small>${e.days.length>1?`Del ${esc(e.days[0])} al ${esc(e.days[e.days.length-1])} de ${esc(e.month)}`:`${esc(e.month)} ${esc(e.day)}`}${e.week?` · Semana ${esc(e.week)}`:''}</small><em>${tag}</em></div>${locked?'':'<span class="arrow">›</span>'}</div>`;
      return card;
    }).join(''):'<div class="empty">No hay eventos de esta categoría en el Excel.</div>'}</section>`;
  document.querySelectorAll('[data-event-id]').forEach(b=>b.addEventListener('click',()=>showEvent(events.find(e=>e.id===b.dataset.eventId))));
}

function showEvent(event){
  if(!event) return;
  currentEvent=event;
  const meta=typeMeta(event.type);
  backBtn.style.visibility='visible'; backBtn.onclick=()=>showEventList(event.type);
  const target=monthData.find(m=>norm(m.name)===norm(event.month));
  const dayRow=target?.macroDays.find(r=>String(r.day)===String(event.day));
  const details=event.type==='competencias' ? [] : (dayRow ? [['Periodo',dayRow.Periodo],['Etapa',dayRow.Etapa],['Mesociclo',dayRow.Mesociclo],['Microciclo',dayRow.Microciclo],['Unidad',dayRow['Uni de entre'] || dayRow['UNIDAD DE ENTRENAMIENTO']],['Carga de fuerza',dayRow['CARGA DE FUERZA']]].filter(x=>!isBlank(x[1])) : []);
  const noInfo=event.type==='competencias';
  content.innerHTML=`
    <section class="event-detail ${meta.cls}"><div class="eyebrow">${meta.icon} ${esc(meta.title)}</div><h2>${esc(event.description)}</h2><div class="big-date">${esc(event.day)} <span>${esc(event.month)}</span></div>${event.days.length>1?`<p class="range">Periodo del evento: ${esc(event.days[0])}–${esc(event.days[event.days.length-1])} de ${esc(event.month)}</p>`:''}${event.week?`<p class="range">Semana ${esc(event.week)}</p>`:''}</section>
    ${noInfo?`<section class="details-panel"><div class="no-info"><small>INFORMACIÓN</small><p>Sin información adicional registrada para esta competencia.</p></div></section>`:(details.length?`<section class="details-panel">${details.map(d=>`<div><small>${esc(d[0])}</small><p>${esc(d[1])}</p></div>`).join('')}</section>`:'')}
    <button class="go-calendar" id="goEventCalendar">Ver en el calendario del mes →</button>`;
  document.getElementById('goEventCalendar').addEventListener('click',()=>showMonth(event.month,event.day));
}

function renderCalendar(){
  backBtn.style.visibility='visible'; backBtn.onclick=renderHome;
  content.innerHTML=`<section class="month-head"><div class="eyebrow">PLAN ANUAL</div><h2>Calendario completo</h2><p>Resumen cronológico de todo el ciclo.</p></section><section class="timeline">${macroRows.map((r,i)=>{
    const event=makeEvents().find(e=>norm(e.month)===norm(r.month) && String(e.day)===String(r.day));
    return `<article class="timeline-row ${event?'has-event':''}"><div class="timeline-date"><strong>${esc(r.day)}</strong><span>${esc(r.month)}</span></div><div class="timeline-dot"></div><div class="timeline-body"><small>${esc(r.dow)}</small><strong>${esc(r.Descripción || r.DESCRIPCION || 'Entrenamiento programado')}</strong>${event?`<button class="mini-event" data-event-id="${esc(event.id)}">${esc(typeMeta(event.type).icon)} ${esc(typeMeta(event.type).title)} →</button>`:''}</div></article>`;
  }).join('')}</section>`;
  document.querySelectorAll('.mini-event').forEach(b=>b.addEventListener('click',()=>showEvent(makeEvents().find(e=>e.id===b.dataset.eventId))));
}

function showMonth(name,highlightDay=null){
  currentMonth=monthData.find(m=>norm(m.name)===norm(name)); currentWeek=null;
  if(!currentMonth) return;
  backBtn.style.visibility='visible'; backBtn.onclick=renderHome;
  const weeks=currentMonth.weeksList;
  content.innerHTML=`
    <section class="month-head"><div class="eyebrow">${esc(currentMonth.period || 'PLAN ANUAL')}</div><h2>${esc(currentMonth.name)}</h2><p>${esc(currentMonth.stage || 'Consulta del macrociclo')}</p></section>
    <div class="month-actions"><button class="small-action" id="monthEvents">Ver fechas importantes de este mes</button></div>
    <div class="summary-grid"><div><span>SEMANAS</span><strong>${weeks.length || '—'}</strong></div><div><span>DÍAS PROGRAMADOS</span><strong>${currentMonth.macroDays.length}</strong></div></div>
    <section class="weeks">${weeks.length ? weeks.map(w=>`<button class="week-card" data-week="${esc(w.week)}"><span>SEMANA</span><strong>${esc(w.week)}</strong><p>${esc(w.description || 'Sin descripción')}</p><span class="arrow">›</span></button>`).join('') : '<div class="empty">No hay bloques semanales registrados en Hoja1.</div>'}</section>
    <section class="daily-block"><div class="section-title"><span>VISTA DIARIA</span><small>Datos de <b>macro gral</b></small></div>${currentMonth.macroDays.map(r=>dayCard(r,highlightDay)).join('')}</section>`;
  document.querySelectorAll('[data-week]').forEach(b=>b.addEventListener('click',()=>showWeek(b.dataset.week)));
  document.getElementById('monthEvents').addEventListener('click',()=>showMonthEvents(currentMonth.name));
  if(highlightDay){ const el=document.querySelector(`[data-day="${CSS.escape(String(highlightDay))}"]`); if(el){el.classList.add('highlight-day'); setTimeout(()=>el.scrollIntoView({behavior:'smooth',block:'center'}),80);}}
}

function showMonthEvents(month){
  const events=sortEventsChronologically(makeEvents().filter(e=>norm(e.month)===norm(month)));
  backBtn.style.visibility='visible'; backBtn.onclick=()=>showMonth(month);
  content.innerHTML=`<section class="month-head"><div class="eyebrow">${esc(month)}</div><h2>Fechas importantes</h2><p>Competencias, controles, descansos y suspensiones detectados en este mes.</p></section><section class="event-list">${events.length?events.map(e=>{const m=typeMeta(e.type); const locked=isLockedCompetition(e); return `<div class="event-card ${m.cls} ${locked?'event-locked':''}" ${locked?'':'data-event-id="'+esc(e.id)+'"'}><div class="event-date"><strong>${esc(e.day)}</strong><span>${m.icon}</span></div><div class="event-info"><strong>${esc(e.description)}</strong><small>${m.title}${e.week?` · Semana ${esc(e.week)}`:''}</small>${locked?'<em>Solo fecha y calendario</em>':''}</div>${locked?'':'<span class="arrow">›</span>'}</div>`}).join(''):'<div class="empty">No hay fechas especiales detectadas en este mes.</div>'}</section>`;
  document.querySelectorAll('[data-event-id]').forEach(b=>b.addEventListener('click',()=>showEvent(events.find(e=>e.id===b.dataset.eventId))));
}

function dayCard(r,highlightDay){
  const details=[['Periodo',r.Periodo],['Etapa',r.Etapa],['Mesociclo',r.Mesociclo],['Microciclo',r.Microciclo],['Unidad',r['Uni de entre'] || r['UNIDAD DE ENTRENAMIENTO']],['Descripción',r.Descripción || r.DESCRIPCION],['Nivel técnico',r['NIVEL DE DESEMPEÑO TÉCNICO']],['Carga de fuerza',r['CARGA DE FUERZA']]].filter(x=>!isBlank(x[1]));
  const event=makeEvents().find(e=>norm(e.month)===norm(r.month)&&String(e.day)===String(r.day));
  return `<article class="day-card ${highlightDay!==null&&String(r.day)===String(highlightDay)?'highlight-day':''}" data-day="${esc(r.day)}"><div class="day-top"><strong>${esc(r.day)}</strong><span>${esc(r.dow)}</span></div>${event?`<button class="day-event ${typeMeta(event.type).cls}" data-event-id="${esc(event.id)}">${typeMeta(event.type).icon} ${esc(event.description)}</button>`:''}<div class="details">${details.map(d=>`<div><small>${esc(d[0])}</small><p>${esc(d[1])}</p></div>`).join('')}</div></article>`;
}

function showWeek(week){
  currentWeek=week;
  const items=currentMonth.macroDays.filter(r=>{const wk=clean(r.SEMANA);return wk===week || norm(wk).includes(norm(week));});
  const sourceItems=currentMonth.items.filter(x=>x.week===week || (!x.week && x.day));
  backBtn.onclick=()=>showMonth(currentMonth.name);
  content.innerHTML=`<section class="month-head"><div class="eyebrow">${esc(currentMonth.name)}</div><h2>Semana ${esc(week)}</h2><p>${esc(currentMonth.weeks.find(w=>w.week===week)?.description || 'Planificación de la semana')}</p></section><section class="daily-block"><div class="section-title"><span>DETALLE</span><small>${items.length} registro(s) del macrociclo</small></div>${items.length?items.map(dayCard).join(''):'<div class="empty">Esta semana no está marcada explícitamente en macro gral; se conserva la descripción de Hoja1.</div>'}</section>${sourceItems.length?`<section class="notes"><div class="section-title"><span>REFERENCIA DEL PLAN</span><small>Hoja1</small></div>${sourceItems.map(x=>`<div class="note-row"><b>${esc(x.day||'')}</b><span>${esc(x.description||'')}</span></div>`).join('')}</section>`:''}`;
  document.querySelectorAll('[data-event-id]').forEach(b=>b.addEventListener('click',()=>showEvent(makeEvents().find(e=>e.id===b.dataset.eventId))));
}

backBtn.onclick=renderHome;
init();
