// Gimnasia en redes: perfiles de gimnasia varonil (Instagram, TikTok, YouTube) que se ven dentro de la app. Los perfiles se guardan en Firebase, redesAKC/estado = {perfiles: [{id, red, usuario, titulo, nota}]}.
const FIREBASE_CONFIG={apiKey:"AIzaSyBNRAkDXLlw5fyiT01-ZfUyB0A7ShsAxyg",authDomain:"akc-con-reporte.firebaseapp.com",projectId:"akc-con-reporte"};
const REDES={
  instagram:{nombre:"Instagram",url:u=>`https://www.instagram.com/${encodeURIComponent(u)}/`},
  tiktok:{nombre:"TikTok",url:u=>`https://www.tiktok.com/@${encodeURIComponent(u)}`},
  youtube:{nombre:"YouTube",url:u=>`https://www.youtube.com/@${encodeURIComponent(u)}`}
};
const USUARIO_OK=/^[A-Za-z0-9._-]{1,40}$/;
let perfiles=[], filtro="todos", ref=null, editando=null;
const $=id=>document.getElementById(id);

// "https://www.instagram.com/usuario/?hl=es", "tiktok.com/@usuario", "@usuario" → {red, usuario}
function leerEnlace(txt){
  const t=String(txt||"").trim();
  let m=t.match(/instagram\.com\/([A-Za-z0-9._]+)/i);
  if(m&&!/^(p|reel|reels|stories|explore)$/i.test(m[1]))return {red:"instagram",usuario:m[1]};
  m=t.match(/tiktok\.com\/@([A-Za-z0-9._-]+)/i);if(m)return {red:"tiktok",usuario:m[1]};
  m=t.match(/youtube\.com\/@([A-Za-z0-9._-]+)/i);if(m)return {red:"youtube",usuario:m[1]};
  if(/^https?:|\//i.test(t))return null;
  const u=t.replace(/^@/,"");
  return USUARIO_OK.test(u)?{red:null,usuario:u}:null;
}
// Nombre automático: TikTok lo da su servicio oEmbed (el nombre real del perfil); Instagram y YouTube no lo dan sin
// permisos especiales, así que se arma con el usuario ("kohei.uchimura" → "Kohei Uchimura"). Se puede corregir a mano.
function nombreDeUsuario(u){
  return String(u||"").replace(/[0-9]+$/,"").split(/[._-]+/).filter(Boolean)
    .map(w=>w.charAt(0).toUpperCase()+w.slice(1).toLowerCase()).join(" ")||u;
}
async function nombreTikTok(u){
  try{
    const r=await fetch("https://www.tiktok.com/oembed?url="+encodeURIComponent("https://www.tiktok.com/@"+u));
    if(!r.ok)return "";
    const j=await r.json();return String(j.author_name||"").trim().slice(0,60);
  }catch(e){return "";}
}
let nombreManual=false, consulta=0;
async function autoNombre(){
  const x=leerEnlace($("fEnlace").value);
  if(!x||nombreManual)return;
  const red=x.red||$("fRed").value, n=++consulta;
  $("fTitulo").value=nombreDeUsuario(x.usuario);
  if(red==="tiktok"){
    const t=await nombreTikTok(x.usuario);
    if(t&&n===consulta&&!nombreManual)$("fTitulo").value=t;
  }
}
function iniciales(s){
  const p=String(s||"").trim().split(/\s+/).filter(Boolean);
  return ((p[0]||"?")[0]+(p.length>1?p[p.length-1][0]:"")).toUpperCase();
}
function estado(txt,error){const e=$("estado");e.textContent=txt||"";e.className="estado"+(error?" err":"");}
function el(tag,cls,txt){const e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e;}

function pintarFiltros(){
  const box=$("filtros");box.innerHTML="";
  [["todos","Todos"],...Object.entries(REDES).map(([k,r])=>[k,r.nombre])].forEach(([k,n])=>{
    const cuantos=k==="todos"?perfiles.length:perfiles.filter(p=>p.red===k).length;
    const b=el("button",null,`${n} (${cuantos})`);b.type="button";b.setAttribute("role","tab");
    b.setAttribute("aria-selected",String(filtro===k));b.onclick=()=>{filtro=k;pintar();};box.appendChild(b);
  });
}
// Al abrir se ve directo cada perfil, dentro de la app, con el visor oficial de su red: Instagram (perfil y sus
// últimas publicaciones) y TikTok (perfil y sus videos). YouTube no tiene visor de canal sin su id interno, así que
// queda como enlace. Los visores ya hechos se reutilizan para que no se recarguen con cada cambio de la nube.
const VISOR={
  instagram:u=>`https://www.instagram.com/${encodeURIComponent(u)}/embed/`,
  tiktok:u=>`https://www.tiktok.com/embed/@${encodeURIComponent(u)}`
};
const bloques=new Map();
function altoVisor(red,ancho){return red==="instagram"?Math.round(150+ancho*2/3):420;}
function ajustarAltos(){
  document.querySelectorAll(".visor iframe").forEach(f=>{f.style.height=altoVisor(f.dataset.red,f.clientWidth||f.parentNode.clientWidth)+"px";});
}
function bloque(p){
  const clave=p.red+"|"+p.usuario.toLowerCase();
  const ya=bloques.get(p.id);
  if(ya&&ya.clave===clave)return ya.nodo;
  const r=REDES[p.red], nodo=el("section","visor "+p.red);
  nodo.setAttribute("aria-label",`${p.titulo} en ${r.nombre}`);
  const h=el("div","herr");
  const be=el("button",null,"✎");be.type="button";be.title="Editar";be.setAttribute("aria-label","Editar "+p.titulo);
  be.onclick=()=>abrir(perfiles.find(x=>x.id===p.id)||p);
  const bq=el("button",null,"✕");bq.type="button";bq.title="Quitar";bq.setAttribute("aria-label","Quitar "+p.titulo);
  bq.onclick=()=>quitar(perfiles.find(x=>x.id===p.id)||p);
  h.appendChild(be);h.appendChild(bq);nodo.appendChild(h);
  if(VISOR[p.red]){
    const f=document.createElement("iframe");f.src=VISOR[p.red](p.usuario);f.loading="lazy";f.dataset.red=p.red;
    f.title=`${p.titulo} en ${r.nombre}`;f.setAttribute("allowfullscreen","");f.setAttribute("allow","autoplay; encrypted-media; fullscreen; picture-in-picture");
    f.setAttribute("referrerpolicy","strict-origin-when-cross-origin");
    nodo.appendChild(f);
  }else{
    const a=el("a","enlace");a.href=r.url(p.usuario);a.target="_blank";a.rel="noopener noreferrer";
    a.appendChild(el("div","avatar",iniciales(p.titulo)));
    const d=el("div","datos");d.appendChild(el("b",null,p.titulo));d.appendChild(el("small",null,"Ver su canal en "+r.nombre));
    a.appendChild(d);nodo.appendChild(a);
  }
  bloques.set(p.id,{clave,nodo});
  return nodo;
}
function pintar(){
  pintarFiltros();
  const box=$("lista");
  const lista=perfiles.filter(p=>filtro==="todos"||p.red===filtro).slice().reverse();  // lo más nuevo arriba
  [...box.children].forEach(n=>{if(!lista.some(p=>bloques.get(p.id)?.nodo===n))n.remove();});
  for(const id of [...bloques.keys()])if(!perfiles.some(p=>p.id===id))bloques.delete(id);
  if(!lista.length){box.innerHTML="";box.appendChild(el("div","vacio",perfiles.length?"No hay perfiles de esta red.":"Todavía no hay perfiles. Toca «+ Agregar perfil»."));return;}
  box.querySelector(".vacio")?.remove();
  lista.forEach((p,i)=>{const n=bloque(p);if(box.children[i]!==n)box.insertBefore(n,box.children[i]||null);});
  ajustarAltos();
}
window.addEventListener("resize",ajustarAltos);

async function guardar(nuevos){
  const antes=perfiles;perfiles=nuevos;pintar();
  try{await ref.set({perfiles:nuevos,actualizado:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});estado("Guardado.");}
  catch(e){console.error(e);perfiles=antes;pintar();estado("No se pudo guardar: "+e.message,true);}
}
function quitar(p){
  if(!confirm(`¿Quitar a ${p.titulo} (@${p.usuario}) de la lista?`))return;
  guardar(perfiles.filter(x=>x.id!==p.id));
}

function abrir(p){
  editando=p||null;
  $("modalTitulo").textContent=p?"Editar perfil":"Agregar perfil";
  $("fEnlace").value=p?REDES[p.red].url(p.usuario):"";$("fRed").value=p?p.red:"instagram";
  $("fTitulo").value=p?p.titulo:"";nombreManual=!!p;$("fNota").value=p?(p.nota||""):"";$("fError").textContent="";
  $("modal").classList.remove("oculto");setTimeout(()=>$("fEnlace").focus(),30);
}
function cerrar(){$("modal").classList.add("oculto");editando=null;}
$("btnAgregar").onclick=()=>abrir(null);
$("fCancelar").onclick=cerrar;
$("modal").addEventListener("click",e=>{if(e.target===$("modal"))cerrar();});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!$("modal").classList.contains("oculto"))cerrar();});
let esperaNombre=null;
$("fEnlace").addEventListener("input",()=>{const x=leerEnlace($("fEnlace").value);if(x&&x.red)$("fRed").value=x.red;
  clearTimeout(esperaNombre);esperaNombre=setTimeout(autoNombre,400);});
