// Trabajo en desarrollo del atleta (antes "Training"): el trabajo de cada atleta sale de Normativos (Excel + nube).
// Por aparato y por bloque: todo lo No adquirido y En proceso, y los 2 primeros elementos en Proyección.
// Lo Consolidado ya no se trabaja. trabajo_gav.xlsx solo da nombre (apodo), nivel, grupo y el nombre en Normativos.
// Palomear = confirmar que el atleta CONSOLIDÓ el elemento: se marca Consolidado en Normativos (nube) y entra el
// siguiente en Proyección. "Agregar elemento" guarda trabajo extra en trainingAKC (no cambia la tabla de Normativos).
// Consolidar y agregar solo lo hace un entrenador (misma contraseña que el editor de rutinas y el calendario).
let dataApp=[];
const APARATOS=[
  ["piso","PISO","PISO"],["arzon","ARZON","ARZÓN"],["anillos","ANILLOS","ANILLOS"],
  ["salto","SALTO DE CABALLO","SALTO"],["paralelas","BARRAS PARALELAS","PARALELAS"],["fija","BARRA FIJA","FIJA"]
];
const ESTADO_TXT={NA:"No adquirido",EP:"En proceso",P:"Proyección",X:"Agregado"};
const PROYECCION_POR_BLOQUE=2;
const BLOQUE_EXTRA="AGREGADOS POR EL ENTRENADOR";
const PASS_HASH='edef2f146f863341daae63d0bf0b1e8aa49b805e273a6e6ca559e40dbb22e6d6';
const COACH_KEY='akcTrainingCoach';
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const jsq=s=>String(s).replace(/\\/g,"\\\\").replace(/'/g,"\\'");

let normBase=null, normDb={athletes:[],items:[]}, trainDb={extras:{}}, cloud=null, vista=null;

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

const extrasDe=at=>((trainDb.extras||{})[AKC_NORMATIVOS.normName(at.norm||at.nombre)]||[]).filter(x=>!x.consolidado);

// Trabajo de un atleta en un aparato: [{bloque, elementos:[{elemento, estado, key|extra}]}]
function trabajo(atleta,ap){
  const bloques=[];
  const norm=atleta.norm;
  if(norm){
    const app=APARATOS.find(a=>a[0]===ap)[1];
    normDb.items.filter(it=>it.apparatus===app).forEach(it=>{
      let b=bloques[bloques.length-1];
      if(!b||b.bloque!==it.classification){b={bloque:it.classification,elementos:[],proy:0};bloques.push(b);}
      const st=it.status?.[norm]||"NA";
      if(st==="C") return;
      if(st==="P"){if(b.proy>=PROYECCION_POR_BLOQUE) return; b.proy++;}
      b.elementos.push({elemento:it.element,estado:st,key:it.key});
    });
  }
  const extra=extrasDe(atleta).filter(x=>x.ap===ap);
  if(extra.length) bloques.push({bloque:BLOQUE_EXTRA,elementos:extra.map(x=>({elemento:x.elemento,estado:"X",extra:x.id}))});
  return bloques.filter(b=>b.elementos.length);
}

async function init(){
  try{
    document.getElementById("content").innerHTML="<div class='list'><div class='item'>Cargando trabajo de Normativos…</div></div>";
    const [atletas,base]=await Promise.all([loadWorkbook(),AKC_NORMATIVOS.cargarBase()]);
    normBase=base; normDb=AKC_NORMATIVOS.unir(base,null);
    const porNombre=new Map(base.athletes.map(a=>[AKC_NORMATIVOS.normName(a.name),a.name]));
    atletas.forEach(a=>a.norm=porNombre.get(AKC_NORMATIVOS.normName(a.normativos))||null);
    dataApp=atletas;
    conectarNube();
    showHome();
  }catch(e){
    console.error(e);
    document.getElementById("content").innerHTML="<div class='list'><div class='item'>No se pudo leer Normativos o trabajo_gav.xlsx.</div></div>";
  }
}

// La nube manda: cualquier cambio (de este u otro equipo) se refleja al momento.
function conectarNube(){
  try{
    if(!window.firebase||!firebase.firestore) return;
    if(!firebase.apps.length) firebase.initializeApp(AKC_NORMATIVOS.FB_CONFIG);
    cloud=firebase.firestore();
    cloud.collection("normativosAKC").doc("estado").onSnapshot(s=>{normDb=AKC_NORMATIVOS.unir(normBase,s.exists?s.data():null);redibujar();},e=>console.error(e));
    cloud.collection("trainingAKC").doc("estado").onSnapshot(s=>{trainDb=s.exists?(s.data()||{extras:{}}):{extras:{}};redibujar();},e=>console.error(e));
  }catch(e){console.error(e);}
}
function redibujar(){if(vista)vista();}

/* ---------- Entrenador ---------- */
async function sha256(t){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(t));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');}
const esCoach=()=>sessionStorage.getItem(COACH_KEY)==='ok';
function modal(html){
  cerrarModal();
  const m=document.createElement('div');m.id='modal';m.className='modal';
  m.innerHTML=`<div class='modal-box'>${html}</div>`;
  document.body.appendChild(m);
  return m;
}
function cerrarModal(){const m=document.getElementById('modal');if(m)m.remove();}
function pedirCoach(){
  if(esCoach()) return Promise.resolve(true);
  return new Promise(ok=>{
    const m=modal(`<h3>Solo entrenador</h3><p>Escribe la contraseña de entrenador para consolidar o agregar elementos.</p>
      <form id='fcoach'><input id='pwcoach' type='password' autocomplete='off' placeholder='Contraseña'><div class='msg' id='msgcoach'></div>
      <div class='acciones'><button type='button' class='sec' id='cancoach'>Cancelar</button><button type='submit'>Entrar</button></div></form>`);
    m.querySelector('#pwcoach').focus();
    m.querySelector('#cancoach').onclick=()=>{cerrarModal();ok(false);};
    m.querySelector('#fcoach').onsubmit=async e=>{e.preventDefault();
      if(await sha256(m.querySelector('#pwcoach').value)===PASS_HASH){sessionStorage.setItem(COACH_KEY,'ok');cerrarModal();ok(true);}
      else m.querySelector('#msgcoach').textContent='Contraseña incorrecta.';};
  });
}

/* ---------- Consolidar y agregar ---------- */
async function consolidar(i,ap,elemento,key,extra,cb){
  const at=dataApp[i];
  if(cb) cb.checked=false;
  if(!(await pedirCoach())) return;
  if(!confirm(`¿Confirmas que ${at.nombre} CONSOLIDÓ «${elemento}»?\n\n${extra?'Se quitará de su lista de trabajo.':'Se marcará Consolidado en Normativos y entrará el siguiente en proyección.'}`)) return;
  try{
    if(extra) await consolidarExtra(at,extra);
    else await consolidarNormativo(at,key);
  }catch(e){console.error(e);alert('No se pudo guardar: '+e.message);}
}

async function consolidarNormativo(at,key){
  const ref=cloud.collection("normativosAKC").doc("estado");
  await cloud.runTransaction(async t=>{
    const snap=await t.get(ref);
    if(!snap.exists) throw new Error('No existe el registro de Normativos en la nube. Abre el módulo Normativos una vez.');
    const data=snap.data(),items=Array.isArray(data.items)?data.items:[];
    let it=new Map(AKC_NORMATIVOS.claves(items)).get(key);
    if(!it){ // elemento nuevo del Excel que aún no está en la nube
      const nuevo=normDb.items.find(x=>x.key===key); if(!nuevo) throw new Error('No se encontró el elemento.');
      const {key:_k,...copia}=nuevo; it={...copia,status:{...copia.status}}; items.push(it);
    }
    it.status={...(it.status||{}),[at.norm]:"C"};
    const athletes=Array.isArray(data.athletes)?data.athletes:[];
    if(!athletes.some(a=>AKC_NORMATIVOS.normName(a.name)===AKC_NORMATIVOS.normName(at.norm))){
      const a=normBase.athletes.find(x=>x.name===at.norm); if(a) athletes.push({name:a.name,column:a.column});
    }
    t.set(ref,{...data,athletes,items,updatedAt:firebase.firestore.FieldValue.serverTimestamp()});
  });
}

async function guardarExtras(fn){
  const ref=cloud.collection("trainingAKC").doc("estado");
  await cloud.runTransaction(async t=>{
    const snap=await t.get(ref);
    const data=snap.exists?snap.data():{};
    const extras=data.extras||{};
    fn(extras);
    t.set(ref,{...data,extras,updatedAt:firebase.firestore.FieldValue.serverTimestamp()});
  });
}
async function consolidarExtra(at,id){
  const k=AKC_NORMATIVOS.normName(at.norm||at.nombre);
  await guardarExtras(ex=>{(ex[k]||[]).forEach(x=>{if(x.id===id){x.consolidado=true;x.consolidadoEl=new Date().toISOString();}});});
}
async function quitarExtra(i,id,elemento){
  const at=dataApp[i];
  if(!(await pedirCoach())) return;
  if(!confirm(`¿Quitar «${elemento}» del trabajo de ${at.nombre}? (No se marca como consolidado.)`)) return;
  const k=AKC_NORMATIVOS.normName(at.norm||at.nombre);
  try{await guardarExtras(ex=>{ex[k]=(ex[k]||[]).filter(x=>x.id!==id);});}
  catch(e){console.error(e);alert('No se pudo guardar: '+e.message);}
}
async function agregarExtra(i,ap){
  const at=dataApp[i];
  if(!(await pedirCoach())) return;
  const txt=APARATOS.find(a=>a[0]===ap)[2];
  const m=modal(`<h3>Agregar elemento</h3><p>${esc(at.nombre)} · ${txt}<br><small>Solo para su entrenamiento: no cambia la tabla de Normativos.</small></p>
    <form id='fextra'><input id='elextra' autocomplete='off' autocorrect='off' spellcheck='false' placeholder='Nombre del elemento'><div class='msg' id='msgextra'></div>
    <div class='acciones'><button type='button' class='sec' id='canextra'>Cancelar</button><button type='submit'>Agregar</button></div></form>`);
  m.querySelector('#elextra').focus();
  m.querySelector('#canextra').onclick=cerrarModal;
  m.querySelector('#fextra').onsubmit=async e=>{e.preventDefault();
    const elemento=m.querySelector('#elextra').value.trim(); if(!elemento){m.querySelector('#msgextra').textContent='Escribe el elemento.';return;}
    const k=AKC_NORMATIVOS.normName(at.norm||at.nombre);
    try{
      await guardarExtras(ex=>{(ex[k]=ex[k]||[]).push({id:Date.now().toString(36)+Math.random().toString(36).slice(2,6),ap,elemento,atleta:at.norm||at.nombre,creado:new Date().toISOString()});});
      cerrarModal();
    }catch(err){console.error(err);m.querySelector('#msgextra').textContent='No se pudo guardar: '+err.message;}
  };
}

/* ---------- Pantallas ---------- */
// Dibujos de los aparatos (solo el aparato, sin figuras).
const ICONO={
 piso:'<svg viewBox="0 0 64 52" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"><path d="M6 38 22 14h36L42 38z"/><path d="M14 32 25 19h26L40 32z" stroke-dasharray="3 3" opacity=".7"/><path d="M6 38v4h36l16-24v-4"/></svg>',
 arzon:'<svg viewBox="0 0 64 52" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><rect x="8" y="16" width="48" height="11" rx="5.5"/><path d="M24 16v-6M40 16v-6M21 10h6M37 10h6"/><path d="M20 27l-6 19M44 27l6 19M24 27l-3 19M40 27l3 19"/></svg>',
 anillos:'<svg viewBox="0 0 64 52" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 4h52"/><path d="M22 4v26M42 4v26"/><circle cx="22" cy="38" r="8"/><circle cx="42" cy="38" r="8"/></svg>',
 salto:'<svg viewBox="0 0 64 52" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14 14c0-4 4-6 18-6s18 2 18 6v4H14z"/><path d="M28 18v14M36 18v14"/><path d="M20 46l8-14h8l8 14z"/></svg>',
 paralelas:'<svg viewBox="0 0 64 52" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M4 14h44M16 22h44"/><path d="M10 14v32M42 14v32M22 22v24M54 22v24"/><path d="M6 46h40M18 46h40" opacity=".6"/></svg>',
 fija:'<svg viewBox="0 0 64 52" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M8 8h48"/><path d="M12 8v40M52 8v40"/><path d="M12 8 2 48M52 8l10 40" opacity=".55" stroke-width="1.6"/></svg>',
 grupo:'<svg viewBox="0 0 64 52" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="32" cy="16" r="7"/><circle cx="14" cy="22" r="5.5"/><circle cx="50" cy="22" r="5.5"/><path d="M20 44c0-8 5-13 12-13s12 5 12 13M4 44c0-6 4-10 10-10 2 0 4 .5 5 1.5M60 44c0-6-4-10-10-10-2 0-4 .5-5 1.5"/></svg>',
 atleta:'<svg viewBox="0 0 64 52" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M32 6l5 10 11 1.6-8 7.8 2 11L32 31l-10 5.4 2-11-8-7.8L27 16z"/><path d="M14 46h36"/></svg>'
};
const iniciales=n=>String(n||'').split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0].toUpperCase()).join('');
const cuantos=(at,ap)=>trabajo(at,ap).reduce((n,b)=>n+b.elementos.length,0);
function apBoton(ap,txt,n,accion){
 return `<button class='ap ${ap}${n===0?' listo':''}' onclick="${accion}">${ICONO[ap]}<b>${txt}</b><span class='cuenta'>${n===0?'Todo consolidado':`<strong>${n}</strong> por trabajar`}</span></button>`;
}
function setBack(fn,txt){
 document.getElementById("nav").innerHTML=`<button class='back' onclick="${fn}">← ${txt||'Regresar'}</button>`;
}

