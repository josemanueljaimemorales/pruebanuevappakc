let data = [];
let NP = {};
let DIFICULTAD = {};
let GRUPOS = {};
let OBL = [];
let CLOUD = null;
const FB_CONFIG = {apiKey:"AIzaSyBNRAkDXLlw5fyiT01-ZfUyB0A7ShsAxyg",authDomain:"akc-con-reporte.firebaseapp.com",projectId:"akc-con-reporte"};
const AP_ORDER = ['PISO','ARZON','ANILLOS','SALTO','PARALELAS','FIJA'];
async function loadCloud(){
  try{
    if(!window.firebase) return;
    if(!firebase.apps.length) firebase.initializeApp(FB_CONFIG);
    const snap = await firebase.firestore().collection('rutinasAKC').doc('estado').get();
    if(snap.exists){ const d = snap.data(); if(d && d.atletas) CLOUD = d; }
  }catch(err){ console.error('Rutinas en la nube no disponibles', err); }
}
const cloudVista = name => CLOUD && CLOUD.atletas && CLOUD.atletas[name] && CLOUD.atletas[name].vista;
const screen = document.getElementById('screen');

const norm = v => String(v ?? '').trim();
const keyName = v => norm(v).toUpperCase();
const nameKey = v => keyName(v).replace(/\s+/g, '');

function escapeHtml(v){
  return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function unique(values){
  return [...new Set(values.map(norm).filter(Boolean))];
}

async function loadExcel(){
  try{
    const res = await fetch('./Excel_Solo_Valores.xlsx', {cache:'no-cache'});
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

    await loadCloud();
    if(!data.length && !CLOUD) throw new Error('La hoja BASEAPPRUTINAS está vacía.');
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
    const name = nameKey(r[keys[0]]);
    if(name) out[name] = r;
  });
  return out;
}

