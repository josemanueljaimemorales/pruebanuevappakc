# App GAV AKC — guía para Claude

App web (HTML/JS sin build) del programa de Gimnasia Artística Varonil de Águilas de Kids Center (AKC).
Se publica con GitHub Pages desde la rama `main`. Usuario: Manu (José Manuel Jaime Morales), entrenador principal. Responder en español, claro y sin relleno.

## Repos
- `pruebanuevappakc` = **app de prueba**. Todo cambio nuevo se hace y se prueba aquí primero.
- `GAV-APP-AKC` = **app oficial**. No se toca hasta que Manu diga que lo de prueba ya funciona ("pásalo a la oficial").
- Al pasar a la oficial: copiar los cambios y poner `SUFIJO_FIREBASE = ""` en `cliente/fuentes.js`.
- Antes de pasar a la oficial, comparar la oficial actual contra el commit "base: espejo de GAV-APP-AKC" (6ee5541): si cambió algo allá (p. ej. `modulos/mvp/app.js` con fotos en `foto1`/`foto2`), integrarlo, no sobrescribirlo. Nunca copiar archivos de prueba encima sin revisar.

## Estructura
- `index.html` + `script.js`: menú principal; cada módulo vive en `modulos/<nombre>/`.
- Módulos: basicos, calendario, cargas, fuerza, fuerzafig, gav-training, mvp, normativos, plan-anual, reportes (asistencia, estadisticas), rutinas (app.js = vista de atletas, editor.html/editor.js = editor protegido), sistemas, fuentes (diagnóstico), respaldo.
- `cliente/config.js` (identidad del club), `cliente/xlsx-reader.js` (lector XLSX propio), `cliente/fuentes.js` (fuentes de datos).
- **Training** (`modulos/gav-training/`): el trabajo de cada atleta sale de Normativos (Excel + nube, con `cliente/normativos-datos.js`, solo lectura): por aparato y bloque, todo lo No adquirido y En proceso y los 2 primeros en Proyección; lo Consolidado no se trabaja. `trabajo_gav.xlsx` solo da apodo (NOMBRE), NIVEL, GRUPO y la columna NORMATIVOS (nombre oficial); sus columnas de aparatos ya no se usan.

## Datos
- **Excel desde Google Drive**: `cliente/fuentes.js` intercepta `fetch` de los Excel y los busca **por nombre** en la carpeta "Utilidades App" (`CARPETA_DRIVE`, compartida con enlace); si no puede listarla usa los IDs fijos de `ARCHIVOS_DRIVE`, y si Drive falla, la copia del repo. Para cambiar un Excel basta subir a esa carpeta un archivo con el mismo nombre; no hace falta subirlo al repo. Las dos apps (prueba y oficial) buscan por nombre desde el 15-oct-2026.
- **MACRO por ciclo**: se llama `MACRO_AA_BB.xlsx` (26_27, 27_28…). Cuando la app pide el MACRO, `fuentes.js` usa el de ciclo más nuevo que haya en "Utilidades App". Plan Anual y Calendario deducen el año de inicio con la fila de días de la semana (no hay año fijo). La copia del repo (`modulos/plan-anual/MACRO_26_27.xlsx`) es solo respaldo si falla Drive.
- Reglas de la carpeta "Utilidades App":
  - Nombre exacto (mayúsculas, espacios, extensión); si se renombra, la app no ve la versión nueva.
  - Con dos archivos del mismo nombre gana el modificado más recientemente; dejar uno solo por nombre.
  - Debe seguir compartida "Cualquier persona con el enlace: lector".
  - Nada privado ahí (todo es público con el enlace). Respaldos y datos personales van en "Respaldos AKC (privado)".
  - Los IDs de `ARCHIVOS_DRIVE` son solo respaldo; "NORMATIVOS_AKC (anterior - usa la oficial).xlsx" ya no lo usa ninguna app.
