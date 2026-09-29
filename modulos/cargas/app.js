const firebaseConfig = {
  apiKey: "AIzaSyBhs-MEQ7McQhs6pNZTa1AWqWwUYp8yvbU",
  authDomain: "app-de-cargas-865db.firebaseapp.com",
  projectId: "app-de-cargas-865db",
  storageBucket: "app-de-cargas-865db.firebasestorage.app",
  messagingSenderId: "848399214095",
  appId: "1:848399214095:web:dd2f91ec522f2b5f44a57a"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

const password = "jmjm0808";
const STORAGE_KEY = "akc_cargas_data_v2";

let modoEdicion = false;
let guardadoPendiente = false;
let guardadoTimer = null;
let tipoActual = "obligatorios";

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

let data = clone(defaults);

function clone(obj){
  return JSON.parse(JSON.stringify(obj));
}

function mergeData(source){
  const merged = clone(defaults);
  if(source && typeof source === "object"){
    for(const tipo of Object.keys(merged)){
      if(source[tipo] && typeof source[tipo] === "object"){
        for(const key of Object.keys(merged[tipo])){
          if(source[tipo][key] !== undefined && source[tipo][key] !== null){
            merged[tipo][key] = String(source[tipo][key]);
          }
        }
      }
    }
  }
  return merged;
}

function saveLocal(){
  try{
    localStorage.setItem(STORAGE_KEY, JSON.stringify({data, pending: guardadoPendiente}));
  }catch(e){
    console.warn("No se pudo guardar localmente", e);
  }
}

function loadLocal(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return false;
    const parsed = JSON.parse(raw);
    if(parsed && parsed.data){
      data = mergeData(parsed.data);
      guardadoPendiente = !!parsed.pending;
      return true;
    }
  }catch(e){
    console.warn("No se pudo leer el respaldo local", e);
  }
  return false;
}

function setEstado(text, ok=false){
  const el = document.getElementById("saveStatus");
  if(el){
    el.textContent = text;
    el.className = ok ? "save-status ok" : "save-status";
  }
}

function fila(t, v){
  return `<div class="item">
    <div class="label">${escapeHtml(t)}</div>
    <div class="valor">${v ? escapeHtml(v) : "Sin asignar"}</div>
  </div>`;
}

