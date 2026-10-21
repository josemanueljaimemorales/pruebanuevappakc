/* AKC Rutinas – Editor con cálculo de NP (Código FIG 2025-2028, FMG N9/N10, USAG N7/N8) */
const FB_CONFIG={apiKey:"AIzaSyBNRAkDXLlw5fyiT01-ZfUyB0A7ShsAxyg",authDomain:"akc-con-reporte.firebaseapp.com",projectId:"akc-con-reporte"};
const COLLECTION='rutinasAKC', DOC='estado', LOCAL='rutinasAKC_estado';
const APS=[['PISO','Piso'],['ARZON','Arzón'],['ANILLOS','Anillos'],['SALTO','Salto'],['PARALELAS','Paralelas'],['FIJA','Fija']];
const NP_COL={PISO:'PISO',ARZON:'ARZON',ANILLOS:'ANILLO',SALTO:'SALTO',PARALELAS:'PARALELA',FIJA:'FIJA'};
const NIVELES=['N7','N8','N9','N10','FIG'];
const LV={A:.1,B:.2,C:.3,D:.4,E:.5,F:.6,G:.7,H:.8,I:.9,J:1};
const ROM=['','I','II','III','IV'];
// Saltos en N7 y N8: valores propios de USAG (tabla de modificaciones del MDP y boletines #4 y #5); los demás saltos
// llevan el valor FIG. En N7 y N8 el valor no se escribe a mano: sale de esta tabla.
const VAULT_USAG={'3|307':2.2,'3|308':2.4,'3|313':3.2,'5|507':2.2,'5|509':2.4,'5|510':3.2,'2|207':2.4,'2|213':3.2,'1|107':3.6,'2|219':4.0,'1|113':4.2,'1|114':4.2,'1|119':2.8};
function vaultUSAG(r){if(!r.k||!CAT[r.k])return r.v||0;const p=r.k.split('|');const v=VAULT_USAG[p[1]+'|'+p[2]];
  if(v!=null)return v;const t=txt(r);
  if(/ kasamatsu /.test(t)&&/ (agrupado|agr|en c|tucked) /.test(t)&&!/ (ext|extendido|carpa|giro) /.test(t))return 2.8;
  return CAT[r.k].v??r.v??0;}

let OBL={rut:{},salto:{},omit:{}}, CAT={}, ALIAS={}, FIX={}, EXCEL=null, WB=null, ORDER=[];
let S={atletas:{},alias:{},bajas:[],obl:{atletas:{},orden:[],bajas:[]}};
let ui={view:'menu',atleta:null,ap:'PISO',open:-1,q:'',replace:-1};
let cloud=null, saveTimer=null, syncState=['', 'Cargando…'];
const root=document.getElementById('ed');

/* ---------- utilidades ---------- */
const r1=x=>Math.round(x*10+1e-9)/10;
const f1=x=>(Math.round(x*10+1e-9)/10).toFixed(1);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function nk(s){return String(s??'').replace(/½/g,' 1/2 ').replace(/¼/g,' 1/4 ').replace(/¾/g,' 3/4 ').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9/]+/g,' ').trim();}
// Texto para las reglas: el apodo que escribió el entrenador + el elemento del Código seleccionado (español e inglés).
// Así cada regla revisa las dos cosas (doble revisión).
function txt(r){const c=r&&r.k&&CAT[r.k];return ' '+nk((r?.n||'')+' '+(c?c.d+' '+(c.en||''):''))+' ';}
// Piso: elementos que cubren la balanza en una pierna (planchas I.61/I.62, arabesca, flick facial o salto con giro a facial).
const esBalanza=r=>r.k==='PISO|1|61'||r.k==='PISO|1|62'||/ (arabesc[a-z]*|fli(c|ck|k)( flac)? facial|salto( con)?( [a-z0-9/]+)? giro a facial) /.test(txt(r));
// Paralelas: elementos que llegan a manos balanceando atrás, y lo que puede seguir sin valor en la misma dirección.
// Paralelas: elementos que terminan balanceando atrás. La braquial subida de pecho, si no lleva corte adelante,
// termina por naturaleza con un vuelo atrás (criterio de Manu).
const llegaAManos=r=>{const t=txt(r);return r.k==='PARALELAS|2|1'||/ (vuelo|imp(ulso)? a manos) /.test(t)||((/ (braq(uial)? subida de pecho|pechada) /.test(t)||r.k==='PARALELAS|1|1')&&!/ corte /.test(t))||(/ moy /.test(t)&&!/ (ap inv|apoyo invertido|handstand|hdst|braq|braquial|upper arm|mortal|salto|tippelt|nolet|giraldo) /.test(t));};
const PV_OPC={medio:'Cambio (½ giro)',giro:'Giro completo',healy:'Healy',gatson:'Gatson'};
// Barra fija: después de llegar a parada de manos (alemana/kip a manos) puede hacer un cambio sencillo sin valor y seguir a gigante.
const FV_OPC={cs:'Cambio sencillo'};
const PV_TXT=v=>PV_OPC[v]||FV_OPC[v]||'';
// Alemana / kip a parada de manos: por el nombre o por el elemento del Código (III.1, báscula de impulso al apoyo invertido).
const kipAManos=r=>{if(r.k==='FIJA|3|1')return true;const t=txt(r);
  // Con giro (p. ej. dominación atrás con ½ giro = cambio sencillo) ya cambia de dirección: no cuenta.
  return / (alemana|aleman|kip|kipe|kippe|bascula|dominacion at(ras)?) /.test(t)&&/ (a manos|apoyo invertido|ap inv|hdst|handstand) /.test(t)&&!/ (1\/2 g|1\/2 giro|1\/2 turn|1\/2 t|con giro|turn|cambio) /.test(t);};
const nameKey=v=>String(v??'').toUpperCase().replace(/\s+/g,'');
function normLevel(v){v=String(v||'').toUpperCase().replace(/\s+/g,'');if(v==='NFIG'||v==='FIG')return'FIG';const m=v.match(/^N?(7|8|9|10)$/);return m?'N'+m[1]:'FIG';}
function table(ap,nivel){return nivel==='N8'&&ap==='ARZON'?'N8ARZON':'FIG';}
// Arzón N8 (boletines MDP): los recorridos con spindle del Código FIG que no estén en la tabla de nivel 8 se reconocen
// con su valor FIG, excepto Nin Reyes 2 (III.23).
function n8RecorridoSpindle(k){return /^ARZON\|3\|/.test(k)&&k!=='ARZON|3|23'&&/spindle|eichorn/i.test(CAT[k]?.en||'');}

/* ---------- búsqueda ---------- */
const STOP=new Set(['con','en','de','del','la','el','a','al','o','y','tambien','por','desde','lc','las','los','un','una','s']);
const SYN={fwd:'ad',forward:'ad',bwd:'at',backward:'at',back:'at',str:'ext',straight:'ext',stretched:'ext',layout:'ext',tuck:'agr',tucked:'agr',t:'g',pike:'carp',piked:'carp',p:'carp',double:'dob',dbl:'dob',salto:'mort',turn:'g',turns:'g',w:'con',with:'con',adelante:'ad',adel:'ad',ade:'ad',frente:'ad',atras:'at',atr:'at',agrupado:'agr',agru:'agr',agrup:'agr',carpado:'carp',carpa:'carp',c:'agr',v:'carp',extendido:'ext',extendida:'ext',giro:'g',giros:'g',mortal:'mort',mortales:'mort',doble:'dob',triple:'tri',piernas:'p',abiertas:'ab',apoyo:'ap',invertido:'inv',salida:'sal'};
function canon(s){
  s=' '+nk(s)+' ';
  s=s.replace(/(\d\/\d)([a-z])/g,'$1 $2')
   .replace(/ (dos|2) giros? y medio /g,' 5/2 g ').replace(/ (uno|un|1) giro y medio /g,' 3/2 g ').replace(/ (tres|3) giros? y medio /g,' 7/2 g ')
   .replace(/ (dos|2) giros /g,' 2/1 g ').replace(/ (tres|3) giros /g,' 3/1 g ').replace(/ (cuatro|4) giros /g,' 4/1 g ').replace(/ giro completo /g,' 1/1 g ')
   .replace(/ doble giro y medio /g,' 5/2 g ').replace(/ giro y medio /g,' 3/2 g ').replace(/ doble giro /g,' 2/1 g ').replace(/ triple giro /g,' 3/1 g ').replace(/ medio giro /g,' 1/2 g ');
  return s.trim().split(' ').map(t=>SYN[t]||t).filter(t=>t&&!STOP.has(t));
}
let INDEX=[];
function buildIndex(){
  INDEX=Object.entries(CAT).map(([k,e])=>({k,toks:canon(e.d+' '+(e.en||''))}));
}
function search(q,ap,nivel){
  const tab=table(ap,nivel), qn=nk(q), qt=canon(q); if(!qn)return[];
  const out=new Map();
  const add=(k,score,name)=>{const p=out.get(k);if(!p||p.score<score)out.set(k,{k,score,name});};
  // alias (aprendidos y del Excel)
  const pre=`${tab}|${ap}|`;
  for(const src of [S.alias,ALIAS]) for(const [ak,k] of Object.entries(src)){
    if(!ak.startsWith(pre)||!CAT[k])continue; const an=ak.slice(pre.length);
    // Protección doble/triple solo para los apodos de fábrica; los que enseñan los entrenadores se respetan.
    if(src===ALIAS){const ct=canon(CAT[k].d), ca=canon(an); if((ct.includes('dob')&&!ca.includes('dob'))||(ct.includes('tri')&&!ca.includes('tri')))continue;}
    let sc=0; if(an===qn)sc=3; else if(an.startsWith(qn))sc=2.4; else if(an.includes(qn))sc=2;
    else{const at=canon(an);const hit=qt.filter(t=>at.some(a=>a.startsWith(t))).length;if(hit===qt.length&&hit)sc=1.6;}
    if(sc)add(k,sc,an);
  }
  // ID escrito: 2.16 o 16
  const idm=qn.match(/^(?:([1-4])[ .])?(\d{1,3})$/);
  const pref=tab==='N8ARZON'?'N8ARZON|':ap+'|';
  for(const it of INDEX){
    if(!it.k.startsWith(pref)&&!(tab==='N8ARZON'&&n8RecorridoSpindle(it.k)))continue;
    if(idm){const [,g,id]=it.k.split('|');if(id===idm[2]&&(!idm[1]||g===idm[1]))add(it.k,2.2);continue;}
    const hit=qt.filter(t=>it.toks.some(a=>a.startsWith(t))).length;
    if(hit&&hit>=Math.max(1,qt.length-1)){
      const extra=it.toks.filter(a=>!qt.some(t=>a.startsWith(t)));
      let sc=hit/qt.length*(hit===qt.length?1.5:1)-0.03*extra.length;
      if(extra.some(a=>a==='dob'||a==='tri'))sc-=.5;
      add(it.k,sc);}
  }
  // N7 y N8: elementos juveniles / virtuales de USAG (valen A 0.1). Escribir "juvenil" o "virtual" los muestra todos.
  if(nivel==='N7'||nivel==='N8')for(const it of INDEX){
    if(!it.k.startsWith('JA|'+ap+'|'))continue;
    if(/^(juv|virt|ja$)/.test(qn)){add(it.k,3);continue;}
    const hit=qt.filter(t=>it.toks.some(a=>a.startsWith(t))).length;
    if(hit===qt.length&&hit)add(it.k,2.5); else if(hit&&hit>=qt.length-1)add(it.k,1.2);
  }
  return [...out.values()].sort((a,b)=>b.score-a.score||CAT[a.k].d.length-CAT[b.k].d.length).slice(0,/^(juv|virt|ja$)/.test(qn)?12:8);
}

/* ---------- filas ---------- */
// Apodo más usado para un elemento del Código en las rutinas de los atletas (si no hay, null).
function apodoDe(k){const c=new Map(),desc=nk(CAT[k]?.d||'');
  for(const x of Object.values(S.atletas||{}))for(const rows of Object.values(x?.r||{}))for(const o of rows||[])
    if(o.k===k&&o.n&&!/^\d/.test(o.n)&&nk(o.n)!==desc)c.set(o.n.trim(),(c.get(o.n.trim())||0)+1);
  let mejor=null,max=0;for(const [n,v] of c)if(v>max){max=v;mejor=n;}return mejor;}
function rowFromKey(k,name){
  const e=CAT[k]; const p=k.split('|');
  name=name||apodoDe(k);
  if(p[0]==='JA')return{n:name||e.d,k,t:'JA',l:'A',g:null,id:'JA'};
  const g=+p[1], id=p[2];
  if(p[0]==='SALTO'){const lvl=ui.atleta&&S.atletas[ui.atleta]?.nivel;const ov=(lvl==='N7'||lvl==='N8')?vaultUSAG({k,n:name||e.d}):null;return{n:name||e.d,k,t:'C',g,id,v:ov??e.v??0};}
  return{n:name||e.d,k,t:'C',l:e.l,g:g||null,id};
}
function keyLabel(r){
  if(r.t==='JA')return'Juvenil A';
  if(!r.g&&!r.id)return'Manual';
  if(!r.id)return `Grupo ${ROM[r.g]||'–'} · manual`;
  return `${ROM[r.g]||'–'}.${r.id}`;
}
function learn(name,ap,nivel,k){const n=nk(name);if(n)S.alias[`${table(ap,nivel)}|${ap}|${n}`]=k;}
function resolve(name,ap,nivel){
  const n=nk(name), tab=table(ap,nivel);
  return S.alias[`${tab}|${ap}|${n}`]||ALIAS[`${tab}|${ap}|${n}`]||null;
}

/* ---------- carga desde Excel ---------- */
function seedAthlete(name,nivel){
  const rows=EXCEL.filter(r=>String(r.ATLETA).trim()===name);
  const rut={};
  for(const [ap] of APS){
    rut[ap]=[];
    for(const x of rows.filter(r=>String(r.APARATO).trim()===ap)){
      let n=String(x.ELEMENTO??'').trim(); if(!n||n==='0')continue;
      let conn=false, ct=false, gig=null;
      for(let k=0;k<3;k++){
        {const mm=n.match(/\s+a\s+(gigante|molino)\s*$/i);if(mm&&ap==='FIJA'){gig=mm[1].toLowerCase();n=n.replace(/\s+a\s+(gigante|molino)\s*$/i,'').trim();}}
        if(/\s*conectad[oa]\s+a\s*$/i.test(n)){conn=true;n=n.replace(/\s*conectad[oa]\s+a\s*$/i,'').trim();}
        if(/\s+a\s+cambio\s+de\s+toma\s*$/i.test(n)){ct=true;n=n.replace(/\s+a\s+cambio\s+de\s+toma\s*$/i,'').trim();}
      }
      const xid=String(x['NÚM DE ID']??'').trim(), xg=String(x.GRUPO??'').trim(), xl=String(x.VALOR??'').trim().toUpperCase();
      const exTxt=`Excel: ${xg}.${xid} ${xl}`;
      const own=`${ap}|${xg}|${xid}`, nn0=nk(n);
      if(ap==='SALTO'){
        const k=FIX[`${ap}|${nn0}`]||own; const v=parseFloat(x.VALOR)||0;
        const row=CAT[k]?rowFromKey(k,n):{n,k:null,t:'M',g:+xg||null,id:xid};
        row.v=v; if(conn)row.c=true; rut[ap].push(row); continue;
      }
      let k=null;
      if(table(ap,nivel)==='N8ARZON')k=resolve(n,ap,nivel);
      if(!k)k=FIX[`${ap}|${nn0}`]||(CAT[own]?own:null)||resolve(n,ap,nivel);
      let row;
      if(k&&CAT[k]){row=rowFromKey(k,n);
        if(row.t==='C'&&table(ap,nivel)==='FIG'&&(row.l!==xl||k!==own))row.ex=exTxt;}
      else row={n,k:null,t:'M',l:LV[xl]?xl:'A',g:+xg||null,id:xid,nf:1};
      if(nivel==='N8'){const nn=nk(n);
        if(ap==='ANILLOS'&&/a manos|^l sit$/.test(nn))row.gx=3;
        if(ap==='FIJA'&&/^endo|weiler|torera|voronin/.test(nn))row.gx=2;}
      if(conn)row.c=true;
      if(ct)row.ct=true;
      if(gig)row.gig=gig;
      rut[ap].push(row);
    }
  }
  return{nivel,r:rut,p:{}};
}
function readLevels(){
  const lv={};
  for(const sn of WB.SheetNames){
    const a=XLSX.utils.sheet_to_json(WB.Sheets[sn],{header:1,range:0,defval:''})[0]||[];
    for(const c of a)if(typeof c==='string'&&/^N\s*(7|8|9|10|FIG)$/i.test(c.trim()))lv[nameKey(sn)]=normLevel(c);
  }
  return lv;
}

/* ---------- cálculo de NP ---------- */
function valOf(r,nivel,ap){if(r.t==='JA')return (nivel==='N7'||nivel==='N8')?.1:0;if(r.v!=null&&!r.l)return r.v;
  let v=LV[r.l]||0; if(nivel==='N7'||nivel==='N8'){const x=usagValor(r,nivel,ap||(r.k||'').split('|')[0],v);if(x!=null)v=x;} return v;}
// Excepciones de valor de USAG (MDP 2025-2028):
// - Anillos N7-N8: plancha abierta, plancha y elementos de grupo II/III que terminan en ellas suben una letra
//   (II.19, II.9, III.56, III.58, III.68, III.70, III.82; boletines MDP #2-#6).
// - Paralelas N8: Stutz o gigante al apoyo valen B y cubren grupo (tabla de nivel 8).
const USAG_ANILLOS_SUBE=new Set(['ANILLOS|2|19','ANILLOS|2|9','ANILLOS|3|56','ANILLOS|3|58','ANILLOS|3|68','ANILLOS|3|70','ANILLOS|3|82']);
function n8StutzGigante(r){const t=txt(r);
  return / (stutz|stuts|stutzkehr|stuetzkehr|gigante|giant) /.test(t)&&/ (apoyo|support|sup) /.test(t)&&!/ (apoyo invertido|ap inv|parada de manos|handstand|hdst|a manos) /.test(t);}
