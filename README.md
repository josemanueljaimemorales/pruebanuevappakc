# AKC RESULTADOS

Módulo independiente para consultar resultados de competencias de gimnasia artística varonil de Águilas Kids Center.

## Cambios de esta versión
- Lee las hojas buscando automáticamente la estructura de resultados, en vez de depender de filas fijas.
- Recorre todos los atletas detectados del Excel.
- Lee la hoja de notas de partida deseadas cuando existe.
- Cada Excel nuevo se agrega al historial y no borra competencias anteriores.
- El historial se conserva en el navegador mediante localStorage.
- La pantalla principal tiene únicamente un botón discreto `＋ Subir Excel`.
- Los atletas se seleccionan desde un menú desplegable.
- El reporte usa colores por aparato y tarjetas de indicadores.
- NF = 0 se muestra como `NO PRESENTÓ` y no entra en el cálculo de efectividad.
- La efectividad general promedia únicamente los aparatos presentados.
- El ranking AKC se calcula entre los atletas del club presentes en ese archivo y con AA > 0.
- El lugar oficial del Excel se conserva como referencia separada y no modifica el ranking AKC.

## Uso
Abre `index.html` en un navegador moderno. El módulo inicia con `NACIONAL 2026` como ejemplo usando el Excel entregado para esta prueba.

Para agregar otra competencia, usa `＋ Subir Excel`. La nueva competencia aparecerá como una tarjeta y las anteriores permanecerán.
