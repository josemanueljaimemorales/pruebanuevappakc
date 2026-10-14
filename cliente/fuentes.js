/* AKC - Fuentes de datos centralizadas.
 *
 * 1) Excel desde Google Drive: intercepta las descargas de los Excel de la app
 *    (fetch) y las pide primero a Google Drive. Si Drive no responde, usa la
 *    copia que está en el repositorio, para que la app nunca se quede sin datos.
 * 2) Firebase: si SUFIJO_FIREBASE no está vacío, todas las colecciones de la app
 *    se redirigen a "<coleccion><sufijo>" (p. ej. normativosAKC_prueba), para
 *    probar sin tocar los datos reales.
 *
 * Para cambiar un Excel solo hay que actualizar su ID de Drive en ARCHIVOS_DRIVE.
 * Este archivo se puede incluir varias veces en una página: es idempotente.
 */
(function(){
  "use strict";

  // ===== CONFIGURACIÓN =====================================================
  const SUFIJO_FIREBASE = "_prueba";          // "" en la app oficial
  const DRIVE_API_KEY   = "AIzaSyBNRAkDXLlw5fyiT01-ZfUyB0A7ShsAxyg"; // proyecto akc-con-reporte
  const TIEMPO_MAX_DRIVE_MS = 10000;
  const COLECCIONES = ["normativosAKC","rutinasAKC","calendarioAKC","mvpAKC","cargasAKC","registros"];
  // Nombre exacto del archivo que pide la app -> ID del archivo en Drive (carpeta "Utilidades App")
  const ARCHIVOS_DRIVE = {
    "MACRO_26_27.xlsx":                        "1wcz-A9Lnypc-WeaiZqP7CYkNn8RNcd4D",
    "ASIGNACION DE COMPETENCIAS.xlsx":         "1eHHr51yXsHSe9ZjyxCVlpQjVXJH50pS1",
    "AKC.xlsx":                                "1rNobFppHPP9gQBpy7NRGJ_yUj0Xn1pQP",
    "AKC_FuerzaFIG.xlsx":                      "1t4CpjnNAKponpJIKK_GF57LEu29BxEtj",
    "trabajo_gav.xlsx":                        "12DcvEwFns3Kf8f99qM-LA0wsqHluCuNj",
    "Excel_Solo_Valores.xlsx":                 "1lyNxLp8fdTUU9RKDgynGGiUTuOrwV7sd",
    "NORMATIVOS_AKC.xlsx":                     "1Mfi8AlUnPWIng5Jrp46GnHLS6UMrlYZv",
    "Secuencias_Base_APP_AKC.xlsx":            "1AH_lM80up_Z5aAQiMZwLvKiBWZdFZLZv",
    "Estadistica de competencias totales.xlsx":"1L_hn4Wd24fUXFAmkCMqyZdca0-6sG1sG"
  };
  // ========================================================================

  // Si ya se cargó en esta página, solo reintenta conectar Firebase.
  if (window.AKC_FUENTES) { window.AKC_FUENTES.conectarFirebase(); return; }

  // Para pruebas: ?fuente=repo fuerza las copias del repositorio (sin Drive).
  let soloRepo = false;
  try { soloRepo = new URLSearchParams(location.search).get("fuente") === "repo"; } catch(e) {}

  const registro = [];   // {archivo, origen:"drive"|"repo", detalle, ms}
  function anotar(archivo, origen, detalle, ms){
    const r = {archivo, origen, detalle: detalle || "", ms: Math.round(ms || 0)};
    registro.push(r);
    const msg = `[AKC fuentes] ${archivo} → ${origen === "drive" ? "Google Drive" : "copia del repositorio"}${detalle ? " (" + detalle + ")" : ""}`;
    (origen === "drive" ? console.info : console.warn)(msg);
    try { window.dispatchEvent(new CustomEvent("akc-fuente", {detail: r})); } catch(e) {}
  }

  function nombreArchivo(input){
    try {
      const url = typeof input === "string" ? input : (input && input.url) || "";
      const u = new URL(url, location.href);
      return decodeURIComponent(u.pathname.split("/").pop() || "");
    } catch(e) { return ""; }
  }

  function urlDrive(id){
    return `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media&supportsAllDrives=true&key=${encodeURIComponent(DRIVE_API_KEY)}`;
  }

  async function pedirADrive(fetchOriginal, id){
    const ctrl = typeof AbortController === "function" ? new AbortController() : null;
    const t = ctrl ? setTimeout(() => ctrl.abort(), TIEMPO_MAX_DRIVE_MS) : null;
    try {
      const res = await fetchOriginal(urlDrive(id), {cache: "no-store", signal: ctrl ? ctrl.signal : undefined});
      if (!res.ok) {
        let motivo = "HTTP " + res.status;
        try { const j = await res.clone().json(); if (j && j.error && j.error.message) motivo += ": " + j.error.message; } catch(e) {}
        throw new Error(motivo);
      }
      const tipo = (res.headers.get("content-type") || "").toLowerCase();
      if (tipo.includes("text/html")) throw new Error("Drive devolvió una página en lugar del archivo");
      return res;
    } finally { if (t) clearTimeout(t); }
  }

  // ---- 1) Interceptar fetch para los Excel ----
  const fetchOriginal = window.fetch.bind(window);
  window.fetch = async function(input, init){
    const archivo = nombreArchivo(input);
    const id = ARCHIVOS_DRIVE[archivo];
    if (!id) return fetchOriginal(input, init);
    if (soloRepo) {
      anotar(archivo, "repo", "forzado con ?fuente=repo");
      return fetchOriginal(input, init);
    }
    const t0 = performance.now();
    try {
      const res = await pedirADrive(fetchOriginal, id);
      anotar(archivo, "drive", "", performance.now() - t0);
      return res;
    } catch(err) {
      const motivo = err && err.name === "AbortError" ? "Drive tardó demasiado" : String(err && err.message || err);
      anotar(archivo, "repo", "Drive no disponible: " + motivo, performance.now() - t0);
      return fetchOriginal(input, init);
    }
  };

  // ---- 2) Redirigir colecciones de Firebase (modo prueba) ----
  let firebaseConectado = false;
  function conectarFirebase(){
    if (firebaseConectado || !SUFIJO_FIREBASE) return firebaseConectado || !SUFIJO_FIREBASE;
    const fs = window.firebase && window.firebase.firestore;
    const proto = fs && fs.Firestore && fs.Firestore.prototype;
    if (!proto || typeof proto.collection !== "function") return false;
    const original = proto.collection;
    proto.collection = function(ruta){
      if (typeof ruta === "string") {
        const partes = ruta.split("/");
        if (COLECCIONES.includes(partes[0])) { partes[0] += SUFIJO_FIREBASE; ruta = partes.join("/"); }
      }
      return original.call(this, ruta);
    };
    firebaseConectado = true;
    console.info(`[AKC fuentes] Firebase en modo prueba: colecciones con sufijo "${SUFIJO_FIREBASE}"`);
    return true;
  }
  if (!conectarFirebase() && SUFIJO_FIREBASE) {
    // Firebase aún no está cargado: reintentar cuando aparezca.
    const timer = setInterval(() => { if (conectarFirebase()) clearInterval(timer); }, 15);
    setTimeout(() => clearInterval(timer), 20000);
    document.addEventListener("DOMContentLoaded", conectarFirebase);
  }

  // Etiqueta visible "MODO PRUEBA" (no sale al imprimir) para no confundir con la app oficial.
  if (SUFIJO_FIREBASE) {
    const ponerEtiqueta = () => {
      if (!document.body || document.getElementById("akc-modo-prueba")) return;
      const e = document.createElement("div");
      e.id = "akc-modo-prueba";
      e.textContent = "MODO PRUEBA";
      e.style.cssText = "position:fixed;right:8px;bottom:8px;z-index:99999;background:#d29922;color:#000;font:700 11px system-ui,sans-serif;padding:3px 8px;border-radius:6px;opacity:.85;pointer-events:none";
      document.body.appendChild(e);
      const st = document.createElement("style");
      st.textContent = "@media print{#akc-modo-prueba{display:none!important}}";
      document.head.appendChild(st);
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ponerEtiqueta); else ponerEtiqueta();
  }

  window.AKC_FUENTES = {
    registro, conectarFirebase,
    archivos: ARCHIVOS_DRIVE,
    sufijoFirebase: SUFIJO_FIREBASE,
    get firebaseConectado(){ return firebaseConectado; },
    urlDrive
  };
})();