function escapeHtml(v){
  return String(v ?? "").replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

function mostrar(tipo){
  tipoActual = tipo;
  let html = "";

  if(tipo === "obligatorios"){
    html += `<div class="card"><h3>Día 1 - Rutinas</h3>
      ${fila("Cantidad de rutinas", data.obligatorios["Cantidad de rutinas"])}
      ${fila("Repetición elementos corrección", data.obligatorios["Rep elementos corrección"])}
      ${fila("Repetición elementos proyección", data.obligatorios["Rep elementos proyección"])}
    </div>`;

    html += `<div class="card"><h3>Día 2 - Corrección y proyección</h3>
      ${fila("Elementos corrección", data.obligatorios["D2 elementos corrección"])}
      ${fila("Elementos proyección", data.obligatorios["D2 elementos proyección"])}
    </div>`;

    html += `<div class="card"><h3>Día 3 - Rutinas a presentar</h3>
      ${fila("Rutinas sin penalidad grave", data.obligatorios["Rutinas sin penalidad grave"])}
      ${fila("Intentos máximo de rutina", data.obligatorios["Intentos máximo de rutinas"])}
    </div>`;
  }
  else if(tipo === "semanal"){
    html += `<div class="card"><h3>Básicos</h3>
      ${fila("Secuencias básicas", data.semanal["Secuencias básicas"])}
    </div>`;

    html += `<div class="card"><h3>Elementos</h3>
      ${fila("Elementos a corregir", data.semanal["Elementos a corregir"])}
      ${fila("Elementos nuevos a trabajar", data.semanal["Elementos nuevos a trabajar"])}
      ${fila("Número de repeticiones", data.semanal["Número de repeticiones"])}
    </div>`;

    html += `<div class="card"><h3>Martes y Miércoles</h3>
      ${fila("Rutinas completas", data.semanal["Rutinas completas"])}
      ${fila("Repetición de correcciones", data.semanal["Repeticion de correcciones"])}
      ${fila("Repetición de elementos nuevos", data.semanal["Repetición de elementos nuevos"])}
    </div>`;

    html += `<div class="card"><h3>Viernes</h3>
      ${fila("Enlaces de rutina", data.semanal["Enlaces de rutina"])}
      ${fila("Elementos por enlace", data.semanal["Elementos por enlace"])}
    </div>`;
  }
  else if(tipo === "sistemas"){
    for(const k in data.sistemas){
      html += `<div class="card">${fila(k, data.sistemas[k])}</div>`;
    }
  }

  document.getElementById("contenido").innerHTML = html;
  marcarBotonActivo(tipo);
}

function marcarBotonActivo(tipo){
  document.querySelectorAll(".botones > button[data-tipo]").forEach(btn=>{
    btn.classList.toggle("active", btn.dataset.tipo === tipo);
  });
}

function guardarAhora(){
  saveLocal();
  setEstado("Guardando en la nube…");

  return db.collection("gym").doc("data").set(data)
    .then(()=>{
      guardadoPendiente = false;
      saveLocal();
      setEstado("Cambios guardados", true);
      return true;
    })
    .catch(err=>{
      guardadoPendiente = true;
      saveLocal();
      console.error("Error guardando en Firestore:", err);
      setEstado("Sin conexión: cambios guardados en este dispositivo");
      return false;
    });
}

function programarGuardado(){
  guardadoPendiente = true;
  saveLocal();
  setEstado("Guardando…");
  clearTimeout(guardadoTimer);
  guardadoTimer = setTimeout(()=>guardarAhora(), 700);
}

function cargar(){
  const teniaLocal = loadLocal();
  if(teniaLocal){
    // El respaldo local es inmediato y permite que los tres botones vean
    // las modificaciones aunque Firebase tarde o no esté disponible.
    if(!modoEdicion) mostrar(tipoActual);
  }

  db.collection("gym").doc("data").onSnapshot(doc=>{
    if(doc.exists){
      // Si existen cambios locales pendientes, no los pisamos con una copia
      // antigua de la nube. Después del guardado exitoso se sincronizan.
      if(!guardadoPendiente){
        data = mergeData(doc.data());
        saveLocal();
        if(!modoEdicion) mostrar(tipoActual);
      }
    } else if(!guardadoPendiente){
      guardarAhora();
    }
  }, err=>{
    console.error("Error de sincronización:", err);
    setEstado("Sin conexión: usando cambios guardados en este dispositivo");
  });
}

function login(){
  const pass = prompt("Contraseña:");
  if(pass === password) editar();
}

function editar(){
  modoEdicion = true;
  let html = `<div class="coach-editor">
    <div class="editor-head">
      <div><h2>Modo Entrenador</h2><p>Los cambios se reflejan inmediatamente en los 3 módulos.</p></div>
      <div id="saveStatus" class="save-status">Listo para editar</div>
    </div>
    <div class="editor-actions">
      <button onclick="guardarAhora()">GUARDAR CAMBIOS</button>
      <button onclick="salirEdicion()">⬅ Salir</button>
    </div>`;

  for(const tipo of Object.keys(data)){
    html += `<h3>${tipo}</h3>`;
    for(const k of Object.keys(data[tipo])){
      html += `<div class="card">
        <label>${escapeHtml(k)}</label>
        <textarea data-edit-tipo="${escapeHtml(tipo)}" data-edit-key="${escapeHtml(k)}">${escapeHtml(data[tipo][k])}</textarea>
      </div>`;
    }
  }
  html += `</div>`;

  document.getElementById("contenido").innerHTML = html;

  document.querySelectorAll("textarea[data-edit-tipo]").forEach(textarea=>{
    textarea.addEventListener("input", e=>{
      const tipo = e.currentTarget.dataset.editTipo;
      const key = e.currentTarget.dataset.editKey;
      data[tipo][key] = e.currentTarget.value;
      programarGuardado();
    });
  });
}

function salirEdicion(){
  if(guardadoPendiente){
    guardarAhora().finally(()=>{
      modoEdicion = false;
      mostrar(tipoActual);
    });
    return;
  }
  modoEdicion = false;
  mostrar(tipoActual);
}

loadLocal();
cargar();
