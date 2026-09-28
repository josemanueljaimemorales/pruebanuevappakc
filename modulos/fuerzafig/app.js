let rows=[];
let currentDay='';

async function init(){
 try{
  const res=await fetch('./AKC_FuerzaFIG.xlsx', {cache:'no-store'});
  if(!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf=await res.arrayBuffer();
  const wb=XLSX.read(buf);
  const ws=wb.Sheets[wb.SheetNames[0]];
  rows=XLSX.utils.sheet_to_json(ws);
  if(!rows.length) throw new Error('El Excel está vacío.');

  const days=[...new Set(rows.map(r=>r.Dia||r.DÍA||r.dia).filter(Boolean))];
  const container=document.getElementById('days');
  container.innerHTML='';
  days.forEach(d=>{
   const count=rows.filter(r=>(r.Dia||r.DÍA||r.dia)==d).length;
   container.innerHTML += `<button class='dayBtn' onclick="showDay(${JSON.stringify(d)})">💪 ${d}<br><small>${count} ejercicios</small></button>`;
  });
 }catch(err){
  document.getElementById('days').innerHTML=`<div class="card"><h2>No se pudo cargar Fuerza FIG</h2><p>${err.message}</p><p>Verifica que <b>AKC_FuerzaFIG.xlsx</b> esté en la misma carpeta que este módulo.</p></div>`;
  console.error(err);
 }
}

function showDay(day){
 currentDay=day;
 document.getElementById('home').classList.add('hidden');
 const div=document.getElementById('exerciseView');
 div.classList.remove('hidden');
 const list=rows.filter(r=>(r.Dia||r.DÍA||r.dia)==day);
 let html=`<button class='back' onclick='goHome()'>🏠 Inicio</button><h2>${day}</h2>`;
 list.forEach(r=>{
   const e=r.Ejercicio||r.ejercicio||'';
   const s=r.Segmento||r.segmento||'';
   const l=r.Link||r.link||'';
   html+=`<div class='exercise'><h3>${e}</h3><div class='segment'>${s}</div>${l?`<button onclick="showVideo(${JSON.stringify(l)},${JSON.stringify(e)},${JSON.stringify(s)})">▶ Ver ejercicio</button>`:'<div class="segment">Sin enlace de video</div>'}</div>`;
 });
 div.innerHTML=html;
}

function showVideo(url,name,seg){
 let id='';
 if(url.includes('/shorts/')) id=url.split('/shorts/')[1].split('?')[0];
 else if(url.includes('v=')) id=url.split('v=')[1].split('&')[0];
 else if(url.includes('youtu.be/')) id=url.split('youtu.be/')[1].split('?')[0];
 const v=document.getElementById('videoView');
 document.getElementById('exerciseView').classList.add('hidden');
 v.classList.remove('hidden');
 v.innerHTML=`<div class='videoCard'><button class='back' onclick='backExercises()'>⬅ Regresar</button><h2>${name}</h2><p>${seg}</p>${id?`<iframe src='https://www.youtube.com/embed/${id}' allowfullscreen></iframe>`:`<p>No se pudo interpretar el enlace del video.</p>`}</div>`;
}

function backExercises(){
 document.getElementById('videoView').classList.add('hidden');
 document.getElementById('exerciseView').classList.remove('hidden');
}
function goHome(){
 document.getElementById('exerciseView').classList.add('hidden');
 document.getElementById('videoView').classList.add('hidden');
 document.getElementById('home').classList.remove('hidden');
}
init();
