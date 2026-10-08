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
let assignmentData = { athletes: [], competitions: [] };

const esc = v => String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const clean = v => String(v ?? '').trim();
const upper = v => clean(v).toUpperCase();
const dateKey = d => `${d.year}-${String(d.month).padStart(2,'0')}-${String(d.day).padStart(2,'0')}`;


function cycleLabel(){
  if(!months.length) return 'CICLO';
  const first=months[0], last=months[months.length-1];
  return `${first.year}–${last.year}`;
}

// Descansos obligatorios oficiales en México (Art. 74 LFT).
// Se calculan por el año real de cada fecha del MACRO, nunca por un año fijo.
function officialHoliday(year, month, day){
  const fixed = {
    '1-1':'Año Nuevo',
    '5-1':'Día del Trabajo',
    '9-16':'Independencia de México',
    '12-25':'Navidad'
  };
  const key=`${month}-${day}`;
  if(fixed[key]) return fixed[key];
  const d=new Date(Date.UTC(year,month-1,day));
  const dow=d.getUTCDay();
  // Primer lunes de febrero: Constitución.
  if(month===2 && dow===1 && day>=1 && day<=7) return 'Día de la Constitución';
  // Tercer lunes de marzo: Natalicio de Benito Juárez.
  if(month===3 && dow===1 && day>=15 && day<=21) return 'Natalicio de Benito Juárez';
  // Tercer lunes de noviembre: Revolución Mexicana.
  if(month===11 && dow===1 && day>=15 && day<=21) return 'Revolución Mexicana';
  return '';
}

function nationalDateLabel(year,month,day){
  // Fechas nacionales/conmemorativas; NO son descansos obligatorios.
  const fixed={
    '2-24':'Día de la Bandera',
    '5-5':'Batalla de Puebla',
    '9-13':'Niños Héroes',
    '10-12':'Día de la Nación Pluricultural',
    '11-2':'Día de Muertos',
    '11-20':'Aniversario de la Revolución Mexicana'
  };
  return fixed[`${month}-${day}`] || '';
}

function dateEventLabels(d){
  const labels=[];
  const official=officialHoliday(d.year,d.month,d.day);
  if(official) labels.push({type:'F',title:official});
  const national=nationalDateLabel(d.year,d.month,d.day);
  if(national && !official) labels.push({type:'N',title:national});
  return labels;
}

async function reloadPlanData(){
  const [macroBuf,assignmentBuf]=await Promise.all([
    fetch('./MACRO_26_27.xlsx',{cache:'no-store'}).then(r=>{if(!r.ok) throw Error('No se encontró MACRO_26_27.xlsx'); return r.arrayBuffer();}),
    fetch('./ASIGNACION DE COMPETENCIAS.xlsx',{cache:'no-store'}).then(r=>{if(!r.ok) throw Error('No se encontró ASIGNACION DE COMPETENCIAS.xlsx'); return r.arrayBuffer();})
  ]);
  const macroWb=XLSX.read(macroBuf,{type:'array',cellDates:true});
  const assignmentWb=XLSX.read(assignmentBuf,{type:'array',cellDates:true});
  days=readCalendar(macroWb);
  assignmentData=readAssignments(assignmentWb);
  buildMonths();
  buildSpecialEvents();
}

function printCalendar(){
  const btn=document.getElementById('printCalendarBtn');
  if(btn) { btn.disabled=true; btn.textContent='ACTUALIZANDO…'; }
  reloadPlanData().then(async ()=>{
    const html=buildPrintableCalendar();
    const w=window.open('','_blank');
    if(!w) throw Error('El navegador bloqueó la ventana de impresión. Permite ventanas emergentes para este sitio.');
    w.document.open(); w.document.write(html); w.document.close();
  }).catch(err=>alert(err.message)).finally(()=>{
    const b=document.getElementById('printCalendarBtn');
    if(b){b.disabled=false;b.textContent='IMPRIMIR / GUARDAR PDF';}
  });
}

