/* Descargar «Estadistica de competencias totales.xlsx» actualizado (Manu, 14-nov-2026): parte del Excel vigente (el mismo
 * formato: colores, nombre combinado por atleta, fórmula del AA) y le mete las copas subidas en «Subir información de
 * competencia». Cada copa nueva va al final del bloque de su atleta; si la copa ya está en el Excel con el mismo nombre,
 * se reemplazan sus datos (como en Estadísticas). Un atleta que no estaba en el Excel va en un bloque nuevo al final.
 * Necesita JSZip. Sin nombres de atletas: todo sale de los datos. */
(function(){
  "use strict";
  const NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
  const COLS = "ABCDEFGHIJKLMN".split("");
  const AP = ["PISO", "ARZON", "ANILLO", "SALTO", "PARALELA", "FIJA"];         // columnas E a J
  const norm = s => String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toUpperCase().replace(/\s+/g, " ");
  const xmlEsc = s => String(s).replace(/[<>&"]/g, c => ({"<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;"}[c]));
  const colDe = ref => ref.replace(/\d+/g, "");
  const filaDe = ref => Number(ref.replace(/\D+/g, ""));

  // Celda nueva (o reemplazo): conserva el estilo s de la plantilla.
  function celda(col, fila, s, valor){
    const r = col + fila, st = s != null ? ` s="${s}"` : "";
    if (valor == null || valor === "") return `<c r="${r}"${st}/>`;
    if (typeof valor === "number" && isFinite(valor)) return `<c r="${r}"${st}><v>${valor}</v></c>`;
    return `<c r="${r}"${st} t="inlineStr"><is><t>${xmlEsc(valor)}</t></is></c>`;
  }
  const numero = v => { const t = String(v == null ? "" : v).trim(); return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : (t || null); };

  async function generar(bufExcel, filasNube){
    const zip = await JSZip.loadAsync(bufExcel);
    const wbXml = await zip.file("xl/workbook.xml").async("string");
    const relXml = await zip.file("xl/_rels/workbook.xml.rels").async("string");
    const dp = new DOMParser();
    // Hoja «Historial»
    const wb = dp.parseFromString(wbXml, "application/xml");
    const hoja = [...wb.getElementsByTagNameNS(NS, "sheet")].find(s => s.getAttribute("name") === "Historial") || wb.getElementsByTagNameNS(NS, "sheet")[0];
    const rid = hoja.getAttribute("r:id") || hoja.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
    const rel = [...dp.parseFromString(relXml, "application/xml").getElementsByTagName("Relationship")].find(r => r.getAttribute("Id") === rid);
    const ruta = "xl/" + rel.getAttribute("Target").replace(/^\/?xl\//, "").replace(/^\//, "");
    let sh = await zip.file(ruta).async("string");
    const ssF = zip.file("xl/sharedStrings.xml");
    const ss = ssF ? [...dp.parseFromString(await ssF.async("string"), "application/xml").getElementsByTagNameNS(NS, "si")]
      .map(si => [...si.getElementsByTagNameNS(NS, "t")].map(t => t.textContent).join("")) : [];

    const doc = dp.parseFromString(sh, "application/xml");
    const valor = c => {
      if (!c) return null;
      const t = c.getAttribute("t"), v = c.getElementsByTagNameNS(NS, "v")[0];
      if (t === "s") return v ? ss[Number(v.textContent)] : null;
      if (t === "inlineStr") return [...c.getElementsByTagNameNS(NS, "t")].map(x => x.textContent).join("");
      return v ? v.textContent : null;
    };
    // Filas: {n, attrs, celdas: {col: elemento}}
    const ser = new XMLSerializer();
    const filas = [...doc.getElementsByTagNameNS(NS, "row")].map(r => {
      const celdas = {};
      [...r.getElementsByTagNameNS(NS, "c")].forEach(c => { celdas[colDe(c.getAttribute("r"))] = c; });
      return {n: Number(r.getAttribute("r")), ht: r.getAttribute("ht"), celdas};
    });
    const encab = filas.find(f => f.n === 1);
    // Bloques por atleta: celdas combinadas de la columna A (o, si no hay, cada nombre hasta el siguiente).
    const merges = [...doc.getElementsByTagNameNS(NS, "mergeCell")].map(m => m.getAttribute("ref"));
    const rangosA = merges.filter(r => /^A\d+:A\d+$/.test(r)).map(r => r.split(":").map(filaDe));
    const datos = filas.filter(f => f.n > 1);
    const bloques = [];
    datos.forEach(f => {
      const nombre = valor(f.celdas.A);
      const enRango = rangosA.find(([a, b]) => f.n >= a && f.n <= b);
      const inicio = enRango ? enRango[0] === f.n : !!(nombre && String(nombre).trim());
      const vacia = !valor(f.celdas.B);
      if (inicio) bloques.push({nombre: String(nombre || "").trim(), filas: []});
      if (!bloques.length || (vacia && !inicio)) return;
      bloques[bloques.length - 1].filas.push({orig: f});
    });
    const otras = []; // filas que no son de un bloque (no se pierden)
    datos.forEach(f => { if (!bloques.some(b => b.filas.some(x => x.orig === f)) && valor(f.celdas.B)) otras.push(f); });

    // Mete las copas del sitio.
    let nuevas = 0, reemplazadas = 0;
    filasNube.forEach(r => {
      let b = bloques.find(x => norm(x.nombre) === norm(r.GIMNASTA));
      if (!b) { b = {nombre: r.GIMNASTA, filas: [], nuevo: true}; bloques.push(b); }
      const fila = b.filas.find(x => x.orig && norm(valor(x.orig.celdas.B)) === norm(r.COPA));
      if (fila) { fila.nube = r; reemplazadas++; } else { b.filas.push({nube: r}); nuevas++; }
    });

    // Estilos. Cada celda guarda su estilo (s): la primera fila de un bloque lleva borde arriba, la última borde abajo y
    // algunas celdas un color que se pone a mano. Las copas nuevas van sin color de relleno.
    const estilos = f => { const o = {}; COLS.forEach(c => { o[c] = f && f.celdas[c] ? f.celdas[c].getAttribute("s") : null; }); return o; };
    const lugar = (i, total) => i === 0 ? "primera" : i === total - 1 ? "ultima" : "media";
    // Estilos «limpios» por columna y lugar: el más usado sin relleno (sin los colores que se ponen a mano, como la mejor
    // nota en verde o la categoría). Las copas nuevas los usan; las filas del Excel conservan los suyos.
    const stF = zip.file("xl/styles.xml"), stDoc = stF ? dp.parseFromString(await stF.async("string"), "application/xml") : null;
    const fills = stDoc ? [...stDoc.getElementsByTagNameNS(NS, "fill")].map(f => { const p = f.getElementsByTagNameNS(NS, "patternFill")[0]; const t = p && p.getAttribute("patternType"); return !t || t === "none" || t === "gray125"; }) : [];
    const xfs = stDoc && stDoc.getElementsByTagNameNS(NS, "cellXfs")[0];
    const sinRelleno = xfs ? [...xfs.getElementsByTagNameNS(NS, "xf")].map(x => fills[Number(x.getAttribute("fillId") || 0)] !== false) : [];
    const cuenta = {primera: {}, media: {}, ultima: {}};
    bloques.forEach(b => { const o = b.filas.filter(x => x.orig); o.forEach((x, i) => { const m = cuenta[lugar(i, o.length)];
      COLS.forEach(c => { const st = x.orig.celdas[c] && x.orig.celdas[c].getAttribute("s"); if (st == null) return;
        if (c !== "A" && sinRelleno.length && !sinRelleno[Number(st)]) return; m[c] = m[c] || {}; m[c][st] = (m[c][st] || 0) + 1; }); }); });
    const limpio = pos => { const o = {}; COLS.forEach(c => { const m = cuenta[pos][c] || cuenta.media[c]; o[c] = m ? Object.entries(m).sort((a, b) => b[1] - a[1])[0][0] : null; }); return o; };
    bloques.forEach(b => {
      const total = b.filas.length, origs = b.filas.filter(x => x.orig);
      const aBloque = origs.length ? estilos(origs[origs.length - 1].orig).A : null;
      b.filas.forEach((x, i) => {
        const pos = lugar(i, total);
        const st = x.orig ? estilos(x.orig) : Object.assign(limpio(pos), origs.length ? {A: aBloque} : {});
        x.st = st;
      });
    });

    // Colores con significado (Manu, 14-nov-2026):
    //  · Nombre de la copa (B) = su ciclo: blanco 24-25, amarillo 25-26 (los del Excel) y uno nuevo por ciclo desde 26-27.
    //    Solo se pinta en las copas nuevas; las del Excel se quedan como están.
    //  · Verde claro = la nota más alta de ese aparato del atleta en su último nivel; verde fuerte = su AA más alto ahí.
    //  · Sin raya entre las copas del Excel y las nuevas: la que era la última del bloque pierde su borde de abajo.
    if (stDoc && xfs) {
      const fillsEl = stDoc.getElementsByTagNameNS(NS, "fills")[0];
      const lista = () => [...fillsEl.getElementsByTagNameNS(NS, "fill")];
      const color = f => { const c = f.getElementsByTagNameNS(NS, "fgColor")[0]; return c ? (c.getAttribute("rgb") || (c.hasAttribute("theme") ? "t" + c.getAttribute("theme") + ":" + (Number(c.getAttribute("tint") || 0)).toFixed(1) : "")) : ""; };
      const relleno = (buscar, rgb) => {
        let i = lista().findIndex(f => buscar.includes(color(f)));
        if (i >= 0) return i;
        const f = dp.parseFromString(`<fill xmlns="${NS}"><patternFill patternType="solid"><fgColor rgb="${rgb}"/><bgColor indexed="64"/></patternFill></fill>`, "application/xml").documentElement;
        fillsEl.appendChild(stDoc.importNode(f, true)); fillsEl.setAttribute("count", lista().length);
        return lista().length - 1;
      };
      const VERDE = relleno(["t9:0.6"], "FFC6E0B4"), VERDE_AA = relleno(["FF00B050"], "FF00B050"), BLANCO = relleno(["t0:0.0"], "FFFFFFFF");
      const CICLOS = {"24-25": () => BLANCO, "25-26": () => relleno(["t7:0.4"], "FFFFE699"), "26-27": () => relleno(["FFBDD7EE"], "FFBDD7EE"),
        "27-28": () => relleno(["FFD9C3E9"], "FFD9C3E9"), "28-29": () => relleno(["FFFCE4D6"], "FFFCE4D6"), "29-30": () => relleno(["FFE2EFDA"], "FFE2EFDA")};
      const xfLista = [...xfs.getElementsByTagNameNS(NS, "xf")], cache = {};
      const conRelleno = (s, fillId) => {
        if (s == null) return s;
        const base = xfLista[Number(s)]; if (!base) return s;
        if (Number(base.getAttribute("fillId") || 0) === fillId) return s;
        const k = s + "|" + fillId; if (cache[k] != null) return cache[k];
        const nx = base.cloneNode(true); nx.setAttribute("fillId", fillId); nx.setAttribute("applyFill", "1");
        xfs.appendChild(nx); xfLista.push(nx); xfs.setAttribute("count", xfLista.length);
        return (cache[k] = String(xfLista.length - 1));
      };
      const esVerde = s => { const b = xfLista[Number(s)]; const f = b && lista()[Number(b.getAttribute("fillId") || 0)]; return !!f && ["t9:0.6", "FF00B050"].includes(color(f)); };
      const num = v => { const x = Number(v); return v != null && v !== "" && isFinite(x) ? x : null; };
      // Borde de las filas de en medio, por columna (el más usado), para quitar la raya de la que deja de ser la última.
      const bordes = {};
      bloques.forEach(b => { const o = b.filas.filter(x => x.orig); o.forEach((x, i) => { if (i === 0 || i === o.length - 1) return;
        COLS.forEach(c => { const st = x.orig.celdas[c] && x.orig.celdas[c].getAttribute("s"), xf = st != null && xfLista[Number(st)]; if (!xf) return;
          const bid = xf.getAttribute("borderId") || "0"; bordes[c] = bordes[c] || {}; bordes[c][bid] = (bordes[c][bid] || 0) + 1; }); }); });
      const bordeMedio = c => bordes[c] ? Object.entries(bordes[c]).sort((a, b) => b[1] - a[1])[0][0] : null;
      const conBorde = (s, borderId) => {
        if (s == null || borderId == null) return s;
        const base = xfLista[Number(s)]; if (!base || (base.getAttribute("borderId") || "0") === borderId) return s;
        const k = s + "|b" + borderId; if (cache[k] != null) return cache[k];
        const nx = base.cloneNode(true); nx.setAttribute("borderId", borderId); nx.setAttribute("applyBorder", "1");
        xfs.appendChild(nx); xfLista.push(nx); xfs.setAttribute("count", xfLista.length);
        return (cache[k] = String(xfLista.length - 1));
      };
      bloques.forEach(b => { const o = b.filas.filter(x => x.orig); if (!o.length) return; const k = b.filas.indexOf(o[o.length - 1]);
        if (k < b.filas.length - 1 && k > 0) COLS.forEach(c => { if (c !== "A") b.filas[k].st[c] = conBorde(b.filas[k].st[c], bordeMedio(c)); }); });
      // Colores de nivel (C) y de categoría (D), como en el resto del Excel (Manu, 14-nov-2026: «respeta los colores de nivel
      // y de categoría»): para cada valor, el relleno que más se usa con él.
      const rellenoDe = {C: {}, D: {}};
      bloques.forEach(b => b.filas.forEach(x => { if (!x.orig) return; ["C", "D"].forEach(c => {
        const cel = x.orig.celdas[c], v = norm(valor(cel)), st = cel && cel.getAttribute("s"), xf = st != null && xfLista[Number(st)];
        if (!v || !xf) return; const m = rellenoDe[c][v] = rellenoDe[c][v] || {}; const fid = xf.getAttribute("fillId") || "0"; m[fid] = (m[fid] || 0) + 1; }); }));
      const rellenoPara = (c, v) => { const m = rellenoDe[c][norm(v)]; return m ? Number(Object.entries(m).sort((a, b) => b[1] - a[1])[0][0]) : null; };
      bloques.forEach(b => b.filas.forEach(x => { if (!x.nube) return; [["C", x.nube.NIVEL], ["D", x.nube.CAT]].forEach(([c, v]) => {
        if (x.orig && norm(valor(x.orig.celdas[c])) === norm(v)) return;  // sin cambio: se queda como estaba
        const fid = rellenoPara(c, v); if (fid != null) x.st[c] = conRelleno(x.st[c], fid); }); }));
      bloques.forEach(b => {
        // Color de ciclo en las copas nuevas.
        b.filas.forEach(x => { if (x.nube && !x.orig) { const c = CICLOS[x.nube.CICLO]; if (c) x.st.B = conRelleno(x.st.B, c()); } });
        // Verdes solo en el último nivel en que compitió (Manu, 14-nov-2026): entre todas sus copas de ese nivel (también
        // las del ciclo pasado si repite nivel), la nota más alta de cada aparato y el AA más alto. En los niveles
        // anteriores ya no hay verdes.
        const filasN = b.filas.map(x => {
          const nv = norm(x.nube ? x.nube.NIVEL : valor(x.orig.celdas.C));
          const ap = x.nube ? AP.map(a => num(x.nube[a])) : "EFGHIJ".split("").map(c => num(valor(x.orig.celdas[c])));
          return {x, nv, ap, aa: ap.reduce((s, v) => s + (v || 0), 0)};
        });
        if (!filasN.length) return;
        const ultimo = filasN[filasN.length - 1].nv;
        const g = filasN.filter(f => f.nv === ultimo);
        filasN.filter(f => f.nv !== ultimo).forEach(f => "EFGHIJK".split("").forEach(c => { if (esVerde(f.x.st[c])) f.x.st[c] = conRelleno(f.x.st[c], BLANCO); }));
        "EFGHIJ".split("").forEach((c, k) => {
          const max = Math.max(...g.map(f => f.ap[k] || 0));
          g.forEach(f => { const top = max > 0 && Math.abs((f.ap[k] || 0) - max) < 1e-9;
            if (top) f.x.st[c] = conRelleno(f.x.st[c], VERDE); else if (esVerde(f.x.st[c])) f.x.st[c] = conRelleno(f.x.st[c], BLANCO); });
        });
        const maxAA = Math.max(...g.map(f => f.aa));
        g.forEach(f => { const top = maxAA > 0 && Math.abs(f.aa - maxAA) < 1e-9;
          if (top) f.x.st.K = conRelleno(f.x.st.K, VERDE_AA); else if (esVerde(f.x.st.K)) f.x.st.K = conRelleno(f.x.st.K, BLANCO); });
      });
      zip.file("xl/styles.xml", new XMLSerializer().serializeToString(stDoc));
    }

    // Arma las filas de nuevo, numeradas en orden.
    let n = 1;
    const out = [], nuevosMerges = [];
    const xmlFila = (num, celdasXml, ht) => `<row r="${num}" spans="1:14"${ht ? ` ht="${ht}" customHeight="1"` : ""}>${celdasXml.join("")}</row>`;
    const copiaCelda = (c, col, num, s) => {
      if (!c) return s != null ? celda(col, num, s, null) : "";
      const e = c.cloneNode(true); e.setAttribute("r", col + num); e.removeAttribute("cm");
      if (s != null) e.setAttribute("s", s);
      const f = e.getElementsByTagNameNS(NS, "f")[0];
      if (f) { // la fórmula de la fila (AA = SUM(E:J)) apunta a su nueva fila
        f.removeAttribute("t"); f.removeAttribute("ref");
        f.textContent = f.textContent.replace(/([A-Z]+)\d+/g, (m, l) => l + num);
      }
      return ser.serializeToString(e).replace(/ xmlns(:\w+)?="[^"]*"/g, "");
    };
    out.push(xmlFila(n, COLS.map(c => copiaCelda(encab && encab.celdas[c], c, n)).filter(Boolean), encab && encab.ht));
    bloques.forEach(b => {
      const ini = n + 1;
      b.filas.forEach((x, i) => {
        n++;
        const st = x.st;
        let celdas;
        if (x.orig && !x.nube) {
          celdas = COLS.map(c => copiaCelda(x.orig.celdas[c], c, n, st[c]));
        } else {
          const r = x.nube;
          const aps = AP.map(a => (r[a] == null ? 0 : Number(r[a])));
          const vals = {A: i === 0 ? (x.orig ? valor(x.orig.celdas.A) : r.GIMNASTA) : null, B: x.orig ? valor(x.orig.celdas.B) : r.COPA,
            C: numero(r.NIVEL), D: r.CAT || null, L: r.LUGAR == null ? null : Number(r.LUGAR), M: r.PART == null ? null : Number(r.PART)};
          celdas = COLS.map(c => {
            if ("EFGHIJ".includes(c)) return celda(c, n, st[c], aps["EFGHIJ".indexOf(c)]);
            if (c === "K") return `<c r="K${n}"${st.K != null ? ` s="${st.K}"` : ""}><f>SUM(E${n}:J${n})</f><v>${Math.round(aps.reduce((a, v) => a + v, 0) * 1000) / 1000}</v></c>`;
            if (c === "N") return st.N != null ? celda(c, n, st.N, null) : "";
            return celda(c, n, st[c], vals[c]);
          });
        }
        out.push(xmlFila(n, celdas.filter(Boolean), x.orig && x.orig.ht));
      });
      if (n > ini) nuevosMerges.push(`A${ini}:A${n}`);
    });
    otras.forEach(f => { n++; out.push(xmlFila(n, COLS.map(c => copiaCelda(f.celdas[c], c, n, null)).filter(Boolean), f.ht)); });

    // Reemplaza en la hoja: datos, celdas combinadas, tamaño y formato condicional.
    sh = sh.replace(/<sheetData>[\s\S]*<\/sheetData>|<sheetData\/>/, "<sheetData>" + out.join("") + "</sheetData>");
    const otrosMerges = merges.filter(r => !/^A\d+:A\d+$/.test(r));
    const todos = nuevosMerges.concat(otrosMerges);
    sh = sh.replace(/<mergeCells[\s\S]*?<\/mergeCells>/, todos.length ? `<mergeCells count="${todos.length}">${todos.map(r => `<mergeCell ref="${r}"/>`).join("")}</mergeCells>` : "");
    sh = sh.replace(/<dimension ref="[^"]*"\s*\/>/, `<dimension ref="A1:N${n}"/>`);
    sh = sh.replace(/(<conditionalFormatting sqref=")([A-Z]+)1:([A-Z]+)\d+"/g, (m, a, c1, c2) => `${a}${c1}1:${c2}${n}"`);
    sh = sh.replace(/<selection [^>]*\/>/g, m => m.replace(/(activeCell|sqref)="[^"]*"/g, (x, k) => `${k}="B2"`));
    zip.file(ruta, sh);
    // Sin cadena de cálculo vieja: Excel recalcula al abrir.
    zip.remove("xl/calcChain.xml");
    zip.file("xl/_rels/workbook.xml.rels", relXml.replace(/<Relationship [^>]*calcChain[^>]*\/>/, ""));
    const ct = await zip.file("[Content_Types].xml").async("string");
    zip.file("[Content_Types].xml", ct.replace(/<Override [^>]*calcChain[^>]*\/>/, ""));
    let w2 = wbXml.replace(/<calcPr([^>]*)\/>/, (m, a) => `<calcPr${a.replace(/\s*fullCalcOnLoad="[^"]*"/, "")} fullCalcOnLoad="1"/>`);
    if (!/<calcPr/.test(w2)) w2 = w2.replace("</workbook>", '<calcPr fullCalcOnLoad="1"/></workbook>');
    zip.file("xl/workbook.xml", w2);
    const blob = await zip.generateAsync({type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", compression: "DEFLATE"});
    return {blob, nuevas, reemplazadas, filas: n - 1};
  }

  async function descargar(urlExcel, filasNube, nombre){
    if (!window.JSZip) throw new Error("Falta JSZip");
    const res = await fetch(urlExcel, {cache: "no-store"});
    if (!res.ok) throw new Error("No se pudo leer el Excel (" + res.status + ")");
    const r = await generar(await res.arrayBuffer(), filasNube);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(r.blob); a.download = nombre;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    return r;
  }
  // Ciclo de una fecha «AAAA-MM-DD»: empieza en agosto (nov-2026 → «26-27»).
  function ciclo(fecha){
    const m = String(fecha || "").match(/^(\d{4})-(\d{2})/); const d = m ? {y: +m[1], mes: +m[2]} : {y: new Date().getFullYear(), mes: new Date().getMonth() + 1};
    const ini = d.mes >= 8 ? d.y : d.y - 1; return String(ini % 100).padStart(2, "0") + "-" + String((ini + 1) % 100).padStart(2, "0");
  }
  window.AKC_EXCEL_HIST = {generar, descargar, ciclo};
})();
