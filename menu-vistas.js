// Menú: algunas tarjetas muestran un adelanto de lo que tienen adentro (Manu, 26-oct-2026).
//   MVP: las dos fotos de la semana (mvpAKC/foto1 y foto2).
//   Desde que se sube la primera copa en «Subir información de competencia» (Manu, 14-nov-2026), esa tarjeta pasa a ser
//   «El atleta más eficiente de la copa» con el nombre de la última copa (competenciasAKC/estado.ultima) y las fotos de
//   sus dos ganadores (competenciasAKC/foto_<id>_L y _O). Hasta entonces sigue siendo el MVP. El módulo MVP no se borra.
// Se leen de Firebase con su API pública (sin cargar todo Firebase en el menú) y se guardan en el celular: las fotos de
// MVP solo se vuelven a bajar si cambiaron (primero se pide solo su fecha). Si algo
// falla, la tarjeta se queda con su ícono.
(function () {
  "use strict";
  const SUFIJO = "_prueba";   // app de prueba; en la oficial va "" (como SUFIJO_FIREBASE en cliente/fuentes.js)
  const BASE = "https://firestore.googleapis.com/v1/projects/akc-con-reporte/databases/(default)/documents/";
  const IMG_OK = /^(data:image\/(png|jpe?g|webp|gif);base64,|https:\/\/)/i;

  function leer(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } }
  function guardar(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin espacio: no pasa nada */ } }
  async function pedir(ruta, campos) {
    const q = (campos || []).map(c => "mask.fieldPaths=" + encodeURIComponent(c)).join("&");
    const r = await fetch(BASE + ruta + (q ? "?" + q : ""));
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  }
  function ponerVista(btn, srcs, clase) {
    const icono = btn && btn.querySelector(".icon");
    if (!icono || !srcs.length) return;
    const vista = document.createElement("span");
    vista.className = "vista " + clase;
    vista.setAttribute("aria-hidden", "true");
    srcs.forEach(src => {
      const img = new Image();
      img.alt = ""; img.decoding = "async"; img.loading = "lazy";
      img.onerror = () => { img.remove(); if (!vista.querySelector("img")) vista.replaceWith(icono); };
      img.src = src;
      vista.appendChild(img);
    });
    icono.replaceWith(vista);
  }

  async function fotoMvp(n) { return foto("akcMenuMvp" + n, "mvpAKC" + SUFIJO + "/foto" + n); }
  async function foto(clave, ruta) {
    const guardada = leer(clave);
    try {
      const fecha = (await pedir(ruta, ["updatedAt"])).fields?.updatedAt?.timestampValue || "";
      if (guardada && guardada.fecha === fecha && guardada.src) return guardada.src;
      const src = (await pedir(ruta, ["src"])).fields?.src?.stringValue || "";
      if (!IMG_OK.test(src)) return "";
      guardar(clave, { fecha, src });
      return src;
    } catch (e) {
      return guardada && guardada.src || "";
    }
  }
  async function mvp() {
    const fotos = (await Promise.all([fotoMvp(1), fotoMvp(2)])).filter(Boolean);
    ponerVista(document.querySelector(".menu .btn.mvp"), fotos, fotos.length > 1 ? "dos" : "una");
  }

  // Tarjeta del MVP convertida en «El atleta más eficiente de la copa».
  function ponerEficiente(btn, copa) {
    if (!btn || !copa) return;
    const s = btn.querySelector("strong"), sm = btn.querySelector("small");
    if (s) s.textContent = "El atleta más eficiente de la copa";
    if (sm) sm.textContent = copa.nombre || "";
    btn.setAttribute("onclick", "openScreen('eficientes')");
    btn.classList.add("eficiente");
  }
  async function ultimaCopa() {
    try {
      const f = (await pedir("competenciasAKC" + SUFIJO + "/estado", ["ultima"])).fields?.ultima?.mapValue?.fields;
      const id = f?.id?.stringValue || "";
      const copa = id ? { id, nombre: f?.nombre?.stringValue || "" } : null;
      guardar("akcMenuCopa", copa);
      return copa;
    } catch (e) { return leer("akcMenuCopa"); }
  }
  async function iniciar() {
    const btn = document.querySelector(".menu .btn.mvp");
    const previa = leer("akcMenuCopa");
    if (previa && previa.id) ponerEficiente(btn, previa);   // sin parpadeo mientras responde la nube
    const copa = await ultimaCopa();
    if (!copa || !copa.id) {
      if (previa && previa.id) location.reload();            // se borró la última copa: vuelve el MVP
      return mvp();
    }
    ponerEficiente(btn, copa);
    const ruta = "competenciasAKC" + SUFIJO + "/foto_" + copa.id + "_";
    const fotos = (await Promise.all([foto("akcMenuEf" + copa.id + "L", ruta + "L"), foto("akcMenuEf" + copa.id + "O", ruta + "O")])).filter(Boolean);
    ponerVista(btn, fotos, fotos.length > 1 ? "dos" : "una");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar); else iniciar();
})();