function usagValor(r,nivel,ap,v){
  if(r.k&&USAG_ANILLOS_SUBE.has(r.k)&&v>0)return r1(v+.1);
  if(nivel==='N8'&&ap==='PARALELAS'&&v<.2&&n8StutzGigante(r))return .2;
  return null;}
function grpOf(r,ap,nivel){
  if(r.t==='JA'||!r.g)return null;
  // En Anillos N8 el grupo III solo lo da la parada de manos (un "III" marcado a mano en otro elemento ya no aplica).
  if(nivel==='N8'&&ap==='ANILLOS'){if(n8ParadaAnillos(r))return 3;if(r.gx&&r.gx!==3)return r.gx;return r.g===3?2:r.g;}
  if(nivel==='N8'){if(r.gx)return r.gx;
    if(ap==='FIJA'&&r.g===3&&n8FijaAdelante(r))return 2;}
  return r.g;
}
// Tabla de grupos de USAG para nivel 8 (MDP, "Table of Element Groups and Rules for Level 8 Competition"):
// Anillos: grupo III = parada de manos sostenida 2 s (llegue a fuerza o con impulso); cualquier otro elemento FIG II o III cubre el grupo II.
// Barra fija: grupo II = cualquier soltada o elemento en la barra hacia adelante / toma cubital (Endo, Adler, Weiler…);
// grupo III = elementos en la barra hacia atrás con toma palmar (Stalder, giro libre atrás…).
function n8ParadaAnillos(r){const en=(r.k&&CAT[r.k]?.en)||'', t=' '+nk(r.n)+' ';
  const porCodigo=!!en&&/\bto (hdst|handstand)/i.test(en)&&!/\b(through|thr\.)/i.test(en);
  const porApodo=/ (parada de manos|apoyo invertido|ap inv|pdm|a manos) /.test(t)&&!/ (desde|por el|por la) /.test(t);
  return porCodigo||porApodo;}
function n8FijaAdelante(r){const t=txt(r);
  if(/ stalder /.test(t))return false;
  return / (fwd|endo|adler|weiler|whaler|el grip|ungr|steineman|koste|carballo|quintero|fuentes|baldauf|adelante|al frente|cubital) /.test(t);}
function dirOf(it){if(it.grp===2)return'ad';if(it.grp===3)return'at';
  const t=txt(it.r);
  if(/ (adelante|ad|frente|ade|adel) /.test(t))return'ad'; if(/ (atras|at|atr) /.test(t))return'at'; return'';}
// Número de medios giros (twist) de un elemento de piso: por el nombre que usa el entrenador o, si no lo dice,
// por el Código cuando la casilla es de un solo elemento.
function medioGiros(r){const t=' '+nk(r.n)+' ';
  const y=/ y medio /.test(t)?1:0;
  if(/ (triple giro|tres giros) /.test(t))return 6+y;
  if(/ (doble giro|dos giros) /.test(t))return 4+y;
  let m=t.match(/ (\d)\/(\d) (g|giro|giros|t|twist) /); if(m)return Math.round(2*m[1]/m[2]);
  if(/ giro y medio /.test(t))return 3;
  if(/ (medio giro|1\/2 giro|1\/2 g) /.test(t))return 1;
  if(/ (giro|giros|twist) /.test(t))return 2;
  const en=' '+nk((r.k&&CAT[r.k]?.en)||'')+' ';
  if(/ (also|or) /.test(en))return 0;
  m=en.match(/ (\d)\/(\d) (t|turn|twist) /); return m?Math.round(2*m[1]/m[2]):0;}
// Piso, todos los niveles (Código FIG 2025-2028, art. 10.2.2 punto 5, y criterio de Manu):
// - Sin conexión en contrasaltos: el segundo elemento debe salir en la dirección con la que termina el primero
//   (un medio giro impar invierte la dirección: 1½ o 2½ giros atrás terminan hacia adelante).
// - Sin conexión entre dos mortales simples con giros.
// - Atrás con atrás sí conecta (p. ej. doble atrás + giro atrás).
// La dirección sale primero del nombre que usa el entrenador, luego del Código y al final del grupo.
function pisoMov(it){const r=it.r,c=r.k&&CAT[r.k];const t=' '+nk(r.n)+' ', td=' '+nk(c?c.d:'')+' ';
  const dirDe=x=>/ (adelante|ade|adel|al frente|frente|ad) /.test(x)?'ad':/ (atras|atr|at) /.test(x)?'at':'';
  const dir=dirDe(t)||(/ (adelante|ad) /.test(td)&&/ (atras|at) /.test(td)?'':dirDe(td))||(it.grp===2?'ad':it.grp===3?'at':'');
  const multi=!/ (doble|triple) giro/.test(t)&&(/ (doble|triple|dbl) (mortal|salto|atras|at|adelante|ad|ade|al|en|agrupado|agr|carpa|extendido|ext) /.test(t)
    ||(!/ (doble|triple|dobl|tripl)/.test(t)&&/ (doble|triple) mortal /.test(td)&&!/ tambien /.test(td)));
  const mg=medioGiros(r); let sale=dir; if(sale&&mg%2===1)sale=sale==='ad'?'at':'ad';
  return {dir,sale,multi,giros:mg>0};}
function pisoConexionInvalida(a,b){const A=pisoMov(a),B=pisoMov(b);
  if(A.giros&&!A.multi&&B.giros&&!B.multi)return 'dos mortales simples con giros (Código FIG)';
  if(A.sale&&B.dir&&A.sale!==B.dir)return 'contramovimiento: cambia de dirección (Código FIG, contrasaltos)';
  return '';}
// Piso: conexión permitida aunque el Código no le dé bonificación (grupos II, III o IV, misma dirección, sin giro con giro).
function pisoViable(r1,r2,nivel){if(!r1||!r2)return false;const x={r:r1,grp:grpOf(r1,'PISO',nivel)},y={r:r2,grp:grpOf(r2,'PISO',nivel)};
  return [2,3,4].includes(x.grp)&&[2,3,4].includes(y.grp)&&!pisoConexionInvalida(x,y);}
function cvPair(a,b,ap,nivel){
  const va=a.val,vb=b.val;
  if(ap==='PISO'){
    if(![2,3,4].includes(a.grp)||![2,3,4].includes(b.grp))return 0;
    if(pisoConexionInvalida(a,b))return 0;
    if(a.grp===4&&b.grp===4)return 0;
    if(va>=.4&&vb>=.4)return .2;
    if((va>=.4&&(vb===.2||vb===.3))||(vb>=.4&&(va===.2||va===.3)))return .1;
    // N7 y N8 (vigente, criterio de Manu): B+C, C+B y C+C también dan 0.1, además de las conexiones FIG.
    // N9, N10 y FIG: solo las bonificaciones del Código FIG.
    if((nivel==='N7'||nivel==='N8')&&[.2,.3].includes(va)&&[.2,.3].includes(vb)&&!(va===.2&&vb===.2))return .1;
    return 0;
  }
  if(ap==='FIJA'){
    const ra=a.grp===2,rb=b.grp===2;
    if(ra&&rb){const lo=Math.min(va,vb),hi=Math.max(va,vb);
      if(lo>=.4&&hi>=.5)return .2; if((lo===.3&&hi>=.4)||(lo===.4&&hi===.4))return .1;
      if((nivel==='N7'||nivel==='N8')&&lo===.3&&hi===.3)return .1; return 0;}
    if(ra!==rb){const rel=ra?va:vb, oth=ra?vb:va, og=ra?b.grp:a.grp;
      if((og===1||og===3)&&oth>=.4&&rel>=.4)return (oth>=.5||rel>=.5)?.2:.1;}
  }
  return 0;
}

/* ---------- reglas especiales del Código 2025 ---------- */
function finalPos(d){
  const t=' '+nk(d)+' ', hits=[];
  const pats=[['cristoinv',/cristo inv(ertido)?/g],['cristo',/cristo( en)?( angulo)?( en)?( v)?( piernas verticales| p vert(icales)?)?/g],
    ['hirinv',/hirondelle invertida/g],['hir',/hirondelle/g],['dorsal',/(suspension|susp|sus) dors(al)? horiz|plancha dorsal/g],
    ['facial',/suspension facial horiz/g],['plancha',/(apoyo|ap) fac(ial)? horiz|plancha/g],['hs',/(apoyo|ap) inv(ertido)?/g],
    ['V',/angulo (piernas|p) (elevadas )?vert/g],['L',/angulo/g]];
  const taken=[];
  for(const [c,re] of pats){let m;while((m=re.exec(t))){const a=m.index,b=a+m[0].length;
    if(taken.some(([x,y])=>a<y&&b>x))continue;taken.push([a,b]);hits.push([a,c]);}}
  if(!hits.length)return null; hits.sort((x,y)=>x[0]-y[0]); const c=hits[hits.length-1][1]; return c==='hs'?null:c;
}
const POS_TXT={cristo:'cristo',cristoinv:'cristo invertido',hir:'hirondelle',hirinv:'hirondelle invertida',dorsal:'plancha dorsal',facial:'suspensión facial',plancha:'plancha',V:'ángulo piernas verticales',L:'ángulo'};
// Arzón: repeticiones especiales del Código FIG 2025-2028 (art. 11.2.2, punto 3). En caso de repetición especial
// cuentan primero la salida y luego los elementos de mayor valor (art. 7, punto 8). N8 no las aplica (USAG).
const ARZ_REP={
  cruz:['3|33','3|34','3|35','3|39','3|40','3|41'],            // a) máx. 2 recorridos 3/3 en apoyo transversal
  rusaRec:['3|57','3|58','3|59','3|64','3|65','3|70'],         // d) máx. 2 recorridos 3/3 en rusas
  spindleRec:['3|17','3|22','3|23','3|29'],                    // e) máx. 2 recorridos 3/3 con spindle
  spindle:['2|28','2|29','2|30','2|34','2|35','2|36'],         // f) máx. 2 spindles completos
  sohn:['2|56','2|57','2|58','2|69','2|71'],                   // g) máx. 2 tipo Sohn / Bezugo
  rusaEntre:['2|110','2|111','2|112','2|113','4|10'],          // b) rusa en un arzón o entre arzones
  rusaPunta:['2|85','2|91','2|92','2|93','2|97','2|103','2|104','2|105','4|1','4|7','4|8','4|9'], // b) rusa en la punta (con salida)
  famRusa:['3|64','3|65','3|70'], famTongFei:['3|57','3|58','3|59']};                             // j) una sola variante por familia
function arzonRepeticiones(items,res,kill){
  const id=it=>it.r.k&&/^ARZON\|/.test(it.r.k)?it.r.k.slice(6):null;
  const en=it=>txt(it.r);
  const vivos=items.filter(it=>it.val>0&&id(it)).sort((a,b)=>((b.grp===4)-(a.grp===4))||(b.val-a.val));
  const tope=(lista,max,why)=>{let n=0;vivos.forEach(it=>{if(it.val>0&&lista.includes(id(it))){n++;if(n>max)kill(it,why);}});};
  tope(ARZ_REP.cruz,2,'Máximo 2 recorridos 3/3 en apoyo transversal (Magyar, Sivado, Driggs…) por rutina');
  tope(ARZ_REP.rusaRec,2,'Máximo 2 recorridos 3/3 en rusas por rutina');
  tope(ARZ_REP.spindleRec,2,'Máximo 2 recorridos 3/3 con spindle por rutina');
  tope(ARZ_REP.spindle,2,'Máximo 2 spindles completos (1/1) por rutina');
  tope(ARZ_REP.sohn,2,'Máximo 2 elementos tipo Sohn o Bezugo por rutina');
  tope(ARZ_REP.famRusa,1,'Misma familia que otro recorrido en rusas (Roth, Wu Guonian, 3/3 con 630°): solo vale uno');
  tope(ARZ_REP.famTongFei,1,'Misma familia que otro recorrido tipo Tong Fei (Tong Fei, Vammen): solo vale uno');
  {let n=0;vivos.forEach(it=>{if(it.val>0&&(id(it)==='3|22'||id(it)==='3|23')){if(/ nin reyes /.test(' '+nk(it.r.n)+' ')){n++;if(n>1)kill(it,'Nin Reyes y Nin Reyes 2: solo vale uno (con Titov o Keikha 4 sí valen los dos)');}}});}
  // b) Rusas: máximo 2 en la rutina (con la salida) y no más de una en la punta ni más de una entre arzones.
  {let punta=0,entre=0,total=0;vivos.forEach(it=>{if(!(it.val>0))return;const k=id(it);
    const p=ARZ_REP.rusaPunta.includes(k)||(it.grp===4&&/ (rusa|russian) /.test(en(it))&&!ARZ_REP.rusaEntre.includes(k)), e=ARZ_REP.rusaEntre.includes(k);
    if(!p&&!e)return; total++;
    if(p&&++punta>1)return kill(it,'Segunda rusa en la punta (incluye la salida): repetición especial');
    if(e&&++entre>1)return kill(it,'Segunda rusa entre arzones o en un arzón: repetición especial');
    if(total>2)kill(it,'Máximo 2 rusas por rutina, contando la salida');});}
  // c) Máximo 2 elementos a parada de manos desde círculos, flairs o tijeras (sin contar la salida).
  {let n=0;vivos.forEach(it=>{if(it.val>0&&it.grp!==4&&/ (handstand|hdst) /.test(en(it))){n++;if(n>2)kill(it,'Máximo 2 elementos a parada de manos por rutina (sin contar la salida)');}});}
  // h) Máximo 4 elementos en flairs (sin contar la salida).
  {let n=0;vivos.forEach(it=>{if(it.val>0&&it.grp!==4&&(/ flairs? /.test(' '+nk(it.r.n)+' ')||/ en flairs /.test(' '+nk(CAT[it.r.k]?.d||'')+' '))){n++;if(n>4)kill(it,'Máximo 4 elementos en flairs por rutina (sin contar la salida)');}});}
}
// Paralelas (Código FIG art. 14.2.2 punto 4) y Barra fija (art. 15.2.2 punto 5): repeticiones especiales.
// Cuentan primero los de mayor valor (art. 7.4 punto 8).
const PAR_REP=[
  {ids:['3|21','3|22','3|29','3|30','3|42','3|46','3|48'],max:2,why:'Máximo 2 gigantes por el apoyo invertido por rutina'},
  {ids:['3|106','3|107','3|108','3|114','3|119','3|120','3|130','3|131','3|137'],max:2,why:'Máximo 2 Felge por el apoyo invertido por rutina'},
  {ids:['1|5','1|6','1|11','1|12','1|15','1|17','1|18'],max:2,why:'Máximo 2 dominaciones adelante por el apoyo invertido por rutina'},
  {ids:['1|59','1|60'],max:1,why:'Solo una variante (posición o toma) del mismo mortal: Pakhniuk'},
  {ids:['3|70','3|71','3|77','3|83'],max:1,why:'Solo una variante (posición o toma) del mismo mortal: Matsunaga / Solis / Torres / Fokin'},
  {ids:['3|72','3|78'],max:1,why:'Solo una variante (posición o toma) del mismo mortal: Tanaka / Esparza'}];
const FIJA_REP=[
  {ids:['3|63','3|64','3|65','3|70','3|76'],max:2,why:'Máximo 2 elementos tipo Adler por rutina'},
  {ids:['2|15','2|16','2|18','2|21','2|23','2|28','2|29','2|34','2|36','2|51'],max:2,why:'Máximo 2 soltadas tipo Tkatchev / Piatti por rutina'},
  {ids:['2|88','2|89','2|90','2|95','2|96','2|102','2|108'],max:2,why:'Máximo 2 soltadas tipo Kovacs por rutina'},
  {ids:['2|58','2|60'],max:2,why:'Máximo 2 soltadas tipo Gienger por rutina'},
  {ids:['2|39','2|40','2|41','2|42','2|48'],max:2,why:'Máximo 2 soltadas tipo Jäger (mortal adelante) por rutina'},
  {ids:['2|3','2|6','2|9'],max:2,why:'Máximo 2 soltadas tipo Markelov por rutina'},
  {ids:['2|65','2|66','2|72','2|78','2|82','2|83','2|84'],max:2,why:'Máximo 2 soltadas con mortal sobre la barra (Gaylord / Pegan) por rutina'},
  {nombre:/ rybalko /,max:1,why:'Solo una variante de toma del mismo elemento con giro (Rybalko)'}];
function familiasRep(items,kill,reglas,ap){
  const id=it=>it.r.k&&it.r.k.startsWith(ap+'|')?it.r.k.slice(ap.length+1):null;
  const vivos=items.filter(it=>it.val>0).sort((a,b)=>b.val-a.val);
  for(const f of reglas){let n=0;vivos.forEach(it=>{if(!(it.val>0))return;
    const ok=f.ids?f.ids.includes(id(it)):f.nombre.test(txt(it.r));
    if(ok&&++n>f.max)kill(it,f.why);});}}
// Barra fija: la 5ª soltada solo vale si hay al menos dos soltadas conectadas (mínimo C+C) (art. 15.2.2 punto 6).
function fijaQuintaSoltada(items,kill){
  const sol=items.filter(it=>it.r.g===2&&it.r.t!=='JA'&&it.val>0);if(sol.length<=4)return;
  const con=items.some((it,i)=>it.r.c&&it.r.g===2&&items[i+1]&&items[i+1].r.g===2&&it.val>=.3&&items[i+1].val>=.3);
  if(!con)sol.slice(4).forEach(it=>kill(it,'5ª soltada: solo vale si hay al menos dos soltadas conectadas (mínimo C+C)'));}
