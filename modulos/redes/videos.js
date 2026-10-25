// Gimnasia en redes · Videos: un video grande a la vez y se desliza hacia arriba para ver el siguiente (como TikTok o
// Reels). Los videos se agregan pegando su enlace de Instagram, TikTok o YouTube y se guardan en la misma nube que los
// perfiles: redesAKC/estado.videos = [{id, red, codigo}] (lo más nuevo primero).
// Solo el video que se está viendo y sus vecinos tienen cargado su reproductor; los demás se vacían para que no suenen.
let videos=[];
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
  return v&&VIDEO[v.red]&&typeof v.codigo==="string"&&/^[A-Za-z0-9_-]{5,25}$/.test(v.codigo)&&v.id;
}

const slides=new Map();
function slide(v){
  const ya=slides.get(v.id);if(ya)return ya;
  const s=document.createElement("section");s.className="slide "+v.red;s.dataset.id=v.id;
  s.setAttribute("aria-label","Video de "+NOMBRE_RED[v.red]);
  const f=document.createElement("iframe");f.title="Video de "+NOMBRE_RED[v.red];f.dataset.src=VIDEO[v.red](v.codigo);
  f.setAttribute("allow","autoplay; encrypted-media; fullscreen; picture-in-picture");f.setAttribute("allowfullscreen","");
  f.setAttribute("referrerpolicy","strict-origin-when-cross-origin");
  const q=document.createElement("button");q.type="button";q.className="quitar";q.textContent="✕";q.title="Quitar video";
  q.setAttribute("aria-label","Quitar este video");q.onclick=()=>quitarVideo(v);
  s.appendChild(f);s.appendChild(q);
  slides.set(v.id,s);observador.observe(s);
  return s;
}
// Carga el reproductor del video visible y sus vecinos; vacía los demás (así deja de sonar el que ya pasó).
let actual=0;
function cargarCerca(){
  const lista=[...$("feed").querySelectorAll(".slide")];
  lista.forEach((s,i)=>{
    const f=s.querySelector("iframe"), cerca=Math.abs(i-actual)<=1;
    if(cerca&&!f.getAttribute("src"))f.src=f.dataset.src;
    if(!cerca&&f.getAttribute("src"))f.removeAttribute("src");
  });
}
const observador=new IntersectionObserver(es=>{
  es.forEach(e=>{if(e.isIntersecting){const l=[...$("feed").querySelectorAll(".slide")];actual=Math.max(0,l.indexOf(e.target));cargarCerca();}});
},{root:null,threshold:.6});

function pintarVideos(){
  const feed=$("feed");
  for(const [id,s] of slides)if(!videos.some(v=>v.id===id)){observador.unobserve(s);s.remove();slides.delete(id);}
  feed.querySelector(".vacio")?.remove();
  if(!videos.length){const d=document.createElement("div");d.className="vacio";d.textContent="Todavía no hay videos. Toca «+ Video» y pega el enlace de un video de Instagram, TikTok o YouTube.";feed.appendChild(d);return;}
  videos.forEach((v,i)=>{const s=slide(v);if(feed.children[i]!==s)feed.insertBefore(s,feed.children[i]||null);});
  cargarCerca();
}
window.alRecibirVideos=function(lista){
  videos=(Array.isArray(lista)?lista:[]).filter(videoValido);
  pintarVideos();
};

async function guardarVideos(nuevos){
  const antes=videos;videos=nuevos;pintarVideos();
  try{await ref.set({videos:nuevos,actualizado:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});}
  catch(e){console.error(e);videos=antes;pintarVideos();alert("No se pudo guardar: "+e.message);}
}
function quitarVideo(v){
  if(!confirm("¿Quitar este video?"))return;
  guardarVideos(videos.filter(x=>x.id!==v.id));
}

// Pestañas: Videos (al abrir) y Perfiles.
function verPestana(cual){
  const vid=cual==="videos";
  $("tabVideos").setAttribute("aria-selected",String(vid));$("tabPerfiles").setAttribute("aria-selected",String(!vid));
  $("feed").classList.toggle("oculto",!vid);$("vistaPerfiles").classList.toggle("oculto",vid);
  $("btnVideo").classList.toggle("oculto",!vid);
  if(vid)cargarCerca();
  else $("feed").querySelectorAll("iframe[src]").forEach(f=>f.removeAttribute("src"));  // que no siga sonando
}
$("tabVideos").onclick=()=>verPestana("videos");
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
  if(videos.some(v=>v.red===x.red&&v.codigo===x.codigo)){err.textContent="Ese video ya está en la lista.";return;}
  const nuevo={id:Date.now().toString(36)+Math.random().toString(36).slice(2,6),red:x.red,codigo:x.codigo};
  cerrarVideo();
  await guardarVideos([nuevo,...videos]);
  $("feed").scrollTo({top:0,behavior:"smooth"});
});
pintarVideos();
