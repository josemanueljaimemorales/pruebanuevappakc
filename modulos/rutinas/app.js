let data = [];
let NP = {};
let DIFICULTAD = {};
let GRUPOS = {};
let OBL = [];

const screen = document.getElementById("screen");

function norm(v){
  return String(v ?? "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function num(v){
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function fmt(v){
  const n = num(v);
  return n === null ? (v ?? "") : n.toFixed(1);
}

function tableByAthlete(rows){
  const out = {};
  rows.forEach(r => {
    const keys = Object.keys(r);
    const nameKey = keys.find(k => norm(k) === "__EMPTY") || keys[0];
    const name = norm(r[nameKey]);
    if(name) out[name] = r;
  });
  return out;
}

async function loadExcel(){
  try{
    const res = await fetch("Excel_Solo_Valores.xlsx", {cache:"no-store"});
    if(!res.ok) throw new Error(`No se pudo cargar Excel_Solo_Valores.xlsx (${res.status})`);
    const buffer = await res.arrayBuffer();
    const wb = XLSX.read(buffer, {type:"array"});

    const required = ["BASEAPPRUTINAS","NP","Dificultad","GRUPOS","OBLIGATORIOS"];
    const missing = required.filter(s => !wb.Sheets[s]);
    if(missing.length) throw new Error("Faltan hojas: " + missing.join(", "));

    data = XLSX.utils.sheet_to_json(wb.Sheets["BASEAPPRUTINAS"], {defval:""});
    NP = tableByAthlete(XLSX.utils.sheet_to_json(wb.Sheets["NP"], {defval:""}));
    DIFICULTAD = tableByAthlete(XLSX.utils.sheet_to_json(wb.Sheets["Dificultad"], {defval:""}));
    GRUPOS = tableByAthlete(XLSX.utils.sheet_to_json(wb.Sheets["GRUPOS"], {defval:""}));
    OBL = XLSX.utils.sheet_to_json(wb.Sheets["OBLIGATORIOS"], {defval:""});

    // Fuente única de atletas: BASEAPPRUTINAS del Excel de AKC MASTER FUSION.
    data = data.filter(r => norm(r["ATLETA"]));

    if(!data.length) throw new Error("BASEAPPRUTINAS no contiene atletas.");
    showHome();
  }catch(err){
    console.error(err);
    screen.innerHTML = `<div class="card error"><h2>Error al leer Rutinas</h2><p>${err.message}</p><p>Verifica que <b>Excel_Solo_Valores.xlsx</b> esté en la misma carpeta que app.js.</p></div>`;
  }
}

function showHome(){
  screen.innerHTML = `
    <div class="button" onclick="showAthletes()">Rutinas</div>
    <div class="button" onclick="showObligatorios()">Obligatorios</div>
  `;
}

function showAthletes(){
  const athletes = [...new Set(data.map(d => String(d["ATLETA"]).trim()).filter(Boolean))];
  screen.innerHTML = `<div class="back" onclick="showHome()">⬅️</div>`;
  athletes.forEach(a => {
    screen.innerHTML += `<div class="button" onclick="showAparatos(${JSON.stringify(a)})">${a}</div>`;
  });
}

function showAparatos(name){
  const key = norm(name);
  const aparatos = [...new Set(
    data.filter(d => norm(d["ATLETA"]) === key).map(d => String(d["APARATO"] ?? "").trim()).filter(Boolean)
  )];
  screen.innerHTML = `<div class="back" onclick="showAthletes()">⬅️</div><h2>${name}</h2>`;
  aparatos.forEach(ap => {
    screen.innerHTML += `<div class="button" onclick="showRutina(${JSON.stringify(name)},${JSON.stringify(ap)})">${ap}</div>`;
  });
}

function apparatusKey(ap){
  const k = norm(ap);
  const aliases = {
    "PISO":"PISO",
    "ARZON":"ARZON",
    "ARZONES":"ARZON",
    "ANILLOS":"ANILLO",
    "ANILLO":"ANILLO",
    "SALTO":"SALTO",
    "PARALELAS":"PARALELA",
    "PARALELA":"PARALELA",
    "FIJA":"FIJA"
  };
  return aliases[k] || k;
}

function getTableValue(table, name, aparato){
  const row = table[norm(name)];
  if(!row) return "";
  const key = apparatusKey(aparato);
  const col = Object.keys(row).find(c => apparatusKey(c) === key);
  return col ? row[col] : "";
}

function getNP(name, aparato){ return getTableValue(NP, name, aparato); }
function getDificultad(name, aparato){ return getTableValue(DIFICULTAD, name, aparato); }
function getGrupos(name, aparato){ return getTableValue(GRUPOS, name, aparato); }

function showRutina(name, aparato){
  const rutina = data.filter(d => norm(d["ATLETA"]) === norm(name) && norm(d["APARATO"]) === norm(aparato));
  const np = getNP(name, aparato);
  const dificultad = getDificultad(name, aparato);
  const grupos = getGrupos(name, aparato);

  let html = `<div class="back" onclick="showAparatos(${JSON.stringify(name)})">⬅️</div>`;
  html += `<h2>${name} - ${aparato}</h2>`;
  html += `<div class="np">Nota de partida: ${fmt(np) || "-"}</div>`;
  html += `<div class="np">Dificultad: ${fmt(dificultad) || "-"}</div>`;
  html += `<div class="np">Grupos: ${fmt(grupos) || "-"}</div>`;

  html += `<table class="table"><tr><th>Elemento</th><th>ID</th><th>Grupo</th><th>Valor</th><th>VD</th></tr>`;
  rutina.forEach(r => {
    html += `<tr><td>${r["ELEMENTO"] || ""}</td><td>${r["NÚM DE ID"] || ""}</td><td>${r["GRUPO"] || ""}</td><td>${r["VALOR"] || ""}</td><td>${r["Valor decimal"] || ""}</td></tr>`;
  });
  html += `</table>`;
  screen.innerHTML = html;
}

function showObligatorios(){
  const names = OBL.map(r => r["NOMBRE"] ?? Object.values(r)[0]).filter(Boolean);
  screen.innerHTML = `<div class="back" onclick="showHome()">⬅️</div>`;
  names.forEach(n => {
    screen.innerHTML += `<div class="button" onclick="showObligatorioDetalle(${JSON.stringify(n)})">${n}</div>`;
  });
}

function showObligatorioDetalle(name){
  const r = OBL.find(x => String(x["NOMBRE"] ?? Object.values(x)[0]) === String(name));
  if(!r) return;
  const hongoValue = r["HONGO  ARZON"] ?? r["HONGO ARZON"] ?? "-";
  let html = `<div class="back" onclick="showObligatorios()">⬅️</div>`;
  html += `<h2>${name}</h2>`;
  html += `<div class="np">Nivel: ${r["NIVEL"] ?? "-"}</div>`;
  html += `<table class="table"><tr><th>Aparato</th><th>Nota</th></tr>
    <tr><td>Piso</td><td>${r["PISO"] ?? "-"}</td></tr>
    <tr><td>Hongo / Arzón</td><td>${hongoValue}</td></tr>
    <tr><td>Anillo</td><td>${r["ANILLO"] ?? "-"}</td></tr>
    <tr><td>Salto</td><td>${r["SALTO"] ?? "-"}</td></tr>
    <tr><td>Paralela</td><td>${r["PARALELA"] ?? "-"}</td></tr>
    <tr><td>Fija</td><td>${r["FIJA"] ?? "-"}</td></tr>
  </table>`;
  screen.innerHTML = html;
}

loadExcel();