function applySpecial(ap,items,res,nivel){
  const kill=(it,why)=>{if(it.val>0){it.val=0;res.rep.add(it.i);res.why[it.i]=why;}};
  const id=it=>it.r.t==='C'&&it.r.k?it.r.k.split('|'):null;
  if(ap==='ANILLOS'){
    // Yamawaki o Jonasson directo a impulso al apoyo invertido: +1 letra (12.2.2 5h)
    items.forEach((it,i)=>{const p=id(it),q=items[i+1]&&id(items[i+1]);
      if(p&&q&&p[1]==='1'&&(p[2]==='44'||p[2]==='45')&&q[1]==='1'&&(q[2]==='75'||q[2]==='81')&&it.val>0){it.val=r1(it.val+.1);res.up[i]=i+1;}});
    // Máximo 3 elementos de grupo II/III seguidos (12.2.2 3a/3b); no aplica en N7-N8
    if(nivel!=='N7'&&nivel!=='N8'){let run=0;
      items.forEach(it=>{const g=it.r.g, p=id(it);
        if((g===2||g===3)&&it.r.t!=='JA'){run++; if(run>3)kill(it,'4º elemento seguido de grupo II/III sin impulso B del grupo I entre ellos');}
        else if(g===1&&valOf(it.r,nivel)>=.2&&!(p&&['49','55','56','74'].includes(p[2]))&&!/kip|bascula/.test(txt(it.r)))run=0;});}
    // Una misma posición final de fuerza por grupo (12.2.2 4a/4b)
    const best={};
    items.filter(it=>(it.r.g===2||it.r.g===3)&&it.r.t==='C'&&it.val>0).forEach(it=>{
      const pos=finalPos(it.r.k&&CAT[it.r.k]?CAT[it.r.k].d:it.r.n); if(!pos)return; it.pos=pos;
      const k=it.r.g+'|'+pos; (best[k]=best[k]||[]).push(it);});
    for(const [k,arr] of Object.entries(best)){if(arr.length<2)continue;arr.sort((a,b)=>b.val-a.val);
      arr.slice(1).forEach(it=>kill(it,`Misma posición final (${POS_TXT[it.pos]}) que "${arr[0].r.n}" en el grupo ${ROM[it.r.g]}`));}
  }
  if(ap==='ARZON'&&nivel!=='N8')arzonRepeticiones(items,res,kill);
  if(ap==='PARALELAS')familiasRep(items,kill,PAR_REP,'PARALELAS');
  if(ap==='FIJA'){familiasRep(items,kill,FIJA_REP,'FIJA');fijaQuintaSoltada(items,kill);}
  if(ap==='PISO'){
    // Máximo 1 elemento de fuerza y 1 de molinos/flairs/rusas (10.2 7a/7b)
    const fuerza=[],molinos=[];
    items.forEach(it=>{const p=id(it);if(!p||p[1]!=='1'||!(it.val>0))return;const n=+p[2];
      if(n>=1&&n<=48&&n!==19&&n!==31)fuerza.push(it);
      else if(/molino|flair|rusa/.test(txt(it.r)))molinos.push(it);});
    [[fuerza,'elemento de fuerza'],[molinos,'elemento de molinos, flairs o rusas']].forEach(([arr,t])=>{
      if(arr.length<2)return;arr.sort((a,b)=>b.val-a.val);arr.slice(1).forEach(it=>kill(it,`Solo vale 1 ${t} en suelo (ya cuenta "${arr[0].r.n}")`));});
  }
}
function compute(ap,rows,nivel,plantada,opt){
  const res={dv:0,eg:0,cv:0,bon:0,nd:0,np:0,egDet:[],counted:new Set(),rep:new Set(),why:{},up:{},notes:[],dIdx:-1,vaults:[]};
  if(ap==='SALTO'){
    rows.forEach((r,i)=>{let v=r.v||0;
      if(nivel==='N7'||nivel==='N8'){const t=txt(r);
        if(r.k)v=vaultUSAG(r);
        // Saltos con mortal múltiple no permitidos en N7-N8 (tabla de niveles USAG)
        if(/ (dbl|double|doble|roche|dragulescu|blanik|yeo|lu yu fu|ri se gwang) /.test(t)){v=0;res.notes.push(`${r.n}: saltos con mortal múltiple no permitidos en ${nivel} (USAG).`);}
        // N7: Yurchenko con giro no permitido (tabla de niveles USAG)
        else if(nivel==='N7'&&(/^SALTO\|4\|40\d$/.test(r.k||'')||(/ yurchenko /.test(txt(r))&&/ (giro|giros|1\/2|1\/1|3\/2|2\/1|5\/2|twist) /.test(txt(r))))){v=0;res.notes.push(`${r.n}: en N7 no se permite Yurchenko con giro (USAG).`);}}
      else if(plantada&&i===0&&!/^(2\|20[1-6]|3\|30[1-3])$/.test(`${r.g}|${r.id}`)&&v>0){v=r1(v+.1);res.bon=.1;}
      res.vaults.push({i,v,np:r1(10+v)});});
    if(!res.vaults.length){res.notes.push('Agrega al menos un salto.');return res;}
    if(res.vaults.length>1){const a1=rows[res.vaults[0].i],a2=rows[res.vaults[1].i],v2=res.vaults[1];
      if(a1.id&&a2.id&&String(a1.id)===String(a2.id)){v2.np=0;res.notes.push('El 2º salto repite el 1º: nota 0.00 para ese salto (final de aparato).');}
      else if(a1.g&&a2.g&&a1.g===a2.g){v2.np=r1(Math.max(0,v2.np-2));res.notes.push('El 2º salto es del mismo grupo que el 1º: -2.0 al 2º salto (final de aparato).');}}
    if(res.vaults.length>2)res.notes.push('Solo cuentan 2 saltos (final de aparato): los demás no se toman en cuenta.');
    res.dv=res.vaults[0].v; res.np=res.vaults[0].np;
    if(res.vaults.length>1)res.avg=r1(res.vaults.reduce((s,x)=>s+x.np,0)/res.vaults.length);
    return res;
  }
  const items=rows.map((r,i)=>({i,r,val:valOf(r,nivel,ap),grp:grpOf(r,ap,nivel)}));
  const seen=new Set();
  for(const it of items){const virt=(nivel==='N7'||nivel==='N8')&&ap==='PISO';
    let key=it.r.k||(it.r.t==='M'&&it.r.g&&/^\d+$/.test(String(it.r.id))?`${it.r.g}|${it.r.id}`:null);
    if(key&&virt)key+='|'+nk(it.r.n);
    if(key&&it.r.t!=='JA'){if(seen.has(key)){it.val=0;res.rep.add(it.i);}seen.add(key);}}
  applySpecial(ap,items,res,nivel);
  Object.entries(res.why).forEach(([i,w])=>res.notes.push(`${rows[i].n}: ${w}.`));
  res.enotes=res.enotes||[];
  // Paralelas: elemento a una barra seguido de Healy sube una letra (y el Healy también) (art. 14.2.2 punto 3b-d).
  if(ap==='PARALELAS')rows.forEach((a,i)=>{const b=rows[i+1];if(!b)return;
    const ta=' '+nk(a.n)+' ', ca=' '+nk((a.k&&CAT[a.k]?.en)||'')+' ', tb=txt(b);
    if(/ (una barra|1 barra|una banda|1 banda|one rail) /.test(ta)&&!/ tambien /.test(ta)&&/ healy /.test(tb)&&!/ (tippelt|arican|abiertas|abierto) /.test(ta+ca)&&!/ connected to healy /.test(ca))
      res.notes.push(`"${a.n}" a una barra seguido de Healy: el Código da una letra más a los dos. Elige la versión "conectado a Healy" del elemento y el Healy después de una barra.`);});
  // Anillos: para juniors FIG no se permiten mortales atrás en suspensión (art. 12.2.2 punto 5f).
  if(ap==='ANILLOS'&&(nivel==='N9'||nivel==='N10'))rows.forEach((r,i)=>{const t=txt(r);
    if(r.g!==4&&/ salto bwd /.test(t)&&/ (hang|susp) /.test(t))res.enotes.push(`"${r.n}": si compite como junior FIG, los mortales atrás en suspensión no están permitidos.`);});
  if(ap==='FIJA'&&nivel!=='N7'&&nivel!=='N8')rows.forEach((a,i)=>{const b=rows[i+1];if(!b||a.ct||FV_OPC[a.pv])return;
    const tb=txt(b);
    const kipHS=kipAManos(a);
    const atras=/ (gigante|molino at(ras)?|stalder|quinta|salvada) /.test(tb)||/ 1\/2 g .*cubital/.test(tb);
    if(kipHS&&atras&&!/ (molino ad(elante)?|endo) /.test(tb))res.enotes.push(`Posible contrabalanceo: "${a.n}" y después "${b.n}". Error de composición -0.30 (jurado E) si van seguidos.`);});
  // Paralelas (FIG, N9 y N10): después de llegar a manos balanceando atrás (vuelo o impulso a manos),
  // el siguiente elemento no puede bajar hacia adelante (Moy, Tippelt, molino/gigante, Kenmotsu, Bhavsar, Diamidov,
  // Makuts, Felge, Peters): contrabalanceo, -0.30 del jurado E (Código FIG 2025-2028, art. 14.2.1 4.a y 4.b).
  // Si entre ellos hay un elemento de fuerza (L-sit, Kato…) ya no van seguidos y no aplica.
  // Paralelas: la salida de doble mortal adelante debe venir de un impulso braquial, un Healy o un Moy directo;
  // si no, hay un balanceo vacío ("vuelo perdido"): -0.3 del jurado E (Código FIG, balanceos vacíos e intermedios).
  if(ap==='PARALELAS'&&nivel!=='N7'&&nivel!=='N8'&&rows.length>1){const u=rows[rows.length-1],pr=rows[rows.length-2];
    const tu=txt(u), tp=txt(pr);
    // También las de mortal adelante (con o sin giros): salen del mismo balanceo atrás. Un Moy al ap. inv. (Tippelt) no cuenta como Moy directo.
    const dobleAd=/ (double salto fwd|doble mortal (adelante|ade|adel|al frente|ad)|doble (adelante|ade|al frente)) /.test(tu);
    const mortalAd=dobleAd||(/ (mortal (adelante|ade|adel|al frente|ad)|salto fwd) /.test(tu)&&!/ (atras|bwd) /.test(tu));
    const vieneAtras=llegaAManos(pr)||/ (braq|braquial|upper arm|healy) /.test(tp)||(/ moy /.test(tp)&&!/ (ap inv|apoyo invertido|handstand|hdst|tippelt) /.test(tp));
    if(mortalAd&&!vieneAtras)
      res.enotes.push(`Vuelo perdido: la salida de ${dobleAd?'doble ':''}mortal adelante ("${u.n}") debe venir de un impulso braquial, un Healy o un Moy directo; después de "${pr.n}" queda un balanceo vacío. -0.30 del jurado E.`);}
  if(ap==='PARALELAS'&&nivel!=='N7'&&nivel!=='N8')rows.forEach((a,i)=>{const b=rows[i+1];if(!b||a.ct)return;
    const nb=txt(b);
    const aManos=llegaAManos(a)&&!a.pv;
    // La salida hacia atrás (último elemento) también va en contra del balanceo.
    const baja=/ (moy|tippelt|tippet|molino|gigante|kenmotsu|bhavsar|babsar|diamidov|diamidob|makuts|felge|peters) /.test(nb)||(i+1===rows.length-1&&/ atras /.test(nb)&&!/ adelante /.test(nb));
    // Con solo apodo (sin elemento del Código), "doble en C/V" en paralelas es la salida atrás.
    const salidaAtras=i+1===rows.length-1&&(/ atras /.test(nb)||(!b.k&&/ doble (en c|en v|c|v|agrup|agrupado|carpa|ext|extendido) /.test(nb)))&&!/ (adelante|ade|adel|al frente) /.test(nb);
    if(aManos&&salidaAtras)res.enotes.push(`Vuelo perdido / contrabalanceo: después de "${a.n}" (llega a manos balanceando atrás) sale "${b.n}" hacia atrás, en contra del balanceo. Tendría que haber un cambio antes (½ giro, giro, Healy o Gatson; márcalo en "Después hace"). -0.30 del jurado E.`);
    else if(aManos&&baja)res.enotes.push(`Posible contrabalanceo: "${a.n}" y después "${b.n}". -0.30 del jurado E (después de llegar a manos balanceando atrás, el siguiente elemento debe seguir en la misma dirección o ir precedido de un elemento de fuerza). Si después del vuelo hace un cambio, giro, Healy o Gatson sin capturarlo, márcalo en el elemento.`);});
  const valued=items.filter(x=>x.val>0);
  const n7=nivel==='N7', n8=nivel==='N8', usag=n7||n8;
  let dis=null;
  if(ap!=='PISO'){const d=valued.filter(x=>x.grp===4);if(d.length)dis=d[d.length-1];
    else res.notes.push('Falta salida (grupo IV).');}
  let chosen=[];
  if(n7){chosen=[...valued].sort((a,b)=>b.val-a.val).slice(0,6);}
  else{
    const pool=valued.filter(x=>x!==dis), lim=ap==='PISO'?8:7, cnt={};
    const rest=[...pool];
    while(chosen.length<lim&&rest.length){
      rest.sort((a,b)=>b.val-a.val||((cnt[a.grp]?1:0)-(cnt[b.grp]?1:0)));
      // Arzón N8: se permiten más de 4 recorridos (grupo III) si los extras son en flairs (boletín MDP #4).
      const flairN8=x=>nivel==='N8'&&ap==='ARZON'&&x.grp===3&&/ flair/.test(' '+nk(x.r.n+' '+(x.r.k&&CAT[x.r.k]?CAT[x.r.k].d:'')));
      const ix=rest.findIndex(x=>x.grp==null||(cnt[x.grp]||0)<4||flairN8(x)); if(ix<0)break;
      const x=rest.splice(ix,1)[0]; if(x.grp!=null&&!flairN8(x))cnt[x.grp]=(cnt[x.grp]||0)+1; chosen.push(x);
    }
    if(dis)chosen.push(dis);
  }
  chosen.forEach(x=>res.counted.add(x.i));
  res.nc={};{const cg={};chosen.forEach(x=>{if(x!==dis&&x.grp!=null)cg[x.grp]=(cg[x.grp]||0)+1;});
    valued.forEach(x=>{if(res.counted.has(x.i))return;
      res.nc[x.i]=(!n7&&x.grp!=null&&(cg[x.grp]||0)>=4)?`No cuenta: ya cuentan 4 elementos del grupo ${ROM[x.grp]} (máximo 4 por grupo)`
        :(x.grp===4&&ap!=='PISO'&&dis&&x!==dis)?'No cuenta: solo cuenta una salida'
        :`No cuenta: queda fuera de los ${n7?6:(ap==='PISO'?8:7)} de mayor valor`;});}
  res.dv=r1(chosen.reduce((s,x)=>s+x.val,0));
  if(dis)res.dIdx=dis.i;
  // Grupos de elementos
  const body=chosen.filter(x=>x!==dis||ap==='PISO');
  if(n7){
    const gs=new Set(body.filter(x=>x.grp).map(x=>x.grp)); if(dis)gs.add(4);
    const n=Math.min(3,gs.size); res.eg=r1(n*.5);
    [...gs].sort().forEach(g=>res.egDet.push({g,v:null,hit:true}));
    if(gs.size<3)res.notes.push(`Solo ${gs.size} grupo(s) de elementos; N7 premia hasta 3.`);
  }else{
    const groups=ap==='PISO'?[1,2,3,4]:[1,2,3];
    for(const g of groups){const xs=body.filter(x=>x.grp===g);
      let v=0; if(xs.length)v=(usag||g===1||Math.max(...xs.map(x=>x.val))>=.4)?.5:.3;
      res.egDet.push({g,v,hit:!!xs.length}); res.eg+=v;
      if(!xs.length)res.notes.push(`Grupo ${ROM[g]} sin cubrir.`);}
    if(ap!=='PISO'){const v=dis?Math.min(dis.val,.5):0;res.egDet.push({g:4,v,hit:!!dis,sal:true});res.eg+=v;}
    res.eg=r1(res.eg);
  }
  // Conexiones
  res.pot={};
  if((ap==='PISO'||ap==='FIJA'))for(let i=0;i+1<rows.length;i++)if(res.counted.has(i)&&res.counted.has(i+1))res.pot[i]=cvPair(items[i],items[i+1],ap,nivel);
  if((ap==='PISO'||ap==='FIJA')){
    rows.forEach((r,i)=>{if(!r.c||i+1>=rows.length)return;
      if(!res.counted.has(i)||!res.counted.has(i+1)){res.notes.push(`Conexión ${i+1}-${i+2}: uno de los dos no cuenta.`);return;}
      let v=(r.cv!=null&&r.cv!=='')?+r.cv:cvPair(items[i],items[i+1],ap,nivel);
      // Piso: una conexión no permitida (contrasalto, giro con giro) no vale aunque se haya puesto a mano.
      if(ap==='PISO'){const m=pisoConexionInvalida(items[i],items[i+1]);if(m){v=0;res.notes.push(`Conexión no permitida ${i+1}-${i+2} ("${rows[i].n}" y "${rows[i+1].n}"): ${m}. No suma; quítala.`);}}
      res.cv+=v;});
    res.cv=r1(res.cv);
  }
  // Bonos
  if(n8&&dis&&dis.val>=.3)res.bon+=dis.val>=.5?.4:dis.val>=.4?.3:.2;
  // N8: el bono por plantar la salida no se calcula aquí; lo deciden los jueces en el momento (criterio de Manu).
  if(plantada&&!usag){
    if(ap!=='ARZON'){const last=ap==='PISO'?items.filter(x=>res.counted.has(x.i)).pop():dis;
      if(last&&last.val>=.3)res.bon+=.1; else res.notes.push('Bono por plantar requiere salida C o mayor.');}
  }
  // N8 Barra fija: cada soltada (grupo II) de valor C o mayor que cuenta da +0.3 (USAG MDP 2025-2028, boletines #2-#4).
  if(n8&&ap==='FIJA'){const sol=chosen.filter(x=>x.r.g===2&&x.val>=.3);
    if(sol.length){res.bon+=.3*sol.length;res.notes.push(`Bono N8 por soltada C o mayor: +0.3 × ${sol.length} (${sol.map(x=>x.r.n).join(', ')}).`);}}
  res.bon=r1(res.bon);
  // Deducción neutral
  const nEl=valued.length;
  if(usag){if(nEl<6)res.nd=r1((6-nEl)*1);}
  else{const t={5:3,4:4,3:5,2:6,1:7,0:10};if(nEl<6)res.nd=t[nEl];}
  res.rep.forEach(i=>{if(!res.why[i])res.notes.push(`${rows[i].n}: repetido (mismo elemento del Código), no suma valor.`);});
  // Deducciones del jurado D (neutrales) y avisos de jurado E propios de cada aparato
  const descOf=r=>txt(r);
  const usagN=nivel==='N7'||nivel==='N8';
  if(ap==='PISO'){
    const multi=r=>r.t==='C'&&(r.g===2||r.g===3)&&/ (doble|triple|dob|tri) /.test(descOf(r));
    if(!usagN){
      if(nivel==='FIG'){const last=rows[rows.length-1];if(!last||!multi(last)){res.nd=r1(res.nd+.3);res.notes.push('Sin mortal múltiple como último elemento (sénior): -0.3 del jurado D.');}}
      else if(!rows.some(multi)){res.nd=r1(res.nd+.3);res.notes.push('Sin mortal múltiple en la rutina: -0.3 del jurado D.');}
    }
    // Balanza en una pierna: la cubren las planchas I.61/I.62 o cualquier elemento llamado arabesca,
    // flick facial o salto con giro a facial (cuente o no entre los 8). Si no hay, se puede marcar en la coreografía.
    if(!rows.some(esBalanza)&&!(opt&&opt.balPiso)){res.nd=r1(res.nd+.3);res.notes.push('Sin balanza en una pierna (arabesca, flick facial, salto con giro a facial o plancha I.61/I.62): -0.3 del jurado D. Agrégala como elemento (cuente o no entre los 8) o marca que la tiene en la coreografía.');}
  }
  if(ap==='ANILLOS'&&!usagN&&rows.length){
    if(!rows.some(r=>r.g===1&&/ (apoyo invertido|ap inv|sost|sostenido|a manos) /.test(descOf(r)))){res.nd=r1(res.nd+.3);res.notes.push('Sin impulso al apoyo invertido: -0.3 del jurado D.');}
  }
  if(ap==='FIJA'){
    rows.forEach((r,i)=>{const nx=rows[i+1];
      if(r.t==='C'&&r.g===2&&!r.gig&&/ (kovacs|kolman|cassina|bretschneider|encima de la barra|sobre la barra) /.test(descOf(r))&&nx&&!/ (molino|gigante) /.test(descOf(nx)))
        (res.enotes=res.enotes||[]).push(`"${r.n}" es suelta con mortal sobre la barra y después no va un molino ("${nx.n}"): -0.3 del jurado E. Si al agarrar cae a gigante o molino, márcalo en el elemento.`);});
  }
  for(const [i,j] of Object.entries(res.up)){if(!res.counted.has(+j)){if(res.counted.has(+i))res.dv=r1(res.dv-.1);delete res.up[i];res.notes.push('El aumento de letra del Yamawaki/Jonasson requiere que el impulso al apoyo invertido cuente.');}}
  res.np=r1(10+res.dv+res.eg+res.cv+res.bon-res.nd);
  return res;
}
function totals(name){
  const a=S.atletas[name]; const out={}; let aa=0;
  for(const [ap] of APS){const c=compute(ap,a.r[ap]||[],a.nivel,a.p?.[ap],a.p||{});out[ap]=c;aa+=c.np;}
  out.aa=r1(aa); return out;
}
function nAv(c){return (new Set(c.notes)).size+(c.enotes?.length||0);
}

