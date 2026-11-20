# Calendario 2027 · Equipo Facilitador ACTS

Sitio del calendario 2027 de la Parroquia El Salvador del Mundo, publicado con GitHub Pages.
No tiene backend ni dependencias: HTML, CSS y JavaScript, y tres archivos de datos.

## Qué hay

| Archivo | Qué es |
|---|---|
| `data/calendario.json` | El calendario tal como se generó desde `datos_calendario.py`. Es la base. |
| `data/manual.json` | Las citas del **Manual del Retiro de ACTS** con su capítulo y página, para consultarlo. |
| `data/cambios.json` | **La memoria de la reunión.** Cada cambio que se hace en modo reunión queda aquí. |

## Modo reunión

1. Botón **Modo reunión** arriba a la derecha.
2. Cada actividad se puede editar, borrar o mover de fecha. Abajo de cada mes aparece «Agregar actividad».
3. Cada cambio pide un **motivo** y queda registrado con el nombre de quien lo anota.
4. La barra de abajo muestra cuántos cambios hay: se pueden **deshacer**, **ver el acta**, **descargar** o
   **publicar en GitHub**.

Al publicar, el sitio escribe `data/cambios.json` y `data/acta.md` en este repositorio con la API de GitHub.
Necesita un token fino con permiso **Contents: write** sobre este repositorio; se guarda solo en el navegador.

## Cómo se convierte en el PDF imprimible

Hermes lee `data/cambios.json` (o el archivo descargado) y:

1. aplica los cambios en `datos_calendario.py`;
2. corre `bash render.sh`, que regenera el Excel, el consolidado y los cuatro PDF por equipo;
3. revisa que ninguna página invada el pie antes de entregar.

El histórico del acta sirve para explicar en la reunión por qué se movió cada fecha.

## Referencias al Manual

Cada bloque del sitio trae su ficha: **Manual · capítulo · página**. Al pulsarla se abre la transcripción de la
cita. Las páginas corresponden al ejemplar impreso del equipo (187 páginas), no al PDF del sitio.

## Desarrollo local

```bash
python -m http.server 8787
# abrir http://localhost:8787
```

Los datos se regeneran desde la carpeta del proyecto:

```bash
python build_web.py      # escribe web/data/calendario.json
```
