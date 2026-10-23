const FIREBASE_CONFIG={apiKey:"AIzaSyBNRAkDXLlw5fyiT01-ZfUyB0A7ShsAxyg",authDomain:"akc-con-reporte.firebaseapp.com",projectId:"akc-con-reporte"};
const COLLECTION="mvpAKC", DOC="estado";
const DAYS=["L","M","X","J","V","S"];
const GROUPS=[
 {block:"Bloque 1", title:"GAV 3", athletes:["Joan"]},
 {block:"Bloque 1", title:"GAV 4", athletes:["Leonardo García Lázaro","Isaac Rangel"]},
 {block:"Bloque 1", title:"GAV 5", athletes:["Leonardo Camacho","Santiago Camacho","Nicolás Flores","Charlie Aznar","David Rangel","Diego Cuevas","Emiliano González"]},
 {block:"Bloque 2", title:"GAV 6", athletes:["Alfredo Jacobo","Brittan Akim","Bruno Báez","Eric López","Chema Robles","Mauro Regand"]},
 {block:"Bloque 2", title:"GAV 9", athletes:["Bruno Jacobo","Diego Chávez","Fer Talavera","Santi Sigler","Mario Bisteni","Max Diaz","Nico Capitanachi","Yerik Guerra"]},
 {block:"Bloque 2", title:"GAV FIG", athletes:["Isaac Martínez","Alonso Ahedo","Diego Vela","Diego Champi Rodríguez","Mikel Larrinua","Richie Jiménez","Diego Jaime"]}
];
const ATHLETES=[...new Map(GROUPS.flatMap(g=>g.athletes).map(name=>[name,{name,block:gBlock(name)}])).values()];
function gBlock(name){return GROUPS.some(g=>g.block==="Bloque 1"&&g.athletes.includes(name))?"Bloque 1":"Bloque 2";}
const defaultData={scores:{},photos:{1:"",2:""},updatedAt:null};
let data=structuredClone(defaultData), db=null, ref=null, pendingAction=null;
let localKey="AKC_MVP_LOCAL_V1";

