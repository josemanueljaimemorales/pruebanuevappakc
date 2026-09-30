let data=[];
let listaActual=[];
let clubAthletes=[];

function render(html){
document.getElementById('app').innerHTML = html;
history.pushState({html:html}, '');
}

window.onpopstate = function(e){
if(e.state && e.state.html){
document.getElementById('app').innerHTML = e.state.html;
}
};

async function init(){
const res = await fetch('./AKC.xlsx?' + Date.now());

if(!res.ok){
  alert("Error cargando AKC.xlsx");
  return;
}

const buf=await res.arrayBuffer();
const wb=XLSX.read(buf);
data=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''});
await loadClubAthletes();
renderAthletes();
home(true);
}

async function loadClubAthletes(){
  const names=new Map();
  const urls=[
    '../gav-training/trabajo_gav.xlsx',
    '../normativos/NORMATIVOS_ESGILA.xlsx'
  ];
  for(const url of urls){
    try{
      const r=await fetch(url+'?'+Date.now());
      if(!r.ok) continue;
      const b=await r.arrayBuffer();
      const w=XLSX.read(b,{type:'array'});
      if(url.includes('trabajo_gav')){
        const sh=w.Sheets[w.SheetNames[0]];
        const rows=XLSX.utils.sheet_to_json(sh,{header:1,defval:''});
        const h=(rows[0]||[]).map(v=>String(v).trim().toUpperCase());
        const idx=h.indexOf('NOMBRE');
        if(idx>=0) rows.slice(1).forEach(row=>{const n=String(row[idx]||'').trim(); if(n && !names.has(n.toUpperCase())) names.set(n.toUpperCase(),n);});
      }else{
        const sh=w.Sheets['NORMATIVOS'];
        const rows=XLSX.utils.sheet_to_json(sh,{header:1,defval:''});
        (rows[0]||[]).slice(2).forEach(v=>{const n=String(v||'').trim(); if(n) names.add(n);});
      }
    }catch(e){ console.warn('No se pudo leer lista de atletas ESGILA',url,e); }
  }
  clubAthletes=[...names.values()].sort((a,b)=>a.localeCompare(b,'es'));
}

function renderAthletes(){
  const box=document.querySelector('.atletas');
  if(!box) return;
  box.innerHTML=clubAthletes.length
    ? clubAthletes.map(n=>`<button onclick="seleccionarAtleta('${String(n).replace(/\\/g,'\\\\').replace(/'/g,"\\'") }')">${n}</button>`).join('')
    : '<div class="empty-athletes">No se encontraron atletas ESGILA.</div>';
}

function home(first=false){
let html = `
<div class="home-menu">
  <div class="menu-title">SISTEMAS DE ENTRENAMIENTO</div>
  <button class="btn" onclick="fuerza()"><span class="icon">💪</span><span><b>FUERZA</b><small>Desarrollo de fuerza</small></span><i>›</i></button>
  <button class="btn" onclick="preventivo()"><span class="icon">🛡</span><span><b>PREVENTIVO</b><small>Prevención y preparación</small></span><i>›</i></button>
  <button class="btn" onclick="orientacion()"><span class="icon">🧭</span><span><b>ORIENTACIÓN</b><small>Guía por aparato</small></span><i>›</i></button>
  <button class="btn" onclick="drill()"><span class="icon">⚙</span><span><b>DRILL</b><small>Trabajo técnico</small></span><i>›</i></button>
  <button class="btn" onclick="fesp()"><span class="icon">🏋</span><span><b>FUERZA ESPECÍFICA</b><small>Fuerza por aparato</small></span><i>›</i></button>
  <button class="btn" onclick="verReporte()"><span class="icon">📊</span><span><b>REPORTE</b><small>Seguimiento y resultados</small></span><i>›</i></button>
</div>
`;
if(first){
document.getElementById('app').innerHTML = html;
history.replaceState({html:html}, '');
}else{
render(html);
}
}

// ===== FUERZA =====
function fuerza(){
render(`
<button class="back" onclick="history.back()">⬅</button>

<button class="btn" onclick="dias('1')">Semana 1</button>
<button class="btn" onclick="dias('2')">Semana 2</button>
<button class="btn" onclick="dias('3')">Semana 3</button>
<button class="btn" onclick="dias('4')">Semana 4</button>

<button class="btn" onclick="fuerzaSegmento()">💪 Por segmento</button>
`);
}

