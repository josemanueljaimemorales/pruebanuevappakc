# Módulo Normativos — ESGILA

Este módulo está contenido físicamente dentro del repositorio del cliente.

- `index.html`: aplicación de normativos.
- `NORMATIVOS_ESGILA.xlsx`: **fuente principal de datos** que lee la aplicación al cargar.
- `database.json`: respaldo de los datos del Excel para recuperación si el navegador no puede leer XLSX.
- `../../cliente/xlsx-reader.js`: lector XLSX local, sin dependencia externa.
- El logo se toma de `../../cliente/logo.png`.
- No depende del repositorio de Normativos AKC ni de Firebase.
- Si cambias atletas, elementos o estados en `NORMATIVOS_ESGILA.xlsx` y reemplazas el archivo en GitHub, la aplicación leerá esos cambios al volver a cargar.
- Los cambios hechos desde la aplicación se guardan localmente; si el Excel cambia, el nuevo Excel tiene prioridad.


Plantilla de descarga: `NORMATIVOS_ESGILA.xlsx`. Los cambios hechos en la aplicación se escriben sobre esta plantilla al descargar.
