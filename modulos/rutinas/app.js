let data = [];
let NP = {};
let DIFICULTAD = {};
let GRUPOS = {};
let OBL = [];
const screen = document.getElementById('screen');

const norm = v => String(v ?? '').trim();
const keyName = v => norm(v).toUpperCase();

function escapeHtml(v){
  return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function unique(values){
  return [...new Set(values.map(norm).filter(Boolean))];
}

async function loadExcel(){
  try{
    const res = await fetch('./Excel_Solo_Valores.xlsx', {cache:'no-store'});
    if(!res.ok) throw new Error(`No se pudo cargar Excel_Solo_Valores.xlsx (HTTP ${res.status})`);
    const buffer = await res.arrayBuffer();
    const wb = XLSX.read(buffer, {cellDates:false});

    const read = name => wb.Sheets[name] ? XLSX.utils.sheet_to_json(wb.Sheets[name], {defval:''}) : [];
    data = read('BASEAPPRUTINAS');
    const npRows = read('NP');
    const diffRows = read('Dificultad');
    const groupRows = read('GRUPOS');
    OBL = read('OBLIGATORIOS');

    NP = indexByFirstColumn(npRows);
    DIFICULTAD = indexByFirstColumn(diffRows);
    GRUPOS = indexByFirstColumn(groupRows);

    if(!data.length) throw new Error('La hoja BASEAPPRUTINAS está vacía.');
    showHome();
  }catch(err){
    screen.innerHTML = `<div class="card"><h2>Error al cargar Rutinas</h2><p>${escapeHtml(err.message)}</p></div>`;
    console.error(err);
  }
}

function indexByFirstColumn(rows){
  const out = {};
  rows.forEach(r=>{
    const keys = Object.keys(r);
    const name = keyName(r[keys[0]]);
    if(name) out[name] = r;
  });
  return out;
}

function getApparatusValue(index, name, apparatus){
  const row = index[keyName(name)];
  if(!row) return '';
  const target = keyName(apparatus);
  const aliases = target === 'PARALELAS' ? ['PARALELA','PARALELAS'] :
                  target === 'ANILLOS' ? ['ANILLO','ANILLOS'] :
                  target === 'ARZON' ? ['ARZON','HONGO  ARZON','HONGO ARZON'] : [target];
  const col = Object.keys(row).find(k => aliases.includes(keyName(k)) || aliases.some(a => keyName(k).includes(a)));
  return col ? row[col] : '';
}

function showHome(){
  screen.innerHTML = `
    <div class="button" data-action="athletes">Rutinas</div>
    <div class="button" data-action="obligatorios">Obligatorios</div>`;
}

function showAthletes(){
  const athletes = unique(data.map(d=>d.ATLETA));
  screen.innerHTML = `<div class="back" data-action="home">⬅️</div><h2>Selecciona atleta</h2>`;
  athletes.forEach(a=>{
    screen.insertAdjacentHTML('beforeend', `<div class="button" data-action="athlete" data-value="${escapeHtml(a)}">${escapeHtml(a)}</div>`);
  });
}

function showAparatos(name){
  const aparatos = unique(data.filter(d=>norm(d.ATLETA)===norm(name)).map(d=>d.APARATO));
  screen.innerHTML = `<div class="back" data-action="athletes">⬅️</div><h2>${escapeHtml(name)}</h2>`;
  aparatos.forEach(ap=>{
    screen.insertAdjacentHTML('beforeend', `<div class="button" data-action="apparatus" data-athlete="${escapeHtml(name)}" data-value="${escapeHtml(ap)}">${escapeHtml(ap)}</div>`);
  });
}

function showRutina(name, apparatus){
  const rutina = data.filter(d=>norm(d.ATLETA)===norm(name) && norm(d.APARATO)===norm(apparatus));
  const np = getApparatusValue(NP,name,apparatus);
  const dificultad = getApparatusValue(DIFICULTAD,name,apparatus);
  const grupos = getApparatusValue(GRUPOS,name,apparatus);

  let html = `<div class="back" data-action="apparatusList" data-athlete="${escapeHtml(name)}">⬅️</div>`;
  html += `<h2>${escapeHtml(name)} - ${escapeHtml(apparatus)}</h2>`;
  html += `<div class="np">Nota de partida: ${escapeHtml(np || '-')}</div>`;
  html += `<div class="np">Dificultad: ${escapeHtml(dificultad || '-')}</div>`;
  html += `<div class="np">Grupos: ${escapeHtml(grupos || '-')}</div>`;
  html += `<table class="table"><tr><th>Elemento</th><th>ID</th><th>Grupo</th><th>Valor</th><th>VD</th></tr>`;
  rutina.forEach(r=>{
    html += `<tr><td>${escapeHtml(r.ELEMENTO)}</td><td>${escapeHtml(r['NÚM DE ID'])}</td><td>${escapeHtml(r.GRUPO)}</td><td>${escapeHtml(r.VALOR)}</td><td>${escapeHtml(r['Valor decimal'])}</td></tr>`;
  });
  html += `</table>`;
  screen.innerHTML = html;
}

function showObligatorios(){
  const names = unique(OBL.map(r=>r.NOMBRE || Object.values(r)[0]));
  screen.innerHTML = `<div class="back" data-action="home">⬅️</div><h2>Obligatorios</h2>`;
  names.forEach(n=>screen.insertAdjacentHTML('beforeend', `<div class="button" data-action="obligatorio" data-value="${escapeHtml(n)}">${escapeHtml(n)}</div>`));
}

function showObligatorioDetalle(name){
  const r = OBL.find(x=>norm(x.NOMBRE || Object.values(x)[0])===norm(name));
  if(!r) return;
  const hongo = r['HONGO  ARZON'] ?? r['HONGO ARZON'] ?? '-';
  screen.innerHTML = `
    <div class="back" data-action="obligatorios">⬅️</div>
    <h2>${escapeHtml(name)}</h2>
    <div class="np">Nivel: ${escapeHtml(r.NIVEL)}</div>
    <table class="table">
      <tr><th>Aparato</th><th>Nota</th></tr>
      <tr><td>Piso</td><td>${escapeHtml(r.PISO)}</td></tr>
      <tr><td>Hongo</td><td>${escapeHtml(hongo)}</td></tr>
      <tr><td>Anillo</td><td>${escapeHtml(r.ANILLO)}</td></tr>
      <tr><td>Salto</td><td>${escapeHtml(r.SALTO)}</td></tr>
      <tr><td>Paralela</td><td>${escapeHtml(r.PARALELA)}</td></tr>
      <tr><td>Fija</td><td>${escapeHtml(r.FIJA)}</td></tr>
    </table>`;
}

screen.addEventListener('click', e=>{
  const el = e.target.closest('[data-action]');
  if(!el) return;
  const action = el.dataset.action;
  if(action==='home') return showHome();
  if(action==='athletes') return showAthletes();
  if(action==='obligatorios') return showObligatorios();
  if(action==='athlete') return showAparatos(el.dataset.value);
  if(action==='apparatus') return showRutina(el.dataset.athlete, el.dataset.value);
  if(action==='apparatusList') return showAparatos(el.dataset.athlete);
  if(action==='obligatorio') return showObligatorioDetalle(el.dataset.value);
});

loadExcel();
