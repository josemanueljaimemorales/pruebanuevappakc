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
  const months = [];
  const fill = (row) => {
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
  for(const r of rows){
    const month=clean(r.MES);
    if(month) currentMonth = month;
    const m=month || currentMonth;
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
  // If Hoja1 is sparse, keep only months actually present in the detailed sheet.
  const macroMonths=[...new Set(macroRows.map(r=>r.month).filter(Boolean))];
  monthData=monthData.filter(m=>macroMonths.some(x=>norm(x)===norm(m.name)));
  for(const m of monthData){
    m.macroDays=macroRows.filter(r=>norm(r.month)===norm(m.name));
    m.stage=[...new Set(m.macroDays.map(r=>r.Etapa).filter(Boolean))].join(' · ');
    m.period=[...new Set(m.macroDays.map(r=>r.Periodo).filter(Boolean))].join(' · ');
    m.weeksList=[...m.weeks.values()];
  }
}

function renderMonths(){
  currentMonth=null; currentWeek=null;
  backBtn.style.visibility='hidden';
  content.innerHTML=`
    <section class="hero">
      <div class="eyebrow">MACROCICLO</div>
      <h2>Plan Anual 2026–2027</h2>
      <p>Selecciona un mes para consultar etapas, semanas y planificación diaria.</p>
    </section>
    <section class="months">${monthData.map((m,i)=>{
      const cls=`phase-${i%6}`;
      const weeks=m.weeksList.length ? `${m.weeksList.length} bloques` : `${m.macroDays.length} días`;
      return `<button class="month-card ${cls}" data-month="${esc(m.name)}">
        <span class="month-number">${String(i+1).padStart(2,'0')}</span>
        <strong>${esc(m.name)}</strong>
        <small>${esc(m.stage || 'Planificación')}</small>
        <em>${esc(weeks)}</em>
        <span class="arrow">›</span>
      </button>`;
    }).join('')}</section>`;
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
    <section class="weeks">${weeks.length ? weeks.map((w,i)=>`
      <button class="week-card" data-week="${esc(w.week)}">
        <span>SEMANA</span><strong>${esc(w.week)}</strong>
        <p>${esc(w.description || 'Sin descripción')}</p><span class="arrow">›</span>
      </button>`).join('') : '<div class="empty">No hay bloques semanales registrados en Hoja1.</div>'}</section>
    <section class="daily-block">
      <div class="section-title"><span>VISTA DIARIA</span><small>Datos de <b>macro gral</b></small></div>
      ${currentMonth.macroDays.map((r,i)=>dayCard(r,i)).join('')}
    </section>`;
  document.querySelectorAll('[data-event-index]').forEach(b=>b.addEventListener('click',()=>showEventDetail(b.dataset.eventIndex)));
  document.querySelectorAll('[data-week]').forEach(b=>b.addEventListener('click',()=>showWeek(b.dataset.week)));
}

function isSpecialEvent(r){
  const text = norm([r.Descripción, r.DESCRIPCION, r['Uni de entre'], r['UNIDAD DE ENTRENAMIENTO'], r.Microciclo, r.Etapa].filter(v=>!isBlank(v)).join(' '));
  return /DESCANS|CONTROL|COMPET|COPA|OLIMPIADA|CAMPEON|TORNEO|EVENTO|VACACION/.test(text) || norm(r['Uni de entre']) === 'C';
}

function specialLabel(r){
  const text = norm([r.Descripción, r.DESCRIPCION].filter(v=>!isBlank(v)).join(' '));
  if(/DESCANS/.test(text)) return 'DESCANSO';
  if(/CONTROL/.test(text)) return 'CONTROL';
  if(/OLIMPIADA|COMPET|COPA|CAMPEON|TORNEO|EVENTO/.test(text) || norm(r['Uni de entre']) === 'C') return 'COMPETENCIA / EVENTO';
  if(/VACACION/.test(text)) return 'VACACIONES';
  return 'EVENTO';
}

function dayCard(r, index=-1){
  const details=[
    ['Periodo',r.Periodo],
    ['Etapa',r.Etapa],
    ['Mesociclo',r.Mesociclo],
    ['Microciclo',r.Microciclo],
    ['Unidad',r['UNIDAD DE ENTRENAMIENTO'] || r['Uni de entre']],
    ['Descripción',r.Descripción || r.DESCRIPCION],
    ['Nivel técnico',r['NIVEL DE DESEMPEÑO TÉCNICO'] || r['NIVEL DE DESEMPEÑO TECNICO']],
    ['Carga de fuerza',r['CARGA DE FUERZA']]
  ].filter(x=>!isBlank(x[1]));
  const special=isSpecialEvent(r);
  const label=special ? specialLabel(r) : '';
  return `<article class="day-card ${special ? 'special-event' : ''}" ${special && index>=0 ? `data-event-index="${index}"` : ''}>
    <div class="day-top"><strong>${esc(r.day)}</strong><span>${esc(r.dow)}</span></div>
    ${special ? `<div class="event-badge">${esc(label)}</div>` : ''}
    <div class="details">${details.map(d=>`<div><small>${esc(d[0])}</small><p>${esc(d[1])}</p></div>`).join('')}</div>
    ${special ? '<div class="event-access">Ver detalle <span>›</span></div>' : ''}
  </article>`;
}

function showEventDetail(index){
  const r=currentMonth?.macroDays?.[Number(index)];
  if(!r) return;
  backBtn.style.visibility='visible';
  backBtn.onclick=()=>showMonth(currentMonth.name);
  const details=[
    ['Fecha', `${currentMonth.name} ${r.day}`],
    ['Día', r.dow],
    ['Periodo', r.Periodo],
    ['Etapa', r.Etapa],
    ['Mesociclo', r.Mesociclo],
    ['Semana', r.SEMANA],
    ['Microciclo', r.Microciclo],
    ['Unidad de entrenamiento', r['UNIDAD DE ENTRENAMIENTO'] || r['Uni de entre']],
    ['Descripción', r.Descripción || r.DESCRIPCION],
    ['Nivel de desempeño técnico', r['NIVEL DE DESEMPEÑO TÉCNICO'] || r['NIVEL DE DESEMPEÑO TECNICO']],
    ['Carga de fuerza', r['CARGA DE FUERZA']]
  ].filter(x=>!isBlank(x[1]));
  content.innerHTML=`
    <section class="event-detail">
      <div class="eyebrow">${esc(specialLabel(r))}</div>
      <h2>${esc(r.Descripción || r.DESCRIPCION || specialLabel(r))}</h2>
      <div class="event-date">${esc(currentMonth.name)} ${esc(r.day)} · ${esc(r.dow)}</div>
      <div class="event-details">${details.map(d=>`<div><small>${esc(d[0])}</small><p>${esc(d[1])}</p></div>`).join('')}</div>
      <div class="source-note">Información tomada exclusivamente del Excel del Plan Anual.</div>
    </section>`;
}

function showWeek(week){
  currentWeek=week;
  const items=currentMonth.macroDays.filter(r=>{
    const wk=clean(r.SEMANA);
    return wk===week || norm(wk).includes(norm(week));
  });
  const sourceItems=currentMonth.items.filter(x=>x.week===week || (!x.week && x.day));
  content.innerHTML=`
    <section class="month-head"><div class="eyebrow">${esc(currentMonth.name)}</div><h2>Semana ${esc(week)}</h2><p>${esc(currentMonth.weeks.find(w=>w.week===week)?.description || 'Planificación de la semana')}</p></section>
    <section class="daily-block"><div class="section-title"><span>DETALLE</span><small>${items.length} registro(s) del macrociclo</small></div>
      ${items.length ? items.map(dayCard).join('') : '<div class="empty">Esta semana no está marcada explícitamente en macro gral; se conserva la descripción de Hoja1.</div>'}
    </section>
    ${sourceItems.length ? `<section class="notes"><div class="section-title"><span>REFERENCIA DEL PLAN</span><small>Hoja1</small></div>${sourceItems.map(x=>`<div class="note-row"><b>${esc(x.day || '')}</b><span>${esc(x.description || '')}</span></div>`).join('')}</section>`:''}`;
  backBtn.onclick=()=>showMonth(currentMonth.name);
}

backBtn.onclick=renderMonths;
init();
