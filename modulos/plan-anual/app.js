let workbook;
let macroRows = [];
let monthData = [];
let currentMonth = null;
let currentWeek = null;

const content = document.getElementById('content');
const backBtn = document.getElementById('backBtn');

function esc(v){
  return String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}
function norm(v){ return String(v ?? '').trim().toUpperCase(); }
function isBlank(v){ return v === null || v === undefined || String(v).trim() === ''; }
function clean(v){ return isBlank(v) ? '' : String(v).trim(); }

function isEventItem(item){
  const text = norm(item.description);
  if(!text) return false;
  return /(COPA|CONTROL|COMPET|OLIMPIADA|CAMPEONATO|DESCANSO|VACACION|RECUPERACION)/.test(text);
}

function eventType(description){
  const text = norm(description);
  if(/OLIMPIADA|CAMPEONATO|COMPET|COPA/.test(text)) return 'COMPETENCIA';
  if(/CONTROL/.test(text)) return 'CONTROL';
  if(/VACACION/.test(text)) return 'VACACIONES';
  if(/DESCANSO|RECUPERACION/.test(text)) return 'DESCANSO / RECUPERACIÓN';
  return 'EVENTO';
}

async function init(){
  try{
    const res = await fetch('./MACRO_26_27.xlsx', {cache:'no-store'});
    if(!res.ok) throw new Error('No se encontró MACRO_26_27.xlsx');
    const buf = await res.arrayBuffer();
    workbook = XLSX.read(buf, {type:'array', cellDates:true});
    buildMacroRows();
    buildMonthData();
    renderMonths();
  }catch(err){
    content.innerHTML = `<div class="error"><h2>No se pudo cargar el Plan Anual</h2><p>${esc(err.message)}</p></div>`;
  }
}

function buildMacroRows(){
  const ws = workbook.Sheets['macro gral'];
  if(!ws) return;
  const matrix = XLSX.utils.sheet_to_json(ws, {header:1, defval:''});
  if(matrix.length < 3) return;
  const fill = (row) => {
    let last='';
    return row.map(v => { if(!isBlank(v)) last=clean(v); return last; });
  };
  const monthRow = fill(matrix[0] || []);
  const dayRow = matrix[1] || [];
  const dowRow = matrix[2] || [];
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
  let lastMonth='';
  for(const r of rows){
    const month=clean(r.MES);
    if(month) lastMonth = month;
    const m=month || lastMonth;
    if(!m) continue;
    if(!map.has(m)) map.set(m,{name:m, items:[], weeks:new Map()});
    const item={month:m, day:clean(r.DÍA), week:clean(r.SEMANA), description:clean(r.DESCRIPCION)};
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
    m.events=m.items.filter(isEventItem);
  }
}

function renderMonths(){
  currentMonth=null; currentWeek=null;
  backBtn.style.visibility='hidden';
  content.innerHTML=`
    <section class="hero">
      <div class="eyebrow">MACROCICLO</div>
      <h2>Plan Anual 2026–2027</h2>
      <p>Selecciona un mes para consultar etapas, semanas, eventos y planificación diaria.</p>
    </section>
    <section class="quick-actions">
      <button class="calendar-link" id="fullCalendarBtn"><span>▦</span><div><strong>Calendario completo</strong><small>Consulta todo el macrociclo día por día</small></div><b>›</b></button>
    </section>
    <section class="months">${monthData.map((m,i)=>{
      const cls=`phase-${i%6}`;
      const weeks=m.weeksList.length ? `${m.weeksList.length} bloques` : `${m.macroDays.length} días`;
      return `<button class="month-card ${cls}" data-month="${esc(m.name)}">
        <span class="month-number">${String(i+1).padStart(2,'0')}</span>
        <strong>${esc(m.name)}</strong>
        <small>${esc(m.stage || 'Planificación')}</small>
        <em>${esc(weeks)}${m.events.length ? ` · ${m.events.length} evento(s)` : ''}</em>
        <span class="arrow">›</span>
      </button>`;
    }).join('')}</section>`;
  document.getElementById('fullCalendarBtn').addEventListener('click',showCalendar);
  document.querySelectorAll('[data-month]').forEach(b=>b.addEventListener('click',()=>showMonth(b.dataset.month)));
}

