// Menú: algunas tarjetas muestran un adelanto de lo que tienen adentro (Manu, 26-oct-2026).
//   MVP: las dos fotos de la semana (mvpAKC/foto1 y foto2).
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

  async function fotoMvp(n) {
    const clave = "akcMenuMvp" + n, guardada = leer(clave), ruta = "mvpAKC" + SUFIJO + "/foto" + n;
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

  function iniciar() { mvp(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar); else iniciar();
})();
