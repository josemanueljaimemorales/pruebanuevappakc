// Training: el trabajo de cada atleta sale de Normativos (Excel + nube).
// Por aparato y por bloque: todo lo No adquirido y En proceso, y los 2 primeros elementos en Proyección.
// Lo Consolidado ya no se trabaja. trabajo_gav.xlsx solo da nombre (apodo), nivel, grupo y el nombre en Normativos.
let dataApp=[];
let progress=JSON.parse(localStorage.getItem("progress")||"{}");
const APARATOS=[
  ["piso","PISO","PISO"],["arzon","ARZON","ARZÓN"],["anillos","ANILLOS","ANILLOS"],
  ["salto","SALTO DE CABALLO","SALTO"],["paralelas","BARRAS PARALELAS","PARALELAS"],["fija","BARRA FIJA","FIJA"]
];
const ESTADO_TXT={NA:"No adquirido",EP:"En proceso",P:"Proyección"};
const PROYECCION_POR_BLOQUE=2;
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const jsq=s=>String(s).replace(/\\/g,"\\\\").replace(/'/g,"\\'");

async function loadWorkbook(){
  const rows=await AKC_XLSX.read("trabajo_gav.xlsx");
  if(!rows.length) throw new Error("El Excel de GAV Training está vacío.");
  const headers=rows[0].map(v=>String(v??"").trim().toUpperCase());
  const col={};
  headers.forEach((h,i)=>{if(h)col[h]=i;});
  const colNorm=headers.findIndex(h=>h.includes("NORMATIVOS"));
  const out=[];
  for(const row of rows.slice(1)){
    const nombre=String(row[col.NOMBRE]??"").trim();
    if(!nombre) continue;
    out.push({
      nombre,
      nivel: row[col.NIVEL]??"",
      grupo: String(row[col.GRUPO]??"").trim(),
      normativos: String((colNorm>=0?row[colNorm]:"")??"").trim()||nombre
    });
  }
  if(!out.length) throw new Error("No se encontraron atletas en trabajo_gav.xlsx.");
  return out;
}

// Trabajo de un atleta en un aparato: [{bloque, elementos:[{elemento, estado}]}]
function trabajo(atleta,ap){
  const norm=atleta.norm; if(!norm) return [];
  const app=APARATOS.find(a=>a[0]===ap)[1];
  const bloques=[];
  normDb.items.filter(it=>it.apparatus===app).forEach(it=>{
    let b=bloques[bloques.length-1];
    if(!b||b.bloque!==it.classification){b={bloque:it.classification,elementos:[],proy:0};bloques.push(b);}
    const st=it.status?.[norm]||"NA";
    if(st==="C") return;
    if(st==="P"){if(b.proy>=PROYECCION_POR_BLOQUE) return; b.proy++;}
    b.elementos.push({elemento:it.element,estado:st});
  });
  return bloques.filter(b=>b.elementos.length);
}

let normDb={athletes:[],items:[]};
async function init(){
  try{
    document.getElementById("content").innerHTML="<div class='list'><div class='item'>Cargando trabajo de Normativos…</div></div>";
    const [atletas,db]=await Promise.all([loadWorkbook(),AKC_NORMATIVOS.cargar()]);
    normDb=db;
    const porNombre=new Map(db.athletes.map(a=>[AKC_NORMATIVOS.normName(a.name),a.name]));
    atletas.forEach(a=>a.norm=porNombre.get(AKC_NORMATIVOS.normName(a.normativos))||null);
    dataApp=atletas;
    showHome();
  }catch(e){
    console.error(e);
    document.getElementById("content").innerHTML="<div class='list'><div class='item'>No se pudo leer Normativos o trabajo_gav.xlsx.</div></div>";
  }
}

function save(){
 localStorage.setItem("progress",JSON.stringify(progress));
}

function checkbox(id){
 let checked=progress[id]||false;
 return `<input type='checkbox' ${checked?"checked":""} onchange="toggle('${jsq(esc(id))}',this.checked)">`;
}

function toggle(id,val){
 progress[id]=val;
 save();
}

function setBack(fn){
 document.getElementById("nav").innerHTML=`<button class='back' onclick="${fn}">⬅ REGRESAR</button>`;
}

function estado(st){return `<span class='estado ${st}'>${ESTADO_TXT[st]}</span>`;}

function showHome(){
 document.getElementById("nav").innerHTML="";
 document.getElementById("content").innerHTML=`
 <button onclick="showGroups()">👥 POR GRUPO</button>
 <button onclick="showAthletes()">👤 POR ATLETA</button>
 `;
}

function showGroups(){
 setBack("showHome()");
 let groups=[...new Set(dataApp.map(a=>a.grupo).filter(Boolean))];
 let html="";
 groups.forEach(g=>{
   html+=`<button onclick="showGroup('${jsq(esc(g))}')">${esc(g)}</button>`;
 });
 document.getElementById("content").innerHTML=html;
}

function showGroup(g){
 setBack("showGroups()");
 let html="";
 APARATOS.forEach(([a,,txt])=>{
   html+=`<button class='${a}' onclick="showGroupAparato('${jsq(esc(g))}','${a}')">${txt}</button>`;
 });
 document.getElementById("content").innerHTML=html;
}

// Por grupo: cada elemento que le toca a alguien del grupo, con quiénes lo trabajan.
function showGroupAparato(g,a){
 setBack(`showGroup('${jsq(esc(g))}')`);
 const atletas=dataApp.filter(x=>x.grupo==g);
 const bloques=[];
 atletas.forEach(at=>trabajo(at,a).forEach(b=>{
   let bl=bloques.find(x=>x.bloque===b.bloque); if(!bl){bl={bloque:b.bloque,elementos:new Map()};bloques.push(bl);}
   b.elementos.forEach(e=>{if(!bl.elementos.has(e.elemento))bl.elementos.set(e.elemento,[]);bl.elementos.get(e.elemento).push(`${at.nombre} (${ESTADO_TXT[e.estado]})`);});
 }));
 // Orden de bloques y elementos como en Normativos
 const app=APARATOS.find(x=>x[0]===a)[1], orden=new Map();
 normDb.items.filter(it=>it.apparatus===app).forEach((it,i)=>{if(!orden.has(it.classification))orden.set(it.classification,i);if(!orden.has(it.classification+"|"+it.element))orden.set(it.classification+"|"+it.element,i);});
 bloques.sort((x,y)=>orden.get(x.bloque)-orden.get(y.bloque));
 let html="<div class='list'>";
 if(!bloques.length) html+="<div class='item'>Nada pendiente en este aparato.</div>";
 bloques.forEach(b=>{
   html+=`<div class='bloque'>${esc(b.bloque)}</div>`;
   [...b.elementos.entries()].sort((x,y)=>orden.get(b.bloque+"|"+x[0])-orden.get(b.bloque+"|"+y[0])).forEach(([e,quien])=>{
     let id=g+"-"+a+"-"+e;
     html+=`<div class='item'>${checkbox(id)}<div class='txt'>${esc(e)}<small class='quien'>${esc(quien.join(", "))}</small></div></div>`;
   });
 });
 html+="</div>";
 document.getElementById("content").innerHTML=html;
}

function showAthletes(){
 setBack("showHome()");
 let html="";
 dataApp.forEach((a,i)=>{
   html+=`<button onclick="showAthlete(${i})">${esc(a.nombre)}</button>`;
 });
 document.getElementById("content").innerHTML=html;
}

function showAthlete(i){
 setBack("showAthletes()");
 let html=dataApp[i].norm?"":`<div class='list'><div class='item'>${esc(dataApp[i].nombre)} no está en Normativos.</div></div>`;
 APARATOS.forEach(([ap,,txt])=>{
   html+=`<button class='${ap}' onclick="showAthleteAparato(${i},'${ap}')">${txt}</button>`;
 });
 document.getElementById("content").innerHTML=html;
}

function showAthleteAparato(i,ap){
 setBack(`showAthlete(${i})`);
 const bloques=trabajo(dataApp[i],ap);
 let html="<div class='list'>";
 if(!dataApp[i].norm) html+=`<div class='item'>${esc(dataApp[i].nombre)} no está en Normativos.</div>`;
 else if(!bloques.length) html+="<div class='item'>Todo consolidado en este aparato.</div>";
 bloques.forEach(b=>{
   html+=`<div class='bloque'>${esc(b.bloque)}</div>`;
   b.elementos.forEach(e=>{
     let id=dataApp[i].nombre+"-"+ap+"-"+e.elemento;
     html+=`<div class='item'>${checkbox(id)}<div class='txt'>${esc(e.elemento)}</div>${estado(e.estado)}</div>`;
   });
 });
 html+="</div>";
 document.getElementById("content").innerHTML=html;
}

init();