function getApparatusValue(index, name, apparatus){
  const row = index[nameKey(name)];
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
    <div class="button" data-action="athletes">Libres</div>
    <div class="button" data-action="obligatorios">Obligatorios</div>
    <div class="button" data-action="editor">Editor de rutinas</div>`;
}

function showAthletes(){
  const athletes = CLOUD ? unique((CLOUD.orden && CLOUD.orden.length ? CLOUD.orden : Object.keys(CLOUD.atletas)).filter(n=>CLOUD.atletas[n])) : unique(data.map(d=>d.ATLETA));
  screen.innerHTML = `<div class="back" data-action="home">⬅️</div><h2>Selecciona atleta</h2>`;
  athletes.forEach(a=>{
    screen.insertAdjacentHTML('beforeend', `<div class="button" data-action="athlete" data-value="${escapeHtml(a)}">${escapeHtml(a)}</div>`);
  });
}

function showAparatos(name){
  const v = cloudVista(name);
  const aparatos = v ? AP_ORDER.filter(ap=>v[ap] && v[ap].rows && v[ap].rows.length) : unique(data.filter(d=>norm(d.ATLETA)===norm(name)).map(d=>d.APARATO));
  screen.innerHTML = `<div class="back" data-action="athletes">⬅️</div><h2>${escapeHtml(name)}</h2>`;
  aparatos.forEach(ap=>{
    screen.insertAdjacentHTML('beforeend', `<div class="button" data-action="apparatus" data-athlete="${escapeHtml(name)}" data-value="${escapeHtml(ap)}">${escapeHtml(ap)}</div>`);
  });
}

function showRutina(name, apparatus){
  const v = cloudVista(name);
  if(v && v[apparatus]){
    const x = v[apparatus];
    let html = `<div class="back" data-action="apparatusList" data-athlete="${escapeHtml(name)}">⬅️</div>`;
    html += `<h2>${escapeHtml(name)} - ${escapeHtml(apparatus)}</h2>`;
    html += `<div class="np">Nota de partida: ${Number(x.np).toFixed(1)}</div>`;
    html += `<div class="np">Dificultad: ${Number(x.d).toFixed(1)}</div>`;
    html += `<div class="np">Grupos: ${Number(x.eg).toFixed(1)}</div>`;
    html += `<table class="table"><tr><th>Elemento</th><th>ID</th><th>Grupo</th><th>Valor</th><th>VD</th></tr>`;
    x.rows.forEach(r=>{ html += `<tr><td>${escapeHtml(r.n)}</td><td>${escapeHtml(r.id)}</td><td>${escapeHtml(r.g)}</td><td>${escapeHtml(r.l)}</td><td>${escapeHtml(r.vd)}</td></tr>`; });
    html += `</table>`;
    screen.innerHTML = html;
    return;
  }
  const rutina = data.filter(d=>norm(d.ATLETA)===norm(name) && norm(d.APARATO)===norm(apparatus));
  const np = getApparatusValue(NP,name,apparatus);
  const dificultad = getApparatusValue(DIFICULTAD,name,apparatus);
  const formatOneDecimal = value => {
    const text = norm(value);
    if(!text) return '';
    const number = Number(String(text).replace(',', '.'));
    return Number.isFinite(number) ? number.toFixed(1) : text;
  };
  const npDisplay = formatOneDecimal(np);
  const dificultadDisplay = formatOneDecimal(dificultad);
  const grupos = getApparatusValue(GRUPOS,name,apparatus);

  let html = `<div class="back" data-action="apparatusList" data-athlete="${escapeHtml(name)}">⬅️</div>`;
  html += `<h2>${escapeHtml(name)} - ${escapeHtml(apparatus)}</h2>`;
  html += `<div class="np">Nota de partida: ${escapeHtml(npDisplay || '-')}</div>`;
  html += `<div class="np">Dificultad: ${escapeHtml(dificultadDisplay || '-')}</div>`;
  html += `<div class="np">Grupos: ${escapeHtml(grupos || '-')}</div>`;
  html += `<table class="table"><tr><th>Elemento</th><th>ID</th><th>Grupo</th><th>Valor</th><th>VD</th></tr>`;
  rutina.forEach(r=>{
    html += `<tr><td>${escapeHtml(r.ELEMENTO)}</td><td>${escapeHtml(r['NÚM DE ID'])}</td><td>${escapeHtml(r.GRUPO)}</td><td>${escapeHtml(r.VALOR)}</td><td>${escapeHtml(r['Valor decimal'])}</td></tr>`;
  });
  html += `</table>`;
  screen.innerHTML = html;
}

const oblVistaCloud = () => CLOUD && CLOUD.obligatorios && CLOUD.obligatorios.vista;
function showObligatorios(){
  const ov = oblVistaCloud();
  if(ov){
    screen.innerHTML = `<div class="back" data-action="home">⬅️</div><h2>Obligatorios</h2>`;
    (ov.orden||[]).filter(n=>ov.atletas[n]).forEach(n=>screen.insertAdjacentHTML('beforeend', `<div class="button" data-action="obligatorio" data-value="${escapeHtml(n)}">${escapeHtml(n)}</div>`));
    return;
  }
  const names = unique(OBL.map(r=>r.NOMBRE || Object.values(r)[0]));
  screen.innerHTML = `<div class="back" data-action="home">⬅️</div><h2>Obligatorios</h2>`;
  names.forEach(n=>screen.insertAdjacentHTML('beforeend', `<div class="button" data-action="obligatorio" data-value="${escapeHtml(n)}">${escapeHtml(n)}</div>`));
}

function showObligatorioDetalle(name){
  const ov = oblVistaCloud();
  if(ov && ov.atletas[name]){
    const x = ov.atletas[name], f = v => Number(v).toFixed(1);
    const fila = (lbl, ap) => `<tr><td>${lbl}</td><td>${f(x.np[ap])}</td><td>${escapeHtml((x.be[ap]||[]).join(', ')) || (ap==='SALTO' ? escapeHtml(x.salto||'') : '-')}</td></tr>`;
    screen.innerHTML = `
      <div class="back" data-action="obligatorios">⬅️</div>
      <h2>${escapeHtml(name)}</h2>
      <div class="np">Nivel: ${escapeHtml(x.nivel)}</div>
      <div class="np">Nota de partida AA: ${f(x.aa)}</div>
      <table class="table">
        <tr><th>Aparato</th><th>Nota de partida</th><th>Bonificaciones</th></tr>
        ${fila('Piso','PISO')}${fila('Hongo / Arzón','ARZON')}${fila('Anillo','ANILLOS')}${fila('Salto','SALTO')}${fila('Paralela','PARALELAS')}${fila('Fija','FIJA')}
      </table>`;
    return;
  }
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
  if(action==='editor'){ location.href='editor.html'; return; }
  if(action==='athletes') return showAthletes();
  if(action==='obligatorios') return showObligatorios();
  if(action==='athlete') return showAparatos(el.dataset.value);
  if(action==='apparatus') return showRutina(el.dataset.athlete, el.dataset.value);
  if(action==='apparatusList') return showAparatos(el.dataset.athlete);
  if(action==='obligatorio') return showObligatorioDetalle(el.dataset.value);
});

loadExcel();
