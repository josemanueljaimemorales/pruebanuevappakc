let rows = [];
let currentDay = '';
const home = document.getElementById('home');
const days = document.getElementById('days');
const exerciseView = document.getElementById('exerciseView');
const videoView = document.getElementById('videoView');

const value = (r, ...keys) => {
  for (const k of keys) if (r && r[k] != null && String(r[k]).trim() !== '') return String(r[k]).trim();
  return '';
};
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

async function init(){
  try{
    const res = await fetch('./AKC_FuerzaFIG.xlsx',{cache:'no-store'});
    if(!res.ok) throw new Error(`No se pudo cargar AKC_FuerzaFIG.xlsx (HTTP ${res.status})`);
    const buf = await res.arrayBuffer();
    const wb = XLSX.read(buf);
    const ws = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(ws,{defval:''});
    if(!rows.length) throw new Error('El Excel está vacío.');

    const dayValues = [...new Set(rows.map(r=>value(r,'Dia','DÍA','dia')).filter(Boolean))];
    days.innerHTML = '';
    dayValues.forEach(day=>{
      const count = rows.filter(r=>value(r,'Dia','DÍA','dia')===day).length;
      const btn = document.createElement('button');
      btn.className='dayBtn';
      btn.type='button';
      btn.dataset.day=day;
      btn.innerHTML=`💪 ${esc(day)}<br><small>${count} ejercicios</small>`;
      days.appendChild(btn);
    });
  }catch(err){
    days.innerHTML=`<div class="card"><h2>No se pudo cargar Fuerza FIG</h2><p>${esc(err.message)}</p></div>`;
    console.error(err);
  }
}

function showDay(day){
  currentDay=day;
  home.classList.add('hidden');
  videoView.classList.add('hidden');
  exerciseView.classList.remove('hidden');
  const list=rows.filter(r=>value(r,'Dia','DÍA','dia')===day);
  exerciseView.innerHTML='';

  const back=document.createElement('button');
  back.className='back'; back.type='button'; back.dataset.action='home'; back.textContent='🏠 Inicio';
  exerciseView.appendChild(back);
  const title=document.createElement('h2'); title.textContent=day; exerciseView.appendChild(title);

  list.forEach(r=>{
    const e=value(r,'Ejercicio','ejercicio');
    const s=value(r,'Segmento','segmento');
    const l=value(r,'Link','link');
    const card=document.createElement('div'); card.className='exercise';
    card.innerHTML=`<h3>${esc(e)}</h3><div class="segment">${esc(s)}</div>`;
    if(l){
      const b=document.createElement('button'); b.type='button'; b.textContent='▶ Ver ejercicio'; b.dataset.video=l; b.dataset.name=e; b.dataset.segment=s; card.appendChild(b);
    } else card.insertAdjacentHTML('beforeend','<div class="segment">Sin enlace de video</div>');
    exerciseView.appendChild(card);
  });
}

function videoId(url){
  const u=String(url||'');
  if(u.includes('/shorts/')) return u.split('/shorts/')[1].split(/[?&]/)[0];
  if(u.includes('youtu.be/')) return u.split('youtu.be/')[1].split(/[?&]/)[0];
  if(u.includes('v=')) return u.split('v=')[1].split('&')[0];
  return '';
}
function showVideo(url,name,seg){
  const id=videoId(url);
  exerciseView.classList.add('hidden');
  videoView.classList.remove('hidden');
  videoView.innerHTML=`<div class="videoCard"><button class="back" type="button" data-action="back">⬅ Regresar</button><h2>${esc(name)}</h2><p>${esc(seg)}</p>${id?`<iframe src="https://www.youtube.com/embed/${encodeURIComponent(id)}" allowfullscreen></iframe>`:`<p>No se pudo interpretar el enlace del video.</p>`}</div>`;
}
function goHome(){exerciseView.classList.add('hidden');videoView.classList.add('hidden');home.classList.remove('hidden');}
function backExercises(){videoView.classList.add('hidden');exerciseView.classList.remove('hidden');}

days.addEventListener('click',e=>{const b=e.target.closest('[data-day]'); if(b) showDay(b.dataset.day);});
exerciseView.addEventListener('click',e=>{
  const b=e.target.closest('button'); if(!b) return;
  if(b.dataset.action==='home') return goHome();
  if(b.dataset.video) return showVideo(b.dataset.video,b.dataset.name,b.dataset.segment);
});
videoView.addEventListener('click',e=>{const b=e.target.closest('[data-action="back"]'); if(b) backExercises();});

init();