function estado(st){return `<span class='estado ${st}'>${ESTADO_TXT[st]}</span>`;}

function showHome(){
 vista=null;
 document.getElementById("nav").innerHTML="";
 document.getElementById("content").innerHTML=`<div class='hero-grid'>
 <button class='hero' onclick="showAthletes()"><span class='ico'>${ICONO.atleta}</span><b>POR ATLETA</b><small>Elige un atleta y ve su trabajo en cada aparato.</small></button>
 <button class='hero oro' onclick="showGroups()"><span class='ico'>${ICONO.grupo}</span><b>POR GRUPO</b><small>Todo lo que trabaja el grupo y quién lo trabaja.</small></button>
 </div>`;
}

function showGroups(){
 vista=null;
 setBack("showHome()","Inicio");
 let groups=[...new Set(dataApp.map(a=>a.grupo).filter(Boolean))];
 let html="<div class='grupos'>";
 groups.forEach(g=>{
   const at=dataApp.filter(a=>a.grupo===g);
   html+=`<button class='grupo' onclick="showGroup('${jsq(esc(g))}')"><b>${esc(g)}</b><small>${at.length} atleta${at.length===1?'':'s'}</small><span class='mini'>${at.map(a=>`<i title='${esc(a.nombre)}'>${esc(iniciales(a.nombre))}</i>`).join('')}</span></button>`;
 });
 document.getElementById("content").innerHTML=html+"</div>";
}

