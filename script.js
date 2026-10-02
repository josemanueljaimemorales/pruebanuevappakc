const urls = {
  planAnual: "modulos/plan-anual/index.html",
  cargas: "modulos/cargas/index.html",
  SISTEMAS: "modulos/sistemas/index.html",
  fuerza: "modulos/fuerza/index.html",
  FuerzaFIG: "modulos/fuerzafig/index.html",
  rutinas: "modulos/rutinas/index.html",
  trabajo: "modulos/gav-training/index.html",
  basicos: "modulos/basicos/index.html",
  normativos: "modulos/normativos/index.html",
  reportes: "modulos/reportes/index.html"
};

const NORMATIVOS_PASSWORD = "Akcgav";
let pendingProtectedUrl = null;

function hideScreens(){
  document.querySelectorAll(".screen").forEach(screen => screen.classList.remove("active"));
}

function openScreen(type){
  if(type === "calendar"){
    hideScreens();
    document.getElementById("calendarScreen").classList.add("active");
    return;
  }

  if(type === "drive"){
    window.location.href = "https://1drv.ms/f/c/55b6a939d4276db6/IgC0lYRLCSV9RpVYk3zc2vS3AfivHxtZwoq3bszrudWQqbw";
    return;
  }

  if(type === "normativos"){
    pendingProtectedUrl = urls.normativos;
    openPassword();
    return;
  }

  const url = urls[type];
  if(!url){goHome();return;}
  showViewer(url);
}

function showViewer(url){
  hideScreens();
  const frame = document.getElementById("viewerFrame");
  if(frame){
    frame.src = "about:blank";
    requestAnimationFrame(() => { frame.src = url; });
  }
  document.getElementById("viewerScreen").classList.add("active");
}

function goHome(){
  hideScreens();
  const frame = document.getElementById("viewerFrame");
  if(frame) frame.src = "about:blank";
  document.getElementById("home").classList.add("active");
  closePassword();
}

function openPassword(){
  const modal = document.getElementById("passwordModal");
  const input = document.getElementById("passwordInput");
  const error = document.getElementById("passwordError");
  if(!modal) return;
  modal.classList.add("show");
  modal.setAttribute("aria-hidden","false");
  error.textContent = "";
  input.value = "";
  setTimeout(() => { try{input.focus();}catch(e){} },100);
}

function closePassword(){
  const modal = document.getElementById("passwordModal");
  if(!modal) return;
  modal.classList.remove("show");
  modal.setAttribute("aria-hidden","true");
  pendingProtectedUrl = null;
}

function checkPassword(){
  const input = document.getElementById("passwordInput");
  const error = document.getElementById("passwordError");
  if(input.value === NORMATIVOS_PASSWORD){
    const url = pendingProtectedUrl;
    closePassword();
    if(url) showViewer(url);
    return;
  }
  error.textContent = "Contraseña incorrecta.";
  input.select();
}

document.addEventListener("keydown", event => {
  const modal = document.getElementById("passwordModal");
  if(modal && modal.classList.contains("show")){
    if(event.key === "Enter"){event.preventDefault();checkPassword();}
    if(event.key === "Escape"){event.preventDefault();closePassword();}
  }
});

window.addEventListener("load", () => {
  hideScreens();
  document.getElementById("home").classList.add("active");
});