function weekKey(d=new Date()){
  const x=new Date(d); const day=x.getDay(); const diff=day===0?-6:1-day;
  x.setDate(x.getDate()+diff); x.setHours(0,0,0,0);
  return x.toISOString().slice(0,10);
}
function weekLabel(){
  const start=new Date(weekKey()+"T00:00:00");
  const end=new Date(start); end.setDate(end.getDate()+5);
  return start.toLocaleDateString("es-MX",{day:"2-digit",month:"short"})+" – "+end.toLocaleDateString("es-MX",{day:"2-digit",month:"short",year:"numeric"});
}
function clone(o){return JSON.parse(JSON.stringify(o));}
function mergeData(raw){
  const x=raw&&typeof raw==="object"?raw:{};
  data={...clone(defaultData),...x,scores:x.scores||{},photos:{...clone(defaultData.photos),...(x.photos||{})}};
}
function saveLocal(){try{localStorage.setItem(localKey,JSON.stringify(data));}catch(e){}}
let photoRefs={}, cloudWarned=false;
function cloudFail(e){
  console.warn("MVP: no se pudo guardar en nube",e);
  if(!cloudWarned){cloudWarned=true;alert("No se pudo guardar en la nube. Revisa tu conexión: este registro solo quedó en este equipo.");}
}
async function initCloud(){
  try{
    if(!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    db=firebase.firestore(); ref=db.collection(COLLECTION).doc(DOC);
    photoRefs={1:db.collection(COLLECTION).doc("foto1"),2:db.collection(COLLECTION).doc("foto2")};
    const snap=await ref.get();
    if(snap.exists){mergeData(snap.data());}
    else {mergeData({}); await ref.set({scores:{},updatedAt:firebase.firestore.FieldValue.serverTimestamp()});}
    await migratePhotos(snap.exists?snap.data():{});
    renderAll();
    ref.onSnapshot(s=>{if(s.exists){const p=data.photos;const x=s.data();data.scores=x.scores||{};data.photos=p;saveLocal();renderRecords();renderScores();}});
    [1,2].forEach(n=>photoRefs[n].onSnapshot(s=>{if(s.exists){data.photos[n]=s.data().src||"";saveLocal();renderPhotos();}}));
  }catch(e){
    console.warn("MVP: nube no disponible",e);
    try{mergeData(JSON.parse(localStorage.getItem(localKey)||"{}"));}catch(_){}
    renderAll();
    ref=null; setTimeout(initCloud,8000);
  }
}
// Las fotos van en documentos separados para que el documento de registros no rebase el límite de Firestore.
async function migratePhotos(raw){
  const legacy=(raw&&raw.photos)||{};
  for(const n of [1,2]){
    const s=await photoRefs[n].get();
    if(s.exists){data.photos[n]=s.data().src||"";}
    else if(legacy[n]){data.photos[n]=legacy[n];await photoRefs[n].set({src:legacy[n],updatedAt:firebase.firestore.FieldValue.serverTimestamp()});}
  }
  if(raw&&raw.photos){await ref.update({photos:firebase.firestore.FieldValue.delete()});}
}
async function saveCloud(){
  saveLocal();
  if(!ref)return;
  try{await ref.update({scores:data.scores,updatedAt:firebase.firestore.FieldValue.serverTimestamp()});}
  catch(e){cloudFail(e);}
}
async function saveScoreCloud(name,day){
  saveLocal();
  if(!ref){cloudFail("sin conexión");return;}
  try{await ref.update(new firebase.firestore.FieldPath("scores",name,day),firebase.firestore.FieldValue.increment(1),"updatedAt",firebase.firestore.FieldValue.serverTimestamp());}
  catch(e){cloudFail(e);}
}
async function savePhotoCloud(n){
  saveLocal();
  if(!ref){cloudFail("sin conexión");return;}
  try{await photoRefs[n].set({src:data.photos[n]||"",updatedAt:firebase.firestore.FieldValue.serverTimestamp()});}
  catch(e){cloudFail(e);}
}
function scoreFor(name,day){
  return Number((data.scores[name]||{})[day]||0);
}
function totalFor(name){return DAYS.reduce((a,d)=>a+scoreFor(name,d),0);}
const DAY_NAMES={L:"Lunes",M:"Martes",X:"Miércoles",J:"Jueves",V:"Viernes",S:"Sábado"};
// Día que se está registrando: por defecto hoy (domingo -> sábado). Se conserva al actualizar la pantalla.
let selDay=new Date().getDay()===0?"S":DAYS[new Date().getDay()-1];
function escHtml(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));}
function dayTotal(d){return ATHLETES.reduce((a,x)=>a+scoreFor(x.name,d),0);}
function renderDayPicker(){
  // Solo de lunes a hoy (el conteo se reinicia cada lunes). En domingo se muestran los 6 días.
  const hoy=new Date().getDay(),visibles=hoy===0?DAYS:DAYS.slice(0,hoy);
  document.getElementById("dayPicker").innerHTML=visibles.map(d=>`<button type="button" class="day-btn" data-day="${d}" aria-pressed="${d===selDay}"><b>${DAY_NAMES[d]}</b><small>${dayTotal(d)} MVP</small></button>`).join("");
  document.getElementById("dayNow").textContent=DAY_NAMES[selDay];
}
function setDay(d){selDay=d;renderRecords();}
function groupHtml(block){
  const groups=GROUPS.filter(g=>g.block===block);
  let html=`<div class="block-title">${block==="Bloque 1"?"🟦":"🟩"} ${block} <span>${block==="Bloque 1"?"GAV 3 + GAV 4 + GAV 5":"GAV 6 + GAV 9 + GAV FIG"}</span></div>`;
  groups.forEach(g=>{
    html+=`<div class="group-title">${g.title}</div><div class="rec-list">`;
    g.athletes.forEach(name=>{
      const n=scoreFor(name,selDay),e=escHtml(name);
      html+=`<div class="rec-row${n?" has":""}"><div class="rec-name">${e}<small>Semana: ${totalFor(name)}</small></div>`+
        `<div class="rec-count" aria-label="${n} MVP el ${DAY_NAMES[selDay]}">${n}</div>`+
        `<button type="button" class="rec-minus" data-name="${e}" aria-label="Quitar 1 MVP a ${e}"${n?"":" disabled"}>−1</button>`+
        `<button type="button" class="rec-plus" data-name="${e}" data-delta="1" aria-label="Sumar 1 MVP a ${e}">+1</button></div>`;
    });
    html+="</div>";
  });
  return html;
}
function esc(s){return s.replace(/\\/g,"\\\\").replace(/'/g,"\\'");}
function renderRecords(){
  renderDayPicker();renderUndo();
  document.getElementById("recordContent").innerHTML=groupHtml("Bloque 1")+groupHtml("Bloque 2");
  document.getElementById("weekLabel").textContent=weekLabel();
}
function renderScores(){
  let html="";
  ["Bloque 1","Bloque 2"].forEach(block=>{
    const names=GROUPS.filter(g=>g.block===block).flatMap(g=>g.athletes);
    const ranked=names.map(name=>({name,total:totalFor(name)})).sort((a,b)=>b.total-a.total||a.name.localeCompare(b.name,"es"));
    html+=`<div class="score-block"><div class="score-title">${block} <span>${block==="Bloque 1"?"GAV 3 + GAV 4 + GAV 5":"GAV 6 + GAV 9 + GAV FIG"}</span></div>`;
    html+=ranked.map((r,i)=>`<div class="rank-row"><span class="rank">${i+1}</span><strong>${r.name}</strong><b>${r.total}</b><small>MVP</small></div>`).join("");
    html+="</div>";
  });
  document.getElementById("scoreContent").innerHTML=html;
}
function renderPhotos(){
  [1,2].forEach(n=>{
    const img=document.getElementById("photo"+n), ph=document.getElementById("placeholder"+n);
    const src=data.photos[n]||"";
    img.src=src; img.style.display=src?"block":"none"; ph.style.display=src?"none":"grid";
  });
}
function renderAll(){renderPhotos();renderRecords();renderScores();}
function hidePanel(id){document.getElementById(id)?.classList.add("hidden");}
function showScores(){renderScores();document.getElementById("scores").classList.remove("hidden");document.getElementById("scores").scrollIntoView({behavior:"smooth"});}
function hideScores(){hidePanel("scores");}
// App de prueba: sin contraseña (solo entra Manu); la acción se abre directo.
function askPassword(action){pendingAction=action;checkPassword();}
function closePassword(){document.getElementById("passwordModal").classList.add("hidden");pendingAction=null;}
function checkPassword(){
  const input=document.getElementById("passwordInput");
  const action=pendingAction;closePassword();
  if(action==="records"){document.getElementById("records").classList.remove("hidden");renderRecords();document.getElementById("records").scrollIntoView({behavior:"smooth"});}
  if(action==="upload"){document.getElementById("upload").classList.remove("hidden");document.getElementById("upload").scrollIntoView({behavior:"smooth"});}
}
// Historial de cambios hechos en este dispositivo, para "Deshacer último".
let historial=[];
try{historial=JSON.parse(sessionStorage.getItem("AKC_MVP_HISTORIAL")||"[]");}catch(e){}
function guardarHistorial(){try{sessionStorage.setItem("AKC_MVP_HISTORIAL",JSON.stringify(historial.slice(-50)));}catch(e){}}
function renderUndo(){
  const b=document.getElementById("undoBtn");if(!b)return;
  const u=historial[historial.length-1];
  b.disabled=!u;
  b.title=u?`Deshacer: ${u.delta>0?"+1":"−1"} a ${u.name} (${DAY_NAMES[u.day]})`:"No hay cambios para deshacer";
}
async function undoLast(){
  const u=historial[historial.length-1];if(!u)return;
  if(!confirm(`¿Deshacer el último cambio?\n\n${u.delta>0?"+1":"−1"} a ${u.name} (${DAY_NAMES[u.day]})`))return;
  historial.pop();guardarHistorial();
  await addScore(u.name,u.day,-u.delta,false);
  toastMvp(`Se deshizo: ${u.delta>0?"+1":"−1"} a ${u.name} (${DAY_NAMES[u.day]})`);
}
// Aviso con "Deshacer" unos segundos después de cada +1 (para el error de dedo inmediato).
let ultimoMas=null;
function avisoMas(name,day){
  const e=document.getElementById("mvpToast");if(!e)return;
  ultimoMas={name,day};
  e.textContent="";
  e.append(document.createTextNode(`+1 a ${name} · `));
  const b=document.createElement("button");b.type="button";b.id="mvpDeshacer";b.className="mvp-toast-btn";b.textContent="Deshacer";e.append(b);
  e.classList.add("show","con-boton");clearTimeout(window.__mt);
  window.__mt=setTimeout(()=>{e.classList.remove("show","con-boton");ultimoMas=null;},5000);
}
async function deshacerMas(){
  const u=ultimoMas;if(!u)return;ultimoMas=null;
  const e=document.getElementById("mvpToast");if(e)e.classList.remove("con-boton");
  const i=historial.map(h=>h.name+"|"+h.day+"|"+h.delta).lastIndexOf(u.name+"|"+u.day+"|1");
  if(i>=0){historial.splice(i,1);guardarHistorial();}
  await addScore(u.name,u.day,-1,false);
  toastMvp(`Se deshizo: +1 a ${u.name} (${DAY_NAMES[u.day]})`);
}
function toastMvp(t){const e=document.getElementById("mvpToast");if(!e)return;e.textContent=t;e.classList.add("show");clearTimeout(window.__mt);window.__mt=setTimeout(()=>e.classList.remove("show"),2600);}
async function addScore(name,day,delta=1,registrar=true){
  const nuevo=Math.max(0,scoreFor(name,day)+delta);
  if(nuevo===scoreFor(name,day)){renderUndo();return;}
  if(registrar){historial.push({name,day,delta});guardarHistorial();}
  if(!data.scores[name])data.scores[name]={};
  data.scores[name][day]=nuevo;
  renderRecords();renderScores();saveLocal();
  if(!ref){cloudFail("sin conexión");return;}
  try{
    const campo=new firebase.firestore.FieldPath("scores",name,day);
    await db.runTransaction(async t=>{
      const snap=await t.get(ref);
      const actual=Number(((snap.data()||{}).scores||{})[name]?.[day]||0);
      t.update(ref,campo,Math.max(0,actual+delta),"updatedAt",firebase.firestore.FieldValue.serverTimestamp());
    });
  }catch(e){cloudFail(e);}
}
function confirmReset(){
  if(!confirm("¿Reiniciar todos los registros de MVP de la semana? Las fotos no se borrarán."))return;
  data.scores={};saveCloud().then(renderAll);
}
function uploadPhoto(block,input){
  const file=input.files?.[0]; if(!file)return;
  const status=document.getElementById("uploadStatus"+block);status.textContent="Procesando…";
  compressImage(file).then(src=>{data.photos[block]=src;renderPhotos();savePhotoCloud(block);status.textContent="Foto guardada.";input.value="";})
  .catch(()=>status.textContent="No se pudo procesar la imagen.");
}
function compressImage(file){
  return new Promise((resolve,reject)=>{
    const r=new FileReader();r.onload=()=>{const img=new Image();img.onload=()=>{
      const max=1000,scale=Math.min(1,max/Math.max(img.width,img.height));
      const c=document.createElement("canvas");c.width=Math.max(1,Math.round(img.width*scale));c.height=Math.max(1,Math.round(img.height*scale));
      c.getContext("2d").drawImage(img,0,0,c.width,c.height);
      resolve(c.toDataURL("image/jpeg",.78));
    };img.onerror=reject;img.src=r.result;};r.onerror=reject;r.readAsDataURL(file);
  });
}
function goBack(){if(window.parent!==window){window.parent.goHome?.();}else history.back();}
document.addEventListener("keydown",e=>{if(!document.getElementById("passwordModal").classList.contains("hidden")){if(e.key==="Enter")checkPassword();if(e.key==="Escape")closePassword();}});
document.addEventListener("click",e=>{
  const d=e.target.closest(".day-btn");if(d){setDay(d.dataset.day);return;}
  if(e.target.closest("#undoBtn")){undoLast();return;}
  if(e.target.closest("#mvpDeshacer")){deshacerMas();return;}
  const m=e.target.closest(".rec-minus");
  if(m){const n=m.dataset.name;if(scoreFor(n,selDay)<=0)return;
    if(confirm(`¿Quitar 1 MVP a ${n} del ${DAY_NAMES[selDay].toLowerCase()}?`))addScore(n,selDay,-1);return;}
  const b=e.target.closest(".rec-plus");if(b){addScore(b.dataset.name,selDay,1);avisoMas(b.dataset.name,selDay);}
});
window.addEventListener("load",initCloud);