/* ---------- guardado ---------- */
function setSync(c,t){syncState=[c,t];const el=document.querySelector('.sync');if(el){el.className='sync '+c;el.textContent=t;}}
/* Guardado en la nube por cambio: cada atleta se escribe por separado para que
   dos dispositivos editando al mismo tiempo no se borren los cambios entre sí. */
let SENT=null, DOC_EXISTS=false, SAVING=false;
function curState(){
  const lib={};for(const n of Object.keys(S.atletas))lib[n]=JSON.stringify({...S.atletas[n],vista:buildVista(n)});
  const v=oblVista(),obl={},ov={};for(const n of Object.keys(S.obl.atletas||{})){obl[n]=JSON.stringify(S.obl.atletas[n]);ov[n]=JSON.stringify(v.atletas[n]||null);}
  const al={};for(const [k,x] of Object.entries(S.alias||{}))al[k]=JSON.stringify(x);
  return{lib,obl,ov,al,orden:JSON.stringify(ORDER),bajas:JSON.stringify(S.bajas||[]),oorden:JSON.stringify(S.obl.orden||[]),obajas:JSON.stringify(S.obl.bajas||[])};
}
function fullDoc(c){const P=o=>Object.fromEntries(Object.entries(o).map(([k,v])=>[k,JSON.parse(v)]));
  return{atletas:P(c.lib),alias:P(c.al),orden:JSON.parse(c.orden),bajas:JSON.parse(c.bajas),
    obligatorios:{atletas:P(c.obl),orden:JSON.parse(c.oorden),bajas:JSON.parse(c.obajas),vista:{orden:JSON.parse(c.oorden),atletas:P(c.ov)}}};}
function save(){
  try{localStorage.setItem(LOCAL,JSON.stringify({...S,orden:ORDER}));}catch(e){}
  clearTimeout(saveTimer);
  if(!cloud){setSync('warn','Guardado en este dispositivo');return;}
  setSync('','Guardando…');SAVING=true;
  saveTimer=setTimeout(async()=>{
    try{const cur=curState();
      if(!DOC_EXISTS||!SENT){await cloud.set({...fullDoc(cur),updatedAt:firebase.firestore.FieldValue.serverTimestamp()});DOC_EXISTS=true;}
      else{const FP=(...x)=>new firebase.firestore.FieldPath(...x), DEL=firebase.firestore.FieldValue.delete(), u=[];
        const diff=(a,b,path)=>{for(const k in a)if(a[k]!==b[k])u.push(FP(...path,k),JSON.parse(a[k]));for(const k in b)if(!(k in a))u.push(FP(...path,k),DEL);};
        diff(cur.lib,SENT.lib,['atletas']);diff(cur.obl,SENT.obl,['obligatorios','atletas']);diff(cur.ov,SENT.ov,['obligatorios','vista','atletas']);diff(cur.al,SENT.al,['alias']);
        if(cur.orden!==SENT.orden)u.push(FP('orden'),JSON.parse(cur.orden));
        if(cur.bajas!==SENT.bajas)u.push(FP('bajas'),JSON.parse(cur.bajas));
        if(cur.oorden!==SENT.oorden)u.push(FP('obligatorios','orden'),JSON.parse(cur.oorden),FP('obligatorios','vista','orden'),JSON.parse(cur.oorden));
        if(cur.obajas!==SENT.obajas)u.push(FP('obligatorios','bajas'),JSON.parse(cur.obajas));
        if(u.length)await cloud.update(...u,FP('updatedAt'),firebase.firestore.FieldValue.serverTimestamp());}
      SENT=cur;setSync('ok','Guardado en la nube');}
    catch(e){console.error(e);setSync('warn','Sin nube: guardado en este dispositivo');}
    SAVING=false;
  },600);
}

function buildVista(n){
  const a=S.atletas[n], t=totals(n), v={};
  for(const [ap] of APS){const c=t[ap], rows=a.r[ap]||[];
    v[ap]={np:c.np,d:ap==='SALTO'?c.dv:r1(c.dv+c.cv),eg:ap==='SALTO'?0:c.eg,
      rows:rows.map((r,i)=>ap==='SALTO'
        ?{n:r.n,id:r.id||'',g:r.g||'',l:((c.vaults.find(x=>x.i===i)||{}).v??r.v??0).toFixed(1),vd:''}
        :{n:r.n,id:r.t==='JA'?'EV':(r.id||''),g:r.t==='JA'?'X':(r.g||''),l:r.t==='JA'?'A':(r.l||''),vd:(c.rep.has(i)?0:valOf(r,a.nivel,ap)).toFixed(1)})};}
  return v;
}
/* ---------- vistas ---------- */
function render(){if(ui.view==='olist')return renderOList();if(ui.view==='oath')return renderOAth();ui.view==='menu'?renderMenu():ui.view==='list'?renderList():renderAthlete();}
function renderMenu(){
  root.innerHTML=`<div class="top"><a class="back" href="index.html">← Rutinas</a><h1>Editor de rutinas</h1><span class="sync ${syncState[0]}">${esc(syncState[1])}</span></div>
  <div class="menu"><button class="card big" data-act="libres"><span><b>Editar libres</b><small>Rutinas, NP, atletas e impresión</small></span><span class="aa">›</span></button>
  <button class="card big" data-act="oblopen"><span><b>Editar obligatorios</b><small>Elementos hechos y nota de partida (niveles 3 a 6)</small></span><span class="aa">›</span></button></div>`;
}
function renderList(){
  let h=`<div class="top"><button class="back" data-act="menu">← Editor</button><h1>Editar libres</h1><span class="sync ${syncState[0]}">${esc(syncState[1])}</span></div>`;
  h+=`<div class="actions"><button class="btn" data-act="addform">Agregar atleta</button><button class="btn ${ui.delMode?'danger':'ghost'}" data-act="delmode">${ui.delMode?'Terminar de eliminar':'Eliminar atleta'}</button></div>`;
  if(ui.adding)h+=`<div class="score addbox"><label>Nombre del atleta<input id="newName" autocomplete="off" placeholder="Ej. JUAN P"></label>
    <label>Nivel<select id="newLevel">${NIVELES.map(n=>`<option ${n==='N8'?'selected':''}>${n}</option>`).join('')}</select></label>
    ${ui.addErr?`<div class="badge b">${esc(ui.addErr)}</div>`:''}<div class="actions"><button class="btn" data-act="addok">Agregar</button><button class="btn ghost" data-act="addno">Cancelar</button></div></div>`;
  if(ui.delAsk)h+=`<div class="score addbox"><b>¿Eliminar a ${esc(ui.delAsk)}?</b><small>Se borran sus rutinas de todos los aparatos y deja de aparecer en Libres.</small>
    <div class="actions"><button class="btn danger" data-act="delok">Eliminar</button><button class="btn ghost" data-act="delno">Cancelar</button></div></div>`;
  h+=`<div class="cards">`;
  for(const n of ORDER){const a=S.atletas[n];if(!a)continue;const t=totals(n);
    if(ui.delMode){h+=`<button class="card del" data-act="delask" data-v="${esc(n)}"><span><b>${esc(n)}</b><span class="lv">${esc(a.nivel)}</span></span><span class="xdel">Eliminar</span></button>`;continue;}
    h+=`<button class="card" data-act="open" data-v="${esc(n)}"><span><b>${esc(n)}</b><span class="lv">${esc(a.nivel)}</span></span><span class="aa">${f1(t.aa)}${APS.reduce((x,[k])=>x+nAv(t[k]),0)?`<small class="warn"> ⚠${APS.reduce((x,[k])=>x+nAv(t[k]),0)}</small>`:''}</span></button>`;}
  h+=`</div><div class="actions"><button class="btn" data-act="export">Descargar Excel actualizado</button></div>`;
  h+=`<div class="actions printbar"><button class="btn" data-act="print">Imprimir rutinas</button><small>Una hoja tamaño carta horizontal por atleta. En el diálogo elige "Guardar como PDF".</small></div>`;
  h+=`<div class="actions printbar"><button class="btn" data-act="dprint">Descargar división en PDF (grupal)</button><small>Para que los atletas aprendan su rutina: por nivel, hasta 6 atletas por hoja, con 1er enlace, 2do enlace y enlace a salir.</small></div>`;
  root.innerHTML=h;
}
function metaLine(r,res,i){
  if(ui.ap==='SALTO'){const vv=res.vaults.find(x=>x.i===i);return `${keyLabel(r)} · valor ${vv?vv.v.toFixed(1):'-'} · NP ${vv?f1(vv.np):'-'}`;}
  const a=S.atletas[ui.atleta]; const g=grpOf(r,ui.ap,a.nivel);
  let m=`${keyLabel(r)} · ${r.t==='JA'?'A 0.1':(r.l||'-')+' '+(LV[r.l]||0).toFixed(1)}`;
  if(a.nivel==='N8'&&r.t!=='JA'&&g&&g!==r.g)m+=` · cuenta como grupo ${ROM[g]} (N8)`;
  let b='';
  if(res.rep.has(i))b+=`<span class="badge b">${esc(res.why[i]||'Repetido')}</span>`;
  if(res.up[i]!=null)b+='<span class="badge i">+1 letra: directo a impulso al apoyo invertido</span>';
  if((a.nivel==='N7'||a.nivel==='N8')&&r.t!=='JA'&&r.l&&usagValor(r,a.nivel,ui.ap,LV[r.l]||0)!=null)b+=`<span class="badge i">Valor USAG ${a.nivel}: ${valOf(r,a.nivel,ui.ap).toFixed(1)}</span>`;
  else if(!res.counted.has(i)&&valOf(r,a.nivel,ui.ap)>0)b+=`<span class="badge w">${esc(res.nc?.[i]||'No cuenta')}</span>`;
  if(i===res.dIdx)b+='<span class="badge i">Salida</span>';
  if(r.t==='JA'&&a.nivel!=='N7'&&a.nivel!=='N8')b+='<span class="badge b">Juvenil A: sin valor en '+a.nivel+'</span>';
  if(r.ct)b+='<span class="badge i">A cambio de toma</span>';
  if(r.gig)b+=`<span class="badge i">Cae a ${r.gig}</span>`;
  if(PV_TXT(r.pv))b+=`<span class="badge i">Luego: ${PV_TXT(r.pv)} (sin valor)</span>`;
  if(r.nf)b+='<span class="badge b">No está en el Código 2025: revisa ID</span>';
  if(r.ex)b+=`<span class="badge w">${esc(r.ex)}</span>`;
  return esc(m)+(b?'<div>'+b+'</div>':'');
}
function renderAthlete(){
  const a=S.atletas[ui.atleta], rows=a.r[ui.ap]||(a.r[ui.ap]=[]), t=totals(ui.atleta), res=t[ui.ap];
  let h=`<div class="top"><button class="back" data-act="list">← Atletas</button><h1></h1><span class="sync ${syncState[0]}">${esc(syncState[1])}</span></div>`;
  h+=`<div class="head"><h2>${esc(ui.atleta)}</h2><select data-act="nivel" aria-label="Nivel">${NIVELES.map(n=>`<option ${n===a.nivel?'selected':''}>${n}</option>`).join('')}</select><span class="aatot">NP AA <b>${f1(t.aa)}</b></span></div>`;
  h+=`<div class="tabs">${APS.map(([k,l])=>`<button class="tab ${k===ui.ap?'on':''}" data-act="ap" data-v="${k}">${l}<span>${f1(t[k].np)}${nAv(t[k])?` <i class="warn">⚠${nAv(t[k])}</i>`:''}</span></button>`).join('')}</div>`;
  h+=`<div class="score"><div class="np"><strong>${f1(res.np)}</strong><em>Nota de partida</em></div>`;
  if(ui.ap!=='SALTO'){
    h+=`<div class="metrics"><div><b>${f1(res.dv)}</b><small>Dificultad</small></div><div><b>${f1(res.eg)}</b><small>Grupos</small></div><div><b>${f1(res.cv)}</b><small>Conexión</small></div><div><b>${f1(res.bon)}</b><small>Bonos</small></div><div><b>${res.nd?'-'+f1(res.nd):'0.0'}</b><small>Ded. jurado D</small></div></div>`;
    h+=`<div class="chips">${res.egDet.map(d=>`<span class="chip ${d.hit?'hit':'miss'}">${d.sal?'Salida':'Grupo '+ROM[d.g]}${d.v!=null?' '+d.v.toFixed(1):''}</span>`).join('')}</div>`;
    if(a.nivel!=='N7'&&a.nivel!=='N8')h+=`<label class="opt"><input type="checkbox" data-act="plant" ${a.p?.[ui.ap]?'checked':''}> Salida plantada (bono)</label>`;
    // La casilla solo se muestra si la rutina no tiene ya un elemento de balanza.
    if(ui.ap==='PISO'&&!(a.r.PISO||[]).some(esBalanza))h+=`<label class="opt"><input type="checkbox" data-act="balpiso" ${a.p?.balPiso?'checked':''}> Tiene balanza en una pierna en la coreografía (fuera de los 8)</label>`;
  }else h+=`<div class="metrics"><div><b>${res.vaults[0]?res.vaults[0].v.toFixed(1):'-'}</b><small>Salto 1</small></div><div><b>${res.vaults[1]?res.vaults[1].v.toFixed(1):'-'}</b><small>Salto 2</small></div>${res.avg!=null?`<div><b>${f1(res.avg)}</b><small>Promedio final</small></div>`:''}</div>`;
  if(ui.ap==='SALTO'&&a.nivel!=='N7'&&a.nivel!=='N8')h+=`<label class="opt"><input type="checkbox" data-act="plant" ${a.p?.SALTO?'checked':''}> Salto 1 plantado (bono +0.1, saltos con mortal)</label>`;
  if(res.notes.length||res.enotes?.length){h+=`<div class="avisos"><b>Avisos (${(new Set(res.notes)).size+(res.enotes?.length||0)})</b>`;
    if(res.notes.length)h+=`<ul class="notes">${[...new Set(res.notes)].map(n=>`<li>${esc(n)}</li>`).join('')}</ul>`;
    if(res.enotes?.length)h+=`<ul class="notes enotes">${res.enotes.map(n=>`<li>${esc(n)}</li>`).join('')}</ul><small class="ehelp">Los avisos de ejecución no cambian la nota de partida.</small>`;
    h+=`</div>`;}
  h+=`</div><div class="list">`;
  if(!rows.length)h+=`<div class="empty">Sin elementos. Escribe abajo el primero.</div>`;
  const canLink=(ui.ap==='PISO'||ui.ap==='FIJA');
  rows.forEach((r,i)=>{
    h+=`<div class="row ${res.counted.has(i)||ui.ap==='SALTO'?'':'off'}"><span class="num">${i+1}</span><div><button class="nm" data-act="edit" data-i="${i}">${esc(r.n)}</button><div class="meta">${metaLine(r,res,i)}</div></div>
      <div class="ctl"><button data-act="up" data-i="${i}" aria-label="Subir">↑</button><button data-act="down" data-i="${i}" aria-label="Bajar">↓</button><button data-act="del" data-i="${i}" aria-label="Quitar" class="${ui.del===i?'sure':''}">${ui.del===i?'Quitar':'✕'}</button></div></div>`;
    if(ui.open===i)h+=editPanel(r,i,a,(res.pot||{})[i]||0);
    if(i<rows.length-1){const pot=(res.pot||{})[i]||0;
      // Posible conexión descartada con la X (r.nc): ya no se muestra aquí, pero sigue en el panel del elemento.
      const sinBono=ui.ap==='PISO'&&pot===0&&res.counted.has(i)&&res.counted.has(i+1)&&pisoViable(r,rows[i+1],a.nivel);
      if(canLink&&(r.c||((pot>0||sinBono)&&!r.nc))){
        const mal=ui.ap==='PISO'&&r.c&&pisoConexionInvalida({r,grp:grpOf(r,'PISO',a.nivel)},{r:rows[i+1],grp:grpOf(rows[i+1],'PISO',a.nivel)});
        const val=mal?0:r.c?((r.cv!=null&&r.cv!=='')?+r.cv:pot):pot;
        const lbl=mal?`No permitida: ${mal}. Toca para quitar`:r.c?(val>0?`Conectados +${val.toFixed(1)}${(r.cv!=null&&r.cv!=='')?' (manual)':''}`:sinBono?'Conectados (sin bonificación 0.0), toca para quitar':'Conectados 0.0: no cumple, toca para quitar'):(ui.ap==='PISO'?(sinBono?`Posible conexión con "${esc(rows[i+1].n)}" sin bonificación (0.0): toca para conectar`:`Posible conexión con "${esc(rows[i+1].n)}": toca para conectar (+${pot.toFixed(1)})`):`Conectar +${pot.toFixed(1)}`);
        h+=`<div class="link"><button class="${r.c?(val>0?'on':sinBono?'':'bad'):(ui.ap==='PISO'?'pos':'')}" data-act="link" data-i="${i}">${lbl}</button>${r.c?'':`<button class="nox" data-act="nolink" data-i="${i}" aria-label="No usar esta conexión" title="No usar esta conexión">✕</button>`}</div>`;}
      else h+='<div class="gap"></div>';}
  });
  h+=`</div>`;
  if(ui.dict)h+=dictPanel(a,rows);
  else h+=`<div class="add"><input id="q" placeholder="Escribe un elemento: nombre, apodo o ID (ej. doble atrás, Cassina, 2.16)" value="${esc(ui.replace<0?ui.q:'')}" autocomplete="off"><div id="sug"></div></div>`;
  h+=`<div class="actions">${ui.dict?'':'<button class="btn" data-act="dict">🎤 Dictar rutina</button>'}<button class="btn ghost" data-act="reseed">Volver a cargar del Excel</button></div>`;
  root.innerHTML=h;
  const q=document.getElementById('q'); if(ui.replace<0&&ui.q){q.focus();q.setSelectionRange(q.value.length,q.value.length);renderSug(ui.q,'sug');}
}
function editPanel(r,i,a,pot){
  let h=`<div class="edit"><label>Nombre como lo llaman<input data-f="n" data-i="${i}" value="${esc(r.n)}"></label>`;
  h+=`<label>Cambiar elemento del Código<input id="rq" data-i="${i}" placeholder="Busca para reemplazar" value="${esc(ui.replace===i?ui.q:'')}" autocomplete="off"></label><div id="rsug"></div>`;
  if(ui.ap==='SALTO'&&(a.nivel==='N7'||a.nivel==='N8')&&r.k)h+=`<div class="two"><small style="color:var(--muted)">Valor USAG ${a.nivel}: <b>${vaultUSAG(r).toFixed(1)}</b> (no se cambia a mano; el Código FIG no aplica en ${a.nivel})</small></div>`;
  else if(ui.ap==='SALTO')h+=`<label>Valor del salto<input data-f="v" data-i="${i}" type="number" step="0.1" value="${r.v??''}"></label>`;
  else if(r.t==='M')h+=`<div class="two"><label>Grupo<select data-f="g" data-i="${i}">${[1,2,3,4].map(g=>`<option value="${g}" ${r.g===g?'selected':''}>${ROM[g]}</option>`).join('')}</select></label><label>Valor<select data-f="l" data-i="${i}">${Object.keys(LV).map(l=>`<option ${r.l===l?'selected':''}>${l}</option>`).join('')}</select></label></div>`;
  if(a.nivel==='N8'&&r.t!=='JA'&&(ui.ap==='ANILLOS'||ui.ap==='FIJA'))h+=`<label>Grupo para N8<select data-f="gx" data-i="${i}"><option value="">Según Código</option>${[1,2,3,4].map(g=>`<option value="${g}" ${r.gx===g?'selected':''}>${ROM[g]}</option>`).join('')}</select></label>`;
  const rowsA=a.r[ui.ap]||[];
  // Piso: la conexión manual solo se ofrece si es viable (grupos II, III o IV, misma dirección, sin giro con giro).
  const viable=ui.ap==='PISO'&&pisoViable(r,rowsA[i+1],a.nivel);
  if((ui.ap==='PISO'||ui.ap==='FIJA')&&i<rowsA.length-1&&(ui.ap!=='PISO'||r.c||viable)){const cur=(r.c&&r.cv!=null&&r.cv!=='')?String(r.cv):'';
    h+=`<label>Conexión manual con "${esc(rowsA[i+1].n)}"<select data-f="cvm" data-i="${i}"><option value="" ${cur===''?'selected':''}>No, solo según reglas</option><option value="0.1" ${cur==='0.1'?'selected':''}>Sí, 0.1</option><option value="0.2" ${cur==='0.2'?'selected':''}>Sí, 0.2</option></select></label>`;}
  if((ui.ap==='PISO'||ui.ap==='FIJA')&&!r.c&&r.nc&&(pot>0||viable)&&i<rowsA.length-1)h+=`<button class="btn ghost" data-act="relink" data-i="${i}">Conectar con "${esc(rowsA[i+1].n)}" (${pot>0?'+'+pot.toFixed(1):'sin bonificación'})</button>`;
  if(ui.ap==='PARALELAS'&&llegaAManos(r))h+=`<label>Después hace (sin valor)<select data-f="pv" data-i="${i}"><option value="" ${!r.pv?'selected':''}>Según el siguiente elemento</option>${Object.entries(PV_OPC).map(([k,t])=>`<option value="${k}" ${r.pv===k?'selected':''}>${t}</option>`).join('')}</select></label>`;
  if(ui.ap==='FIJA'&&r.g===2)h+=`<label>Al agarrar continúa con<select data-f="gig" data-i="${i}"><option value="" ${!r.gig?'selected':''}>Según el siguiente elemento</option><option value="gigante" ${r.gig==='gigante'?'selected':''}>Cae a gigante</option><option value="molino" ${r.gig==='molino'?'selected':''}>Cae a molino</option></select></label>`;
  if(ui.ap==='FIJA'&&kipAManos(r))h+=`<label>Después hace (sin valor)<select data-f="pv" data-i="${i}"><option value="" ${!r.pv?'selected':''}>Según el siguiente elemento</option>${Object.entries(FV_OPC).map(([k,t])=>`<option value="${k}" ${r.pv===k?'selected':''}>${t} y sigue a gigante</option>`).join('')}</select></label>`;
  if(ui.ap==='FIJA')h+=`<label class="opt"><input type="checkbox" data-f="ct" data-i="${i}" ${r.ct?'checked':''}> Después de este elemento hay cambio de toma (sin valor)</label>`;
  if(r.k&&CAT[r.k])h+=`<small style="color:var(--muted)">${esc(CAT[r.k].d)}${CAT[r.k].en&&CAT[r.k].en!==CAT[r.k].d?`<br><i>Código en inglés: ${esc(CAT[r.k].en)}</i>`:''}${CAT[r.k].corr?'<br>Traducción corregida con el Código en inglés.':''}</small>`;
  return h+`</div>`;
}
function renderSug(q,target){
  const box=document.getElementById(target); if(!box)return;
  const a=S.atletas[ui.atleta]; if(!q.trim()){box.innerHTML='';return;}
  const res=search(q,ui.ap,a.nivel);
  let h='<div class="sug">';
  for(const s of res){const e=CAT[s.k];const r=rowFromKey(s.k);
    const tag=r.t==='JA'?'Juvenil / virtual USAG · A 0.1':ui.ap==='SALTO'?`${keyLabel(r)} · ${(a.nivel==='N7'||a.nivel==='N8')?'valor USAG '+r.v.toFixed(1):(e.v??'-')}`:`${keyLabel(r)} · ${r.l} ${(LV[r.l]||0).toFixed(1)}`;
    h+=`<button data-act="pick" data-k="${esc(s.k)}" data-n="${esc(s.name?s.name.replace(/^./,c=>c.toUpperCase()):'')}"><b>${esc(s.name?s.name.replace(/^./,c=>c.toUpperCase()):e.d)}</b><small><span class="k">${esc(tag)}</span> · ${esc(e.d)}${e.en&&e.en!==e.d?`<br><i>EN: ${esc(e.en)}</i>`:''}</small></button>`;}
  h+=`<button data-act="manual"><b>Agregar "${esc(q)}" a mano</b><small>Tú indicas grupo y valor</small></button></div>`;
  box.innerHTML=h;
}

