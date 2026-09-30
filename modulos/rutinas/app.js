let data = [];
let NP = {};
let OBL = [];
let clubAthletes = new Set();

const screen = document.getElementById("screen");

async function loadExcel(){
const res = await fetch("Excel_Solo_Valores.xlsx?"+Date.now());
if(!res.ok) throw new Error("No se encontró Excel_Solo_Valores.xlsx");
const buffer = await res.arrayBuffer();
const wb = XLSX.read(buffer);
clubAthletes = await loadClubAthletes();
data = XLSX.utils.sheet_to_json(wb.Sheets["BASEAPPRUTINAS"] || { });
const npSheet = XLSX.utils.sheet_to_json(wb.Sheets["NP"] || { });
OBL = [];
data = data.filter(r=>clubAthletes.has(String(r["ATLETA"]||"").trim().toUpperCase()));

npSheet.forEach(r=>{
const keys = Object.keys(r);
const name = (r[keys[0]]||"").toString().trim().toUpperCase();
if(name && clubAthletes.has(name)) NP[name]=r;
});

showHome();
}

async function loadClubAthletes(){
  const names=new Set();
  const sources=["../gav-training/trabajo_gav.xlsx","../normativos/NORMATIVOS_ESGILA.xlsx"];
  for(const url of sources){
    try{
      const r=await fetch(url+"?"+Date.now());
      if(!r.ok) continue;
      const b=await r.arrayBuffer();
      const w=XLSX.read(b,{type:"array"});
      if(url.includes("trabajo_gav")){
        const rows=XLSX.utils.sheet_to_json(w.Sheets[w.SheetNames[0]],{header:1,defval:""});
        const h=(rows[0]||[]).map(v=>String(v).trim().toUpperCase());
        const i=h.indexOf("NOMBRE");
        if(i>=0) rows.slice(1).forEach(row=>{const n=String(row[i]||"").trim().toUpperCase();if(n)names.add(n);});
      }else{
        const rows=XLSX.utils.sheet_to_json(w.Sheets["NORMATIVOS"],{header:1,defval:""});
        (rows[0]||[]).slice(2).forEach(v=>{const n=String(v||"").trim().toUpperCase();if(n)names.add(n);});
      }
    }catch(e){console.warn("No se pudo leer padrón ESGILA",url,e)}
  }
  return names;
}

function showHome(){
screen.innerHTML = `
<div class="homeTitle">
  <div class="eyebrow"><span data-cliente-name>ESGILA</span></div>
  <h1>RUTINAS</h1>
  <p>Gimnasia Artística Varonil</p>
</div>

<div class="homeMenu">
  <div class="button homeCard routines" onclick="showAthletes()">
    <span class="cardIcon">R</span>
    <span class="cardText">
      <strong>Rutinas</strong>
      <small>Rutinas por atleta y aparato</small>
    </span>
    <span class="cardArrow">›</span>
  </div>

</div>
${data.length===0 ? `<div class="dataNotice">El archivo de rutinas actual no contiene atletas ESGILA. Sustituye <b>Excel_Solo_Valores.xlsx</b> por el Excel de rutinas de ESGILA para mostrar sus rutinas.</div>` : ``}
`;
}

function showAthletes(){
const athletes = [...new Set(data.map(d=>d["ATLETA"]))];
screen.innerHTML = `<div class="back" onclick="showHome()">⬅️</div>`;
athletes.forEach(a=>{
screen.innerHTML += `<div class="button" onclick="showAparatos('${a}')">${a}</div>`;
});
}

function showAparatos(name){
const aparatos = [...new Set(data.filter(d=>d["ATLETA"]===name).map(d=>d["APARATO"]))];
screen.innerHTML = `<div class="back" onclick="showAthletes()">⬅️</div>`;
aparatos.forEach(ap=>{
screen.innerHTML += `<div class="button" onclick="showRutina('${name}','${ap}')">${ap}</div>`;
});
}

function mapAparato(ap){
ap=ap.toUpperCase();
if(ap==="ARZON") return "ARZON";
if(ap==="PARALELAS") return "PARALELA";
if(ap==="ANILLOS") return "ANILLO";
return ap;
}

function getNP(name, aparato){
const row = NP[name.toUpperCase()];
if(!row) return "";
const key = mapAparato(aparato);
const col = Object.keys(row).find(c=>c.toUpperCase().includes(key));
if(!col) return "";
let val = row[col];
if(!isNaN(val)) return parseFloat(val).toFixed(1);
return val;
}

function showRutina(name, aparato){
const rutina = data.filter(d=>d["ATLETA"]===name && d["APARATO"]===aparato);
const np = getNP(name, aparato);

// 🔹 SUMA VD
let sumaVD = 0;
rutina.forEach(r=>{
let val = parseFloat(r["Valor decimal"]);
if(!isNaN(val)) sumaVD += val;
});

// 🔹 BASE
let dificultad = sumaVD;
let grupos = 0;

if(!isNaN(np) && sumaVD > 0){
grupos = parseFloat(np) - sumaVD - 10;
}

// 🔥 REGLA FIG (GRUPOS MAX 2.0)
if(grupos > 2){
let exceso = grupos - 2;
grupos = 2;
dificultad += exceso;
}

// 🔹 FORMATO FINAL
dificultad = dificultad ? dificultad.toFixed(1) : "";
grupos = grupos ? grupos.toFixed(1) : "";

let html = `<div class="back" onclick="showAparatos('${name}')">⬅️</div>`;
html += `<h2>${name} - ${aparato}</h2>`;
html += `<div class="np">Nota de partida: ${np||"-"}</div>`;
html += `<div class="np">Dificultad: ${dificultad||"-"}</div>`;
html += `<div class="np">Grupos: ${grupos||"-"}</div>`;

html += `<table class="table">
<tr><th>Elemento</th><th>ID</th><th>Grupo</th><th>Valor</th><th>VD</th></tr>`;

rutina.forEach(r=>{
html+=`<tr>
<td>${r["ELEMENTO"]||""}</td>
<td>${r["NÚM DE ID"]||""}</td>
<td>${r["GRUPO"]||""}</td>
<td>${r["VALOR"]||""}</td>
<td>${r["Valor decimal"]||""}</td>
</tr>`;
});

html += "</table>";
screen.innerHTML = html;
}

loadExcel();
