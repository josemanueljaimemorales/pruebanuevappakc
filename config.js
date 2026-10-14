window.CLIENTE = {
  nombre: "ÁGUILAS KC",
  subtitulo: "GIMNASIA ARTÍSTICA VARONIL",
  logo: "../modulos/fuerza/logo-transparent.png",
  colores: {
    principal: "#aeb9c6",
    secundario: "#c5a45a",
    acento: "#2ea8ff"
  },
  repositorios: {
    normativosExcel: new URL("modulos/normativos/NORMATIVOS_AKC.xlsx", (document.currentScript && document.currentScript.src) || location.href).href, // copia de este repo; cliente/fuentes.js lo pide primero a Google Drive
    normativosDatabase: "https://raw.githubusercontent.com/josemanueljaimemorales/NormativosAKC/main/database.json",
    rutinasExcel: "https://raw.githubusercontent.com/josemanueljaimemorales/RutinasAKC/main/Excel_Solo_Valores.xlsx"
  }
};