function printableItemsForMonth(m){
  const rows=new Map();
  const add=(key,item)=>{
    if(!rows.has(key)) rows.set(key,[]);
    rows.get(key).push(item);
  };

  const monthDays=new Set(m.days.map(d=>d.key));
  for(const type of ['competencia','eventos','descansos']){
    for(const e of specialEvents[type]){
      const matchingDays=e.days.filter(d=>monthDays.has(d.key));
      for(const d of matchingDays){
        const venues=type==='competencia' ? venuesForEvent(e) : [];
        add(d.key,{type,title:e.title,venues});
      }
    }
  }

  for(const d of m.days){
    for(const h of dateEventLabels(d)) add(d.key,{type:h.type,title:h.title,venues:[]});
  }

  return [...rows.entries()]
    .sort((a,b)=>a[0].localeCompare(b[0]))
    .map(([key,items])=>({date:m.days.find(d=>d.key===key),items}));
}

function printableTypeLabel(type){
  return type==='competencia'?'Competencia':type==='eventos'?'Evento':type==='descansos'?'Descanso':type==='F'?'Festivo oficial':'Fecha nacional';
}

function printableEventText(item){
  const venue=item.venues?.length ? ` · Sede: ${item.venues.join(' / ')}` : '';
  return `<div class="p-event p-${esc(item.type)}"><b>${esc(printableTypeLabel(item.type))}:</b> ${esc(item.title)}${esc(venue)}</div>`;
}

