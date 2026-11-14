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
    plantel.forEach(p => filas.set(p.key, {key: p.key, nombre: p.nombre || p.key, nivel: p.nivel || "", tipo: p.tipo}));
    Object.entries(res).forEach(([k, r]) => {
      const f = filas.get(k) || {key: k, nombre: k, tipo: r.tipo};
      f.nombre = r.nombre || f.nombre; f.nivel = r.nivel || f.nivel; f.tipo = r.tipo || f.tipo; f.r = r;
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

  window.AKC_EFIC = {APS, calcular, grupo, nivelTexto, comps, ultima, ranking};
})();
