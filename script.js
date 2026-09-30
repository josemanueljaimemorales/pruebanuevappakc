const MODULES={
  basicos:'modulos/basicos/index.html',
  sistemas:'modulos/sistemas/index.html',
  fuerza:'modulos/fuerza/index.html',
  rutinas:'modulos/rutinas/index.html',
  cargas:'modulos/cargas/index.html',
  'gav-training':'modulos/gav-training/index.html',
  normativos:'modulos/normativos/index.html',
  'plan-anual':'modulos/plan-anual/index.html'
};
const viewer=document.getElementById('viewer');
const frame=document.getElementById('frame');
document.querySelectorAll('[data-module]').forEach(btn=>btn.addEventListener('click',()=>{
  const url=MODULES[btn.dataset.module];
  if(!url)return;
  frame.src=url;
  viewer.classList.remove('hidden');
}));
document.getElementById('back').onclick=()=>{frame.src='';viewer.classList.add('hidden')};


const archivosBtn=document.getElementById('archivos-planificacion');
archivosBtn.addEventListener('click',()=>{
  const url=(window.CLIENTE&&window.CLIENTE.onedrive||'').trim();
  if(!url){
    alert('Configura el enlace de OneDrive en cliente/config.js');
    return;
  }
  window.open(url,'_blank','noopener,noreferrer');
});