- El conector de Drive puede leer, mover, renombrar y crear archivos, pero no reemplazar el contenido de uno existente. Para actualizar un Excel, Claude crea uno nuevo con el mismo nombre en "Utilidades App" (gana el más reciente), mueve el anterior a "Respaldos AKC (privado)" y verifica descargándolo que sea idéntico y público. Solo después de que el código que lo lee esté en las dos apps. Solo caben archivos chicos (~10 KB, como ASIGNACION); el MACRO (36 KB aun sin las filas vacías de Hoja1) es demasiado grande: lo sube Manu con "Administrar versiones → Subir nueva versión" (o "Reemplazar archivo existente") y Claude verifica descargándolo y mueve a respaldos el duplicado si quedó uno.
- **Firebase** (proyecto `akc-con-reporte`, SDK compat 9.6.10). Colecciones: normativosAKC, rutinasAKC, calendarioAKC, mvpAKC, cargasAKC (doc `estado`) y registros (Fuerza).
- En la app de prueba `SUFIJO_FIREBASE = "_prueba"`: todo se guarda en `<coleccion>_prueba`, nunca en los datos reales. `modulos/respaldo/` descarga un JSON de los datos reales y tiene un botón para copiarlos a modo prueba.
- Normativos une Excel + nube por aparato+clasificación+elemento (no por fila); la nube manda y nunca se borran avances.

## Reglas de trabajo (de Manu)
- PRs: cuando Manu apruebe los cambios, Claude abre el PR y también hace el merge (Manu no lo hace a mano).
- Cambiar solo lo que se pide; no rehacer ni "mejorar" otras partes; no romper funciones existentes. Si algo falla repetidamente, volver a la última versión funcional.
- **No modificar el editor de rutinas** (`modulos/rutinas/editor.*`) salvo que Manu lo pida explícitamente.
- Distinguir lo hecho, lo probado y lo verificado; no afirmar que algo funciona sin probarlo.
- Probar pantalla y también PDF/impresión (fondo blanco, sin etiquetas de prueba), navegación sin botones duplicados y cálculos con casos límite (no multiplicar porcentajes por 100 dos veces).
- No exponer contraseñas ni tokens en texto visible ni en el repo.
- Gimnasia varonil: sin figuras femeninas; imágenes/videos reales, no generados por IA.

## MACRO y ASIGNACION DE COMPETENCIAS (convenciones para editarlos)
- Los edita Claude con openpyxl a partir de la versión vigente en Drive (descargarla y comparar antes); conservar formato, colores, celdas combinadas y área de impresión; revisar la impresión (PDF) y probar Plan Anual y Calendario con los archivos nuevos antes de entregarlos.
- MACRO, hoja "macro gral": fila 9 = unidad por día (CH choque, O ordinaria, R recuperación, D descanso, C competencia, E evento, V vacaciones; confirmado por Manu), fila 10 = descripción. Competencia = unidad C + descripción en rojo; evento = unidad E.
- Dos cosas el mismo día: descripción "A / B" y unidad "C/E" (misma cantidad y orden). P. ej. "COPA PANAMERICANA GUATEMALA 26 / CAMPAMENTO…".
- Descanso solo para algunos: "DESCANSO PARA PARTICIPANTES DE <competencia>"; la app no lista nombres de descansos.
- ASIGNACION: una columna por competencia o evento, en orden de fecha; fila 1 = nombre **idéntico** al del MACRO, fila 2 = "SEDE\n<lugar>"; valores SI / NO (podría ir pero no va) / No aplica (no le corresponde por nivel o categoría); PARTICIPACION = COUNTIF(SI)/número de SI de la fila. Los eventos (campamentos) se ligan solo por nombre exacto.
- Patrones del ciclo 26-27: copas para todos los niveles (Pablo Mares, FIG, solo va a Mikulak, selectivos, Estatal y Nacional); Copa CDI solo niveles 3–8; selectivos nacionales solo 9, 10 y FIG; Estatal GUEM y Nacional FMG desde nivel 4; Juegos CONADE / Olimpiada Nacional depende de la categoría por edad, no del nivel (preguntar a Manu quién entra).

