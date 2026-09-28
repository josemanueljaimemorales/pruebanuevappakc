let datos=[];fetch('data/sistemas.json').then(r=>r.json()).then(d=>{datos=d;dibujar(d);});
function dibujar(arr){const l=document.getElementById('lista');l.innerHTML='';arr.forEach(s=>{let b=document.createElement('button');b.className='sys';b.textContent=s.nombre;b.onclick=()=>{menu.style.display='none';visor.classList.remove('oculto');foto.src='img/'+s.archivo;};l.appendChild(b);});}
buscar.oninput=e=>dibujar(datos.filter(x=>x.nombre.toLowerCase().includes(e.target.value.toLowerCase())));
volver.onclick=()=>{visor.classList.add('oculto');menu.style.display='block';foto.src='';};