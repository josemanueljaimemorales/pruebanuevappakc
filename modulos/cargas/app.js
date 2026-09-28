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

// 🔥 CONTROL DE MODO
let modoEdicion = false;

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

function guardar(){
  db.collection("gym").doc("data").set(data);
}

function cargar(){
  db.collection("gym").doc("data").onSnapshot(doc=>{
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

      data = firebaseData;

      if(actualizado){
        db.collection("gym").doc("data").set(data);
      }

    } else {
      db.collection("gym").doc("data").set(data);
    }

    // 🔥 SOLO refresca si NO estás editando
    if(!modoEdicion){
      mostrar("obligatorios");
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

  let html="<h2>Modo Entrenador</h2>";
  html+=`<button onclick="salirEdicion()">⬅ Salir</button>`;

  for(let tipo in data){
    html+=`<h3>${tipo}</h3>`;

    for(let k in data[tipo]){
      html+=`<div class="card">
        <label>${k}</label>
        <textarea oninput="actualizar('${tipo}','${k}',this.value)">
${data[tipo][k]}
        </textarea>
      </div>`;
    }
  }

  document.getElementById("contenido").innerHTML=html;
}

function salirEdicion(){
  modoEdicion = false;
  mostrar("obligatorios");
}

function actualizar(tipo,key,val){
  data[tipo][key]=val;
  guardar();
}