/* ---------- dictado de rutina ---------- */
// Se dicta (micrófono del navegador o del teclado) o se escribe: "1 parado de manos, 2 mortal adelante agrupado, 3 …".
// Cada número que sigue en orden (1, 2, 3… o uno, dos, tres…) empieza un elemento; sin números se separa por comas o
// renglones. Cada parte se busca con search() y se revisa antes de colocarla. "conectado con/a" al final de un elemento
// = conexión con el siguiente (piso y fija). Nada se guarda hasta tocar "Colocar".
const NUM_PAL={uno:1,primero:1,dos:2,segundo:2,tres:3,tercero:3,cuatro:4,cuarto:4,cinco:5,quinto:5,seis:6,sexto:6,siete:7,septimo:7,ocho:8,octavo:8,nueve:9,noveno:9,diez:10,decimo:10,once:11,doce:12,trece:13,catorce:14,quince:15};
const DICT_RELLENO=/^(y |luego |despues |entonces |hace |hacemos |hago |va |sigue |el |la |un |una |elemento |numero )+/;
const DICT_CONEXION=/ (conectad[oa]s?|enlazad[oa]s?|en conexion)( (a|al|con|en))?( (el|la) (siguiente|que sigue))?$/;
let REC=null, DICT_VOC={};
// Palabras que conoce el buscador en un aparato (Código en español e inglés y apodos), para corregir lo mal dictado.
function dictVocabulario(ap,nivel){const tab=table(ap,nivel),key=tab+'|'+ap;if(DICT_VOC[key])return DICT_VOC[key];
  const v=new Set(),pref=tab==='N8ARZON'?'N8ARZON|':ap+'|',add=t=>nk(t).split(' ').forEach(w=>{if(w.length>=4&&!/\d/.test(w))v.add(w);});
  for(const [k,e] of Object.entries(CAT))if(k.startsWith(pref)||k.startsWith('JA|'+ap+'|'))add(e.d+' '+(e.en||''));
  for(const src of [S.alias,ALIAS])for(const ak of Object.keys(src))if(ak.startsWith(tab+'|'+ap+'|'))add(ak.slice(tab.length+ap.length+2));
  return DICT_VOC[key]=[...v];}
function distancia(a,b){if(Math.abs(a.length-b.length)>2)return 9;const m=[...Array(b.length+1).keys()];
  for(let i=1;i<=a.length;i++){let prev=m[0];m[0]=i;for(let j=1;j<=b.length;j++){const t=m[j];m[j]=Math.min(m[j]+1,m[j-1]+1,prev+(a[i-1]===b[j-1]?0:1));prev=t;}}return m[b.length];}
function dictCorregir(q,ap,nivel){const voc=dictVocabulario(ap,nivel),set=new Set(voc);let cambio=false;
  const out=q.split(' ').map(w=>{if(w.length<4||set.has(w)||/\d/.test(w)||STOP.has(w)||SYN[w])return w;
    let mejor=null,dm=w.length>=7?2:1;for(const c of voc){const d=distancia(w,c);if(d<=dm&&(!mejor||d<dm)){mejor=c;dm=d;}}
    if(mejor){cambio=true;return mejor;}return w;});
  return cambio?out.join(' '):null;}
function partirDictado(t){
  const norm=w=>w.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const tk=String(t||'').replace(/[\n;]+/g,' | ').replace(/\bsiguiente\b(?! que)/gi,' | ').split(/\s+/).filter(Boolean);
  const numDe=w=>{const x=norm(w).replace(/[.,:)\-]+$/,'');return /^\d{1,2}$/.test(x)?+x:(NUM_PAL[x]||0);};
  const hayNumeros=tk.some(w=>numDe(w)===1);
  const segs=[];let cur=[],esp=1;
  const corta=()=>{const x=cur.join(' ').trim();if(x)segs.push(x);cur=[];};
  for(let j=0;j<tk.length;j++){const w=tk[j];
    if(w==='|'){corta();continue;}
    if(hayNumeros&&numDe(w)===esp){
      // "número 1" / "elemento 1": la palabra anterior no es parte del elemento
      if(cur.length&&/^(numero|elemento|el)$/.test(norm(cur[cur.length-1])))cur.pop();
      corta();esp++;continue;}
    if(!hayNumeros&&/,$/.test(w)){cur.push(w.slice(0,-1));corta();continue;}
    cur.push(w);
  }
  corta();
  return segs.map(x=>x.replace(/^[\s,.:\-]+|[\s,.:\-]+$/g,'')).filter(Boolean);
}
function dictBuscar(txt,ap,nivel){
  let q=' '+nk(txt)+' ', c=false, cAnt=false;
  if(/^ (conectad[oa]|enlazad[oa]) (a|al|con) /.test(q)){cAnt=true;q=q.replace(/^ (conectad[oa]|enlazad[oa]) (a|al|con) /,' ');}
  if(DICT_CONEXION.test(q.trimEnd())){c=true;q=q.trimEnd().replace(DICT_CONEXION,' ')+' ';}
  q=q.trim().replace(DICT_RELLENO,'').trim();
  // Formas habladas: "parado de manos" = apoyo invertido (en aparatos; en piso no es elemento del Código); en piso la
  // rondada y el flic previos no tienen valor.
  if(ap!=='PISO')q=(' '+q+' ').replace(/ parad[oa] de manos /g,' apoyo invertido ').trim();
  if(ap==='PISO'){const sq=q.replace(/^((rondada|flick flack|flic flac|flick flac|flic flack|flic|flick) )+(?=\S)/,'');if(!/^(flac|flack)$/.test(sq))q=sq;}
  let opts=search(q,ap,nivel);
  if(!opts.length||opts[0].score<1.4){const q2=dictCorregir(q,ap,nivel);if(q2){const o2=search(q2,ap,nivel);if(o2.length&&(!opts.length||o2[0].score>opts[0].score))opts=o2;}}
  let conf=!opts.length?'no':(opts[0].score>=1.4&&(!opts[1]||opts[0].score-opts[1].score>=.15))?'ok':'duda';
  return{txt:q,opts,k:opts.length?opts[0].k:'m',name:opts.length?opts[0].name||'':'',conf,c,cAnt};
}
function dictAnalizar(){
  const a=S.atletas[ui.atleta], d=ui.dict;
  d.items=partirDictado(d.txt).map(x=>dictBuscar(x,ui.ap,a.nivel));
  // "conectado con …" al inicio de un elemento une con el anterior
  d.items.forEach((it,j)=>{if(it.cAnt&&j>0)d.items[j-1].c=true;});
}
function dictOpcion(s,a){const e=CAT[s.k],r=rowFromKey(s.k),nm=s.name?s.name.replace(/^./,c=>c.toUpperCase()):e.d;
  const tag=r.t==='JA'?'Juvenil A 0.1':ui.ap==='SALTO'?`${keyLabel(r)} · ${(a.nivel==='N7'||a.nivel==='N8')?r.v.toFixed(1):(e.v??'-')}`:`${keyLabel(r)} · ${r.l} ${(LV[r.l]||0).toFixed(1)}`;
  return `${nm} · ${tag}${s.name?' · '+e.d:''}`;}