function pendientesGrupo(g,ap){const s=new Set();dataApp.filter(x=>x.grupo===g).forEach(at=>trabajo(at,ap).forEach(b=>b.elementos.forEach(e=>s.add(b.bloque+'|'+e.elemento))));return s.size;}
function showGroup(g){
 vista=()=>showGroup(g);
 setBack("showGroups()","Grupos");
 const at=dataApp.filter(a=>a.grupo===g);
 let html=`<div class='ficha'><div class='avatar'>${ICONO.grupo.replace('<svg','<svg width="38" height="32"')}</div><div><h2>${esc(g)}</h2><p>${at.map(a=>esc(a.nombre)).join(' · ')}</p></div></div><div class='ap-grid'>`;
 APARATOS.forEach(([a,,txt])=>{html+=apBoton(a,txt,pendientesGrupo(g,a),`showGroupAparato('${jsq(esc(g))}','${a}')`);});
 document.getElementById("content").innerHTML=html+"</div>";
}

// Por grupo: cada elemento que le toca a alguien del grupo; tocar el nombre de un atleta = consolidar para él.
function showGroupAparato(g,a){
 vista=()=>showGroupAparato(g,a);
 setBack(`showGroup('${jsq(esc(g))}')`,g);
 const bloques=[];
 dataApp.forEach((at,i)=>{if(at.grupo!==g)return; trabajo(at,a).forEach(b=>{
   let bl=bloques.find(x=>x.bloque===b.bloque); if(!bl){bl={bloque:b.bloque,elementos:new Map()};bloques.push(bl);}
   b.elementos.forEach(e=>{const k=e.extra?'x:'+e.elemento:e.elemento;if(!bl.elementos.has(k))bl.elementos.set(k,{elemento:e.elemento,quien:[]});bl.elementos.get(k).quien.push({i,at,e});});
 });});
 // Orden de bloques y elementos como en Normativos (los agregados al final)
 const app=APARATOS.find(x=>x[0]===a)[1], orden=new Map();
 normDb.items.filter(it=>it.apparatus===app).forEach((it,n)=>{if(!orden.has(it.classification))orden.set(it.classification,n);if(!orden.has(it.classification+"|"+it.element))orden.set(it.classification+"|"+it.element,n);});
 const pos=k=>orden.has(k)?orden.get(k):1e9;
 bloques.sort((x,y)=>pos(x.bloque)-pos(y.bloque));
 const txt=APARATOS.find(x=>x[0]===a)[2];
 let html=`<div class='titulo-lista ${a}'>${ICONO[a]}<div><b>${txt}</b><small>${esc(g)}</small></div></div><div class='list'>`;
 if(!bloques.length) html+="<div class='vacio'>Nada pendiente en este aparato.</div>";
 bloques.forEach(b=>{
   html+=`<div class='bloque'>${esc(b.bloque)}</div>`;
   [...b.elementos.values()].sort((x,y)=>pos(b.bloque+"|"+x.elemento)-pos(b.bloque+"|"+y.elemento)).forEach(({elemento,quien})=>{
     html+=`<div class='item'><div class='txt'>${esc(elemento)}<div class='quien'>${quien.map(({i,at,e})=>
       `<button class='chip ${e.estado}' title='Confirmar que lo consolidó' onclick="consolidar(${i},'${a}','${jsq(esc(e.elemento))}','${jsq(esc(e.key||''))}','${jsq(esc(e.extra||''))}')">${esc(at.nombre)} · ${ESTADO_TXT[e.estado]}</button>`).join('')}</div></div></div>`;
   });
 });
 html+="</div><p class='ayuda'>Toca el nombre de un atleta cuando consolide el elemento (solo entrenadores).</p>";
 document.getElementById("content").innerHTML=html;
}

