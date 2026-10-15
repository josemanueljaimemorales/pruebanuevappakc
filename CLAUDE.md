# App GAV AKC — guía para Claude

App web (HTML/JS sin build) del programa de Gimnasia Artística Varonil de Águilas de Kids Center (AKC).
Se publica con GitHub Pages desde la rama `main`. Usuario: Manu (José Manuel Jaime Morales), entrenador principal. Responder en español, claro y sin relleno.

## Repos
- `pruebanuevappakc` = **app de prueba**. Todo cambio nuevo se hace y se prueba aquí primero.
- `GAV-APP-AKC` = **app oficial**. No se toca hasta que Manu diga que lo de prueba ya funciona ("pásalo a la oficial").
- Al pasar a la oficial: copiar los cambios y poner `SUFIJO_FIREBASE = ""` en `cliente/fuentes.js`.

## Estructura
- `index.html` + `script.js`: menú principal; cada módulo vive en `modulos/<nombre>/`.
- Módulos: basicos, calendario, cargas, fuerza, fuerzafig, gav-training, mvp, normativos, plan-anual, reportes (asistencia, estadisticas), rutinas (app.js = vista de atletas, editor.html/editor.js = editor protegido), sistemas, fuentes (diagnóstico), respaldo.
- `cliente/config.js` (identidad del club), `cliente/xlsx-reader.js` (lector XLSX propio), `cliente/fuentes.js` (fuentes de datos).

## Datos
- **Excel desde Google Drive**: `cliente/fuentes.js` intercepta `fetch` de los Excel y los pide a la API de Drive (carpeta "Utilidades App", IDs en `ARCHIVOS_DRIVE`); si Drive falla usa la copia del repo. Para cambiar un Excel, se actualiza en Drive (mismo ID); no hace falta subirlo al repo.
- **Firebase** (proyecto `akc-con-reporte`, SDK compat 9.6.10). Colecciones: normativosAKC, rutinasAKC, calendarioAKC, mvpAKC, cargasAKC (doc `estado`) y registros (Fuerza).
- En la app de prueba `SUFIJO_FIREBASE = "_prueba"`: todo se guarda en `<coleccion>_prueba`, nunca en los datos reales. `modulos/respaldo/` descarga un JSON de los datos reales y tiene un botón para copiarlos a modo prueba.
- Normativos une Excel + nube por aparato+clasificación+elemento (no por fila); la nube manda y nunca se borran avances.

## Reglas de trabajo (de Manu)
- Cambiar solo lo que se pide; no rehacer ni "mejorar" otras partes; no romper funciones existentes. Si algo falla repetidamente, volver a la última versión funcional.
- **No modificar el editor de rutinas** (`modulos/rutinas/editor.*`) salvo que Manu lo pida explícitamente.
- Distinguir lo hecho, lo probado y lo verificado; no afirmar que algo funciona sin probarlo.
- Probar pantalla y también PDF/impresión (fondo blanco, sin etiquetas de prueba), navegación sin botones duplicados y cálculos con casos límite (no multiplicar porcentajes por 100 dos veces).
- No exponer contraseñas ni tokens en texto visible ni en el repo.
- Gimnasia varonil: sin figuras femeninas; imágenes/videos reales, no generados por IA.

## Rutinas (criterios de Manu)
- N7 y N8 usan la estructura de rutinas USAG; elementos del mismo cuadro del Código dan valor cada uno sin contar como repetición.
- En el Excel de rutinas "CONECTADO A" al final de un elemento = conexión con el de la siguiente línea; "A CAMBIO DE TOMA" = cambio de toma que no suma valor.
- Obligatorios: rutina oficial por nivel en `modulos/rutinas/obligatorios.json`; palomeos por atleta en la nube (`obligatorios.atletas[nombre].m`). ✓ realiza, ↺ reemplazado por BE, ✗ no realiza.