function dias(sem){
window.sem=sem;
render(`
<button class="back" onclick="history.back()">⬅</button>
<button class="btn" onclick="lista('Fuerza','Lunes')">Lunes</button>
<button class="btn" onclick="lista('Fuerza','Miercoles')">Miércoles</button>
<button class="btn" onclick="lista('Fuerza','Viernes')">Viernes</button>
`);
}

function lista(tipo,dia){
let items=data.filter(r=>r.Tipo==="Fuerza" && r.Semana==window.sem && r.Dia===dia);
mostrar(items);
}

// ===== NUEVO: FUERZA POR SEGMENTO =====
function fuerzaSegmento(){

let lista = data.filter(r=>r.Tipo==="Fuerza");

let segmentos = [...new Set(lista.map(r=>r.Segmento).filter(e=>e))];

render(
`<button class="back" onclick="history.back()">⬅</button>`+
segmentos.map(s=>
`<button class="btn" onclick="listaFuerzaSegmento('${s}')">${s}</button>`
).join('')
);

}

function listaFuerzaSegmento(seg){

let items = data.filter(r=>
  r.Tipo==="Fuerza" &&
  r.Segmento===seg
);

mostrar(items);

}

// ===== PREVENTIVO =====
function preventivo(){
render(`
<button class="back" onclick="history.back()">⬅</button>

<button class="btn" onclick="listaPrev('1')">Semana 1</button>
<button class="btn" onclick="listaPrev('2')">Semana 2</button>
<button class="btn" onclick="listaPrev('3')">Semana 3</button>
<button class="btn" onclick="listaPrev('4')">Semana 4</button>

<button class="btn" onclick="preventivoSegmento()">🦵 Por segmento</button>
`);
}

function listaPrev(sem){
let items=data.filter(r=>r.Tipo==="Preventivo" && r.Semana==sem);
mostrar(items);
}

function preventivoSegmento(){

let lista = data.filter(r=>r.Tipo==="Preventivo");

let segmentos = [...new Set(lista.map(r=>r.Segmento).filter(e=>e))];

render(
`<button class="back" onclick="history.back()">⬅</button>`+
segmentos.map(s=>
`<button class="btn" onclick="listaSegmento('${s}')">${s}</button>`
).join('')
);

}

function listaSegmento(seg){
let items = data.filter(r=>r.Tipo==="Preventivo" && r.Segmento===seg);
mostrar(items);
}

// ===== ORIENTACIÓN =====
function orientacion(){

render(`
<button class="back" onclick="history.back()">⬅</button>

<button class="btn" onclick="orientacionLista()">Ver todos</button>
<button class="btn" onclick="orientacionAparato()">Por aparato</button>
`);
}

function orientacionLista(){
let items=data.filter(r=>(r.Tipo||"").toLowerCase().includes("orient"));
mostrar(items);
}

function orientacionAparato(){

let lista = data.filter(r=>(r.Tipo||"").toLowerCase().includes("orient"));

let aparatos = [...new Set(lista.map(r=>r.Aparato).filter(e=>e))];

render(
`<button class="back" onclick="history.back()">⬅</button>`+
aparatos.map(a=>
`<button class="btn" onclick="listaAparato('${a}')">${a}</button>`
).join('')
);

}

function listaAparato(ap){
let items = data.filter(r=>
(r.Tipo||"").toLowerCase().includes("orient") &&
r.Aparato===ap
);
mostrar(items);
}

// ===== DRILL =====
function drill(){
let aparatos=[...new Set(data.filter(r=>r.Tipo==="Drill").map(r=>r.Aparato))];
render(
`<button class="back" onclick="history.back()">⬅</button>`+
aparatos.map(a=>`<button class="btn" onclick="listaA('Drill','${a}')">${a}</button>`).join('')
);
}

// ===== F ESP =====
function fesp(){
let aparatos=[...new Set(data.filter(r=>r.Tipo==="F ESP APA").map(r=>r.Aparato))];
render(
`<button class="back" onclick="history.back()">⬅</button>`+
aparatos.map(a=>`<button class="btn" onclick="listaA('F ESP APA','${a}')">${a}</button>`).join('')
);
}

function listaA(tipo,aparato){
let items=data.filter(r=>r.Tipo===tipo && r.Aparato===aparato);
mostrar(items);
}

