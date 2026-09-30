/* ESGILA - lector XLSX local, sin librerías externas. */
(function(){
  "use strict";
  const U8 = Uint8Array, DV = DataView;
  const te = new TextDecoder("utf-8");
  function u16(v,o){return v.getUint16(o,true)}
  function u32(v,o){return v.getUint32(o,true)}
  function str(bytes){return te.decode(bytes)}
  function findSig(bytes,sig,start,end){
    for(let i=(end??bytes.length)-4;i>=start;i--){
      if(bytes[i]===0x50&&bytes[i+1]===0x4b&&bytes[i+2]===sig[2]&&bytes[i+3]===sig[3]) return i;
    }
    return -1;
  }
  async function inflateRaw(bytes){
    if(typeof DecompressionStream!=="function") throw new Error("Este navegador no admite descompresión XLSX.");
    const ds=new DecompressionStream("deflate-raw");
    const stream=new Blob([bytes]).stream().pipeThrough(ds);
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  async function unzip(buffer){
    const bytes=new U8(buffer), view=new DV(buffer);
    const eocd=findSig(bytes,[0x50,0x4b,0x05,0x06],Math.max(0,bytes.length-65557));
    if(eocd<0) throw new Error("XLSX inválido: no se encontró el ZIP.");
    const count=u16(view,eocd+10), cdOffset=u32(view,eocd+16);
    const files=new Map(); let p=cdOffset;
    for(let i=0;i<count;i++){
      if(u32(view,p)!==0x02014b50) throw new Error("XLSX inválido: directorio ZIP dañado.");
      const method=u16(view,p+10), csize=u32(view,p+20), nlen=u16(view,p+28), xlen=u16(view,p+30), clen=u16(view,p+32), lhoff=u32(view,p+42);
      const name=str(bytes.subarray(p+46,p+46+nlen)); p+=46+nlen+xlen+clen;
      if(u32(view,lhoff)!==0x04034b50) throw new Error("XLSX inválido: entrada ZIP dañada.");
      const ln=u16(view,lhoff+26), lx=u16(view,lhoff+28), dataStart=lhoff+30+ln+lx;
      const compressed=bytes.subarray(dataStart,dataStart+csize);
      let data;
      if(method===0) data=compressed;
      else if(method===8) data=await inflateRaw(compressed);
      else throw new Error("XLSX usa una compresión no compatible.");
      files.set(name,data);
    }
    return files;
  }
  function xml(files,name){
    const b=files.get(name); if(!b) throw new Error("No se encontró "+name);
    return new DOMParser().parseFromString(str(b),"application/xml");
  }
  function localName(el){return el.localName||el.nodeName.split(":").pop()}
  function childrenByName(parent,name){
    return Array.from(parent.getElementsByTagNameNS("*",name));
  }
  function textOf(el){
    return Array.from(el.getElementsByTagNameNS("*","t")).map(x=>x.textContent||"").join("");
  }
  function colIndex(ref){
    const m=/^([A-Z]+)\d+$/i.exec(ref||""); if(!m) return 0;
    let n=0; for(const ch of m[1].toUpperCase()) n=n*26+(ch.charCodeAt(0)-64);
    return n-1;
  }
  function sharedStrings(files){
    if(!files.has("xl/sharedStrings.xml")) return [];
    const doc=xml(files,"xl/sharedStrings.xml");
    return childrenByName(doc,"si").map(si=>textOf(si));
  }
  function sheetPath(files,doc,sheetName){
    const sheets=childrenByName(doc,"sheet");
    const s=sheets.find(x=>x.getAttribute("name")===sheetName)||sheets[0];
    if(!s) throw new Error("No se encontró la hoja XLSX.");
    const rid=s.getAttribute("r:id")||s.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships","id");
    const relDoc=xml(files,"xl/_rels/workbook.xml.rels");
    const rel=childrenByName(relDoc,"Relationship").find(x=>x.getAttribute("Id")===rid);
    if(!rel) throw new Error("No se encontró la relación de la hoja.");
    let target=rel.getAttribute("Target");
    if(target.startsWith("/")) target=target.slice(1);
    else target="xl/"+target.replace(/^\.?\//,"");
    return target;
  }
  function worksheet(files,path,ss){
    const doc=xml(files,path), rows=[];
    for(const row of childrenByName(doc,"row")){
      const out=[];
      for(const c of Array.from(row.getElementsByTagNameNS("*","c"))){
        const ref=c.getAttribute("r"), idx=colIndex(ref);
        const type=c.getAttribute("t"), v=c.getElementsByTagNameNS("*","v")[0];
        let value="";
        if(type==="s") value=ss[Number(v?.textContent||0)]??"";
        else if(type==="inlineStr") value=textOf(c);
        else if(type==="b") value=(v?.textContent==="1");
        else if(v) value=v.textContent;
        else if(type==="str") value=textOf(c);
        out[idx]=value;
      }
      rows.push(out);
    }
    return rows;
  }
  async function read(url,sheetName){
    const response=await fetch(url,{cache:"no-store"});
    if(!response.ok) throw new Error("No se pudo cargar "+url);
    const files=await unzip(await response.arrayBuffer());
    const wb=xml(files,"xl/workbook.xml");
    const ss=sharedStrings(files);
    const path=sheetPath(files,wb,sheetName);
    return worksheet(files,path,ss);
  }
  window.ESGILA_XLSX={read};
})();