// Por atleta: lista desplegable agrupada por grupo; al elegir, su ficha y los aparatos.
let atletaSel=-1;
function showAthletes(){
 vista=()=>showAthletes();
 setBack("showHome()","Inicio");
 const grupos=[...new Set(dataApp.map(a=>a.grupo||'Sin grupo'))];
 let html=`<div class='selector'><label for='selAtleta'>Atleta</label><div class='select-wrap'><select id='selAtleta' onchange="atletaSel=+this.value;showAthletes()"><option value='-1'>Elige un atleta…</option>${
   grupos.map(g=>`<optgroup label='${esc(g)}'>${dataApp.map((a,i)=>(a.grupo||'Sin grupo')===g?`<option value='${i}' ${i===atletaSel?'selected':''}>${esc(a.nombre)}</option>`:'').join('')}</optgroup>`).join('')
 }</select></div></div>`;
 if(atletaSel>=0&&dataApp[atletaSel]){
   const at=dataApp[atletaSel];
   html+=`<div class='ficha'><div class='avatar'>${esc(iniciales(at.nombre))}</div><div><h2>${esc(at.nombre)}</h2><p>${at.norm?esc(at.norm):'No está en Normativos'}</p><div class='tags'>${at.grupo?`<span class='tag'>${esc(at.grupo)}</span>`:''}${at.nivel!==''?`<span class='tag oro'>Nivel ${esc(at.nivel)}</span>`:''}</div></div></div><div class='ap-grid'>`;
   APARATOS.forEach(([ap,,txt])=>{html+=apBoton(ap,txt,cuantos(at,ap),`showAthleteAparato(${atletaSel},'${ap}')`);});
   html+="</div>";
 }
 document.getElementById("content").innerHTML=html;
}
function showAthlete(i){atletaSel=i;showAthletes();}

