# AKC Resultados — Prototipo

Módulo independiente para visualizar resultados de competencias a partir de archivos Excel.

## Uso

1. Abre `index.html` en un navegador.
2. El prototipo inicia con los datos de `NACIONAL 2026`.
3. Usa **Subir Excel de resultados** para cargar otro archivo compatible.
4. El evento se detecta desde la esquina superior izquierda de la hoja principal.

## Reglas principales

- Muestra Objetivo AA, All Around, Diferencia y efectividad general.
- Muestra NP deseada cuando existe en la segunda hoja.
- Muestra NP real, NF, DED y porcentaje por aparato.
- Si NF es 0, el aparato se muestra como **NO PRESENTÓ** y no genera DED ni porcentaje.
- El ranking es interno de AKC: solo considera atletas presentes en el archivo y con AA mayor que 0.
- El ranking no representa el lugar oficial obtenido frente a todos los competidores del evento.

## Estructura esperada del Excel

- `Hoja3`: resultados principales.
- `Hoja2`: resultados/base y, cuando exista, sección `NOTAS DE PARTIDA DESEADAS`.
