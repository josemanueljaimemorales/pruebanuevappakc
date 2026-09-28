let data = [];
let NP = {};
let OBL = [];
let athleteDirectory = [];
let routineMap = new Map();
const screen = document.getElementById("screen");

function normName(s){return String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9 ]/gi," ").replace(/\s+/g," ").trim().toUpperCase()}

async function loadExcel(){
  const remote = window.CLIENTE?.repositorios?.rutinasExcel || "";
  let res = null;
  if(remote){ try { res = await fetch(remote+"?v="+Date.now(),{cache:"no-store"}); } catch(e){} }
  if(!res || !res.ok) res = await fetch("Excel_Solo_Valores.xlsx?" + Date.now());
  if(!res.ok) throw new Error("No se encontró el Excel de rutinas.");

  const buffer = await res.arrayBuffer();
  const wb = XLSX.read(buffer, {type:"array"});
  const baseSheet = wb.Sheets["BASEAPPRUTINAS"];
  if(!baseSheet) throw new Error("El Excel no contiene la hoja BASEAPPRUTINAS");
  data = XLSX.utils.sheet_to_json(baseSheet, {defval:""});

  const npSheet = wb.Sheets["NP"];
  NP = {};
  if(npSheet){
    XLSX.utils.sheet_to_json(npSheet, {defval:""}).forEach(r=>{
      const keys = Object.keys(r);
      const name = String(r[keys[0]] || "").trim().toUpperCase();
      if(name && !name.startsWith("__")) NP[name] = r;
    });
  }
  OBL = wb.Sheets["OBLIGATORIOS"] ? XLSX.utils.sheet_to_json(wb.Sheets["OBLIGATORIOS"], {defval:""}) : [];

  data = data.filter(r => String(r["ATLETA"] || "").trim() && String(r["APARATO"] || "").trim());
  buildRoutineMap();
  athleteDirectory = await loadAthleteDirectory();
  showHome();
}

async function loadAthleteDirectory(){
  try{
    const list = await AKC_ATHLETES.load();
    if(list.length) return list;
  }catch(e){}
  return [...new Set(data.map(d=>String(d["ATLETA"]||"").trim()).filter(Boolean))].map(name=>({name}));
}

function buildRoutineMap(){
  routineMap = new Map();
  [...new Set(data.map(d=>String(d["ATLETA"]||"").trim()).filter(Boolean))].forEach(n=>routineMap.set(normName(n),n));
}

function resolveRoutineName(fullName){
  const key=normName(fullName);
  if(routineMap.has(key)) return routineMap.get(key);
  const parts=key.split(" ").filter(Boolean);
  if(!parts.length) return null;
  const candidates=[...routineMap.entries()].filter(([k])=>{
    const p=k.split(" ").filter(Boolean);
    return p[0]===parts[0] || parts.includes(p[0]) || (parts.length>1 && p.some(x=>parts.includes(x)));
  });
  return candidates.length===1 ? candidates[0][1] : null;
}

function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}

function showHome(){
  screen.innerHTML = `
  <div class="homeTitle"><div class="eyebrow">ÁGUILAS KC</div><h1>RUTINAS</h1><p>Gimnasia Artística Varonil</p></div>
  <div class="homeMenu">
    <div class="button homeCard routines" onclick="showAthletes()"><span class="cardIcon">R</span><span class="cardText"><strong>Rutinas</strong><small>Rutinas por atleta y aparato</small></span><span class="cardArrow">›</span></div>
    <div class="button homeCard mandatory" onclick="showObligatorios()"><span class="cardIcon">O</span><span class="cardText"><strong>Obligatorios</strong><small>Elementos obligatorios por nivel</small></span><span class="cardArrow">›</span></div>
  </div>`;
}

function showAthletes(){
  let html=`<div class="back" onclick="showHome()">← Volver</div><div class="athleteGrid">`;
  athleteDirectory.forEach(a=>{
    const full=String(a.name||"").trim(); const routineName=resolveRoutineName(full);
    html+=`<button class="athleteCard ${routineName?'available':'unavailable'}" ${routineName?`onclick="showAparatos('${esc(routineName).replace(/'/g,"\\'")}')"`:"disabled"}>`+
      `<span class="athleteInitial">${esc(full.charAt(0)||"A")}</span><span><strong>${esc(full)}</strong><small>${routineName?"Rutina disponible":"Sin rutina cargada"}</small></span><b>${routineName?'›':'—'}</b></button>`;
  });
  screen.innerHTML=html+`</div>`;
}

