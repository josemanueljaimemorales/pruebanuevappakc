let dataApp=[];
let progress=JSON.parse(localStorage.getItem("progress")||"{}");

async function loadWorkbook(){
  const rows=await AKC_XLSX.read("trabajo_gav.xlsx");
  if(!rows.length) throw new Error("El Excel de GAV Training está vacío.");
  const headers=rows[0].map(v=>String(v??"").trim().toUpperCase());
  const col={};
  headers.forEach((h,i)=>{if(h)col[h]=i;});
  const apparatus=[
    ["PISO","piso"],["ARZON","arzon"],["ANILLOS","anillos"],
    ["SALTO","salto"],["PARALELAS","paralelas"],["FIJA","fija"]
  ];
  const out=[];
  for(const row of rows.slice(1)){
    const nombre=String(row[col.NOMBRE]??"").trim();
    if(!nombre) continue;
    const athlete={
      nombre,
      nivel: row[col.NIVEL]??"",
      grupo: String(row[col.GRUPO]??"").trim(),
      aparatos:{}
    };
    apparatus.forEach(([header,key])=>{
      const raw=String(row[col[header]]??"");
      athlete.aparatos[key]=raw.split(/\r?\n/)
        .map(x=>x.trim()).filter(Boolean)
        .map(nombre=>({nombre}));
    });
    out.push(athlete);
  }
  if(!out.length) throw new Error("No se encontraron atletas en trabajo_gav.xlsx.");
  return out;
}

async function init(){
  try{
    document.getElementById("content").innerHTML="<div class='list'><div class='item'>Cargando trabajo_gav.xlsx…</div></div>";
    dataApp=await loadWorkbook();
    showHome();
  }catch(e){
    console.error(e);
    document.getElementById("content").innerHTML="<div class='list'><div class='item'>No se pudo leer trabajo_gav.xlsx.</div></div>";
  }
}

function save(){
 localStorage.setItem("progress",JSON.stringify(progress));
}

function checkbox(id){
 let checked=progress[id]||false;
 return `<input type='checkbox' ${checked?"checked":""} onchange="toggle('${id}',this.checked)">`;
}

function toggle(id,val){
 progress[id]=val;
 save();
}

function setBack(fn){
 document.getElementById("nav").innerHTML=`<button class='back' onclick="${fn}">⬅ REGRESAR</button>`;
}

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
   html+=`<button onclick="showGroup('${g.replace(/'/g,"\\'")}')">${g}</button>`;
 });
 document.getElementById("content").innerHTML=html;
}

function showGroup(g){
 setBack("showGroups()");
 let aparatos=["piso","arzon","anillos","salto","paralelas","fija"];
 let html="";
 aparatos.forEach(a=>{
   html+=`<button class='${a}' onclick="showGroupAparato('${g.replace(/'/g,"\\'")}','${a}')">${a.toUpperCase()}</button>`;
 });
 document.getElementById("content").innerHTML=html;
}

function showGroupAparato(g,a){
 setBack(`showGroup('${g.replace(/'/g,"\\'")}')`);
 let atletas=dataApp.filter(x=>x.grupo==g);
 let set=new Set();
 atletas.forEach(at=>{
   (at.aparatos[a]||[]).forEach(e=>set.add(e.nombre));
 });
 let html="<div class='list'>";
 set.forEach(e=>{
   let id=g+"-"+a+"-"+e;
   html+=`<div class='item'>${checkbox(id)} ${e}</div>`;
 });
 html+="</div>";
 document.getElementById("content").innerHTML=html;
}

function showAthletes(){
 setBack("showHome()");
 let html="";
 dataApp.forEach((a,i)=>{
   html+=`<button onclick="showAthlete(${i})">${a.nombre}</button>`;
 });
 document.getElementById("content").innerHTML=html;
}

function showAthlete(i){
 setBack("showAthletes()");
 let aparatos=["piso","arzon","anillos","salto","paralelas","fija"];
 let html="";
 aparatos.forEach(ap=>{
   html+=`<button class='${ap}' onclick="showAthleteAparato(${i},'${ap}')">${ap.toUpperCase()}</button>`;
 });
 document.getElementById("content").innerHTML=html;
}

function showAthleteAparato(i,ap){
 setBack(`showAthlete(${i})`);
 let lista=dataApp[i].aparatos[ap]||[];
 let html="<div class='list'>";
 lista.forEach(e=>{
   let id=dataApp[i].nombre+"-"+ap+"-"+e.nombre;
   html+=`<div class='item'>${checkbox(id)} ${e.nombre}</div>`;
 });
 html+="</div>";
 document.getElementById("content").innerHTML=html;
}

init();
