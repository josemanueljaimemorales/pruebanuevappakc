/* Normativos de solo lectura para otros módulos (p. ej. Training).
 * Une el Excel NORMATIVOS_AKC.xlsx con lo guardado en la nube (normativosAKC/estado) igual que el
 * módulo Normativos: empareja por aparato + clasificación + elemento y la nube manda. No escribe nada.
 * Necesita xlsx-reader.js, config.js y, para la nube, Firebase (o akc-firestore.js en aguilaskc.net).
 */
(function(){
  "use strict";
  const APPS=["PISO","ARZON","ANILLOS","SALTO DE CABALLO","BARRAS PARALELAS","BARRA FIJA"];
  const FB_CONFIG={apiKey:"AIzaSyBNRAkDXLlw5fyiT01-ZfUyB0A7ShsAxyg",authDomain:"akc-con-reporte.firebaseapp.com",projectId:"akc-con-reporte"};
  const normName=s=>String(s??"").normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/\s+/g," ").trim().toLowerCase();
  const ESTADO={"Consolidado":"C","En proceso":"EP","Proyección":"P","N/A":"NA"};

  function desdeExcel(rows){
    const names=[];
    for(let c=2;c<(rows[0]||[]).length;c++){const name=String(rows[0][c]??"").trim();if(name)names.push({name,column:c});}
    const appSet=new Set(APPS),items=[];let app="",clas="";
    for(let r=1;r<rows.length;r++){
      const a=String(rows[r]?.[0]??"").trim(),b=String(rows[r]?.[1]??"").trim();
      if(appSet.has(a)){app=a;clas="";continue;}
      if(!app)continue;
      if(a)clas=a;
      if(!b)continue;
      const status={};names.forEach(n=>status[n.name]=ESTADO[String(rows[r]?.[n.column]??"").trim()]||"NA");
      items.push({id:`${app}|${r+1}`,row:r+1,apparatus:app,classification:clas,element:b,status});
    }
    return {athletes:names,items};
  }

  // Misma unión que mergeExcelWithCloud de modulos/normativos (sin guardar).
  function unir(base,cloud){
    const oldAth=Array.isArray(cloud?.athletes)?cloud.athletes:[];
    const byName=new Map(oldAth.map(a=>[normName(a.name),a])),byColumn=new Map(oldAth.filter(a=>Number.isFinite(a.column)).map(a=>[a.column,a]));
    const athletes=base.athletes.map(a=>({...(byName.get(normName(a.name))||byColumn.get(a.column)||{}),name:a.name,column:a.column}));
    const oldItems=Array.isArray(cloud?.items)?cloud.items:[];
    const keyed=list=>{const seen=new Map();return list.map(x=>{const b=x.apparatus+"|"+normName(x.classification||"")+"|"+normName(x.element);const n=(seen.get(b)||0)+1;seen.set(b,n);return [b+"|"+n,x];});};
    const oldByKey=new Map(keyed(oldItems)),oldById=new Map(oldItems.map(x=>[x.id,x]));
    const items=keyed(base.items).map(([k,x])=>{
      let old=oldByKey.get(k);
      if(!old){const c=oldById.get(x.id);if(c&&normName(c.element)===normName(x.element)&&c.apparatus===x.apparatus)old=c;}
      const status={};
      athletes.forEach(a=>{const prior=old?.status||{},oldA=byColumn.get(a.column);status[a.name]=prior[a.name]||(oldA?prior[oldA.name]:null)||x.status?.[a.name]||"NA";});
      return {...x,status,key:k};
    });
    return {athletes,items};
  }

  async function nube(){
    if(!window.firebase||!firebase.firestore)return null;
    if(!firebase.apps.length)firebase.initializeApp(FB_CONFIG);
    const snap=await firebase.firestore().collection("normativosAKC").doc("estado").get();
    return snap.exists?snap.data():null;
  }

  async function cargarBase(){
    const fuente=window.CLIENTE?.repositorios?.normativosExcel||"NORMATIVOS_AKC.xlsx";
    return desdeExcel(await AKC_XLSX.read(fuente,"NORMATIVOS"));
  }

  async function cargar(){
    const base=await cargarBase();
    let cloud=null;
    try{cloud=await nube();}catch(e){console.warn("Normativos: no se pudo leer la nube; se usa solo el Excel.",e);}
    return cloud?unir(base,cloud):unir(base,null);
  }

  // Clave de cada elemento (aparato + clasificación + elemento + número de repetición), igual que el módulo Normativos.
  function claves(list){const seen=new Map();return list.map(x=>{const b=x.apparatus+"|"+normName(x.classification||"")+"|"+normName(x.element);const n=(seen.get(b)||0)+1;seen.set(b,n);return [b+"|"+n,x];});}

  window.AKC_NORMATIVOS={cargar,cargarBase,unir,claves,normName,APPS,FB_CONFIG};
})();