function showMonth(name){
  currentMonth=monthData.find(m=>norm(m.name)===norm(name));
  currentWeek=null;
  backBtn.style.visibility='visible';
  backBtn.onclick=renderMonths;
  const weeks=currentMonth.weeksList;
  content.innerHTML=`
    <section class="month-head">
      <div class="eyebrow">${esc(currentMonth.period || 'PLAN ANUAL')}</div>
      <h2>${esc(currentMonth.name)}</h2>
      <p>${esc(currentMonth.stage || 'Consulta del macrociclo')}</p>
    </section>
    <div class="summary-grid">
      <div><span>SEMANAS</span><strong>${weeks.length || '—'}</strong></div>
      <div><span>DÍAS PROGRAMADOS</span><strong>${currentMonth.macroDays.length}</strong></div>
    </div>
    ${currentMonth.events.length ? `<section class="events-block"><div class="section-title"><span>EVENTOS DEL MES</span><small>Datos de Hoja1</small></div>${currentMonth.events.map(eventCard).join('')}</section>` : ''}
    <section class="weeks">${weeks.length ? weeks.map((w)=>`
      <button class="week-card" data-week="${esc(w.week)}">
        <span>SEMANA</span><strong>${esc(w.week)}</strong>
        <p>${esc(w.description || 'Sin descripción')}</p><span class="arrow">›</span>
      </button>`).join('') : '<div class="empty">No hay bloques semanales registrados en Hoja1.</div>'}</section>
    <section class="daily-block">
      <div class="section-title"><span>VISTA DIARIA</span><small>Datos de <b>macro gral</b></small></div>
      ${currentMonth.macroDays.map(dayCard).join('')}
    </section>`;
  document.querySelectorAll('[data-week]').forEach(b=>b.addEventListener('click',()=>showWeek(b.dataset.week)));
  document.querySelectorAll('[data-event]').forEach(b=>b.addEventListener('click',()=>showEvent(Number(b.dataset.event))));
}

function eventCard(item){
  const idx = currentMonth.items.indexOf(item);
  return `<button class="event-card event-${eventType(item.description).toLowerCase().replace(/[^a-záéíóúüñ]+/g,'-')}" data-event="${idx}">
    <span class="event-type">${esc(eventType(item.description))}</span>
    <strong>${esc(item.description)}</strong>
    <small>${esc(currentMonth.name)}${item.day ? ` · día ${esc(item.day)}` : ''}${item.week ? ` · semana ${esc(item.week)}` : ''}</small>
    <span class="arrow">›</span>
  </button>`;
}

function showEvent(itemIndex){
  const item=currentMonth.items[itemIndex];
  if(!item) return;
  backBtn.style.visibility='visible';
  backBtn.onclick=()=>showMonth(currentMonth.name);
  const matchingDays=currentMonth.macroDays.filter(r=>item.day && String(r.day)===String(item.day));
  const details=matchingDays[0] || {};
  content.innerHTML=`
    <section class="event-head">
      <div class="eyebrow">${esc(eventType(item.description))}</div>
      <h2>${esc(item.description)}</h2>
      <p>${esc(currentMonth.name)}${item.day ? ` · Día ${esc(item.day)}` : ''}${item.week ? ` · Semana ${esc(item.week)}` : ''}</p>
    </section>
    <section class="event-detail">
      <div><span>FECHA EN EL PLAN</span><strong>${esc(currentMonth.name)}${item.day ? ` ${esc(item.day)}` : ''}</strong></div>
      ${item.week ? `<div><span>SEMANA</span><strong>${esc(item.week)}</strong></div>` : ''}
      ${details.dow ? `<div><span>DÍA</span><strong>${esc(details.dow)}</strong></div>` : ''}
      ${details.Etapa ? `<div><span>ETAPA</span><strong>${esc(details.Etapa)}</strong></div>` : ''}
      ${details.Mesociclo ? `<div><span>MESOCICLO</span><strong>${esc(details.Mesociclo)}</strong></div>` : ''}
      ${details.Microciclo ? `<div><span>MICROCICLO</span><strong>${esc(details.Microciclo)}</strong></div>` : ''}
    </section>
    <button class="calendar-link" id="eventCalendarBtn"><span>▦</span><div><strong>Ver calendario completo</strong><small>Regresar a la vista diaria del macrociclo</small></div><b>›</b></button>`;
  document.getElementById('eventCalendarBtn').addEventListener('click',showCalendar);
}

