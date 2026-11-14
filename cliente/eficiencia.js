/* AKC - Eficiencia por competencia (Manu, 14-nov-2026).
 * Lo usan «Subir información de competencia» (modulos/reportes/entrenadores) y
 * «El atleta más eficiente de la copa» (modulos/eficientes). Sin nombres de atletas: los nombres viven en la nube
 * (competenciasAKC/estado.plantel y cada resultado), así este archivo puede ser público.
 *
 * Por aparato presentado: % = NF ÷ (la NP más alta entre la de la rutina y la del juez) × 100, nunca más de 100.
 *   Si el juez dio menos que la rutina, el 100% es la NP de la rutina; si dio más, el 100% es la del juez.
 * Eficiencia = promedio de los aparatos que presentó (los que no presentó no cuentan).
 * Grupos por nivel: obligatorios = niveles 3, 4, 5 y 6; libres = 7, 8, 9, 10 y FIG.
 */
(function(){
  "use strict";
  const APS = [["PISO","Piso"],["ARZON","Arzón"],["ANILLOS","Anillos"],["SALTO","Salto"],["PARALELAS","Paralelas"],["FIJA","Barra fija"]];

  function calcular(r){
    const ap = {}; let suma = 0, n = 0, aa = 0;
    APS.forEach(([k]) => {
      const np = r && r.np ? r.np[k] : null, nf = r && r.nf ? r.nf[k] : null, ref = r && r.ref ? r.ref[k] : null;
      if (np == null || nf == null) { ap[k] = null; return; }
      const conRef = ref != null && ref > 0;
      const base = conRef ? Math.max(ref, np) : np;
      const p = base > 0 ? Math.min(100, nf / base * 100) : 0;
      ap[k] = {np, nf, ref: conRef ? ref : null, base, ded: np - nf, dif: conRef ? np - ref : null, p, sinRef: !conRef};
      suma += p; n++; aa += nf;
    });
    return {ap, n, aa, ef: n ? suma / n : null};
  }

  function grupo(nivel, tipo){
    const t = String(nivel == null ? "" : nivel).toUpperCase();
    if (/FIG|JR|JUV|MAY|ELITE|ÉLITE/.test(t)) return "L";
    const m = t.match(/\d+/);
    if (m) return Number(m[0]) <= 6 ? "O" : "L";
    return tipo === "O" ? "O" : "L";
  }

  function nivelTexto(nivel){
    const t = String(nivel == null ? "" : nivel).trim();
    return /^\d+$/.test(t) ? "Nivel " + t : t.replace(/^N(?=\d)/i, "Nivel ");
  }

  function comps(estado){
    return Object.entries((estado && estado.competencias) || {}).map(([id, c]) => Object.assign({id}, c))
      .sort((a, b) => String(b.fecha || "").localeCompare(String(a.fecha || "")) || String(b.creada || "").localeCompare(String(a.creada || "")));
  }

  // Última competencia (por fecha) que ya tiene al menos un resultado con notas.
  function ultima(estado){
    const res = (estado && estado.resultados) || {};
    return comps(estado).find(c => Object.values(res[c.id] || {}).some(r => calcular(r).n)) || null;
  }

  // Ranking de una competencia: {L: [...], O: [...]}; primero quienes compitieron (mayor eficiencia; empate: mayor AA),
  // al final quienes no compitieron (orden alfabético). Cada fila: {key, nombre, nivel, r, calc, compitio, lugar}.
  function ranking(estado, compId){
    const res = ((estado && estado.resultados) || {})[compId] || {};
    const plantel = (estado && estado.plantel) || [];
    const filas = new Map();
    plantel.forEach(p => filas.set(p.key, {key: p.key, nombre: p.nombre || p.key, nivel: p.nivel || "", tipo: p.tipo, gav: p.gav || ""}));
    Object.entries(res).forEach(([k, r]) => {
      const f = filas.get(k) || {key: k, nombre: k, tipo: r.tipo};
      // El nombre del plantel (el vigente) manda sobre el guardado con el resultado.
      f.nombre = (filas.has(k) && f.nombre !== k ? f.nombre : "") || r.nombre || f.nombre; f.nivel = r.nivel || f.nivel; f.tipo = r.tipo || f.tipo; f.gav = r.gav || f.gav || ""; f.r = r;
      filas.set(k, f);
    });
    const out = {L: [], O: []};
    filas.forEach(f => { f.calc = calcular(f.r); f.compitio = !!f.calc.n; out[grupo(f.nivel, f.tipo)].push(f); });
    ["L","O"].forEach(g => {
      const si = out[g].filter(f => f.compitio).sort((a, b) => b.calc.ef - a.calc.ef || b.calc.aa - a.calc.aa);
      const no = out[g].filter(f => !f.compitio).sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), "es"));
      si.forEach((f, i) => { f.lugar = i + 1; });
      out[g] = si.concat(no);
    });
    return out;
  }

  // ---------- Colores (Manu, 14-nov-2026; los mismos de su Excel del Nacional) ----------
  // Semáforo: verde = cumple con el parámetro más alto, amarillo = cercano al objetivo, rojo = mayor área de oportunidad.
  const SEM = {V: "Listo", A: "En proceso", R: "Por debajo"};
  function semPct(g, p){ return g === "O" ? (p >= 90 ? "V" : p >= 80 ? "A" : "R") : (p >= 85 ? "V" : p >= 75 ? "A" : "R"); }
  // Obligatorios: entre más cerca de 10, más cerca del objetivo (9.9 o 10 verde, 9.6 a 9.8 amarillo, 9.5 o menos rojo).
  function semNP(g, np){ return g === "O" ? (np >= 9.9 - 1e-9 ? "V" : np >= 9.6 - 1e-9 ? "A" : "R") : ""; }
  // Deducción (NP del juez − NF). Obligatorios: hasta 1.0 bien, más de 1.0 amarillo, 1.8 o más rojo.
  // Libres: como en el Excel (menos de 1.5 bien, de 1.5 a 1.99 en proceso, 2 o más rojo).
  function semDed(g, d){ return g === "O" ? (d <= 1 + 1e-9 ? "V" : d < 1.8 - 1e-9 ? "A" : "R") : (d < 1.5 ? "V" : d < 2 ? "A" : "R"); }
  function semEf(e){ return e >= 85 ? "V" : e >= 75 ? "A" : "R"; }
  const NIVEL_COLOR = {"3": "#FFE699", "4": "#2E75B5", "5": "#548135", "6": "#ED7D31", "7": "#F4B083", "8": "#BDD6EE", "9": "#D0CECE", "10": "#A8D08D", "FIG": "#C55A11"};
  const GAV_COLOR = {"GAV 3": "#FFF2CC", "GAV 4": "#9DC3E6", "GAV 5": "#FFC000", "GAV 6": "#F8CBAD", "GAV 9": "#AEABAB", "GAV FIG": "#A9D18E"};
  const GAVS = Object.keys(GAV_COLOR);
  function nivelClave(nivel){ const t = String(nivel == null ? "" : nivel).toUpperCase(); if (/FIG|ELITE|ÉLITE/.test(t)) return "FIG"; const m = t.match(/\d+/); return m ? String(Number(m[0])) : ""; }
  function tinta(hex){ const n = parseInt(String(hex).slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255; return (r * 299 + g * 587 + b * 114) / 1000 > 140 ? "#111" : "#fff"; }
  function pinta(hex){ return hex ? `background:${hex};color:${tinta(hex)}` : ""; }

  function esc(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m])); }
  const f1 = v => v == null ? "—" : Number(v).toFixed(1), f3 = v => v == null ? "—" : Number(v).toFixed(3);

  let cssPuesto = false;
  function ponerCss(){
    if (cssPuesto) return; cssPuesto = true;
    const st = document.createElement("style");
    st.textContent = `
.efc{display:grid;gap:14px}
.efc .tw{overflow-x:auto;border:1px solid #213a55;border-radius:12px;-webkit-overflow-scrolling:touch}
.efc table{border-collapse:collapse;width:100%;min-width:1000px;font-size:12px;font-variant-numeric:tabular-nums;color:#f3f7fc}
.efc th,.efc td{border:1px solid #1b3047;padding:5px;text-align:center;vertical-align:middle}
.efc th{background:#11243a;color:#cfe2fa;font-size:10.5px;text-transform:uppercase}
.efc th.grp{background:#163a60;color:#fff;text-align:left;font-size:13px;letter-spacing:.08em}
.efc td.nm{text-align:left;font-weight:900;font-size:15px;line-height:1.2;min-width:170px}
.efc td.nm small{display:block;font-weight:600;font-size:10.5px;opacity:.8;color:inherit;margin-top:2px}
.efc td.lg,.efc thead tr:last-child th:first-child{position:sticky;left:0;z-index:1;width:46px;min-width:46px}
.efc td.nm,.efc thead tr:last-child th:nth-child(2){position:sticky;left:46px;z-index:1}
.efc td.lg:not(.m1):not(.m2):not(.m3),.efc td.nm:not([style*=background]){background:#0c1a2b}
.efc td.lg{font-weight:900;font-size:15px}
.efc td.aa{font-weight:800}
.efc td.ef{font-weight:900;font-size:14px}
.efc .c{display:grid;grid-template-columns:auto auto auto auto;gap:1px 4px;justify-content:center;white-space:nowrap}
.efc .c span{font-size:9px;opacity:.7;text-align:right}.efc .c b{text-align:left}
.efc .p{margin-top:3px;border-radius:4px;font-weight:900;padding:2px 0}
.efc .s-V{background:#00B050;color:#fff}.efc .s-A{background:#FFFF00;color:#111}.efc .s-R{background:#FF0000;color:#fff}
.efc .t-V{color:#2ee07a}.efc .t-A{color:#ffd400}.efc .t-R{color:#ff5a5a}
.efc .m1{background:#BF9000;color:#111}.efc .m2{background:#C8C8C8;color:#111}.efc .m3{background:#BD0000;color:#fff}
.efc tr.no td{opacity:.6}.efc tr.no td.nm,.efc tr.no td.nv{opacity:1}
.efc tr.sel td{outline:2px solid #54a7ff;outline-offset:-2px}
.efc tr[data-k]{cursor:pointer}
.efc .np0{font-size:11px;opacity:.7}
.efc .ley{font-size:11.5px;line-height:1.55;color:#c9d6e4}
.efc tr.prom td{border-top:3px solid #54a7ff;font-weight:900}.efc tr.prom td.pt{text-align:right;font-size:13px;padding-right:8px}.efc tr.prom .p{font-size:14px;padding:4px 0}.efc .po{font-size:11px;margin-top:2px;opacity:.85}
.efc .ley i{display:inline-block;width:12px;height:12px;border-radius:3px;vertical-align:-2px;margin:0 3px 0 8px}
@media(max-width:600px){.efc td.nm{min-width:130px;max-width:160px;font-size:14px}}
@media print{
 .efc table{min-width:0;font-size:7.8px;color:#000}
 .efc .tw{overflow:visible;border:1px solid #999;border-radius:0}
 .efc th,.efc td{border:1px solid #999;padding:2px 2px}
 .efc td.nm{font-size:12.5px;min-width:0}
 .efc td.nm small{font-size:8.5px}
 .efc .c{gap:0 2px}.efc .c span{font-size:6.5px}.efc .p{margin-top:1px;padding:1px 0}
 .efc td.lg,.efc thead tr:last-child th:first-child{width:30px;min-width:30px}
 .efc td.ef{font-size:10.5px}
 .efc thead th{font-size:7px;white-space:normal}
 .efc th{background:#e6e6e6!important;color:#000}.efc th.grp{background:#cfd8e3!important;color:#000}
 .efc .t-V{color:#00873d}.efc .t-A{color:#a37c00}.efc .t-R{color:#d00000}
 .efc .ley{display:none}
 .efc tr.prom td{border-top:2px solid #000}.efc tr.prom td.pt{font-size:9px}.efc tr.prom .p{font-size:10px;padding:2px 0}.efc .po{font-size:8px;color:#000;opacity:1}
 .efc *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
 .efc tr{break-inside:avoid}
 .efc td.lg,.efc td.nm,.efc th{position:static!important}
 .efc td.lg:not(.m1):not(.m2):not(.m3),.efc td.nm:not([style*=background]){background:#fff}
}`;
    document.head.appendChild(st);
  }

  // Concentrado con colores (el que se imprime y el que ven los papás). opts.sel = atleta resaltado.
  function concentrado(estado, compId, opts){
    ponerCss(); opts = opts || {};
    const rk = ranking(estado, compId);
    const tabla = (g, titulo) => {
      const filas = rk[g]; if (!filas.length) return "";
      let h = `<div class="tw"><table><thead><tr><th class="grp" colspan="${APS.length + 6}">${titulo}</th></tr><tr><th>Lugar</th><th>Nombre</th><th>Nivel</th>${APS.map(([, l]) => `<th>${l}</th>`).join("")}<th>AA</th><th>% Eficiencia</th><th>Lugar en la copa</th></tr></thead><tbody>`;
      filas.forEach(f => {
        const gc = GAV_COLOR[f.gav] || "", nc = NIVEL_COLOR[nivelClave(f.nivel)] || "";
        const med = f.compitio && f.lugar <= 3 ? " m" + f.lugar : "";
        h += `<tr data-k="${esc(f.key)}" class="${f.compitio ? "" : "no"}${opts.sel === f.key ? " sel" : ""}"><td class="lg${med}">${f.compitio ? f.lugar : "—"}</td>` +
          `<td class="nm" style="${pinta(gc)}">${esc(f.nombre)}<small>${esc(f.gav || "")}${f.compitio ? "" : (f.gav ? " · " : "") + "No compitió"}</small></td>` +
          `<td class="nv" style="${pinta(nc)}">${esc(nivelTexto(f.nivel).replace(/^Nivel /, "")) || "—"}</td>`;
        APS.forEach(([k]) => {
          const x = f.calc.ap[k];
          if (!f.compitio) { h += `<td class="np0">0</td>`; return; }
          if (!x) { h += `<td class="np0">No presentó</td>`; return; }
          h += `<td><div class="c"><span>NP</span><b class="t-${semNP(g, x.np)}">${f1(x.np)}</b><span>NF</span><b>${f3(x.nf)}</b>` +
               `<span>Rut.</span><b>${f1(x.ref)}${x.sinRef ? "*" : ""}</b><span>Ded.</span><b class="t-${semDed(g, x.ded)}">${f3(x.ded)}</b></div>` +
               `<div class="p s-${semPct(g, x.p)}">${x.p.toFixed(1)}%</div></td>`;
        });
        h += `<td class="aa">${f.compitio ? f.calc.aa.toFixed(3) : "0"}</td>` +
             `<td class="ef ${f.compitio ? "s-" + semEf(f.calc.ef) : ""}">${f.compitio ? f.calc.ef.toFixed(1) + "%" : "0%"}</td>` +
             `<td>${f.r && f.r.lugar != null ? `<b>${f.r.lugar}°</b>${f.r.part != null ? " de " + f.r.part : ""}` : "—"}</td></tr>`;
      });
      // Fila de promedios: % promedio de cada aparato (solo quienes lo presentaron) y su orden de mayor a menor.
      const prom = {}; APS.forEach(([k]) => {
        const v = filas.filter(f => f.compitio && f.calc.ap[k]).map(f => f.calc.ap[k].p);
        if (v.length) prom[k] = v.reduce((a, b) => a + b, 0) / v.length;
      });
      const orden = Object.keys(prom).sort((a, b) => prom[b] - prom[a]);
      const efs = filas.filter(f => f.compitio).map(f => f.calc.ef);
      const efP = efs.length ? efs.reduce((a, b) => a + b, 0) / efs.length : null;
      h += `<tr class="prom"><td colspan="3" class="pt">Promedio del aparato</td>` +
        APS.map(([k]) => prom[k] == null ? `<td class="np0">—</td>` :
          `<td><div class="p s-${semPct(g, prom[k])}">${prom[k].toFixed(1)}%</div><div class="po">${orden.indexOf(k) + 1}.º</div></td>`).join("") +
        `<td></td><td class="ef ${efP == null ? "" : "s-" + semEf(efP)}">${efP == null ? "—" : efP.toFixed(1) + "%"}</td><td></td></tr>`;
      return h + "</tbody></table></div>";
    };
    const sw = c => `<i style="background:${c}"></i>`;
    return `<div class="efc">${tabla("L", "LIBRES · NIVELES 7, 8, 9, 10 Y FIG")}${tabla("O", "OBLIGATORIOS · NIVELES 3, 4, 5 Y 6")}
<div class="ley"><b>Colores:</b>${sw("#00B050")}Verde = cumple con el parámetro más alto${sw("#FFFF00")}Amarillo = cercano al objetivo${sw("#FF0000")}Rojo = mayor área de oportunidad.<br>
<b>% del aparato</b> (NF ÷ la NP más alta entre la de la rutina y la del juez; nunca más de 100): libres verde ≥ 85 %, amarillo 75 a 84.9 %, rojo &lt; 75 % · obligatorios verde ≥ 90 %, amarillo 80 a 89.9 %, rojo &lt; 80 %.<br>
<b>NP del juez</b> en obligatorios (color de la letra): verde 9.9 o 10, amarillo 9.6 a 9.8, rojo 9.5 o menos. <b>Ded.</b> = NP del juez − NF: obligatorios verde hasta 1.0, amarillo más de 1.0, rojo 1.8 o más · libres verde menos de 1.5, amarillo 1.5 a 1.99, rojo 2 o más.<br>
<b>% Eficiencia</b> = promedio de los aparatos que presentó (los que no presentó no cuentan): verde ≥ 85 %, amarillo 75 a 84.9 %, rojo &lt; 75 %. Lugar interno: ${sw("#BF9000")}1.º ${sw("#C8C8C8")}2.º ${sw("#BD0000")}3.º; si empatan, gana el de mayor AA. Rut. = NP de la rutina (editor de rutinas)${'' }.<br>
<b>Nombre</b> con el color de su grupo:${GAVS.map(k => sw(GAV_COLOR[k]) + k.replace("GAV FIG", "GAV FIG y Élite")).join("")}. <b>Nivel</b> con el color de su nivel.</div></div>`;
  }

  window.AKC_EFIC = {APS, calcular, grupo, nivelTexto, comps, ultima, ranking, concentrado, semPct, semEf, GAVS};
})();
