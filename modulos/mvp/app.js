const MVP_PASSWORD="Akcgav";
const FIREBASE_CONFIG={apiKey:"AIzaSyBNRAkDXLlw5fyiT01-ZfUyB0A7ShsAxyg",authDomain:"akc-con-reporte.firebaseapp.com",projectId:"akc-con-reporte"};
const COLLECTION="mvpAKC", DOC="estado";
const DAYS=["L","M","X","J","V","S"];
const GROUPS=[
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
async function initCloud(){
  try{
    if(!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    db=firebase.firestore(); ref=db.collection(COLLECTION).doc(DOC);
    const snap=await ref.get();
    if(snap.exists){mergeData(snap.data());}
    else {mergeData({}); await ref.set({...data,updatedAt:firebase.firestore.FieldValue.serverTimestamp()});}
    renderAll();
    ref.onSnapshot(s=>{if(s.exists){mergeData(s.data());saveLocal();renderAll();}});
  }catch(e){
    console.warn("MVP: nube no disponible",e);
    try{mergeData(JSON.parse(localStorage.getItem(localKey)||"{}"));}catch(_){}
    renderAll();
  }
}
async function saveCloud(){
  saveLocal();
  if(!ref)return;
  try{await ref.set({...data,updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});}
  catch(e){console.warn("MVP: no se pudo guardar en nube",e);}
}
function scoreFor(name,day){
  return Number((data.scores[name]||{})[day]||0);
}
function totalFor(name){return DAYS.reduce((a,d)=>a+scoreFor(name,d),0);}
function groupHtml(block){
  const groups=GROUPS.filter(g=>g.block===block);
  let html=`<div class="block-title">${block==="Bloque 1"?"🟦":"🟩"} ${block} <span>${block==="Bloque 1"?"GAV 4 + GAV 5":"GAV 6 + GAV 9 + GAV FIG"}</span></div>`;
  groups.forEach(g=>{
    html+=`<div class="group-title">${g.title}</div><div class="table-wrap"><table><thead><tr><th>Atleta</th>${DAYS.map(d=>`<th>${d}</th>`).join("")}<th>TOTAL</th></tr></thead><tbody>`;
    g.athletes.forEach(name=>{
      html+=`<tr><td>${name}</td>${DAYS.map(d=>`<td><button class="count-btn" onclick="addScore('${esc(name)}','${d}')" title="Agregar MVP">${scoreFor(name,d)}</button></td>`).join("")}<td class="total">${totalFor(name)}</td></tr>`;
    });
    html+="</tbody></table></div>";
  });
  return html;
}
function esc(s){return s.replace(/\\/g,"\\\\").replace(/'/g,"\\'");}
function renderRecords(){
  document.getElementById("recordContent").innerHTML=groupHtml("Bloque 1")+groupHtml("Bloque 2");
  document.getElementById("weekLabel").textContent=weekLabel();
}
function renderScores(){
  let html="";
  ["Bloque 1","Bloque 2"].forEach(block=>{
    const names=GROUPS.filter(g=>g.block===block).flatMap(g=>g.athletes);
    const ranked=names.map(name=>({name,total:totalFor(name)})).sort((a,b)=>b.total-a.total||a.name.localeCompare(b.name,"es"));
    html+=`<div class="score-block"><div class="score-title">${block} <span>${block==="Bloque 1"?"GAV 4 + GAV 5":"GAV 6 + GAV 9 + GAV FIG"}</span></div>`;
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
function askPassword(action){
  pendingAction=action;
  const modal=document.getElementById("passwordModal"), input=document.getElementById("passwordInput");
  document.getElementById("passwordError").textContent="";
  input.value=""; modal.classList.remove("hidden"); setTimeout(()=>input.focus(),50);
}
function closePassword(){document.getElementById("passwordModal").classList.add("hidden");pendingAction=null;}
function checkPassword(){
  const input=document.getElementById("passwordInput");
  if(input.value!==MVP_PASSWORD){document.getElementById("passwordError").textContent="Contraseña incorrecta.";input.select();return;}
  const action=pendingAction;closePassword();
  if(action==="records"){document.getElementById("records").classList.remove("hidden");renderRecords();document.getElementById("records").scrollIntoView({behavior:"smooth"});}
  if(action==="upload"){document.getElementById("upload").classList.remove("hidden");document.getElementById("upload").scrollIntoView({behavior:"smooth"});}
}
async function addScore(name,day){
  if(!data.scores[name])data.scores[name]={};
  data.scores[name][day]=scoreFor(name,day)+1;
  renderRecords();renderScores();saveLocal();await saveCloud();
}
function confirmReset(){
  if(!confirm("¿Reiniciar todos los registros de MVP de la semana? Las fotos no se borrarán."))return;
  data.scores={};saveCloud().then(renderAll);
}
function uploadPhoto(block,input){
  const file=input.files?.[0]; if(!file)return;
  const status=document.getElementById("uploadStatus"+block);status.textContent="Procesando…";
  compressImage(file).then(src=>{data.photos[block]=src;renderPhotos();saveCloud();status.textContent="Foto guardada.";input.value="";})
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
window.addEventListener("load",initCloud);