function buildPrintableCalendar(){
  const first=months[0], last=months[months.length-1];
  const cycle=`${first?.name || ''} ${first?.year || ''} – ${last?.name || ''} ${last?.year || ''}`;
  const logoUrl=new URL('../../logo.png',location.href).href;

  const monthsHtml=months.map(m=>{
    const rows=printableItemsForMonth(m);
    if(!rows.length) return '';
    return `<section class="p-month"><h2>${esc(monthLabel(m))}</h2>${rows.map(row=>`
      <div class="p-row"><div class="p-date">${esc(row.date.day)} ${esc(row.date.monthName.toLowerCase())}</div><div class="p-items">${row.items.map(printableEventText).join('')}</div></div>`).join('')}</section>`;
  }).join('');

  const athleteRows=assignmentData.athletes.map(a=>{
    const assigned=orderedAssignmentCompetitions().filter(c=>a.assignments[c.key]);
    const list=assigned.length
      ? assigned.map(c=>`<div class="a-event"><span>✓</span>${esc(c.title)}</div>`).join('')
      : '<div class="a-none">Sin competencias asignadas</div>';
    return `<tr><td class="a-name">${esc(a.name)}</td><td class="a-level">${esc(a.level)}</td><td class="a-events">${list}</td></tr>`;
  }).join('');

  const legend=`<div class="p-legend">
    <span><b class="legend-c">C</b> Competencia</span>
    <span><b class="legend-e">E</b> Evento</span>
    <span><b class="legend-d">D</b> Descanso / puente / vacaciones</span>
    <span><b class="legend-f">F</b> Festivo oficial</span>
    <span><b class="legend-n">N</b> Fecha nacional</span>
  </div>`;

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Plan Anual ${esc(cycle)}</title><style>
  @page{size:A4 portrait;margin:11mm 12mm 12mm}
  *{box-sizing:border-box}
  body{font-family:Arial,Helvetica,sans-serif;color:#152238;background:#fff;margin:0;font-size:10px;line-height:1.35}
  .p-head{display:flex;align-items:center;gap:12px;border-bottom:3px solid #19b8f2;padding:0 0 8px;margin-bottom:12px}
  .p-logo{width:70px;height:70px;object-fit:contain;flex:none}
  .p-brand h1{margin:0;color:#0b2342;font-size:19px;letter-spacing:.4px}
  .p-brand .sub{margin-top:2px;color:#42536b;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.6px}
  .p-brand .cycle{margin-top:5px;color:#0b2342;font-size:10px;font-weight:800}
  .p-title{margin-left:auto;text-align:right;color:#0b2342}
  .p-title strong{display:block;font-size:11px;letter-spacing:.7px}
  .p-title span{font-size:8px;color:#64748b}
  .p-month{break-inside:avoid;margin:0 0 13px}
  .p-month h2{margin:0 0 5px;padding:5px 8px;background:#0b2342;color:#fff;border-left:5px solid #19b8f2;font-size:12px;letter-spacing:.7px;text-transform:uppercase}
  .p-row{display:grid;grid-template-columns:76px 1fr;border-bottom:1px solid #d7dee8;break-inside:avoid;min-height:28px}
  .p-date{padding:6px 7px;font-weight:800;color:#0b2342;background:#f3f7fb;text-transform:uppercase;font-size:9px}
  .p-items{padding:4px 7px}
  .p-event{padding:2px 0 2px 8px;border-left:4px solid #94a3b8;margin:1px 0;color:#26364d}
  .p-event b{font-size:8.5px}
  .p-competencia{border-left-color:#0b67b2}.p-eventos{border-left-color:#7b5bb5}.p-descansos{border-left-color:#6b7280}.p-F{border-left-color:#d28a00}.p-N{border-left-color:#18a36b}
  .p-event b{color:#0b2342}
  .p-legend{display:flex;flex-wrap:wrap;gap:7px 13px;border-top:2px solid #0b2342;padding:7px 0 10px;margin-top:2px;font-size:8px;color:#42536b;break-inside:avoid}
  .p-legend b{display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:3px;color:#fff;font-size:8px;margin-right:3px}
  .legend-c{background:#0b67b2}.legend-e{background:#7b5bb5}.legend-d{background:#6b7280}.legend-f{background:#d28a00}.legend-n{background:#18a36b}
  .assign{break-before:page;margin-top:2px}
  .assign-head{display:flex;align-items:center;gap:10px;border-bottom:3px solid #19b8f2;padding-bottom:7px;margin-bottom:10px}
  .assign-logo{width:48px;height:48px;object-fit:contain}
  .assign h2{margin:0;color:#0b2342;font-size:14px;text-transform:uppercase;letter-spacing:.4px}
  .assign .sub{margin:2px 0 0;color:#64748b;font-size:8px}
  table{border-collapse:collapse;width:100%;font-size:8.5px;table-layout:fixed}
  th,td{border:1px solid #cbd5e1;vertical-align:top}
  th{background:#0b2342;color:#fff;padding:5px 4px;text-align:left;font-size:8px}
  td{padding:4px;background:#fff}
  tr:nth-child(even) td{background:#f7f9fc}
  .a-name{width:31%;font-weight:700;color:#172b46}.a-level{width:10%;text-align:center;font-weight:800;color:#0b2342}.a-events{width:59%}
  .a-event{padding:2px 0;border-bottom:1px solid #e5e7eb;line-height:1.2}.a-event:last-child{border-bottom:0}.a-event span{color:#0b67b2;font-weight:900;margin-right:5px}.a-none{color:#94a3b8;font-style:italic}
  .note{margin-top:7px;color:#64748b;font-size:7.5px;line-height:1.3}
  .footer{margin-top:12px;padding-top:5px;border-top:1px solid #cbd5e1;text-align:center;color:#64748b;font-size:7px}
  @media print{button{display:none}}
</style></head><body>
<header class="p-head"><img class="p-logo" src="${esc(logoUrl)}" alt="Águilas KC"><div class="p-brand"><h1>ÁGUILAS DE KIDS CENTER</h1><div class="sub">Gimnasia Artística Varonil · Águilas KC</div><div class="cycle">PLAN ANUAL · ${esc(cycle)}</div></div><div class="p-title"><strong>CALENDARIO PARA FAMILIAS</strong><span>Concentrado de fechas relevantes del ciclo</span></div></header>
${monthsHtml || '<p>No hay competencias, eventos, descansos ni fechas nacionales registradas en el ciclo.</p>'}
${legend}
<section class="assign"><div class="assign-head"><img class="assign-logo" src="${esc(logoUrl)}" alt="Águilas KC"><div><h2>Atletas y asignación a competencias</h2><div class="sub">Concentrado generado directamente de ASIGNACIÓN DE COMPETENCIAS al momento de imprimir.</div></div></div><table><thead><tr><th class="a-name">ATLETA</th><th class="a-level">NIVEL</th><th class="a-events">COMPETENCIAS ASIGNADAS</th></tr></thead><tbody>${athleteRows || '<tr><td colspan="3">Sin atletas registrados.</td></tr>'}</tbody></table><div class="note">F = festivo oficial en México. N = fecha nacional/conmemorativa. Los domingos no se consideran automáticamente descansos.</div><div class="footer">ÁGUILAS DE KIDS CENTER · PLAN ANUAL · ${esc(cycle)}</div></section>
<script>window.onload=()=>setTimeout(()=>window.print(),300);</script></body></html>`;
}

function init(){
  reloadPlanData()
    .then(renderHome)
    .catch(err=>{
      content.innerHTML = `<div class="error"><h2>No se pudo cargar el Plan Anual</h2><p>${esc(err.message)}</p></div>`;
    });
}

function normalizeName(v){
  return String(v ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
}

function competitionTokens(v){
  let t=normalizeName(v)
    .replace(/\b(?:19|20)\d{2}\b/g,' ')
    .replace(/\b\d{1,2}\b/g,' ')
    .replace(/\b(?:DE|DEL|LA|EL|Y|O|PARA|POR|EN)\b/g,' ')
    .replace(/\b(?:COPA|CAMPEONATO|COMPETENCIA|TORNEO|CONTROL|EVENTO)\b/g,' ')
    .replace(/\b(?:PROBABLE|FECHA|PRIMER|PRIMERO|SEGUNDO|SEGUNDA|1ER|2DO|2DA)\b/g,' ')
    .replace(/\bSELECTIVOS?\b/g,'SELECTIVO')
    .replace(/\bNACIONALES?\b/g,'NACIONAL')
    .replace(/\bESTATALES?\b/g,'ESTATAL')
    .replace(/\bINVITATIONALS?\b/g,'INVITATIONAL')
    .replace(/\bCUPS?\b/g,'CUP')
    .replace(/\s+/g,' ').trim();
  return new Set(t ? t.split(' ') : []);
}

function competitionMatchScore(a,b){
  const na=normalizeName(a), nb=normalizeName(b);
  if(!na || !nb) return 0;
  if(na===nb) return 100;
  if(na.includes(nb) || nb.includes(na)) return 92;

  const A=competitionTokens(a), B=competitionTokens(b);
  if(!A.size || !B.size) return 0;
  let common=0;
  A.forEach(x=>{ if(B.has(x)) common++; });
  const union=new Set([...A,...B]).size;
  const minSize=Math.min(A.size,B.size);
  const coverage=common/minSize;
  const jaccard=common/union;

  // Requerimos una coincidencia fuerte para no mezclar competencias distintas.
  if(coverage===1) return 80 + jaccard*10;
  if(coverage>=0.75 && jaccard>=0.50) return 65 + jaccard*10;
  return jaccard*50;
}

function readAssignments(wb){
  const ws = wb.Sheets[wb.SheetNames[0]];
  if(!ws) throw Error('No existe la hoja de asignación de competencias');
  const matrix = XLSX.utils.sheet_to_json(ws,{header:1,defval:''});
  const header = matrix[0] || [];
  const venueRow = matrix.findIndex((row,i)=>i>0 && row.some(cell=>/^\s*SEDE(?:S| DE COMPETENCIAS)?\s*[:\n]?/i.test(clean(cell))));
  const competitions = [];
  for(let c=2;c<header.length;c++){
    const title = clean(header[c]);
    if(title && title.toUpperCase()!=='PARTICIPACION'){
      competitions.push({key:`c${c}`, title, column:c, venue:venueRow>=0 ? clean(matrix[venueRow]?.[c]).replace(/^SEDE\s*[:\n]?\s*/i,'').trim() : ''});
    }
  }
  const athletes = [];
  for(let r=1;r<matrix.length;r++){
    if(r===venueRow) continue;
    const name=clean(matrix[r]?.[0]);
    if(!name || /^(SEDE|SEDES|SEDE DE COMPETENCIAS)$/i.test(name)) continue;
    const level=clean(matrix[r]?.[1]);
    const assignments={};
    competitions.forEach(comp=>{
      const value=upper(matrix[r]?.[comp.column]);
      assignments[comp.key]=value==='SI';
    });
    athletes.push({name,level,assignments});
  }
  return {athletes,competitions};
}

function assignmentColumnsForEvent(event){
  const title=clean(event?.title || '');
  if(!title) return [];

  // 1) Coincidencia EXACTA entre la descripción del MACRO y el encabezado
  // de ASIGNACION. Esta es la vía principal y evita cualquier alias manual.
  const normalizedTitle=normalizeName(title);
  const exact=assignmentData.competitions.find(comp =>
    normalizeName(comp.title) === normalizedTitle
  );
  if(exact) return [exact];

  // 2) Si el nombre cambió ligeramente (año, prefijos, etc.), usamos
  // coincidencia por contenido, pero nunca inventamos una competencia.
  const scored=assignmentData.competitions
    .map(comp=>({comp,score:competitionMatchScore(title,comp.title)}))
    .filter(x=>x.score>=65)
    .sort((a,b)=>b.score-a.score);

  if(!scored.length) return [];

  const best=scored[0];
  if(best.score>=92) return [best.comp];

  const threshold=Math.max(65,best.score-8);
  return scored.filter(x=>x.score>=threshold).map(x=>x.comp);
}

function athletesForEvent(event){
  const cols=assignmentColumnsForEvent(event);
  if(!cols.length) return [];
  return assignmentData.athletes.filter(a=>cols.some(c=>a.assignments[c.key]));
}

function venuesForEvent(event){
  const cols=assignmentColumnsForEvent(event);
  return [...new Set(cols.map(c=>clean(c.venue)).filter(Boolean))];
}

function eventForAssignment(comp){
  const key=normalizeName(comp?.title || '');
  if(!key) return null;

  const scored=specialEvents.competencia
    .map(e=>({event:e,score:competitionMatchScore(comp.title,e.title)}))
    .filter(x=>x.score>=65)
    .sort((a,b)=>b.score-a.score);

  return scored.length ? scored[0].event : null;
}

function competitionOrderKey(comp){
  const event=eventForAssignment(comp);
  return event?.start?.key || '9999-99-99';
}

function orderedAssignmentCompetitions(){
  return assignmentData.competitions.slice().sort((a,b)=>{
    const ka=competitionOrderKey(a), kb=competitionOrderKey(b);
    if(ka!==kb) return ka.localeCompare(kb);
    return normalizeName(a.title).localeCompare(normalizeName(b.title),'es');
  });
}

function competitionsForAthlete(athlete){
  return orderedAssignmentCompetitions()
    .filter(c=>athlete.assignments[c.key])
    .map(c=>({assignment:c,event:eventForAssignment(c)}));
}

function readCalendar(wb){
  const ws = wb.Sheets['macro gral'];
  if(!ws) throw Error('No existe la hoja "macro gral"');
  const matrix = XLSX.utils.sheet_to_json(ws,{header:1,defval:''});
  const fillRow = row => {
    let last='';
    return row.map(v=>{if(!['',null,undefined].includes(v)) last=clean(v); return last;});
  };

  // SheetJS conserva los rangos combinados de Excel en ws['!merges'].
  // Para NIVEL DE DESEMPEÑO TECNICO y CARGA DE FUERZA, el valor no está
  // en una sola fila: está distribuido verticalmente (ALTO/MEDIO/BAJO y
  // 60-80%/45-60%) y cada bloque está combinado horizontalmente.
  // Si usamos fillRow sobre una sola fila, se termina repitiendo un valor
  // incorrecto para muchos días. Aquí resolvemos el valor real de cada
  // columna respetando las celdas combinadas del Excel.
  const mergedValueAt = (row1,col1) => {
    const r=row1-1, c=col1-1;
    const direct=ws[XLSX.utils.encode_cell({r,c})];
    if(direct && clean(direct.v)!=='') return clean(direct.v);
    const merges=ws['!merges']||[];
    for(const m of merges){
      if(r>=m.s.r && r<=m.e.r && c>=m.s.c && c<=m.e.c){
        const top=ws[XLSX.utils.encode_cell({r:m.s.r,c:m.s.c})];
        return top ? clean(top.v) : '';
      }
    }
    return '';
  };

  const technicalForColumn = col => {
    // Prioridad por fila: ALTO, MEDIO, BAJO; solo una de las tres
    // corresponde a cada bloque del calendario.
    for(const row of [11,12,13]){
      const value=mergedValueAt(row,col);
      if(value) return value;
    }
    return '';
  };

  const forceForColumn = col => {
    // Las cargas están en las filas 15 y 16 y también están combinadas
    // horizontalmente por bloques.
    for(const row of [15,16]){
      const value=mergedValueAt(row,col);
      if(value) return value;
    }
    return '';
  };

  const monthRow = fillRow(matrix[0]||[]);
  const dayRow = matrix[1]||[];
  const dowRow = matrix[2]||[];
  const periodRow = fillRow(matrix[3]||[]);
  const stageRow = fillRow(matrix[4]||[]);
  const weekRow = fillRow(matrix[6]||[]);
  const unitRow = fillRow(matrix[8]||[]);
  const descRow = fillRow(matrix[9]||[]);

  let year=2026, previousMonth=0;
  const out=[];
  for(let c=1;c<monthRow.length;c++){
    const monthName=upper(monthRow[c]);
    const month=MONTHS[monthName];
    const dayNum=Number(dayRow[c]);
    if(!month || !Number.isFinite(dayNum) || dayNum<1 || dayNum>31) continue;
    if(previousMonth && month < previousMonth) year++;
    previousMonth=month;
    const d = {
      year,month,monthName,day:dayNum,dow:clean(dowRow[c]),
      period:clean(periodRow[c]),stage:clean(stageRow[c]),week:clean(weekRow[c]),
      unit:clean(unitRow[c]),description:clean(descRow[c]),
      technical:technicalForColumn(c+1),
      force:forceForColumn(c+1)
    };
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

  // IMPORTANTE:
  // "D" en la fila de unidad NO significa que sea un descanso para este módulo.
  // Los domingos son descanso natural y nunca se listan.
  // Un descanso/vacación/puente solo existe cuando está EXPRESAMENTE
  // indicado en la descripción del Excel.
  if(/DESCANS|VACACION|PUENTE/.test(t)) return 'descansos';

  // La columna "Unidad de entrenamiento" es la fuente oficial de clasificación:
  // C = Competencia, E = Evento. No se intenta adivinar por el nombre de la descripción.
  const unit = upper(d.unit).replace(/\s+/g,'');
  if(unit==='C') return 'competencia';
  if(unit==='E') return 'eventos';
  return null;
}

function eventTitleKey(text){
  // Quita fechas y números de día para que, por ejemplo,
  // "Copa AGPAC 14 de noviembre" y "Copa AGPAC 15 de noviembre"
  // se consideren el mismo evento.
  return upper(text)
    .replace(/\b\d{1,2}\s*(?:AL|A|[-/] )?\s*\d{1,2}\b/g,'')
    .replace(/\b\d{1,2}\s+DE\s+(ENERO|FEBRERO|MARZO|ABRIL|MAYO|JUNIO|JULIO|AGOSTO|SEPTIEMBRE|OCTUBRE|NOVIEMBRE|DICIEMBRE)\b/g,'')
    .replace(/\b\d{1,2}[-/]\d{1,2}(?:[-/]\d{2,4})?\b/g,'')
    .replace(/\s+/g,' ').trim();
}

function nextDay(a,b){
  return (new Date(b.year,b.month-1,b.day)-new Date(a.year,a.month-1,a.day))===86400000;
}

function buildSpecialEvents(){
  const result={competencia:[],eventos:[],descansos:[]};
  const sorted=days.slice().sort((a,b)=>a.key.localeCompare(b.key));

  // COMPETENCIAS: se agrupan únicamente días consecutivos que pertenecen
  // al mismo nombre de competencia. El nombre se toma del Excel, quitando
  // solamente las fechas que cambian de un día al siguiente.
  let i=0;
  while(i<sorted.length){
    const d=sorted[i];
    if(classify(d)!=='competencia' || !d.description){i++;continue;}
    const key=eventTitleKey(d.description);
    let end=d, j=i+1;
    while(j<sorted.length){
      const n=sorted[j];
      if(classify(n)==='competencia' && n.description && nextDay(end,n) && eventTitleKey(n.description)===key){
        end=n; j++;
      } else break;
    }
    result.competencia.push({id:`competencia-${d.key}`,type:'competencia',title:d.description,start:d,end,days:sorted.filter(x=>x.key>=d.key&&x.key<=end.key)});
    i=j;
  }

  // EVENTOS: aparecen solamente cuando realmente existe un evento en el Excel.
  // No se generan automáticamente por domingos ni por días ordinarios.
  i=0;
  while(i<sorted.length){
    const d=sorted[i];
    if(classify(d)!=='eventos' || !d.description){i++;continue;}
    const key=eventTitleKey(d.description);
    let end=d,j=i+1;
    while(j<sorted.length){
      const n=sorted[j];
      if(classify(n)==='eventos' && n.description && nextDay(end,n) && eventTitleKey(n.description)===key){end=n;j++;}
      else break;
    }
    result.eventos.push({id:`eventos-${d.key}`,type:'eventos',title:d.description,start:d,end,days:sorted.filter(x=>x.key>=d.key&&x.key<=end.key)});
    i=j;
  }

  // DESCANSOS: solo descansos explícitos del Excel (D/descanso/vacaciones/puente),
  // excluyendo TODOS los domingos porque son descanso natural.
  i=0;
  while(i<sorted.length){
    const d=sorted[i];
    if(classify(d)!=='descansos' || !d.description){i++;continue;}
    const key=eventTitleKey(d.description);
    let end=d,j=i+1;
    while(j<sorted.length){
      const n=sorted[j];
      if(classify(n)==='descansos' && n.description && nextDay(end,n) && eventTitleKey(n.description)===key){end=n;j++;}
      else break;
    }
    result.descansos.push({id:`descansos-${d.key}`,type:'descansos',title:d.description,start:d,end,days:sorted.filter(x=>x.key>=d.key&&x.key<=end.key)});
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
  content.innerHTML=`<section class="hero"><div class="eyebrow">PLAN ANUAL ${cycleLabel()}</div><h2>${esc(title)}</h2>${subtitle?`<p>${esc(subtitle)}</p>`:''}</section>`;
}

function renderHome(){
  backBtn.style.visibility='hidden';
  content.innerHTML=`
    <section class="hero">
      <div class="eyebrow">PLAN ANUAL ${cycleLabel()}</div>
      <h2>Calendario de entrenamiento</h2>
      <p>Consulta cada mes por día y accede directamente a competencias, eventos y descansos.</p>
    </section>
    <section class="print-action"><button class="print-calendar-btn" id="printCalendarBtn">IMPRIMIR / GUARDAR PDF</button><small>Genera el concentrado actualizado y abre la impresión. En el diálogo elige <b>Guardar como PDF</b> para obtener el archivo PDF.</small></section>
    <section class="quick-actions">
      <button class="quick competition" data-list="competencia"><strong>COMPETENCIAS</strong><span>${specialEvents.competencia.length} registradas · asignaciones</span><b>›</b></button>
      <button class="quick athletes" data-athletes><strong>ATLETAS</strong><span>${assignmentData.athletes.length} atletas asignados</span><b>›</b></button>
      <button class="quick event" data-list="eventos"><strong>EVENTOS</strong><span>${specialEvents.eventos.length} registrados</span><b>›</b></button>
      <button class="quick rest" data-list="descansos"><strong>DESCANSOS</strong><span>${specialEvents.descansos.length} registrados</span><b>›</b></button>
    </section>
    <section class="month-list">
      <div class="section-title"><span>MESES</span><small>Orden cronológico</small></div>
      ${months.map((m,i)=>`<button class="month-card" data-month-key="${esc(m.key)}"><span>${String(i+1).padStart(2,'0')}</span><strong>${esc(monthLabel(m))}</strong><em>${m.days.length} días</em><b>›</b></button>`).join('')}
    </section>`;
  document.querySelectorAll('[data-month-key]').forEach(b=>b.onclick=()=>showMonth(b.dataset.monthKey));
  document.querySelectorAll('[data-list]').forEach(b=>b.onclick=()=>showSpecialList(b.dataset.list));
  document.querySelector('[data-athletes]')?.addEventListener('click',showAthletesList);
  document.getElementById('printCalendarBtn')?.addEventListener('click',printCalendar);
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
  const athletes=e.type==='competencia'?athletesForEvent(e):[];
  const extra=e.type==='competencia'?` · ${athletes.length} atletas`:'';
  const venue=e.type==='competencia' ? venuesForEvent(e) : [];
  const venueText=venue.length ? ` · ${venue.join(' / ')}` : '';
  return `<button class="special-card ${esc(e.type)}" data-event-id="${esc(e.id)}"><span class="tag">${label}</span><strong>${esc(e.title)}</strong><small>${esc(formatRange(e))}${extra}${esc(venueText)}</small><b>›</b></button>`;
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
  const athletes=e.type==='competencia'?athletesForEvent(e):[];
  const athleteSection=e.type==='competencia' ? `
    <section class="assigned-athletes">
      <div class="subsection-head"><div><span>ATLETAS ASIGNADOS</span><small>${athletes.length} atletas</small></div></div>
      ${athletes.length ? `<div class="athlete-grid">${athletes.map(a=>`<button class="athlete-chip" data-athlete="${esc(a.name)}"><strong>${esc(a.name)}</strong><span>Nivel ${esc(a.level)}</span>›</button>`).join('')}</div>` : '<div class="empty small">No hay atletas asignados a esta competencia.</div>'}
    </section>` : '';
  content.innerHTML=`
    <section class="event-detail ${esc(type)}">
      <div class="eyebrow">${type==='competencia'?'COMPETENCIA':type==='eventos'?'EVENTO':'DESCANSO'}</div>
      <h2>${esc(e.title)}</h2>
      <div class="event-range">${esc(formatRange(e))}</div>
      ${e.type==='competencia' && venuesForEvent(e).length ? `<div class="competition-venue"><small>SEDE</small><strong>${esc(venuesForEvent(e).join(' · '))}</strong></div>` : ''}
      <div class="event-description"><small>DESCRIPCIÓN</small><p>${esc(e.title)}</p></div>
      ${athleteSection}
      <button class="calendar-jump" id="calendarJump">VER EN CALENDARIO GENERAL ›</button>
    </section>`;
  document.querySelectorAll('[data-athlete]').forEach(b=>b.onclick=()=>showAthleteDetail(b.dataset.athlete, e.id));
  document.getElementById('calendarJump').onclick=()=>{
    selectedDate=e.start.key;
    const m=months.find(x=>x.days.some(d=>d.key===e.start.key));
    if(m) showMonth(m.key);
  };
}

function showAthletesList(){
  backBtn.style.visibility='visible'; backBtn.onclick=renderHome;
  content.innerHTML=`<section class="hero"><div class="eyebrow">PLAN ANUAL</div><h2>Atletas</h2><p>Selecciona un atleta para consultar las competencias que tiene asignadas.</p></section>
  <section class="athlete-list">
    ${assignmentData.athletes.map(a=>`<button class="athlete-row" data-athlete-row="${esc(a.name)}"><div><strong>${esc(a.name)}</strong><small>Nivel ${esc(a.level)}</small></div><span>${competitionsForAthlete(a).length} competencias ›</span></button>`).join('')}
  </section>`;
  document.querySelectorAll('[data-athlete-row]').forEach(b=>b.onclick=()=>showAthleteDetail(b.dataset.athleteRow));
}

function showAthleteDetail(name,returnEventId=null){
  const athlete=assignmentData.athletes.find(a=>normalizeName(a.name)===normalizeName(name));
  if(!athlete)return;
  backBtn.style.visibility='visible';
  backBtn.onclick=()=>returnEventId ? openSpecial(returnEventId,'competencia') : showAthletesList();
  const items=competitionsForAthlete(athlete);
  content.innerHTML=`<section class="athlete-detail">
    <div class="eyebrow">ATLETA</div>
    <h2>${esc(athlete.name)}</h2>
    <div class="athlete-level">Nivel ${esc(athlete.level)}</div>
    <div class="subsection-head"><div><span>COMPETENCIAS ASIGNADAS</span><small>${items.length} competencias</small></div></div>
    <section class="athlete-competitions">
      ${items.length ? items.map(({assignment,event})=>`
        <button class="athlete-competition ${event?'linked':''}" data-athlete-event="${event?esc(event.id):''}" data-athlete-event-type="competencia">
          <div><strong>${esc(assignment.title)}</strong><small>${event?esc(formatRange(event)):'Fecha pendiente en Plan Anual'}</small></div>
          <span>${event?'Ver competencia ›':'Asignada'}</span>
        </button>`).join('') : '<div class="empty">Este atleta no tiene competencias con SI en el archivo de asignación.</div>'}
    </section>
  </section>`;
  document.querySelectorAll('[data-athlete-event]').forEach(b=>{
    if(b.dataset.athleteEvent) b.onclick=()=>openSpecial(b.dataset.athleteEvent,'competencia');
  });
}

function focusDate(key,scroll=true){
  document.querySelectorAll('.day-card.highlight').forEach(x=>x.classList.remove('highlight'));
  const el=document.getElementById(`day-${key}`);
  if(el){el.classList.add('highlight'); if(scroll)el.scrollIntoView({behavior:'smooth',block:'center'});}
}

init();
