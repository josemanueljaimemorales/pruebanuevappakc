const firebaseConfig = {
  apiKey: "AIzaSyBNRAkDXLlw5fyiT01-ZfUyB0A7ShsAxyg",
  authDomain: "akc-con-reporte.firebaseapp.com",
  projectId: "akc-con-reporte"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

const password = "jmjm0808";
const STORAGE_KEY = "akc_cargas_data_v3";
const CLOUD_COLLECTION = "cargasAKC";
const CLOUD_DOC = "estado";

let modoEdicion = false;
let tipoActual = "obligatorios";
let data = null;
let saveTimer = null;
let unsubscribe = null;
let cloudReady = false;

const defaults = {
  obligatorios: {
    "Cantidad de rutinas": "",
    "Rep elementos corrección": "",
    "Rep elementos proyección": "",
    "D2 elementos corrección": "",
    "D2 elementos proyección": "",
    "Rutinas sin penalidad grave": "",
    "Intentos máximo de rutinas": ""
  },
  sistemas: {
    "Semana de fuerza": "",
    "Abdomen CBR": "",
    "PF paralelas": "",
    "Core barra": "",
    "Uchimura": "",
    "ABC y planchas": "",
    "Plantados": "",
    "Brazos flexionados": "",
    "Brazos extendidos": "",
    "Fuerza Cristos": "",
    "Patadas": ""
  },
  semanal: {
    "Secuencias básicas": "",
    "Elementos a corregir": "",
    "Elementos nuevos a trabajar": "",
    "Número de repeticiones": "",
    "Rutinas completas": "",
    "Repeticion de correcciones": "",
    "Repetición de elementos nuevos": "",
    "Enlaces de rutina": "",
    "Elementos por enlace": ""
  }
};

function clone(v){ return JSON.parse(JSON.stringify(v)); }
function mergeData(source){
  const out=clone(defaults);
  if(source && typeof source==='object'){
    const incoming=source.data && typeof source.data==='object' ? source.data : source;
    for(const tipo of Object.keys(out)){
      if(!incoming[tipo] || typeof incoming[tipo]!=='object') continue;
      for(const key of Object.keys(out[tipo])){
        if(incoming[tipo][key]!==undefined && incoming[tipo][key]!==null) out[tipo][key]=String(incoming[tipo][key]);
      }
    }
  }
  return out;
}
function saveLocal(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(data));}catch(e){console.warn(e)}}
function loadLocal(){try{const raw=localStorage.getItem(STORAGE_KEY);if(raw){data=mergeData(JSON.parse(raw));return true;}}catch(e){console.warn(e)}return false}
function setEstado(text,ok=false){const el=document.getElementById('saveStatus');if(el){el.textContent=text;el.className=ok?'save-status ok':'save-status';}}
function escapeHtml(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function fila(t,v){return `<div class="item"><div class="label">${escapeHtml(t)}</div><div class="valor">${v?escapeHtml(v):'Sin asignar'}</div></div>`;}

function mostrar(tipo){
  tipoActual=tipo;
  let html='';
  if(tipo==='obligatorios'){
    html+=`<div class="card"><h3>Día 1 - Rutinas</h3>${fila('Cantidad de rutinas',data.obligatorios['Cantidad de rutinas'])}${fila('Repetición elementos corrección',data.obligatorios['Rep elementos corrección'])}${fila('Repetición elementos proyección',data.obligatorios['Rep elementos proyección'])}</div>`;
    html+=`<div class="card"><h3>Día 2 - Corrección y proyección</h3>${fila('Elementos corrección',data.obligatorios['D2 elementos corrección'])}${fila('Elementos proyección',data.obligatorios['D2 elementos proyección'])}</div>`;
    html+=`<div class="card"><h3>Día 3 - Rutinas a presentar</h3>${fila('Rutinas sin penalidad grave',data.obligatorios['Rutinas sin penalidad grave'])}${fila('Intentos máximo de rutina',data.obligatorios['Intentos máximo de rutinas'])}</div>`;
  } else if(tipo==='semanal'){
    html+=`<div class="card"><h3>Básicos</h3>${fila('Secuencias básicas',data.semanal['Secuencias básicas'])}</div>`;
    html+=`<div class="card"><h3>Elementos</h3>${fila('Elementos a corregir',data.semanal['Elementos a corregir'])}${fila('Elementos nuevos a trabajar',data.semanal['Elementos nuevos a trabajar'])}${fila('Número de repeticiones',data.semanal['Número de repeticiones'])}</div>`;
    html+=`<div class="card"><h3>Martes y Miércoles</h3>${fila('Rutinas completas',data.semanal['Rutinas completas'])}${fila('Repetición de correcciones',data.semanal['Repeticion de correcciones'])}${fila('Repetición de elementos nuevos',data.semanal['Repetición de elementos nuevos'])}</div>`;
    html+=`<div class="card"><h3>Viernes</h3>${fila('Enlaces de rutina',data.semanal['Enlaces de rutina'])}${fila('Elementos por enlace',data.semanal['Elementos por enlace'])}</div>`;
  } else {
    for(const k in data.sistemas) html+=`<div class="card">${fila(k,data.sistemas[k])}</div>`;
  }
  document.getElementById('contenido').innerHTML=html;
  document.querySelectorAll('.botones > button[data-tipo]').forEach(btn=>btn.classList.toggle('active',btn.dataset.tipo===tipo));
}

async function guardarAhora(){
  if(!data) return false;
  saveLocal();
  setEstado('Guardando en la nube…');
  try{
    const ref=db.collection(CLOUD_COLLECTION).doc(CLOUD_DOC);
    // Same Firestore pattern used by the working AKC modules: one stable document,
    // cloud data as the source of truth, server timestamp for synchronization.
    await ref.set({data:clone(data),updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:false});
    cloudReady=true;
    setEstado('Cambios guardados en la nube',true);
    return true;
  }catch(err){
    console.error('Error guardando Cargas AKC en Firestore:',err);
    setEstado('No se pudo guardar en la nube');
    return false;
  }
}

function programarGuardado(){
  saveLocal();
  setEstado('Guardando…');
  clearTimeout(saveTimer);
  saveTimer=setTimeout(()=>guardarAhora(),500);
}

async function cargar(){
  // Local is only a fallback while the cloud is loading. It must never block
  // a newer Firestore snapshot from reaching another device.
  const hadLocal=loadLocal();
  if(!hadLocal) data=clone(defaults);
  mostrar(tipoActual);

  const ref=db.collection(CLOUD_COLLECTION).doc(CLOUD_DOC);
  try{
    const snap=await ref.get();
    if(snap.exists){
      data=mergeData(snap.data());
      saveLocal();
      cloudReady=true;
      mostrar(tipoActual);
    } else {
      // Do not let a device with only the default/local fallback overwrite
      // another device. The first explicit trainer save creates the cloud document.
      cloudReady=false;
      setEstado('Nube lista para el primer guardado');
    }
  }catch(err){
    console.error('Error leyendo Cargas AKC desde Firestore:',err);
    setEstado('Sin conexión con la nube');
  }

  if(unsubscribe) unsubscribe();
  unsubscribe=ref.onSnapshot(snap=>{
    if(!snap.exists) return;
    data=mergeData(snap.data());
    saveLocal();
    cloudReady=true;
    if(!modoEdicion) mostrar(tipoActual);
    else setEstado('Sincronizado con la nube',true);
  },err=>{
    console.error('Error en sincronización Cargas AKC:',err);
    setEstado('Error de sincronización');
  });
}

function login(){const pass=prompt('Contraseña:');if(pass===password)editar();}
function editar(){
  modoEdicion=true;
  let html=`<div class="coach-editor"><div class="editor-head"><div><h2>Modo Entrenador</h2><p>Los cambios se guardan directamente en la nube.</p></div><div id="saveStatus" class="save-status">Listo para editar</div></div><div class="editor-actions"><button onclick="guardarAhora()">GUARDAR CAMBIOS</button><button onclick="salirEdicion()">⬅ Salir</button></div>`;
  for(const tipo of Object.keys(data)){
    html+=`<h3>${escapeHtml(tipo)}</h3>`;
    for(const k of Object.keys(data[tipo])) html+=`<div class="card"><label>${escapeHtml(k)}</label><textarea data-edit-tipo="${escapeHtml(tipo)}" data-edit-key="${escapeHtml(k)}">${escapeHtml(data[tipo][k])}</textarea></div>`;
  }
  html+='</div>';
  document.getElementById('contenido').innerHTML=html;
  document.querySelectorAll('textarea[data-edit-tipo]').forEach(t=>t.addEventListener('input',e=>{
    data[e.currentTarget.dataset.editTipo][e.currentTarget.dataset.editKey]=e.currentTarget.value;
    programarGuardado();
  }));
}
async function salirEdicion(){
  if(saveTimer) clearTimeout(saveTimer);
  const ok=await guardarAhora();
  if(ok){modoEdicion=false;mostrar(tipoActual);}else{setEstado('No se pudo confirmar el guardado en la nube');}
}

loadLocal();
cargar();