function dictPanel(a,rows){
  const d=ui.dict, apTxt=(APS.find(x=>x[0]===ui.ap)||[])[1]||ui.ap, link=ui.ap==='PISO'||ui.ap==='FIJA';
  const voz=!!(window.SpeechRecognition||window.webkitSpeechRecognition);
  let h=`<div class="dict"><b>Dictar rutina · ${esc(apTxt)}</b>
    <small>Di o escribe los elementos en orden con su número: "1 parado de manos, 2 mortal adelante agrupado, 3 flic mortal atrás extendido…".${link?' Di "conectado con" al final de un elemento para unirlo con el siguiente.':''} ${voz?'Toca 🎤 Hablar, o usa el micrófono del teclado dentro del cuadro.':'En este navegador usa el micrófono del teclado del celular dentro del cuadro.'}</small>
    <textarea id="dtxt" rows="4" placeholder="1 parado de manos, 2 mortal adelante agrupado…">${esc(d.txt)}</textarea>
    <div class="dbtns">${voz?`<button class="btn" data-act="dmic">${REC_ON?'■ Detener':'🎤 Hablar'}</button>`:''}<button class="btn" data-act="dana">Buscar elementos</button><button class="btn ghost" data-act="dno">Cancelar</button></div>
    <div class="dmsg">${esc(d.msg||'')}</div>`;
  if(d.items){
    if(!d.items.length)h+=`<div class="empty">No encontré elementos en el texto.</div>`;
    else{
      h+=`<small>Revisa cada elemento: en verde está seguro, en amarillo hay otras opciones parecidas y en rojo no lo encontró. Puedes corregir lo que entendió o elegir otro de la lista.</small><div class="dlist">`;
      d.items.forEach((it,j)=>{
        h+=`<div class="drow ${it.k==='x'?'skip':it.conf}"><span class="num">${j+1}</span><div class="dbody">
          <input data-d="t" data-i="${j}" value="${esc(it.txt)}" aria-label="Lo que entendió" autocomplete="off">
          <select data-d="k" data-i="${j}" aria-label="Elemento">${it.opts.map(s=>`<option value="${esc(s.k)}" ${it.k===s.k?'selected':''}>${esc(dictOpcion(s,a))}</option>`).join('')}
            <option value="m" ${it.k==='m'?'selected':''}>Agregar "${esc(it.txt)}" a mano (grupo y valor después)</option><option value="x" ${it.k==='x'?'selected':''}>No agregar</option></select>
          ${link&&j<d.items.length-1?`<label class="opt"><input type="checkbox" data-d="c" data-i="${j}" ${it.c?'checked':''}> Conectado con el siguiente</label>`:''}</div></div>`;});
      h+=`</div>`;
      const n=d.items.filter(it=>it.k!=='x').length;
      if(rows.length)h+=`<div class="dmodo"><label class="opt"><input type="radio" name="dmodo" data-d="modo" value="fin" ${d.modo!=='rep'?'checked':''}> Agregar al final (ya tiene ${rows.length})</label><label class="opt"><input type="radio" name="dmodo" data-d="modo" value="rep" ${d.modo==='rep'?'checked':''}> Reemplazar la rutina de ${esc(apTxt)}</label></div>`;
      h+=`<button class="btn" data-act="dok" ${n?'':'disabled'}>Colocar ${n} elemento${n===1?'':'s'} en la rutina</button>`;
    }
  }
  return h+`</div>`;
}
// Una frase a la vez y solo el resultado final: en Chrome de Android el modo continuo con resultados parciales repite
// lo dicho ("1 1 1 flic flic flic…"). Al terminar cada frase se vuelve a escuchar solo hasta tocar ■ Detener.
let REC_ON=false;
function dictLimpiar(t){return String(t).replace(/[,.;:]+/g,' ').replace(/(^|\s)(\S+)(\s+\2(?=\s|$)){2,}/gi,'$1$2').replace(/\s+/g,' ').trim();}
function dictMic(){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition, d=ui.dict;
  if(REC_ON){REC_ON=false;if(REC)REC.stop();return;}
  if(!SR){d.msg='Este navegador no tiene dictado por voz: usa el micrófono del teclado dentro del cuadro.';return render();}
  const ta=document.getElementById('dtxt'); if(ta)d.txt=ta.value;
  REC_ON=true;
  const escuchar=()=>{
    if(!REC_ON||!ui.dict)return;
    REC=new SR(); REC.lang='es-MX'; REC.continuous=false; REC.interimResults=false; REC.maxAlternatives=1;
    REC.onresult=e=>{const r=e.results[e.results.length-1];if(!r||!r.isFinal)return;
      const frase=dictLimpiar(r[0].transcript);if(!frase)return;
      d.txt=(d.txt.trim()?d.txt.trim().replace(/,$/,'')+', ':'')+frase; const t=document.getElementById('dtxt'); if(t)t.value=d.txt;};
    REC.onerror=e=>{if(e.error==='not-allowed'||e.error==='service-not-allowed'){REC_ON=false;d.msg='No hay permiso para el micrófono: actívalo en el navegador o usa el micrófono del teclado.';}
      else if(e.error!=='no-speech'&&e.error!=='aborted'){REC_ON=false;d.msg='El dictado se detuvo ('+e.error+'). Puedes usar el micrófono del teclado.';}};
    REC.onend=()=>{REC=null;if(REC_ON&&ui.dict)setTimeout(escuchar,200);else if(ui.dict){d.msg=d.msg&&d.msg.startsWith('Escuchando')?'':d.msg;render();}};
    try{REC.start();}catch(err){REC=null;REC_ON=false;d.msg='No se pudo iniciar el micrófono.';render();}
  };
  d.msg='Escuchando… di un elemento por frase (por ejemplo "uno, flic flac") y toca ■ Detener al terminar.';
  escuchar(); render();
}
function dictColocar(){
  const a=S.atletas[ui.atleta], rows=a.r[ui.ap], d=ui.dict, link=ui.ap==='PISO'||ui.ap==='FIJA';
  const nuevos=[];
  d.items.forEach(it=>{if(it.k==='x')return;
    let row;
    if(it.k==='m'||!CAT[it.k])row={n:it.txt?it.txt.replace(/^./,c=>c.toUpperCase()):'Elemento',k:null,t:'M',l:'A',g:1,id:'',v:ui.ap==='SALTO'?0:undefined};
    // Nombre: el apodo que coincidió, el que ya usa en otras rutinas o, si no hay, lo que se dictó.
    else{const s=it.opts.find(o=>o.k===it.k), cap=x=>x.replace(/^./,c=>c.toUpperCase());
      row=rowFromKey(it.k,s&&s.name?cap(s.name):(apodoDe(it.k)||!it.txt)?'':cap(it.txt));}
    if(link&&it.c)row.c=true;
    nuevos.push(row);});
  if(!nuevos.length)return;
  if(link)nuevos[nuevos.length-1].c=false;
  if(d.modo==='rep'&&rows.length){if(!confirm(`Se reemplazan los ${rows.length} elementos actuales de ${ui.atleta} en este aparato por los ${nuevos.length} dictados. ¿Continuar?`))return;rows.splice(0,rows.length);}
  rows.push(...nuevos); ui.dict=null; ui.open=-1; save(); render();
}

/* ---------- eventos ---------- */
root.addEventListener('click',e=>{
  const el=e.target.closest('[data-act]'); if(!el)return;
  if(el.dataset.act!=='del')ui.del=-1;
  const act=el.dataset.act, i=+el.dataset.i, a=ui.atleta&&S.atletas[ui.atleta], rows=a&&a.r[ui.ap];
  if(act==='open'){ui={view:'athlete',atleta:el.dataset.v,ap:'PISO',open:-1,q:'',replace:-1};return render();}
  if(act==='list'){ui.view='list';ui.open=-1;return render();}
  if(act==='ap'){ui.ap=el.dataset.v;ui.open=-1;ui.q='';ui.replace=-1;return render();}
  if(act==='export')return exportExcel();
  if(act==='menu'){ui.view='menu';return render();}
  if(act==='libres'){ui.view='list';ui.delMode=false;ui.adding=false;return render();}
  if(act==='addform'){ui.adding=!ui.adding;ui.addErr='';ui.delMode=false;ui.delAsk=null;render();document.getElementById('newName')?.focus();return;}
  if(act==='addno'){ui.adding=false;return render();}
  if(act==='addok'){const nm=(document.getElementById('newName').value||'').trim().replace(/\s+/g,' ').toUpperCase(), lv=document.getElementById('newLevel').value;
    if(!nm){ui.addErr='Escribe el nombre.';return render();}
    if(S.atletas[nm]){ui.addErr='Ya existe un atleta con ese nombre.';return render();}
    const r={};APS.forEach(([ap])=>r[ap]=[]);S.atletas[nm]={nivel:lv,r,p:{}};S.bajas=(S.bajas||[]).filter(x=>x!==nm);
    if(!ORDER.includes(nm))ORDER.push(nm);ui.adding=false;save();ui={view:'athlete',atleta:nm,ap:'PISO',open:-1,q:'',replace:-1};return render();}
  if(act==='delmode'){ui.delMode=!ui.delMode;ui.delAsk=null;ui.adding=false;return render();}
  if(act==='delask'){ui.delAsk=el.dataset.v;return render();}
  if(act==='delno'){ui.delAsk=null;return render();}
  if(act==='delok'){const nm=ui.delAsk;delete S.atletas[nm];ORDER=ORDER.filter(x=>x!==nm);S.bajas=[...new Set([...(S.bajas||[]),nm])];ui.delAsk=null;save();return render();}
  if(act==='dict'){REC_ON=false;if(REC)REC.stop();ui.dict={txt:'',items:null,modo:'fin'};ui.q='';ui.replace=-1;render();document.getElementById('dtxt')?.focus();return;}
  if(act==='dno'){REC_ON=false;if(REC)REC.stop();ui.dict=null;return render();}
  if(act==='dmic')return dictMic();
  if(act==='dana'){REC_ON=false;if(REC)REC.stop();const t=document.getElementById('dtxt');if(t)ui.dict.txt=t.value;ui.dict.msg='';dictAnalizar();return render();}
  if(act==='dok')return dictColocar();
  if(act==='print')return printAll();
  if(act==='dprint')return printAll(divPrintHTML,DIV_PREF);
  if(act==='edit'){ui.open=ui.open===i?-1:i;ui.replace=-1;ui.q='';return render();}
  if(act==='up'&&i>0){[rows[i-1],rows[i]]=[rows[i],rows[i-1]];ui.open=-1;save();return render();}
  if(act==='down'&&i<rows.length-1){[rows[i+1],rows[i]]=[rows[i],rows[i+1]];ui.open=-1;save();return render();}
  if(act==='del'){if(ui.del!==i){ui.del=i;return render();}rows.splice(i,1);ui.del=-1;ui.open=-1;save();return render();}
  if(act==='link'){rows[i].c=!rows[i].c;save();return render();}
  if(act==='nolink'){rows[i].nc=true;save();return render();}
  if(act==='relink'){rows[i].c=true;delete rows[i].nc;save();return render();}
  if(act==='plant'){a.p=a.p||{};a.p[ui.ap]=el.checked;save();return render();}
  if(act==='balpiso'){a.p=a.p||{};a.p.balPiso=el.checked||undefined;save();return render();}
  if(act==='reseed'){if(!confirm(`Se reemplaza la rutina de ${ui.atleta} en todos los aparatos con la del Excel. ¿Continuar?`))return;
    S.atletas[ui.atleta]=seedAthlete(ui.atleta,a.nivel);ui.open=-1;save();return render();}
  if(act==='pick'||act==='manual'){
    const typed=ui.q.trim();
    let row;
    if(act==='pick'){const k=el.dataset.k;
      const isAlias=typed&&!/^\d/.test(typed);
      // Si la sugerencia es un apodo (p. ej. escribes "wug" y eliges "Wugonian"), el apodo se completa con ese nombre; se puede editar después.
      // Con la escritura que ya tenga en alguna rutina (mayúsculas, acentos); el fragmento escrito no se aprende como apodo.
      let sn=isAlias&&el.dataset.n||'';
      if(sn){const nn=nk(sn);for(const x of Object.values(S.atletas||{}))for(const rr of Object.values(x?.r||{}))for(const o of rr||[])if(o.k===k&&o.n&&nk(o.n)===nn)sn=o.n.trim();}
      row=rowFromKey(k,sn||(ui.replace>=0?rows[ui.replace].n:(isAlias?typed:'')));
      if(isAlias&&!sn)learn(typed,ui.ap,a.nivel,k);}
    else row={n:typed||'Elemento',k:null,t:'M',l:'A',g:1,id:'',v:ui.ap==='SALTO'?0:undefined};
    if(ui.replace>=0){row.c=rows[ui.replace].c;rows[ui.replace]=row;ui.open=ui.replace;}
    else{rows.push(row);ui.open=act==='manual'?rows.length-1:-1;}
    ui.q='';ui.replace=-1;save();return render();
  }
});
root.addEventListener('input',e=>{
  const t=e.target;
  if(t.id==='q'){ui.q=t.value;ui.replace=-1;renderSug(t.value,'sug');return;}
  if(t.id==='rq'){ui.q=t.value;ui.replace=+t.dataset.i;renderSug(t.value,'rsug');return;}
  if(t.id==='dtxt'&&ui.dict){ui.dict.txt=t.value;return;}
});
root.addEventListener('change',e=>{
  const t=e.target, a=ui.atleta&&S.atletas[ui.atleta];
  if(t.dataset.act==='nivel'){a.nivel=t.value;save();return render();}
  if(t.dataset.d&&ui.dict){const d=ui.dict, it=d.items&&d.items[+t.dataset.i];
    if(t.dataset.d==='modo'){d.modo=t.value;return render();}
    if(!it)return;
    if(t.dataset.d==='k'){it.k=t.value;const s=it.opts.find(o=>o.k===t.value);it.conf=t.value==='x'?it.conf:s?'ok':'no';return render();}
    if(t.dataset.d==='c'){it.c=t.checked;return;}
    if(t.dataset.d==='t'){const c=it.c, nv=dictBuscar(t.value,ui.ap,a.nivel);nv.c=c||nv.c;d.items[+t.dataset.i]=nv;return render();}
    return;}
  if(t.dataset.f){const r=a.r[ui.ap][+t.dataset.i], f=t.dataset.f;
    if(f==='n'){const antes=r.n;r.n=t.value.trim()||r.n;
      if(r.k&&CAT[r.k]&&r.n!==antes&&!/^\d/.test(r.n)&&nk(r.n)!==nk(CAT[r.k].d)){
        learn(r.n,ui.ap,a.nivel,r.k);
        const otros=[];for(const n of ORDER){const x=S.atletas[n];(x?.r?.[ui.ap]||[]).forEach(o=>{if(o!==r&&o.k===r.k&&nk(o.n)!==nk(r.n))otros.push([n,o]);});}
        if(otros.length){const lista=otros.slice(0,10).map(([n,o])=>`• ${n}: "${o.n}"`).join('\n')+(otros.length>10?`\n… y ${otros.length-10} más`:'');
          if(confirm(`Otros ${otros.length} elemento(s) tienen este mismo elemento del Código (${keyLabel(r)}):\n\n${lista}\n\n¿Ponerles también el nombre "${r.n}"? Solo cambia el nombre, no el valor ni la nota.`))otros.forEach(([,o])=>{o.n=r.n;});}
      }}
    if(f==='v')r.v=parseFloat(t.value)||0;
    if(f==='g')r.g=+t.value;
    if(f==='l')r.l=t.value;
    if(f==='gx')r.gx=t.value?+t.value:undefined;
    if(f==='ct')r.ct=t.checked||undefined;
    if(f==='gig')r.gig=t.value||undefined;
    if(f==='pv')r.pv=t.value||undefined;
    if(f==='cv')r.cv=t.value===''?undefined:t.value;
    if(f==='cvm'){if(t.value){r.c=true;r.cv=t.value;delete r.nc;}else{r.cv=undefined;r.c=false;}}
    save();render();}
});

/* ---------- OBLIGATORIOS (USAG/FMG División 1) ---------- */
const OAPS=[['PISO','Piso'],['ARZON','Hongo / Arzón'],['ANILLOS','Anillos'],['SALTO','Salto'],['PARALELAS','Paralelas'],['FIJA','Fija']];
function oblDefaults(nivel){const m={};for(const [ap] of OAPS){m[ap]={};if(ap==='SALTO')continue;(OBL.rut[nivel]?.[ap]||[]).forEach(x=>{if(x.v==null)m[ap][x.id]=true;});}return m;}
function oblNew(nivel){return{nivel:String(nivel),m:oblDefaults(String(nivel)),at:{},salto:(OBL.salto[String(nivel)]||[[null]])[0][0]};}
function oblCompute(a,ap){
  const lv=String(a.nivel), res={base:9,bon:0,om:0,land:0,np:0,notes:[],ok:{}};
  if(ap==='SALTO'){const ops=OBL.salto[lv]||[];const s=ops.find(o=>o[0]===a.salto)||ops[0];res.base=s?s[2]:9.9;res.vault=s?s[1]:'';
    if(a.at?.SALTO)res.land=.1;res.np=r1(Math.min(10,res.base+res.land));return res;}
  const items=OBL.rut[lv]?.[ap]||[], m=a.m?.[ap]||{}, omitVal=(OBL.omit[lv]||{})[ap]||1;
  const bes=items.filter(x=>x.v!=null&&m[x.id]);
  const valid=[];
  for(const b of bes){
    if(b.req&&!m[b.req]){res.notes.push(`${b.id} requiere ${b.req}: no cuenta.`);continue;}
    if(b.ex){const other=valid.find(x=>x.ex===b.ex);if(other){res.notes.push(`Solo cuenta una de las opciones ${b.ex} (${other.id} o ${b.id}).`);continue;}}
    valid.push(b);}
  const counted=valid.slice(0,3); if(valid.length>3)res.notes.push('Máximo 3 bonificaciones específicas por aparato.');
  counted.forEach(b=>{res.bon+=b.v;res.ok[b.id]=true;});
  const repl=new Set(counted.flatMap(b=>b.rep||[]));
  items.filter(x=>x.v==null).forEach(x=>{if(!m[x.id]&&!repl.has(x.id)){res.om+=omitVal;res.notes.push(`Parte #${x.id} sin marcar: -${omitVal.toFixed(1)} por parte omitida.`);}});
  if(a.at?.[ap])res.land=.1;
  res.bon=r1(res.bon);res.om=r1(res.om);
  const raw=res.base+res.bon-res.om+res.land; if(raw>10)res.notes.push('La nota máxima es 10.0.');
  res.np=r1(Math.max(0,Math.min(10,raw)));return res;
}
function oblTotals(a){const o={};let aa=0;for(const [ap] of OAPS){o[ap]=oblCompute(a,ap);aa+=o[ap].np;}o.aa=r1(aa);return o;}
function oblVista(){const v={orden:S.obl.orden,atletas:{}};for(const n of S.obl.orden){const a=S.obl.atletas[n];if(!a)continue;const t=oblTotals(a);
  v.atletas[n]={nivel:a.nivel,aa:t.aa,np:Object.fromEntries(OAPS.map(([ap])=>[ap,t[ap].np])),be:Object.fromEntries(OAPS.map(([ap])=>[ap,Object.keys(t[ap].ok)])),salto:t.SALTO.vault};}
  return v;}
