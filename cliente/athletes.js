(function(){
  "use strict";
  const c=window.CLIENTE||{};
  const cacheKey="AKC_ATLETAS_CACHE_V1";
  const normalize=s=>String(s??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim().toLowerCase();
  async function getRows(url){
    if(!url) return [];
    const r=await fetch(url+"?v="+Date.now(),{cache:"no-store"});
    if(!r.ok) throw new Error("No se pudo actualizar el padrón de atletas.");
    const b=await r.arrayBuffer();
    const w=XLSX.read(b,{type:"array"});
    const sh=w.Sheets["NORMATIVOS"]||w.Sheets[w.SheetNames[0]];
    return XLSX.utils.sheet_to_json(sh,{header:1,defval:""});
  }
  async function load(){
    const url=c.repositorios&&c.repositorios.normativosExcel;
    try{
      const rows=await getRows(url);
      const athletes=[];
      (rows[0]||[]).slice(2).forEach((v,i)=>{
        const name=String(v||"").trim();
        if(name) athletes.push({name,column:i+3});
      });
      if(athletes.length){
        localStorage.setItem(cacheKey,JSON.stringify({at:athletes,ts:Date.now()}));
        return athletes;
      }
    }catch(e){console.warn("Padrón remoto no disponible",e)}
    try{
      const cached=JSON.parse(localStorage.getItem(cacheKey)||"null");
      if(cached&&Array.isArray(cached.at)&&cached.at.length) return cached.at;
    }catch(e){}
    return [];
  }
  window.AKC_ATHLETES={load,normalize};
})();