function showAparatos(name){
  const aparatos = [...new Set(data.filter(d=>d["ATLETA"]===name).map(d=>d["APARATO"]))];
  screen.innerHTML = `<div class="back" onclick="showAthletes()">← Volver</div><h2>${esc(name)}</h2>`;
  aparatos.forEach(ap=>{screen.innerHTML += `<div class="button homeCard routines" onclick="showRutina('${esc(name).replace(/'/g,"\\'")}','${esc(ap).replace(/'/g,"\\'")}')"><span class="cardIcon">${esc(ap.charAt(0))}</span><span class="cardText"><strong>${esc(ap)}</strong><small>Ver rutina y dificultad</small></span><span class="cardArrow">›</span></div>`});
}

function showObligatorios(){
  const levels=[...new Set(OBL.map(r=>r.NIVEL||r.Nivel||r["NIVEL"]||Object.values(r)[0]).filter(Boolean))];
  screen.innerHTML=`<div class="back" onclick="showHome()">← Volver</div><h2>Obligatorios</h2>`;
  levels.forEach(l=>screen.innerHTML+=`<div class="button homeCard mandatory" onclick="showObligLevel('${esc(l).replace(/'/g,"\\'")}')"><span class="cardIcon">O</span><span class="cardText"><strong>Nivel ${esc(l)}</strong><small>Elementos obligatorios</small></span><span class="cardArrow">›</span></div>`);
}
function showObligLevel(level){
  const rows=OBL.filter(r=>String(r.NIVEL||r.Nivel||Object.values(r)[0])===String(level));
  screen.innerHTML=`<div class="back" onclick="showObligatorios()">← Volver</div><h2>Nivel ${esc(level)}</h2><table class="table"><tr>${Object.keys(rows[0]||{}).map(k=>`<th>${esc(k)}</th>`).join('')}</tr>${rows.map(r=>`<tr>${Object.values(r).map(v=>`<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</table>`;
}

function mapAparato(ap){ap=ap.toUpperCase();if(ap==="ARZON")return "ARZON";if(ap==="PARALELAS")return "PARALELA";if(ap==="ANILLOS")return "ANILLO";return ap;}
function getNP(name, aparato){const row=NP[name.toUpperCase()];if(!row)return "";const key=mapAparato(aparato);const col=Object.keys(row).find(c=>c.toUpperCase().includes(key));if(!col)return "";let val=row[col];return !isNaN(val)?parseFloat(val).toFixed(1):val;}
function showRutina(name, aparato){
  const rutina=data.filter(d=>d["ATLETA"]===name&&d["APARATO"]===aparato); const np=getNP(name,aparato);
  let sumaVD=0; rutina.forEach(r=>{let val=parseFloat(r["Valor decimal"]);if(!isNaN(val))sumaVD+=val});
  let dificultad=sumaVD,grupos=0;if(!isNaN(np)&&sumaVD>0)grupos=parseFloat(np)-sumaVD-10;if(grupos>2){let exceso=grupos-2;grupos=2;dificultad+=exceso;}
  dificultad=dificultad?dificultad.toFixed(1):"";grupos=grupos?grupos.toFixed(1):"";
  let html=`<div class="back" onclick="showAparatos('${esc(name).replace(/'/g,"\\'")}')">← Volver</div><h2>${esc(name)} — ${esc(aparato)}</h2><div class="np">Nota de partida: ${np||"-"}</div><div class="np">Dificultad: ${dificultad||"-"}</div><div class="np">Grupos: ${grupos||"-"}</div><table class="table"><tr><th>Elemento</th><th>ID</th><th>Grupo</th><th>Valor</th><th>VD</th></tr>`;
  rutina.forEach(r=>{html+=`<tr><td>${esc(r["ELEMENTO"])}</td><td>${esc(r["NÚM DE ID"])}</td><td>${esc(r["GRUPO"])}</td><td>${esc(r["VALOR"])}</td><td>${esc(r["Valor decimal"])}</td></tr>`});screen.innerHTML=html+"</table>";
}

loadExcel().catch(e=>{console.error(e);screen.innerHTML=`<div class="dataNotice">No se pudo cargar el Excel de rutinas: ${esc(e.message)}</div>`});