function dayCard(r){
  const details=[['Periodo',r.Periodo],['Etapa',r.Etapa],['Mesociclo',r.Mesociclo],['Microciclo',r.Microciclo],['Unidad',r['UNIDAD DE ENTRENAMIENTO']],['Descripción',r.Descripción || r.DESCRIPCION],['Nivel técnico',r['NIVEL DE DESEMPEÑO TÉCNICO']],['Carga de fuerza',r['CARGA DE FUERZA']]].filter(x=>!isBlank(x[1]));
  return `<article class="day-card"><div class="day-top"><strong>${esc(r.day)}</strong><span>${esc(r.dow)}</span></div><div class="details">${details.map(d=>`<div><small>${esc(d[0])}</small><p>${esc(d[1])}</p></div>`).join('')}</div></article>`;
}

function showWeek(week){
  currentWeek=week;
  const items=currentMonth.macroDays.filter(r=>{
    const wk=clean(r.SEMANA);
    return wk===week || norm(wk).includes(norm(week));
  });
  const sourceItems=currentMonth.items.filter(x=>x.week===week || (!x.week && x.day));
  const events=sourceItems.filter(isEventItem);
  content.innerHTML=`
    <section class="month-head"><div class="eyebrow">${esc(currentMonth.name)}</div><h2>Semana ${esc(week)}</h2><p>${esc(currentMonth.weeks.find(w=>w.week===week)?.description || 'Planificación de la semana')}</p></section>
    ${events.length ? `<section class="events-block"><div class="section-title"><span>EVENTOS Y DESCANSOS</span><small>Datos de Hoja1</small></div>${events.map(eventCard).join('')}</section>` : ''}
    <section class="daily-block"><div class="section-title"><span>DETALLE</span><small>${items.length} registro(s) del macrociclo</small></div>
      ${items.length ? items.map(dayCard).join('') : '<div class="empty">Esta semana no está marcada explícitamente en macro gral; se conserva la descripción de Hoja1.</div>'}
    </section>
    ${sourceItems.length ? `<section class="notes"><div class="section-title"><span>REFERENCIA DEL PLAN</span><small>Hoja1</small></div>${sourceItems.map(x=>`<div class="note-row"><b>${esc(x.day || '')}</b><span>${esc(x.description || '')}</span></div>`).join('')}</section>`:''}`;
  document.querySelectorAll('[data-event]').forEach(b=>b.addEventListener('click',()=>{
    const sourceIndex=currentMonth.items.indexOf(events[Number(b.dataset.event)]);
    showEvent(sourceIndex);
  }));
  backBtn.onclick=()=>showMonth(currentMonth.name);
}

function showCalendar(){
  backBtn.style.visibility='visible';
  backBtn.onclick=renderMonths;
  const grouped=[];
  for(const r of macroRows){
    let g=grouped.find(x=>norm(x.name)===norm(r.month));
    if(!g){g={name:r.month,rows:[]};grouped.push(g);}
    g.rows.push(r);
  }
  content.innerHTML=`
    <section class="hero">
      <div class="eyebrow">PLAN ANUAL</div>
      <h2>Calendario completo</h2>
      <p>Vista completa construida exclusivamente con la hoja <b>macro gral</b> del Excel.</p>
    </section>
    <section class="calendar-list">
      ${grouped.map(g=>`<div class="calendar-month"><h3>${esc(g.name)}</h3>${g.rows.map(r=>`<article class="calendar-day"><div class="calendar-day-top"><strong>${esc(r.day)}</strong><span>${esc(r.dow)}</span></div><div class="calendar-details">${[['Periodo',r.Periodo],['Etapa',r.Etapa],['Mesociclo',r.Mesociclo],['Microciclo',r.Microciclo],['Unidad',r['UNIDAD DE ENTRENAMIENTO']],['Descripción',r.Descripción || r.DESCRIPCION],['Nivel técnico',r['NIVEL DE DESEMPEÑO TÉCNICO']],['Carga de fuerza',r['CARGA DE FUERZA']]].filter(x=>!isBlank(x[1])).map(d=>`<div><small>${esc(d[0])}</small><p>${esc(d[1])}</p></div>`).join('')}</div></article>`).join('')}</div>`).join('')}
    </section>`;
}

backBtn.onclick=renderMonths;
init();