- La app para crear macrociclos nuevos vive en el repo `AKC_PRO_MASTER` (https://josemanueljaimemorales.github.io/AKC_PRO_MASTER/); sus criterios están en su CLAUDE.md.

## Rutinas (criterios de Manu)
- N7 y N8 usan la estructura de rutinas USAG; elementos del mismo cuadro del Código dan valor cada uno sin contar como repetición.
- En el Excel de rutinas "CONECTADO A" al final de un elemento = conexión con el de la siguiente línea; "A CAMBIO DE TOMA" = cambio de toma que no suma valor.
- Obligatorios: rutina oficial por nivel en `modulos/rutinas/obligatorios.json`; palomeos por atleta en la nube (`obligatorios.atletas[nombre].m`). ✓ realiza, ↺ reemplazado por BE, ✗ no realiza.

## Atletas: el mismo atleta en cada módulo (confirmado por Manu, 21-oct-2026)
- Nombre oficial = el de Normativos (fila 1 de la hoja NORMATIVOS, padrón que también usa Fuerza). "—" = no aparece.
- Columnas: Normativos | Training (trabajo_gav.xlsx) | Rutinas | MVP | Asignación | Estadística.
- Diego Jaime | Diego | DIEGO J | — | Diego Jaime | DIEGO JAIME
- Ricardo Jimenez | Richie | RICHIE | — | Ricardo Jiménez | RICHIE
- Alonso Ahedo | Alonso | ALONSO | Alonso Ahedo | Alonso Ahedo | ALONSO
- Mikel Larrinua | Mikel | MIKEL | Mikel Larrinua | Mikel Larrinua | MIKEL
- Diego Rodriguez | Champi | CHAMPI | Diego Champi Rodríguez | Diego Rodríguez | DIEGO RODRIGUEZ
- Isaac Martinez | Isaac (GAV 9) | ISAAC | Isaac Martínez | Isaac Martínez | ISAAC MARTINEZ
- Diego Vela | Vela | VELA | Diego Vela | Diego Vela | DIEGO VELA
- Yerik Guerra | Yerik | YERIK | — | Yerik Guerra | YERIK
- Fernando Talavera | Fer | FER | Fer Talavera | Fernando Talavera | FER
- Diego Chavez | Chavez | CHAVEZ | Diego Chávez | Diego Chávez | DIEGO CHAVEZ
- Mario Bisteni | Mario | MARIO | Mario Bisteni | Mario Bisteni | MARIO
- Maximiliano Diaz | Max | MAX | Max Diaz | Maximiliano Díaz | MAX DIAZ
- Santiago Sigler | Santi Lee | SANTI LEE | Santi Sigler | Santiago Sigler | SANTI SIGLER
- Nicolas Capitanacci | Nico Capi | NICO CAPI | Nico Capitanachi | Nicolás Capitanacci | NICO CAPITANACCI
- Bruno Jacobo | Brunito | — | Bruno Jacobo | Bruno Jacobo | BRUNO JACOBO
- Santi Camacho | Santi power | — | Santiago Camacho | Santiago Camacho | SANTI CAMACHO
- Leo Camacho | Leito | — | Leonardo Camacho | Leonardo Camacho | LEO CAMACHO
- Nico Flores | Nico flores | — | Nicolás Flores | Nicolás Flores | NICO FLORES
- Carlos Aznar | Charly | — | Charlie Aznar | Carlos Aznar | CHARLY
- Emi Gonzalez | Emi | — | Emiliano González | Emiliano González | EMI GONZALEZ
- David Rangel | David | — | David Rangel | David Rangel | DAVID
- Diego Cuevas | Cuevas | — | Diego Cuevas | Diego Cuevas | DIEGO CUEVAS
- Jose Ma Robles | Chema | — | Chema Robles | José María Robles | CHEMA
- Mauro Regand | Mauro | — | Mauro Regand | Mauro Regand | MAURO
- Bruno Baez | Bruno Baez | — | Bruno Báez | Bruno Báez | BRUNO BAEZ
- Brittan Akim | Brittan | — | Brittan Akim | Brittán Robles | BRITTAN  (nombre completo: Brittan Akin Robles)
- Alfredo Jacobo | Alfred | — | Alfredo Jacobo | Alfredo Jacobo | ALFRED
- Erik Lopez | — | — | Eric López | Erik Lopez | —  (niño nuevo; aún no está en Training)
- Leo Lazaro | Leo Lazaro | — | Leonardo García Lázaro | Leonardo Garcia Lazaro | —
- Isaac Rangel (GAV 4) | Isaac Rangel | — | Isaac Rangel | Isaac Rangel | —  (el otro "Isaac" de Training, GAV 9, es Isaac Martinez)
- "Pato" ya no está en el equipo (se quitó de Training).
- Joan: niño nuevo de un grupo nuevo (GAV 3, nivel 3; ya en MVP, Normativos —todo en Proyección— y Training). No va en Asignación: todavía no compite.
- Pablo Mares: no entrena al 100% en AKC; se queda solo en Asignación (y su historial en Estadística como PABLO). No agregarlo a Normativos ni a otros módulos.
- Angel Babun y Felix Mogollon (registros de Fuerza) son de ESGILA, no de AKC: no mezclarlos con los atletas de AKC.