$("fRed").addEventListener("change",autoNombre);
$("fTitulo").addEventListener("input",()=>{nombreManual=$("fTitulo").value.trim()!=="";});
$("form").addEventListener("submit",e=>{
  e.preventDefault();
  const x=leerEnlace($("fEnlace").value), err=$("fError");
  if(!x){err.textContent="Pega el enlace del perfil (no de un video) o escribe @usuario.";return;}
  const red=x.red||$("fRed").value, titulo=$("fTitulo").value.trim()||nombreDeUsuario(x.usuario), nota=$("fNota").value.trim();
  if(!titulo){err.textContent="Escribe el nombre que se mostrará.";return;}
  const rep=perfiles.find(p=>p.red===red&&p.usuario.toLowerCase()===x.usuario.toLowerCase()&&(!editando||p.id!==editando.id));
  if(rep){err.textContent=`@${x.usuario} ya está en la lista (${rep.titulo}).`;return;}
  const nuevo={id:editando?editando.id:Date.now().toString(36)+Math.random().toString(36).slice(2,6),red,usuario:x.usuario,titulo,nota};
  const lista=editando?perfiles.map(p=>p.id===editando.id?nuevo:p):[...perfiles,nuevo];
  cerrar();guardar(lista);
});

function iniciar(){
  pintar();
  try{
    if(!firebase.apps.length)firebase.initializeApp(FIREBASE_CONFIG);
    ref=firebase.firestore().collection("redesAKC").doc("estado");
    estado("Cargando…");
    ref.onSnapshot(s=>{
      const d=s.exists?s.data():{};
      perfiles=(Array.isArray(d.perfiles)?d.perfiles:[]).filter(p=>p&&REDES[p.red]&&USUARIO_OK.test(p.usuario||"")&&p.titulo);
      estado("");pintar();
      if(window.alRecibirVideos)alRecibirVideos(d.videos);
    },e=>{console.error(e);estado("No se pudo conectar con la nube: "+e.message,true);});
  }catch(e){console.error(e);estado("No se pudo conectar con la nube.",true);}
}
iniciar();