// ===== MOSTRAR =====
function mostrar(items){
listaActual = items;

let atleta = localStorage.getItem("atleta") || "SIN_NOMBRE";
let semana = window.sem || "1";
let dia = new Date().toLocaleDateString('es-MX',{weekday:'long'});

db.collection("registros")
.where("atleta","==",atleta)
.where("semana","==",semana)
.where("dia","==",dia)
.get()
.then(snap=>{

let hechos = {};
snap.forEach(d=>{
 hechos[d.data().ejercicio] = true;
});

render(
`<button class="back" onclick="history.back()">⬅</button>`+

items.map((r,i)=>{

let nombre = r.Ejercicio||r.Nombre||"Ejercicio";

let mostrarCheck = (r.Tipo === "Fuerza" || r.Tipo === "Preventivo");

let done = hechos[nombre] ? "done" : "";

return `
<div class="card">

<button class="btn" onclick="video(${i})">
${nombre}
<div class="info">
${r.Series ? "Series: "+r.Series : ""}
${r.Reps ? " | Reps: "+r.Reps : ""}
${r.Peso ? " | Peso: "+r.Peso : ""}
</div>
</button>

${
mostrarCheck
? `<button class="check ${done}" ${done ? "disabled" : ""} onclick="marcar(${i}, this)">✔</button>`
: ``
}

</div>
`;

}).join('')
);

});

}

// ===== VIDEO =====
function convertir(raw){
if(!raw) return "";
raw = raw.split("?")[0];
if(raw.includes("shorts")) return "https://www.youtube.com/embed/"+raw.split("shorts/")[1];
if(raw.includes("watch?v=")) return "https://www.youtube.com/embed/"+raw.split("watch?v=")[1];
if(raw.includes("embed")) return raw;
return "";
}

function video(i){
let r = listaActual[i];
let raw = r.Video || r.Link || r.LINK || r.video || r.link || "";
let url = convertir(raw);

if(!url){
alert("Video no válido");
return;
}

render(`
<button class="back" onclick="history.back()">⬅</button>
<iframe class="video" src="${url}" allowfullscreen></iframe>`);
}

// ===== REPORTE =====
function verReporte(){

db.collection("registros").get().then(snap=>{

let data = {};
const permitidos = new Set(clubAthletes);

snap.forEach(d=>{
 let r = d.data();
 let atleta = r.atleta;
 if(!permitidos.has(atleta)) return;
 let dia = r.dia;
 let semana = r.semana || "1";

 if(!data[atleta]) data[atleta] = {};
 if(!data[atleta][semana]) data[atleta][semana] = {};
 if(!data[atleta][semana][dia]) data[atleta][semana][dia] = 0;

 data[atleta][semana][dia]++;
});

let html = `
<button class="back" onclick="history.back()">⬅</button>
<h2>📊 REPORTE GENERAL</h2>
`;

for(let atleta in data){

 html += `<h3>${atleta}</h3>`;

 for(let semana in data[atleta]){

   html += `<h4>Semana ${semana}</h4>`;

   let total = 0;

   for(let dia in data[atleta][semana]){
     html += `<p>${dia}: ${data[atleta][semana][dia]}</p>`;
     total += data[atleta][semana][dia];
   }

   html += `<b>Total: ${total}</b><br><br>`;
 }

 html += `<hr>`;
}

html += `<button class="btn" onclick="reiniciarConteo()">🔄 Reiniciar conteo</button>`;

render(html);

});

}
init();

// ===== MARCAR =====
function marcar(i,btn){

 if(btn.classList.contains("done")){
   return;
 }

 let r = listaActual[i];
 let nombre = r.Ejercicio || r.Nombre || "Ejercicio";

 btn.classList.add("done");
 btn.disabled = true;

 guardarEjercicio(nombre);

}

async function guardarEjercicio(nombre){

 const atleta = localStorage.getItem("atleta") || "SIN_NOMBRE";
 const semana = window.sem || "1";
 const dia = new Date().toLocaleDateString('es-MX',{weekday:'long'});

 const snap = await db.collection("registros")
   .where("atleta","==",atleta)
   .where("semana","==",semana)
   .where("dia","==",dia)
   .where("ejercicio","==",nombre)
   .get();

 if(!snap.empty){
   return;
 }

 db.collection("registros").add({
   atleta, semana, dia, ejercicio:nombre, fecha:new Date()
 });

}

function reiniciarConteo(){

if(!confirm("¿Seguro quieres borrar todos los registros?")) return;

db.collection("registros").get().then(snap=>{
  let batch = db.batch();

  snap.forEach(doc=>{
    batch.delete(doc.ref);
  });

  batch.commit().then(()=>{
    alert("Conteo reiniciado");
    home();
  });

});

}