function oblSeedFromRows(rows){
  S.obl=S.obl||{atletas:{},orden:[],bajas:[]};
  rows.forEach(r=>{const n=String(r[0]||'').trim().toUpperCase();const lv=parseInt(r[1]);if(!n||!(lv>=3&&lv<=6))return;
    if(S.obl.atletas[n]||(S.obl.bajas||[]).includes(n))return;S.obl.atletas[n]=oblNew(lv);S.obl.orden.push(n);});
}
function renderOList(){
  const O=S.obl;
  let h=`<div class="top"><button class="back" data-act="menu">← Editor</button><h1>Editar obligatorios</h1><span class="sync ${syncState[0]}">${esc(syncState[1])}</span></div>`;
  h+=`<div class="actions"><button class="btn" data-act="oadd">Agregar atleta</button><button class="btn ${ui.odel?'danger':'ghost'}" data-act="odelmode">${ui.odel?'Terminar de eliminar':'Eliminar atleta'}</button></div>`;
  if(ui.oadding)h+=`<div class="score addbox"><label>Nombre del atleta<input id="oName" autocomplete="off"></label><label>Nivel<select id="oLevel">${['3','4','5','6'].map(n=>`<option value="${n}">Nivel ${n}</option>`).join('')}</select></label>
    ${ui.oerr?`<div class="badge b">${esc(ui.oerr)}</div>`:''}<div class="actions"><button class="btn" data-act="oaddok">Agregar</button><button class="btn ghost" data-act="oaddno">Cancelar</button></div></div>`;
  if(ui.oask)h+=`<div class="score addbox"><b>¿Eliminar a ${esc(ui.oask)}?</b><small>Se borra su selección de elementos y deja de aparecer en Obligatorios.</small><div class="actions"><button class="btn danger" data-act="odelok">Eliminar</button><button class="btn ghost" data-act="odelno">Cancelar</button></div></div>`;
  h+=`<div class="cards">`;
  const _oprint=`<div class="actions printbar"><button class="btn" data-act="oprint">Imprimir obligatorios</button><small>Una hoja tamaño carta horizontal por atleta.</small></div>`;
  for(const n of O.orden){const a=O.atletas[n];if(!a)continue;const t=oblTotals(a);
    h+=ui.odel?`<button class="card del" data-act="odelask" data-v="${esc(n)}"><span><b>${esc(n)}</b><span class="lv">Nivel ${esc(a.nivel)}</span></span><span class="xdel">Eliminar</span></button>`
      :`<button class="card" data-act="oopen" data-v="${esc(n)}"><span><b>${esc(n)}</b><span class="lv">Nivel ${esc(a.nivel)}</span></span><span class="aa">${f1(t.aa)}</span></button>`;}
  if(!O.orden.length)h+=`<div class="empty">Sin atletas. Agrega el primero.</div>`;
  root.innerHTML=h+`</div>`+_oprint;
}
function renderOAth(){
  const n=ui.oat, a=S.obl.atletas[n]; if(!a){ui.view='olist';return renderOList();}
  const t=oblTotals(a), ap=ui.oap||'PISO', c=t[ap], lv=String(a.nivel);
  let h=`<div class="top"><button class="back" data-act="oback">← Atletas</button><h1></h1><span class="sync ${syncState[0]}">${esc(syncState[1])}</span></div>`;
  h+=`<div class="head"><h2>${esc(n)}</h2><select data-oc="nivel" aria-label="Nivel">${['3','4','5','6'].map(x=>`<option value="${x}" ${x===lv?'selected':''}>Nivel ${x}</option>`).join('')}</select><span class="aatot">NP AA <b>${f1(t.aa)}</b></span></div>`;
  h+=`<div class="tabs">${OAPS.map(([k,l])=>`<button class="tab ${k===ap?'on':''}" data-act="oap" data-v="${k}">${l}<span>${f1(t[k].np)}</span></button>`).join('')}</div>`;
  h+=`<div class="score"><div class="np"><strong>${f1(c.np)}</strong><em>Nota de partida · Nivel ${esc(lv)}</em></div>`;
  h+=`<div class="metrics"><div><b>${f1(c.base)}</b><small>Base</small></div><div><b>+${f1(c.bon)}</b><small>Bonificaciones</small></div><div><b>${c.om?'-'+f1(c.om):'0.0'}</b><small>Omisiones</small></div><div><b>+${f1(c.land)}</b><small>Aterrizaje</small></div></div>`;
  h+=`<label class="opt"><input type="checkbox" data-oc="at" ${a.at?.[ap]?'checked':''}> Bono por aterrizaje (+0.1)</label>`;
  if(c.notes.length)h+=`<div class="avisos"><b>Avisos (${c.notes.length})</b><ul class="notes">${c.notes.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`;
  h+=`</div>`;
  if(ap==='SALTO'){
    h+=`<div class="list">${(OBL.salto[lv]||[]).map(o=>`<label class="orow"><input type="radio" name="osalto" data-oc="salto" value="${o[0]}" ${(a.salto||OBL.salto[lv][0][0])===o[0]?'checked':''}><span class="otag">Salto</span><span class="otx">${esc(o[1])}<small>Nota base ${o[2].toFixed(1)}</small></span></label>`).join('')}</div>`;
  }else{
    const m=a.m?.[ap]||{};
    h+=`<div class="list">${(OBL.rut[lv]?.[ap]||[]).map(x=>{const be=x.v!=null;
      const sub=[x.req?`Requiere ${x.req}`:'',x.ex?'Solo una de las opciones':'',x.nota||''].filter(Boolean).join(' · ');
      const kind=be?(x.rep?`<span class="okind rep">Reemplaza #${x.rep.join(' y #')}</span>`:`<span class="okind add">Se agrega</span>`):'';
      const isRep=!be&&!m[x.id]&&(OBL.rut[lv]?.[ap]||[]).some(z=>z.v!=null&&m[z.id]&&(z.rep||[]).includes(x.id));
      return `<label class="orow ${be?'be':''} ${m[x.id]?'on':''} ${isRep?'repl':''}"><input type="checkbox" data-oc="mark" data-v="${esc(x.id)}" ${m[x.id]?'checked':''}><span class="otag">${be?esc(x.id)+' +'+x.v.toFixed(1):'#'+esc(x.id)}</span><span class="otx">${isRep?'<span class="okind rep">Reemplazada por BE</span>':''}${kind}${esc(x.t)}${sub?`<small>${esc(sub)}</small>`:''}</span></label>`;}).join('')}</div>`;
  }
  root.innerHTML=h;
}
root.addEventListener('click',e=>{
  const el=e.target.closest('[data-act]'); if(!el)return; const act=el.dataset.act; const O=S.obl;
  if(act==='oprint')return printAll(oblPrintHTML);
  if(act==='oblopen'){ui.view='olist';ui.odel=false;ui.oadding=false;ui.oask=null;return render();}
  if(act==='oback'){ui.view='olist';return render();}
  if(act==='oopen'){ui.view='oath';ui.oat=el.dataset.v;ui.oap='PISO';return render();}
  if(act==='oap'){ui.oap=el.dataset.v;return render();}
  if(act==='oadd'){ui.oadding=!ui.oadding;ui.oerr='';ui.odel=false;ui.oask=null;render();document.getElementById('oName')?.focus();return;}
  if(act==='oaddno'){ui.oadding=false;return render();}
  if(act==='oaddok'){const nm=(document.getElementById('oName').value||'').trim().replace(/\s+/g,' ').toUpperCase(),lv=document.getElementById('oLevel').value;
    if(!nm){ui.oerr='Escribe el nombre.';return render();} if(O.atletas[nm]){ui.oerr='Ya existe un atleta con ese nombre.';return render();}
    O.atletas[nm]=oblNew(lv);O.bajas=(O.bajas||[]).filter(x=>x!==nm);if(!O.orden.includes(nm))O.orden.push(nm);ui.oadding=false;save();ui.view='oath';ui.oat=nm;ui.oap='PISO';return render();}
  if(act==='odelmode'){ui.odel=!ui.odel;ui.oask=null;ui.oadding=false;return render();}
  if(act==='odelask'){ui.oask=el.dataset.v;return render();}
  if(act==='odelno'){ui.oask=null;return render();}
  if(act==='odelok'){const nm=ui.oask;delete O.atletas[nm];O.orden=O.orden.filter(x=>x!==nm);O.bajas=[...new Set([...(O.bajas||[]),nm])];ui.oask=null;save();return render();}
});
root.addEventListener('change',e=>{
  const t=e.target, k=t.dataset.oc; if(!k)return; const a=S.obl.atletas[ui.oat]; if(!a)return; const ap=ui.oap||'PISO';
  if(k==='nivel'){a.nivel=t.value;a.m=oblDefaults(t.value);a.salto=OBL.salto[t.value][0][0];}
  if(k==='at'){a.at=a.at||{};a.at[ap]=t.checked||undefined;}
  if(k==='mark'){a.m=a.m||{};a.m[ap]=a.m[ap]||{};const mm=a.m[ap],id=t.dataset.v,items=OBL.rut[String(a.nivel)]?.[ap]||[],x=items.find(z=>z.id===id);
    if(t.checked){mm[id]=true;
      if(x&&x.v!=null){(x.rep||[]).forEach(r=>delete mm[r]);
        if(x.ex)items.filter(z=>z.ex===x.ex&&z.id!==id&&mm[z.id]).forEach(z=>{delete mm[z.id];});}
      else items.filter(z=>z.v!=null&&mm[z.id]&&(z.rep||[]).includes(id)).forEach(z=>delete mm[z.id]);}
    else{delete mm[id];
      if(x&&x.v!=null)(x.rep||[]).forEach(r=>{if(!items.some(z=>z.v!=null&&mm[z.id]&&(z.rep||[]).includes(r)))mm[r]=true;});}}
  if(k==='salto')a.salto=t.value;
  save();render();
});

/* ---------- imprimir ---------- */
const AP_NAME={PISO:'Piso',ARZON:'Arzón',ANILLOS:'Anillos',SALTO:'Salto',PARALELAS:'Paralelas',FIJA:'Fija'};
let PRINT_PREF='Rutinas AKC';
function printAll(build,pref){
  PRINT_PREF=pref||(typeof build==='function'?'Obligatorios AKC':'Rutinas AKC');
  let area=document.getElementById('printArea');
  if(!area){area=document.createElement('div');area.id='printArea';document.body.appendChild(area);}
  const fecha=new Date().toLocaleDateString('es-MX',{day:'numeric',month:'long',year:'numeric'});
  let h='';
  if(typeof build==='function')h=build(fecha); else for(const n of ORDER){const a=S.atletas[n];if(!a)continue;const t=totals(n);
    h+=`<section class="sheet fsheet"><header class="ph"><img src="logo.png" alt=""><div><h1>${esc(n)}</h1><p>Nivel ${esc(a.nivel)} · Rutinas libres · ${esc(fecha)}</p></div><div class="paa"><span>NP AA</span><b>${f1(t.aa)}</b></div></header><div class="pgrid">`;
    for(const [ap] of APS){const c=t[ap], rows=a.r[ap]||[];
      h+=`<article class="pap"><div class="pap-h"><h2>${AP_NAME[ap]}</h2><b>NP ${f1(c.np)}</b></div>`;
      if(ap==='SALTO'){
        h+=`<div class="pm">Valor salto 1: ${c.vaults[0]?c.vaults[0].v.toFixed(1):'-'}${c.vaults[1]?` · Salto 2: ${c.vaults[1].v.toFixed(1)} · Promedio: ${f1(c.avg)}`:''}</div>`;
        h+=`<table><tr><th>Salto</th><th>ID</th><th>Grupo</th><th>Valor</th><th>NP</th></tr>`;
        rows.forEach((r,i)=>{const vv=c.vaults.find(x=>x.i===i);h+=`<tr><td>${esc(r.n)}</td><td>${esc(r.id||'')}</td><td>${r.g?ROM[r.g]:''}</td><td>${vv?vv.v.toFixed(1):''}</td><td>${vv?f1(vv.np):''}</td></tr>`;});
      }else{
        h+=`<div class="pm">Dificultad ${f1(c.dv)} · Grupos ${f1(c.eg)} · Conexión ${f1(c.cv)}${c.bon?` · Bonos ${f1(c.bon)}`:''}${c.nd?` · Ded. neutral -${f1(c.nd)}`:''}</div>`;
        h+=`<table><tr><th>Elemento</th><th>ID</th><th>Grupo</th><th>Valor</th><th>VD</th></tr>`;
        rows.forEach((r,i)=>{const vd=c.rep.has(i)?0:valOf(r,a.nivel,ap);
          h+=`<tr class="${res_off(c,i,vd)?'off':''}"><td>${esc(r.n)}${PV_TXT(r.pv)?' → '+esc(PV_TXT(r.pv)):''}${r.c&&i<rows.length-1?' <span class="cx">↔</span>':''}</td><td>${r.t==='JA'?'EV':esc(r.id||'')}</td><td>${r.t==='JA'?'X':(r.g?ROM[r.g]:'')}</td><td>${r.t==='JA'?'A':esc(r.l||'')}</td><td>${vd.toFixed(1)}</td></tr>`;});
      }
      if(!rows.length)h+=`<tr><td colspan="5">Sin elementos</td></tr>`;
      h+=`</table></article>`;}
    h+=`</div><footer class="pf">↔ conectado con el siguiente elemento. En gris: elementos que no cuentan para la dificultad.</footer></section>`;}
  area.innerHTML=h;
  const imgs=[...area.querySelectorAll('img')];
  Promise.all(imgs.map(im=>im.complete?1:new Promise(r=>{im.onload=im.onerror=r;}))).then(()=>{
    fitOblSheets(area);fitDivSheets(area);
    const prev=document.title, d=new Date(); document.title=`${PRINT_PREF} ${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`;
    if(area.querySelector('.dsheet')){const t=document.title;document.title=prev;return divDescargarPDF(area,t);}
    window.print(); setTimeout(()=>{document.title=prev;},1000);});
}
/* Libres y obligatorios: acomoda los 6 aparatos en 3 columnas (opción A o B, la que deje letra más grande) y elige por atleta
   la letra más grande con la que todo cabe en una hoja carta horizontal. */
function fitOblSheets(area){
  const pxmm=96/25.4, alto=199.9*pxmm*0.98; // alto útil de la hoja (215.9 mm - márgenes), con 2 % de holgura
  area.classList.add('measuring');
  area.querySelectorAll('.osheet,.fsheet').forEach(sh=>{
    const grid=sh.querySelector('.pgrid'), cards=[...grid.querySelectorAll(':scope > .pap')];
    grid.innerHTML='';const cols=[0,1,2].map(()=>{const d=document.createElement('div');d.className='ocol';grid.appendChild(d);return d;});
    const acomodar=fs=>{
      sh.style.setProperty('--fs',fs+'px');
      cards.forEach(c=>cols[0].appendChild(c));
      const hs=cards.map(c=>c.getBoundingClientRect().height+2.5*pxmm);
      // Orden de las tarjetas: Piso, Hongo/Arzón, Anillos, Salto, Paralelas, Fija (OAPS).
      // Opción A: Piso+Arzón | Anillos+Salto+Paralelas | Fija.  Opción B: Piso+Arzón | Anillos+Salto | Paralelas+Fija.
      const OPCIONES=[[0,0,1,1,1,2],[0,0,1,1,2,2]];
      let mejor=OPCIONES[0],maxMejor=Infinity;
      OPCIONES.forEach(asig=>{const suma=[0,0,0];asig.forEach((cl,i)=>suma[cl]+=hs[i]||0);const m=Math.max(...suma);if(m<maxMejor){maxMejor=m;mejor=asig;}});
      cards.forEach((c,i)=>cols[mejor[i]].appendChild(c));
      return sh.getBoundingClientRect().height;
    };
    let lo=7,hi=18;
    for(let k=0;k<12;k++){const mid=(lo+hi)/2;if(acomodar(mid)<=alto)lo=mid;else hi=mid;}
    // Verificación final: si con la letra elegida no cabe, se baja poco a poco hasta que quepa.
    while(acomodar(lo)>alto&&lo>6)lo-=0.25;
  });
  area.classList.remove('measuring');
}
/* ---------- División de rutinas (impresión grupal para que los atletas aprendan su rutina) ---------- */
const DIV_PREF='División de rutinas AKC';
const DIV_GRUPOS=[['Nivel 7 y 8',['N7','N8']],['Nivel 9',['N9']],['Nivel 10',['N10']],['FIG',['FIG']]];
const DIV_AP={PISO:'PISO',ARZON:'ARZONES',ANILLOS:'ANILLOS',SALTO:'SALTO DE CABALLO',PARALELAS:'PARALELAS',FIJA:'FIJA'};
// Con 8 elementos: 1er enlace 1-3, 2do enlace 3-6, enlace a salir 6-8 (con otro número se ajusta igual).
function divBloques(n){if(n<4)return[];const b=[['1er enlace',1,3,'d1']];if(n-2>3)b.push(['2do enlace',3,n-2,'d2']);b.push(['Enlace a salir',n-2,n,'d3']);return b;}
// Mitades: 8 elementos 4 y 4, 7 elementos 4 y 3, 6 elementos 3 y 3 (la primera parte lleva el elemento de más).
function divMitades(n){if(n<2)return[];const m=Math.ceil(n/2);return[['Primera parte',1,m,'p1'],['Segunda parte',m+1,n,'p2']];}
function divPrintHTML(fecha){
  // Hojas de hasta 6 atletas. Si un grupo cabe completo en la hoja del grupo anterior, va en la misma hoja (p. ej. Nivel 10 y FIG).
  const POR=6, hojas=[];
  for(const [titulo,niveles] of DIV_GRUPOS){
    const at=ORDER.filter(n=>S.atletas[n]&&niveles.includes(S.atletas[n].nivel));if(!at.length)continue;
    const ult=hojas[hojas.length-1];
    if(ult&&!ult.parte&&ult.at.length+at.length<=POR){ult.titulos.push(titulo);ult.at.push(...at);continue;}
    for(let p=0;p<at.length;p+=POR)hojas.push({titulos:[titulo],at:at.slice(p,p+POR),parte:at.length>POR?`hoja ${p/POR+1} de ${Math.ceil(at.length/POR)}`:''});
  }
  let h='';
  for(const hj of hojas){const titulo=hj.titulos.length>1?hj.titulos.slice(0,-1).join(', ')+' y '+hj.titulos[hj.titulos.length-1]:hj.titulos[0];
      h+=`<section class="sheet dsheet"><header class="dh"><img src="logo.png" alt=""><div><h1>División de rutinas · ${esc(titulo)}</h1><p>${esc(fecha)}${hj.parte?` · ${hj.parte}`:''}</p></div></header><div class="dgrid" style="grid-template-columns:repeat(${Math.max(4,hj.at.length)},minmax(0,1fr))">`;
      for(const n of hj.at){const a=S.atletas[n];
        h+=`<div class="dcol"><div class="dname">${esc(n)}</div>`;
        for(const [ap] of APS){const rows=(a.r[ap]||[]).map(r=>r.n);const salto=ap==='SALTO';
          h+=`<div class="dap"><div class="dt">${DIV_AP[ap]}</div><div class="dhd${salto?' solo':''}"><span>NOMBRE</span>${salto?'':'<span>PARTES</span><span>DIVISIÓN</span>'}</div><div class="dbody${salto?' solo':''}">`;
          (rows.length?rows:['—']).forEach((nm,i)=>{h+=`<div class="de${i%2?' alt':''}" style="grid-row:${i+1}">${esc(nm)}</div>`;});
          if(!salto)divMitades(rows.length).forEach(([t,x,y,c])=>{h+=`<div class="db ${c}" style="grid-row:${x}/${y+1}"><span>${t}</span></div>`;});
          if(!salto)divBloques(rows.length).forEach(([t,x,y,c])=>{h+=`<div class="db ${c}" style="grid-row:${x}/${y+1}"><span>${t}</span></div>`;});
          h+=`</div></div>`;}
        h+=`</div>`;}
      h+=`</div></section>`;
  }
  return h||'<section class="sheet dsheet"><p>No hay atletas.</p></section>';
}
// Letra más grande con la que cada hoja de división cabe en una carta vertical.
function fitDivSheets(area){
  const sheets=area.querySelectorAll('.dsheet');if(!sheets.length)return;
  const pxmm=96/25.4, alto=263.4*pxmm*0.98;
  area.classList.add('measuring');
  sheets.forEach(sh=>{let lo=6,hi=15;
    for(let k=0;k<12;k++){const mid=(lo+hi)/2;sh.style.setProperty('--fs',mid+'px');if(sh.getBoundingClientRect().height<=alto)lo=mid;else hi=mid;}
    sh.style.setProperty('--fs',lo+'px');while(sh.getBoundingClientRect().height>alto&&lo>5){lo-=.25;sh.style.setProperty('--fs',lo+'px');}});
  area.classList.remove('measuring');
}
/* La división se entrega como PDF hecho aquí mismo y no con el diálogo de impresión: en Android el "tema oscuro para sitios"
   oscurece lo que dibuja el navegador (al imprimir y aun dentro de imágenes). Por eso el PDF se dibuja directo con jsPDF:
   cada fondo, borde y texto se copia de la hoja ya acomodada en pantalla, con sus colores reales. */
const JSPDF_URL='https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
function cargarJsPDF(){
  if(window.jspdf)return Promise.resolve();
  return new Promise((ok,no)=>{const s=document.createElement('script');s.src=JSPDF_URL;s.onload=ok;
    s.onerror=()=>no(new Error('No se pudo cargar el generador de PDF. Revisa tu conexión a internet.'));document.head.appendChild(s);});
}
function pdfColor(c){const m=/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/.exec(c||'');
  if(!m||(m[4]!==undefined&&+m[4]===0))return null;return[+m[1],+m[2],+m[3]];}
// Las letras estándar del PDF no traen todos los signos: se cambian por el más parecido.
function pdfTexto(t){return t.replace(/[″“”]/g,'"').replace(/[′‘’]/g,"'").replace(/[–—]/g,'-').replace(/…/g,'...').replace(/[^\x20-\xff]/g,'');}
async function divLogo(sh){
  const im=sh.querySelector('img');if(!im)return null;
  try{const r=await fetch(im.src);return new Uint8Array(await r.arrayBuffer());}catch(e){return null;}
}
function divHojaAPDF(doc,sh,logo){
  const pxmm=96/25.4, M=8, o=sh.getBoundingClientRect();
  const X=v=>M+(v-o.left)/pxmm, Y=v=>M+(v-o.top)/pxmm, L=v=>v/pxmm;
  // Fondos y bordes
  for(const el of sh.querySelectorAll('*')){
    const cs=getComputedStyle(el), r=el.getBoundingClientRect();if(!r.width||!r.height)continue;
    const bg=pdfColor(cs.backgroundColor);if(bg){doc.setFillColor(...bg);doc.rect(X(r.left),Y(r.top),L(r.width),L(r.height),'F');}
    for(const [lado,x,y,w,h] of [['Top',r.left,r.top,r.width,0],['Bottom',r.left,r.bottom,r.width,0],['Left',r.left,r.top,0,r.height],['Right',r.right,r.top,0,r.height]]){
      const bw=parseFloat(cs['border'+lado+'Width']);if(!bw||cs['border'+lado+'Style']==='none')continue;
      const bc=pdfColor(cs['border'+lado+'Color']);if(!bc)continue;doc.setFillColor(...bc);
      const ex=(lado==='Right')?-bw:0, ey=(lado==='Bottom')?-bw:0;
      doc.rect(X(x+ex),Y(y+ey),L(w||bw),L(h||bw),'F');}
  }
  const im=sh.querySelector('img');if(logo&&im){const r=im.getBoundingClientRect();try{doc.addImage(logo,'PNG',X(r.left),Y(r.top),L(r.width),L(r.height),'logo');}catch(e){}}
  // Textos
  const tw=document.createTreeWalker(sh,NodeFilter.SHOW_TEXT);let nd;
  while((nd=tw.nextNode())){
    const t=nd.textContent;if(!t.trim())continue;
    const cs=getComputedStyle(nd.parentElement), fs=parseFloat(cs.fontSize)*0.75;
    const bold=(parseInt(cs.fontWeight)||400)>=600, ital=cs.fontStyle==='italic';
    doc.setFont('helvetica',bold&&ital?'bolditalic':bold?'bold':ital?'italic':'normal');
    doc.setTextColor(...(pdfColor(cs.color)||[17,17,17]));
    const rg=document.createRange();
    if(cs.writingMode.startsWith('vertical')){
      rg.selectNodeContents(nd);const r=rg.getBoundingClientRect(), cel=nd.parentElement.closest('.db')||nd.parentElement, cr=cel.getBoundingClientRect();
      const txt=pdfTexto(t.trim());let f=fs;doc.setFontSize(f);
      const maxW=L(cr.height)*0.94;if(doc.getTextWidth(txt)>maxW){f=f*maxW/doc.getTextWidth(txt);doc.setFontSize(f);}
      const w=doc.getTextWidth(txt), cx=X((r.left+r.right)/2), cy=Y((cr.top+cr.bottom)/2);
      doc.text(txt,cx+f*0.3528*0.35,cy+w/2,{angle:90});
      continue;}
    // Renglones tal como quedaron en pantalla (palabra por palabra)
    const lineas=[];const re=/\S+/g;let m;
    while((m=re.exec(t))){rg.setStart(nd,m.index);rg.setEnd(nd,m.index+m[0].length);const r=rg.getBoundingClientRect();
      const ln=lineas.find(z=>Math.abs(z.cy-(r.top+r.bottom)/2)<r.height*0.4);
      if(ln){ln.ps.push(m[0]);ln.l=Math.min(ln.l,r.left);ln.r=Math.max(ln.r,r.right);}else lineas.push({cy:(r.top+r.bottom)/2,l:r.left,r:r.right,ps:[m[0]]});}
    const cel=nd.parentElement.getBoundingClientRect(), centro=cs.textAlign==='center';
    for(const ln of lineas){
      const txt=pdfTexto(ln.ps.join(' '));let f=fs;doc.setFontSize(f);
      const maxW=centro?L(cel.width)*0.96:L(ln.r-ln.l)*1.08;
      if(doc.getTextWidth(txt)>maxW){f=f*maxW/doc.getTextWidth(txt);doc.setFontSize(f);}
      const y=Y(ln.cy)+f*0.3528*0.35;
      if(centro)doc.text(txt,X((cel.left+cel.right)/2),y,{align:'center'});else doc.text(txt,X(ln.l),y);
    }
  }
}
async function divDescargarPDF(area,nombre){
  const btn=document.querySelector('[data-act="dprint"]'),txt=btn&&btn.textContent;
  if(btn){btn.disabled=true;btn.textContent='Generando PDF…';}
  area.classList.add('measuring');
  try{
    await cargarJsPDF();
    const doc=new window.jspdf.jsPDF({unit:'mm',format:'letter',orientation:'portrait'});
    const hojas=[...area.querySelectorAll('.dsheet')], logo=hojas.length?await divLogo(hojas[0]):null;
    hojas.forEach((sh,i)=>{if(i)doc.addPage('letter','portrait');divHojaAPDF(doc,sh,logo);});
    const a=document.createElement('a');a.href=URL.createObjectURL(doc.output('blob'));a.download=nombre.normalize('NFD').replace(/[̀-ͯ]/g,'')+'.pdf';
    document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),60000);
  }catch(e){alert(e.message||'No se pudo generar el PDF.');}
  finally{area.classList.remove('measuring');if(btn){btn.disabled=false;btn.textContent=txt;}}
}
function oblPrintHTML(fecha){
  let h='';
  for(const n of S.obl.orden){const a=S.obl.atletas[n];if(!a)continue;const t=oblTotals(a),lv=String(a.nivel);
    h+=`<section class="sheet osheet"><header class="ph"><img src="logo.png" alt=""><div><h1>${esc(n)}</h1><p>Nivel ${esc(lv)} · Obligatorios · ${esc(fecha)}</p></div><div class="paa"><span>NP AA</span><b>${f1(t.aa)}</b></div></header><div class="pgrid">`;
    for(const [ap,l] of OAPS){const c=t[ap];
      h+=`<article class="pap"><div class="pap-h"><h2>${l}</h2><b>NP ${f1(c.np)}</b></div>`;
      if(ap==='SALTO'){h+=`<div class="pm">${esc(c.vault||'')} · Base ${f1(c.base)}${c.land?' · Aterrizaje +0.1':''}</div>`;}
      else{const m=a.m?.[ap]||{};
        h+=`<div class="pm">Base ${f1(c.base)} · Bonificaciones +${f1(c.bon)}${c.om?` · Omisiones -${f1(c.om)}`:''}${c.land?' · Aterrizaje +0.1':''}</div><table>`;
        const repl=new Set((OBL.rut[lv]?.[ap]||[]).filter(z=>z.v!=null&&m[z.id]).flatMap(z=>z.rep||[]));
        (OBL.rut[lv]?.[ap]||[]).forEach(x=>{const be=x.v!=null, done=!!m[x.id];
          if(be&&!done)return;
          h+=`<tr class="${done?'':'off'}"><td class="ck">${done?'✓':(repl.has(x.id)?'↺':'✗')}</td><td class="oid">${be?esc(x.id)+' +'+x.v.toFixed(1):'#'+esc(x.id)}</td><td>${be?(x.rep?`(Reemplaza #${x.rep.join(' y #')}) `:'(Se agrega) '):''}${esc(x.t)}</td></tr>`;});
        h+=`</table>`;}
      h+=`</article>`;}
    h+=`</div><footer class="pf">✓ realizado. ↺ parte reemplazada por una BE. ✗ parte no realizada. Solo se listan las bonificaciones (BE) que hace el atleta.</footer></section>`;}
  return h;
}
function res_off(c,i,vd){return vd>0&&!c.counted.has(i);}
/* ---------- exportar ---------- */
function exportExcel(){
  const base=[], npR=[['','PISO','ARZON','ANILLO','SALTO','PARALELA','FIJA','Probable AA']], dR=[['','PISO','ARZON','ANILLO','SALTO','PARALELA','FIJA']], gR=[['','PISO','ARZON','ANILLO','SALTO','PARALELA','FIJA']];
  const oldNP={};(XLSX.utils.sheet_to_json(WB.Sheets['NP']||{},{header:1})||[]).forEach(r=>{if(r&&r[0])oldNP[nameKey(r[0])]=r;});
  base.push(['ATLETA','APARATO','ELEMENTO','NÚM DE ID','GRUPO','VALOR','Valor decimal']);
  for(const n of ORDER){const a=S.atletas[n];if(!a)continue;const t=totals(n);
    for(const [ap] of APS){const rows=a.r[ap]||[];const c=t[ap];
      rows.forEach((r,i)=>{
        if(ap==='SALTO'){const vv=c.vaults.find(x=>x.i===i);base.push([n,ap,r.n,r.id||'',r.g||'',vv?vv.v:r.v||0,0]);return;}
        const val=c.rep.has(i)?0:valOf(r,a.nivel,ap);
        base.push([n,ap,r.n+(r.gig?' A '+r.gig.toUpperCase():'')+(r.ct?' A CAMBIO DE TOMA':'')+(r.c?' CONECTADO A':''),r.t==='JA'?'EV':r.id,r.t==='JA'?'X':r.g,r.t==='JA'?'A':r.l,r1(val)]);});}
    const old=oldNP[nameKey(n)];const label=old?old[0]:n;
    npR.push([label,...APS.map(([ap])=>t[ap].np),old?old[7]??'':'']);
    dR.push([label,...APS.map(([ap])=>ap==='SALTO'?t[ap].dv:r1(t[ap].dv+t[ap].cv))]);
    gR.push([label,...APS.map(([ap])=>ap==='SALTO'?0:t[ap].eg)]);
  }
  const put=(name,aoa)=>{WB.Sheets[name]=XLSX.utils.aoa_to_sheet(aoa);if(!WB.SheetNames.includes(name))WB.SheetNames.push(name);};
  put('BASEAPPRUTINAS',base);put('NP',npR);put('Dificultad',dR);put('GRUPOS',gR);
  XLSX.writeFile(WB,'Excel_Solo_Valores.xlsx');
}

/* ---------- inicio ---------- */
async function init(){
  try{
    const [catRes,xRes]=await Promise.all([fetch('./elementos.json',{cache:'no-cache'}),fetch('./Excel_Solo_Valores.xlsx',{cache:'no-cache'})]);
    if(!catRes.ok)throw new Error('No se encontró elementos.json');
    if(!xRes.ok)throw new Error('No se encontró Excel_Solo_Valores.xlsx');
    const cj=await catRes.json(); CAT=cj.E; ALIAS=cj.alias; FIX=cj.fix||{}; buildIndex();
    OBL=await fetch('./obligatorios.json',{cache:'no-cache'}).then(r=>r.json());
    WB=XLSX.read(await xRes.arrayBuffer());
    EXCEL=XLSX.utils.sheet_to_json(WB.Sheets['BASEAPPRUTINAS'],{defval:''});
    ORDER=[...new Set(EXCEL.map(r=>String(r.ATLETA).trim()).filter(Boolean))];
  }catch(err){root.innerHTML=`<div class="top"><a class="back" href="index.html">← Rutinas</a></div><div class="empty">No se pudo abrir el editor: ${esc(err.message)}</div>`;return;}
  let stored=null;
  try{if(window.firebase){if(!firebase.apps.length)firebase.initializeApp(FB_CONFIG);cloud=firebase.firestore().collection(COLLECTION).doc(DOC);
    const snap=await cloud.get(); if(snap.exists){stored=snap.data();DOC_EXISTS=true;} setSync('ok','Guardado en la nube');}}
  catch(e){console.error(e);cloud=null;setSync('warn','Sin nube: guardado en este dispositivo');}
  if(!stored){try{stored=JSON.parse(localStorage.getItem(LOCAL)||'null');}catch(e){}}
  S={atletas:stored?.atletas||{},alias:stored?.alias||{},bajas:stored?.bajas||[],obl:stored?.obligatorios||stored?.obl||{atletas:{},orden:[],bajas:[]}};
  delete S.obl.vista; S.obl.orden=S.obl.orden||[]; S.obl.bajas=S.obl.bajas||[]; S.obl.atletas=S.obl.atletas||{};
  {const before=S.obl.orden.length;const rows=(XLSX.utils.sheet_to_json(WB.Sheets['OBLIGATORIOS']||{},{header:1})||[]).slice(1);oblSeedFromRows(rows);if(S.obl.orden.length!==before)var oblSeeded=true;}
  {const excel=ORDER.filter(n=>!S.bajas.includes(n));ORDER=[...(stored?.orden||[]).filter(n=>S.atletas[n]),...excel];ORDER=[...new Set(ORDER)];}
  for(const n in S.atletas)delete S.atletas[n].vista;
  const lv=readLevels(); let changed=false;
  for(const n of ORDER)if(!S.atletas[n]){S.atletas[n]=seedAthlete(n,lv[nameKey(n)]||'FIG');changed=true;}
  for(const n of Object.keys(S.atletas))if(!ORDER.includes(n))ORDER.push(n);
  if(DOC_EXISTS)SENT=curState();
  if(changed||typeof oblSeeded!=='undefined'||!DOC_EXISTS)save();
  if(cloud)cloud.onSnapshot(s=>{if(!s.exists||s.metadata.hasPendingWrites||SAVING)return;const d=s.data();DOC_EXISTS=true;
    S.atletas=d.atletas||{};for(const n in S.atletas)delete S.atletas[n].vista;S.bajas=d.bajas||[];S.alias=d.alias||{};
    ORDER=[...new Set([...(d.orden||[]).filter(n=>S.atletas[n]),...Object.keys(S.atletas)])];
    if(d.obligatorios){S.obl={atletas:d.obligatorios.atletas||{},orden:d.obligatorios.orden||[],bajas:d.obligatorios.bajas||[]};}
    SENT=curState();
    if(ui.view==='athlete'&&ui.atleta&&!S.atletas[ui.atleta]){ui.view='list';ui.atleta=null;}
    if(ui.view==='oath'&&ui.oat&&!S.obl.atletas[ui.oat]){ui.view='olist';ui.oat=null;}
    const ae=document.activeElement?.tagName;if(ae!=='INPUT'&&ae!=='TEXTAREA'&&ae!=='SELECT')render();},e=>console.error(e));
  render();
}
const PASS_HASH='edef2f146f863341daae63d0bf0b1e8aa49b805e273a6e6ca559e40dbb22e6d6';
async function sha256(t){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(t));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');}
function gate(msg){
  root.innerHTML=`<div class="top"><a class="back" href="index.html">← Rutinas</a><h1>Editor de rutinas</h1></div>
  <form class="score gate" id="gate"><label>Contraseña<input id="pw" type="password" autocomplete="off" required></label>
  ${msg?`<div class="badge b">${esc(msg)}</div>`:''}<button class="btn" type="submit">Entrar</button></form>`;
  const f=document.getElementById('gate');document.getElementById('pw').focus();
  f.addEventListener('submit',async e=>{e.preventDefault();
    try{if(await sha256(document.getElementById('pw').value)===PASS_HASH){sessionStorage.setItem('akcRutinasEditor','ok');init();}else gate('Contraseña incorrecta.');}
    catch(err){gate('No se pudo validar la contraseña en este navegador.');}});
}
if(sessionStorage.getItem('akcRutinasEditor')==='ok')init(); else gate('');