function showAthleteAparato(i,ap){
 vista=()=>showAthleteAparato(i,ap);
 atletaSel=i;
 setBack("showAthletes()",dataApp[i].nombre);
 const bloques=trabajo(dataApp[i],ap);
 const txt=APARATOS.find(x=>x[0]===ap)[2];
 let html=`<div class='titulo-lista ${ap}'>${ICONO[ap]}<div><b>${txt}</b><small>${esc(dataApp[i].nombre)}</small></div></div><div class='list'>`;
 if(!dataApp[i].norm) html+=`<div class='vacio'>${esc(dataApp[i].nombre)} no está en Normativos.</div>`;
 else if(!bloques.length) html+="<div class='vacio'>Todo consolidado en este aparato.</div>";
 bloques.forEach(b=>{
   html+=`<div class='bloque'>${esc(b.bloque)}</div>`;
   b.elementos.forEach(e=>{
     html+=`<div class='item'><input type='checkbox' title='Confirmar que lo consolidó' onchange="consolidar(${i},'${ap}','${jsq(esc(e.elemento))}','${jsq(esc(e.key||''))}','${jsq(esc(e.extra||''))}',this)"><div class='txt'>${esc(e.elemento)}</div>${estado(e.estado)}${e.extra?`<button class='quitar' title='Quitar' onclick="quitarExtra(${i},'${jsq(esc(e.extra))}','${jsq(esc(e.elemento))}')">✕</button>`:''}</div>`;
   });
 });
 html+="</div>";
 html+=`<button class='agregar' onclick="agregarExtra(${i},'${ap}')">＋ AGREGAR ELEMENTO</button><p class='ayuda'>Palomea un elemento cuando el atleta lo consolide (solo entrenadores).</p>`;
 document.getElementById("content").innerHTML=html;
}

init();
