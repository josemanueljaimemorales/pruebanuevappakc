// Gimnasia en redes · Videos: un video grande a la vez y se desliza hacia arriba para ver el siguiente (como TikTok o
// Reels). Los videos se agregan pegando su enlace de Instagram, TikTok o YouTube y se guardan en la misma nube que los
// perfiles: redesAKC/estado.videos = [{id, red, codigo}] (lo más nuevo primero).
// Solo el video que se está viendo y sus vecinos tienen cargado su reproductor; los demás se vacían para que no suenen.
let videos=[], videosNube=[];  // videos = los que se muestran; videosNube = todos (también los ocultos)
const VIDEO={
  instagram:c=>`https://www.instagram.com/p/${encodeURIComponent(c)}/embed/`,
  tiktok:c=>`https://www.tiktok.com/embed/v2/${encodeURIComponent(c)}`,
  youtube:c=>`https://www.youtube.com/embed/${encodeURIComponent(c)}?autoplay=1&mute=1&playsinline=1&loop=1&playlist=${encodeURIComponent(c)}&rel=0`
};
const NOMBRE_RED={instagram:"Instagram",tiktok:"TikTok",youtube:"YouTube"};

// Enlace → {red, codigo}. Los enlaces cortos de TikTok (vm.tiktok.com/…) se resuelven con su servicio oEmbed.
async function leerVideo(txt){
  const t=String(txt||"").trim();
  let m=t.match(/instagram\.com\/(?:[A-Za-z0-9._]+\/)?(?:p|reel|reels|tv)\/([A-Za-z0-9_-]{5,})/i);
  if(m)return {red:"instagram",codigo:m[1]};
  m=t.match(/tiktok\.com\/@[A-Za-z0-9._-]+\/video\/(\d{8,25})/i)||t.match(/tiktok\.com\/(?:embed\/v2|player\/v1)\/(\d{8,25})/i);
  if(m)return {red:"tiktok",codigo:m[1]};
  if(/(vm|vt)\.tiktok\.com\/|tiktok\.com\/t\//i.test(t)){
    try{
      const r=await fetch("https://www.tiktok.com/oembed?url="+encodeURIComponent(t));
      const j=r.ok?await r.json():{};
      if(/^\d{8,25}$/.test(String(j.embed_product_id||"")))return {red:"tiktok",codigo:String(j.embed_product_id)};
    }catch(e){}
    return null;
  }
  m=t.match(/youtu\.be\/([A-Za-z0-9_-]{11})/i)||t.match(/youtube\.com\/(?:shorts|embed|live)\/([A-Za-z0-9_-]{11})/i)||t.match(/youtube\.com\/watch\?[^#]*v=([A-Za-z0-9_-]{11})/i);
  if(m)return {red:"youtube",codigo:m[1]};
  return null;
}
function videoValido(v){
  return v&&VIDEO[v.red]&&typeof v.codigo==="string"&&/^[A-Za-z0-9_-]{5,25}$/.test(v.codigo)&&v.id
    // Los automáticos de Instagram o TikTok sin archivo son los que la red no deja ver fuera de su app (p. ej. reels con
    // música con derechos): su reproductor solo diría "enlace dañado", así que no se muestran.
    &&!(v.auto&&!v.mp4&&v.red!=="youtube")&&!v.foto;  // foto = publicación de fotos de TikTok (no es video)
}

const slides=new Map();
const MP4_OK=/^https:\/\/[^\s"'<>]+$/;
// Con archivo (.mp4, lo renueva la tarea de las 7:00 y 19:00): video propio, a pantalla completa, que arranca solo al
// llegar y se pausa al pasar. Sin archivo (recién agregado, YouTube, o si el archivo ya venció): el reproductor de la red.
function slide(v){
  const ya=slides.get(v.id);
  if(ya){actualizarSlide(ya,v);return ya;}
  const s=document.createElement("section");s.className="slide "+v.red;s.dataset.id=v.id;
  s.setAttribute("aria-label","Video de "+NOMBRE_RED[v.red]);
  if(v.mp4&&MP4_OK.test(v.mp4))ponerVideo(s,v);else ponerIframe(s,v);
  const pie=document.createElement("div");pie.className="pie-video";
  const a=document.createElement("a");a.className="autor";a.target="_blank";a.rel="noopener noreferrer";
  a.href=v.red==="instagram"?`https://www.instagram.com/p/${encodeURIComponent(v.codigo)}/`:v.red==="tiktok"?`https://www.tiktok.com/@${encodeURIComponent(v.perfil||"_")}/video/${encodeURIComponent(v.codigo)}`:`https://www.youtube.com/watch?v=${encodeURIComponent(v.codigo)}`;
  a.textContent=(v.perfil?"@"+v.perfil+" · ":"")+NOMBRE_RED[v.red];
  pie.appendChild(a);s.appendChild(pie);
  const q=document.createElement("button");q.type="button";q.className="quitar";q.textContent="✕";q.title="Quitar video";
  q.setAttribute("aria-label","Quitar este video");q.onclick=()=>quitarVideo(v);
  s.appendChild(q);
  slides.set(v.id,s);observador.observe(s);
  return s;
}
function ponerIframe(s,v){
  s.querySelector("video")?.remove();s.querySelector(".sonido")?.remove();s.classList.remove("nativo","pausado","esperando");
  if(s.querySelector("iframe"))return;
  const f=document.createElement("iframe");f.title="Video de "+NOMBRE_RED[v.red];f.dataset.src=VIDEO[v.red](v.codigo);
  f.setAttribute("allow","autoplay; encrypted-media; fullscreen; picture-in-picture");f.setAttribute("allowfullscreen","");
  f.setAttribute("referrerpolicy","strict-origin-when-cross-origin");
  s.insertBefore(f,s.firstChild);
}
function ponerVideo(s,v){
  s.classList.add("nativo");
  const x=document.createElement("video");x.dataset.src=v.mp4;x.muted=!conSonido;x.loop=true;x.playsInline=true;
  x.setAttribute("playsinline","");x.setAttribute("webkit-playsinline","");x.preload="none";
  if(v.imagen&&MP4_OK.test(v.imagen))x.poster=v.imagen;
  x.addEventListener("loadedmetadata",()=>{x.classList.toggle("horizontal",x.videoWidth>x.videoHeight);});
  x.addEventListener("error",()=>{if(x.getAttribute("src"))ponerAviso(s,v);});  // archivo vencido o que no abre
  x.addEventListener("click",()=>{if(x.paused)x.play().catch(()=>{});else x.pause();});
  x.addEventListener("waiting",()=>s.classList.add("esperando"));
  x.addEventListener("playing",()=>{s.classList.remove("esperando","pausado");cargarCerca();});  // ya puede ir el siguiente
  x.addEventListener("pause",()=>s.classList.add("pausado"));
  s.insertBefore(x,s.firstChild);
  const b=document.createElement("button");b.type="button";b.className="sonido";b.setAttribute("aria-label","Sonido");
  b.textContent=conSonido?"🔊":"🔇";b.onclick=()=>cambiarSonido();
  s.appendChild(b);
}
// Si el archivo no abre (venció y aún no se renueva): aviso con enlace al original, en lugar del reproductor de la red,
// que con estos videos suele decir "enlace dañado".
function ponerAviso(s,v){
  const x=s.querySelector("video");if(x){x.removeAttribute("src");x.load();x.remove();}
  s.querySelector(".sonido")?.remove();s.classList.remove("pausado","esperando");
  if(s.querySelector(".aviso-video"))return;
  const d=document.createElement("div");d.className="aviso-video";
  d.appendChild(document.createTextNode("Este video no se pudo ver aquí."));
  const a=document.createElement("a");a.target="_blank";a.rel="noopener noreferrer";a.href=s.querySelector(".autor")?.href||"#";
  a.textContent="Verlo en "+NOMBRE_RED[v.red];d.appendChild(a);
  if(v.imagen&&MP4_OK.test(v.imagen))s.style.backgroundImage=`url("${v.imagen.replace(/"/g,"%22")}")`;
  s.insertBefore(d,s.firstChild);
}
// La nube trae el archivo renovado: se cambia si ese video no se está reproduciendo.
function actualizarSlide(s,v){
  const x=s.querySelector("video");
  if(v.mp4&&MP4_OK.test(v.mp4)){
    if(!x){s.querySelector("iframe")?.remove();s.querySelector(".aviso-video")?.remove();s.style.backgroundImage="";ponerVideo(s,v);}
    else if(x.dataset.src!==v.mp4&&(x.paused||x.error)){x.dataset.src=v.mp4;if(x.getAttribute("src")){x.src=v.mp4;}}
  }
}
// Sonido: los navegadores solo dejan arrancar solos los videos sin sonido; al tocar 🔇 se activa para todos.
let conSonido=false;
// Ahorro de datos: se prende solo con datos móviles o "ahorro de datos" del celular (si el navegador lo dice; el iPhone
// no lo dice) y se puede cambiar con su botón. Con ahorro no salen los videos muy pesados y el siguiente no se precarga.
const PESO_MAX_AHORRO=12e6;
let ahorro=(()=>{
  try{const g=localStorage.getItem("akcRedesAhorro");if(g==="1"||g==="0")return g==="1";}catch(e){}
  const c=navigator.connection;
  return !!c&&(c.saveData||c.type==="cellular"||/(^|-)(2g|3g)$/.test(c.effectiveType||""));
})();
function pintarAhorro(){const b=$("btnAhorro");if(b){b.setAttribute("aria-pressed",String(ahorro));b.textContent=ahorro?"Ahorro de datos: sí":"Ahorro de datos: no";}}
function cambiarAhorro(){
  ahorro=!ahorro;try{localStorage.setItem("akcRedesAhorro",ahorro?"1":"0");}catch(e){}
  pintarAhorro();pintarVideos();
}
const pesoOk=v=>!ahorro||!v.peso||v.peso<=PESO_MAX_AHORRO;
function cambiarSonido(){
  conSonido=!conSonido;
  $("feed").querySelectorAll("video").forEach(x=>{x.muted=!conSonido;});
  $("feed").querySelectorAll(".sonido").forEach(b=>{b.textContent=conSonido?"🔊":"🔇";});
  const x=videoActual();if(x&&x.paused)x.play().catch(()=>{});
}
function videoActual(){const l=[...$("feed").querySelectorAll(".slide")];return l[actual]&&l[actual].querySelector("video");}
// El video visible se reproduce; el siguiente y el anterior se precargan; los demás se vacían (no suenan ni gastan datos).
let actual=0;
// Primero carga solo el video que se ve; cuando ya se está reproduciendo, empieza a cargar el siguiente (con ahorro de
// datos, solo su inicio). El anterior se conserva si ya estaba cargado; los demás se vacían (no gastan datos ni suenan).
function cargarCerca(){
  const lista=[...$("feed").querySelectorAll(".slide")];
  const visible=!$("feed").classList.contains("oculto");
  const xa=lista[actual]&&lista[actual].querySelector("video");
  const listoActual=!xa||xa.readyState>=3||!xa.paused&&xa.currentTime>0;
  lista.forEach((s,i)=>{
    const d=i-actual, f=s.querySelector("iframe"), x=s.querySelector("video");
    if(f){
      if(visible&&Math.abs(d)<=1&&!f.getAttribute("src"))f.src=f.dataset.src;
      if((!visible||Math.abs(d)>1)&&f.getAttribute("src"))f.removeAttribute("src");
    }
    if(!x)return;
    if(visible&&d===0){
      if(!x.getAttribute("src")){x.preload="auto";x.src=x.dataset.src;}
      x.muted=!conSonido;
      x.play().catch(()=>{if(!x.muted){x.muted=true;conSonido=false;$("feed").querySelectorAll(".sonido").forEach(b=>b.textContent="🔇");x.play().catch(()=>{});}});
    }else if(visible&&d===1&&listoActual){
      if(!x.getAttribute("src")){x.preload=ahorro?"metadata":"auto";x.src=x.dataset.src;}
      x.pause();
    }else if(visible&&(d===-1||d===1)&&x.getAttribute("src")){
      x.pause();
    }else if(x.getAttribute("src")){x.pause();x.removeAttribute("src");x.load();}
  });
}
const observador=new IntersectionObserver(es=>{
  es.forEach(e=>{if(e.isIntersecting){const l=[...$("feed").querySelectorAll(".slide")];actual=Math.max(0,l.indexOf(e.target));cargarCerca();}});
},{root:null,threshold:.6});

// Orden al azar cada vez que se abre el módulo, sin dos seguidos del mismo perfil. Mientras se ven, el orden no cambia;
// los que lleguen de la nube se acomodan al azar más adelante (nunca antes del que se está viendo).
let orden=[], ponerPrimero=null;
// La misma persona en Instagram y TikTok cuenta como un solo perfil (se junta por el nombre de la lista de perfiles).
function perfilDe(v){
  if(!v.perfil)return "manual:"+v.id;
  const u=v.perfil.toLowerCase(), p=(typeof perfiles!=="undefined"?perfiles:[]).find(x=>x.red===v.red&&x.usuario.toLowerCase()===u);
  return p?p.titulo.trim().toLowerCase():u;
}
// Toma al azar de qué perfil sigue (más probable el que tiene más videos), nunca el mismo que el anterior si se puede;
// si un perfil tiene tantos que ya no alcanzarían los demás para separarlos, va ése.
function mezclar(lista){
  const grupos=new Map();
  lista.forEach(v=>{const k=perfilDe(v);if(!grupos.has(k))grupos.set(k,[]);grupos.get(k).push(v);});
  grupos.forEach(g=>{for(let i=g.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[g[i],g[j]]=[g[j],g[i]];}});
  const out=[];let ultimo=null;
  while(out.length<lista.length){
    const vivos=[...grupos].filter(([,g])=>g.length);
    const total=vivos.reduce((t,[,g])=>t+g.length,0);
    const [kMax,gMax]=vivos.reduce((m,x)=>x[1].length>m[1].length?x:m);
    let k;
    if(kMax!==ultimo&&gMax.length>total-gMax.length)k=kMax;
    else{
      const cand=vivos.filter(([kk])=>kk!==ultimo);
      if(!cand.length)k=ultimo;
      else{let r=Math.random()*cand.reduce((t,[,g])=>t+g.length,0);k=cand.find(([,g])=>(r-=g.length)<0)?.[0]||cand[0][0];}
    }
    out.push(grupos.get(k).pop());ultimo=k;
  }
  return out;
}
function ordenar(lista){
  const porId=new Map(lista.map(v=>[v.id,v]));
  if(!orden.length){orden=mezclar(lista).map(v=>v.id);}
  else{
    orden=orden.filter(id=>porId.has(id));
    const nuevos=lista.filter(v=>!orden.includes(v.id));
    nuevos.forEach(v=>{
      if(v.id===ponerPrimero){orden.unshift(v.id);return;}
      const desde=Math.min(orden.length,actual+2), k=desde+Math.floor(Math.random()*(orden.length-desde+1));
      orden.splice(k,0,v.id);
    });
  }
  return orden.map(id=>porId.get(id));
}
function pintarVideos(){
  const feed=$("feed");
  const mostrar=videos.filter(pesoOk);
  for(const [id,s] of slides)if(!mostrar.some(v=>v.id===id)){observador.unobserve(s);s.querySelector("video")?.removeAttribute("src");s.remove();slides.delete(id);}
  feed.querySelector(".vacio")?.remove();
  if(!mostrar.length){const d=document.createElement("div");d.className="vacio";d.textContent="Todavía no hay videos. Toca «+ Video» y pega el enlace de un video de Instagram, TikTok o YouTube.";feed.appendChild(d);return;}
  ordenar(mostrar).forEach((v,i)=>{const s=slide(v);if(feed.children[i]!==s)feed.insertBefore(s,feed.children[i]||null);});
  cargarCerca();
}
window.alRecibirVideos=function(lista){
  videosNube=(Array.isArray(lista)?lista:[]).filter(v=>v&&v.id);
  videos=videosNube.filter(videoValido);
  pintarVideos();
};

// Se guarda la lista completa de la nube (con los ocultos), para no borrar los que esperan que su archivo abra.
async function guardarVideos(nube){
  const antes=[videos,videosNube];videosNube=nube;videos=nube.filter(videoValido);pintarVideos();
  try{await ref.set({videos:nube,actualizado:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});}
  catch(e){console.error(e);[videos,videosNube]=antes;pintarVideos();alert("No se pudo guardar: "+e.message);}
}
function quitarVideo(v){
  if(!confirm("¿Quitar este video?"))return;
  guardarVideos(videosNube.filter(x=>x.id!==v.id));
}

// Pestañas: Videos (al abrir) y Perfiles.
function verPestana(cual){
  const vid=cual==="videos";
  $("tabVideos").setAttribute("aria-selected",String(vid));$("tabPerfiles").setAttribute("aria-selected",String(!vid));
  $("feed").classList.toggle("oculto",!vid);$("vistaPerfiles").classList.toggle("oculto",vid);
  $("btnVideo").classList.toggle("oculto",!vid);
  cargarCerca();  // al salir de Videos se vacían todos, para que no siga sonando
}
$("tabVideos").onclick=()=>verPestana("videos");
$("btnAhorro").onclick=cambiarAhorro;pintarAhorro();
$("tabPerfiles").onclick=()=>verPestana("perfiles");

function abrirVideo(){$("vEnlace").value="";$("vError").textContent="";$("modalVideo").classList.remove("oculto");setTimeout(()=>$("vEnlace").focus(),30);}
function cerrarVideo(){$("modalVideo").classList.add("oculto");}
$("btnVideo").onclick=abrirVideo;
$("vCancelar").onclick=cerrarVideo;
$("modalVideo").addEventListener("click",e=>{if(e.target===$("modalVideo"))cerrarVideo();});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!$("modalVideo").classList.contains("oculto"))cerrarVideo();});
$("formVideo").addEventListener("submit",async e=>{
  e.preventDefault();
  const err=$("vError"), b=$("vGuardar");b.disabled=true;err.textContent="";
  const x=await leerVideo($("vEnlace").value);b.disabled=false;
  if(!x){err.textContent="No reconozco ese enlace. Pega el enlace de un video (reel, post, TikTok o YouTube), no el de un perfil.";return;}
  if(videosNube.some(v=>v.red===x.red&&v.codigo===x.codigo)){err.textContent="Ese video ya está en la lista.";return;}
  const nuevo={id:Date.now().toString(36)+Math.random().toString(36).slice(2,6),red:x.red,codigo:x.codigo};
  cerrarVideo();ponerPrimero=nuevo.id;  // el que se acaba de agregar sale primero
  await guardarVideos([nuevo,...videosNube]);
  $("feed").scrollTo({top:0,behavior:"smooth"});
});
pintarVideos();
