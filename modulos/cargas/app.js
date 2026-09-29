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

let modoEdicion = false;
let guardando = false;
let cambiosPendientes = false;
let remoteDataMientrasEdita = null;

let data = {
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

function fila(t, v){
  return `<div class="item">
    <div class="label">${t}</div>
    <div class="valor">${v ? v : "Sin asignar"}</div>
  </div>`;
}

function mostrar(tipo){
  let html = "";

  if(tipo==="obligatorios"){
    html+=`<div class="card"><h3>Día 1 - Rutinas</h3>
    ${fila("Cantidad de rutinas", data.obligatorios["Cantidad de rutinas"])}
    ${fila("Repetición elementos corrección", data.obligatorios["Rep elementos corrección"])}
    ${fila("Repetición elementos proyección", data.obligatorios["Rep elementos proyección"])}
    </div>`;

    html+=`<div class="card"><h3>Día 2 - Corrección y proyección</h3>
    ${fila("Elementos corrección", data.obligatorios["D2 elementos corrección"])}
    ${fila("Elementos proyección", data.obligatorios["D2 elementos proyección"])}
    </div>`;

    html+=`<div class="card"><h3>Día 3 - Rutinas a presentar</h3>
    ${fila("Rutinas sin penalidad grave", data.obligatorios["Rutinas sin penalidad grave"])}
    ${fila("Intentos máximo de rutina", data.obligatorios["Intentos máximo de rutinas"])}
    </div>`;
  }
  else if(tipo==="semanal"){
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
      ${fila("Repeticion de correcciones", data.semanal["Repeticion de correcciones"])}
      ${fila("Repetición de elementos nuevos", data.semanal["Repetición de elementos nuevos"])}
    </div>`;
    html += `<div class="card"><h3>Viernes</h3>
      ${fila("Enlaces de rutina", data.semanal["Enlaces de rutina"])}
      ${fila("Elementos por enlace", data.semanal["Elementos por enlace"])}
    </div>`;
  }
  else if(tipo==="sistemas"){
    for(let k in data.sistemas){
      html+=`<div class="card">${fila(k, data.sistemas[k])}</div>`;
    }
  }

  document.getElementById("contenido").innerHTML = html;
}

function clonar(obj){
  return JSON.parse(JSON.stringify(obj));
}

function actualizarIndicador(){
  const btn = document.getElementById("btnGuardarCambios");
  const estado = document.getElementById("estadoGuardado");
  if(!btn || !estado) return;

  btn.disabled = guardando || !cambiosPendientes;
  btn.textContent = guardando ? "Guardando…" : "Guardar cambios";
  estado.textContent = guardando ? "Guardando en la nube…" : (cambiosPendientes ? "Cambios sin guardar" : "Todos los cambios están guardados");
  estado.className = guardando ? "guardando" : (cambiosPendientes ? "pendiente" : "guardado");
}

async function guardarCambios(){
  if(!modoEdicion || !cambiosPendientes || guardando) return;

  guardando = true;
  actualizarIndicador();

  try{
    // Tomamos la última versión recibida de Firebase y encima aplicamos
    // únicamente lo que este entrenador modificó. Así evitamos pisar
    // cambios hechos desde otro dispositivo.
    const base = remoteDataMientrasEdita ? clonar(remoteDataMientrasEdita) : clonar(data);

    for(const tipo in data){
      if(!base[tipo]) base[tipo] = {};
      for(const key in data[tipo]){
        if(Object.prototype.hasOwnProperty.call(cambiosRealizados, tipo) &&
           Object.prototype.hasOwnProperty.call(cambiosRealizados[tipo], key)){
          base[tipo][key] = data[tipo][key];
        }
      }
    }

    base.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
    await db.collection("gym").doc("data").set(base);

    data = clonar(base);
    remoteDataMientrasEdita = clonar(base);
    cambiosPendientes = false;
    cambiosRealizados = {};
    mostrarEditor();

  }catch(error){
    console.error(error);
    alert("No se pudieron guardar los cambios en la nube. Revisa tu conexión e inténtalo nuevamente.");
  }finally{
    guardando = false;
    actualizarIndicador();
  }
}

let cambiosRealizados = {};

function cargar(){
  db.collection("gym").doc("data").onSnapshot(async doc=>{
    if(doc.exists){
      const firebaseData = doc.data();
      let actualizado = false;

      for(let tipo in data){
        if(!firebaseData[tipo]){
          firebaseData[tipo] = {};
          actualizado = true;
        }
        for(let key in data[tipo]){
          if(firebaseData[tipo][key] === undefined){
            firebaseData[tipo][key] = "";
            actualizado = true;
          }
        }
      }

      if(modoEdicion){
        // No reemplazamos lo que el entrenador está editando en pantalla.
        // Guardamos la última versión remota para fusionarla al guardar.
        remoteDataMientrasEdita = clonar(firebaseData);
      }else{
        data = firebaseData;
        if(actualizado){
          await db.collection("gym").doc("data").set(data);
        }
        mostrar("obligatorios");
      }
    }else{
      await db.collection("gym").doc("data").set(data);
      if(!modoEdicion) mostrar("obligatorios");
    }
  }, error=>{
    console.error("Error de sincronización:", error);
    const estado = document.getElementById("estadoGuardado");
    if(estado){
      estado.textContent = "Error de conexión con la nube";
      estado.className = "error";
    }
  });
}

cargar();

function login(){
  let pass = prompt("Contraseña:");
  if(pass===password) editar();
}

function editar(){
  modoEdicion = true;
  cambiosPendientes = false;
  cambiosRealizados = {};
  remoteDataMientrasEdita = clonar(data);
  mostrarEditor();
}

function mostrarEditor(){
  let html=`<div class="editor-head">
    <div>
      <h2>Modo Entrenador</h2>
      <div id="estadoGuardado" class="guardado">Todos los cambios están guardados</div>
    </div>
    <div class="editor-actions">
      <button id="btnGuardarCambios" class="guardar-btn" onclick="guardarCambios()">Guardar cambios</button>
      <button class="salir-btn" onclick="salirEdicion()">Salir</button>
    </div>
  </div>`;

  for(let tipo in data){
    html+=`<h3>${tipo}</h3>`;
    for(let k in data[tipo]){
      const valor = data[tipo][k] ?? "";
      html+=`<div class="card">
        <label>${k}</label>
        <textarea data-tipo="${encodeURIComponent(tipo)}" data-key="${encodeURIComponent(k)}">${valor}</textarea>
      </div>`;
    }
  }

  document.getElementById("contenido").innerHTML=html;

  document.querySelectorAll("textarea[data-tipo]").forEach(area=>{
    area.addEventListener("input", function(){
      const tipo = decodeURIComponent(this.dataset.tipo);
      const key = decodeURIComponent(this.dataset.key);
      actualizar(tipo,key,this.value);
    });
  });

  actualizarIndicador();
}

async function salirEdicion(){
  if(cambiosPendientes){
    const guardar = confirm("Tienes cambios sin guardar. ¿Quieres guardarlos antes de salir?");
    if(guardar){
      await guardarCambios();
      if(cambiosPendientes) return;
    }else{
      // Descarta solamente los cambios locales y vuelve a la última versión de Firebase.
      if(remoteDataMientrasEdita) data = clonar(remoteDataMientrasEdita);
    }
  }

  modoEdicion = false;
  cambiosPendientes = false;
  cambiosRealizados = {};
  remoteDataMientrasEdita = null;
  mostrar("obligatorios");
}

function actualizar(tipo,key,val){
  if(!data[tipo]) data[tipo] = {};
  data[tipo][key] = val;
  if(!cambiosRealizados[tipo]) cambiosRealizados[tipo] = {};
  cambiosRealizados[tipo][key] = true;
  cambiosPendientes = true;
  actualizarIndicador();
}
