# Made

La página del regalo y la galería de fotos. HTML, CSS y JavaScript
planos: sin framework, sin build, sin dependencias.

Se publica en <https://ssebas545.github.io/Regalo-7-Meses/> con
GitHub Pages. **Todo lo que se commitea a `main` es público en
minutos y no hay preview.**

## Estructura

| archivo | qué es |
|---|---|
| `index.html` | la narrativa: sobre, fechas, manual, canciones, carta, promesa |
| `galeria.html` | las fotos y la subida desde el celular |
| `clave.html` | herramienta para generar el hash de una clave nueva |
| `styles.css` | la hoja de estilos única (paleta nocturna) |
| `config.js` | fechas, hash de la clave y datos del repo de fotos |
| `acceso.js` | el portón de la clave (PBKDF2-SHA256) |
| `app.js` | contadores, sobre, menú, tarjetas que se dan vuelta |
| `galeria.js` | token, listado, compresión, subida y lightbox |
| `clave.js` | generador de salt + hash |
| `fuentes/` | Fraunces variable, subset latino, con su licencia OFL |
| `robots.txt` | `Disallow: /` |

## Probarlo en local

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

Y abrir <http://127.0.0.1:8765/>. No abrir con `file://`: el portón
necesita WebCrypto y la galería necesita `fetch`.

## La galería

### Antes de las fotos: el regalo

La galería no arranca con la grilla. Primero hay una caja con un lirio
en vez de moño: al tocarla se destapa, sale una luz cálida y aparece
**"Te amo, nunca lo dudes."** Las fotos no se ven hasta ese momento.
Al recargar, la caja vuelve a estar cerrada; si se toca de nuevo ya
abierta, el mensaje se repite sin tocar las fotos.

### Cómo está armada

Las fotos **no están en este repo**, que es público. Viven en otro
repo, privado: `SSebas545/Regalo-7-Meses-fotos`, carpeta `fotos/`.
La página las lee con la API de GitHub usando un token de permiso
fino que se pega una vez por sesión.

Cada foto son dos archivos:

```
fotos/20261025-013045-a1b2.webp      1600 px, calidad 0.82
fotos/20261025-013045-a1b2-min.webp   480 px, calidad 0.70
```

El nombre lleva la fecha y la hora, así que la lista se ordena sola
y no hace falta un `manifest.json`: la galería lee el listado del
repo. Menos piezas, menos cosas que se desincronicen.

### Configurarlo (una sola vez)

1. Crear el repo **privado** `Regalo-7-Meses-fotos`, con un README
   cualquiera y la rama `main`.
2. En GitHub: *Settings → Developer settings → Personal access
   tokens → Fine-grained tokens → Generate new token*.
   - **Repository access**: solo `Regalo-7-Meses-fotos`.
   - **Permissions → Contents**: *Read and write*.
   - **Expiration**: 90 días (renovable).
3. Abrir la galería en el celular, tocar el `+`, pegar el token y
   guardar.

El token queda en `sessionStorage`: se borra al cerrar la pestaña y
nunca se escribe en el repo, en la URL ni en el historial.

### Subir

Desde la galería, `+` → *Elegir fotos*: abre el carrete o la cámara
del teléfono. Hasta 10 por vez.

Antes de salir, cada foto se redibuja en un `<canvas>` y se
re-encodea: eso **borra el EXIF** (fecha, modelo, GPS). Se suben la
grande y la miniatura. Si el navegador no sabe escribir WebP, cae a
JPEG solo.

### Borrar una foto

Todavía no hay botón: se borra desde GitHub, en el repo privado, y
se borran los dos archivos (el grande y el `-min`). La galería se
actualiza sola al recargar.

### Límites

- 10 fotos por tanda y 25 MB por archivo original.
- El listado de la API devuelve hasta 1000 archivos, o sea unas 500
  fotos. Si algún día no alcanza, hay que paginar.
- Los GIF y los SVG se rechazan: se validan los *magic bytes*, no
  la extensión.

## Diseño

Paleta azul marino, en variables al principio de `styles.css`:

| variable | hex | para qué | contraste sobre el fondo |
|---|---|---|---|
| `--fondo` | `#070f1e` | el fondo | — |
| `--sup` / `--sup-2` | `#0d1a2e` / `#13233c` | tarjetas, paneles, la caja | — |
| `--texto` | `#eaf0fa` | el texto | 16.73:1 |
| `--tenue` | `#9fb2cd` | texto secundario | 8.87:1 |
| `--acento` | `#a9c6ec` | detalles, foco, enlaces | 10.93:1 |
| `--miel` | `#e0b878` | el sello, el corazón, el regalo | 10.31:1 |

Los contrastes están medidos con la fórmula de WCAG contra `--fondo`:
todos pasan AA (4.5:1) y AAA (7:1). No hay colores sueltos: los pocos
translúcidos se arman con `color-mix()` sobre las variables.

**Los lirios** son SVG inline: un `<symbol id="lirio">` por página,
reusado con `<use>`. Dos grandes en las esquinas del sobre y uno chico
apoyado en la línea que separa las secciones. Se recolorean solos con
`currentColor`; en mobile bajan la opacidad para no amontonarse.

## Seguridad: qué protege qué

| cosa | cómo está | qué tan fuerte es |
|---|---|---|
| el texto de la página | portón con PBKDF2-SHA256 (150k iteraciones) | **disuasión**: el HTML es público y se lee con “ver código fuente” |
| las fotos | repo privado + token con permiso solo a ese repo | **real**: sin token no se pueden ni listar |
| el token | `sessionStorage`, `Bearer` en el header | no va al repo, ni a la URL, ni a los logs |
| el origen | `ssebas545.github.io` es compartido con otros Pages de la cuenta | por eso el token es de permiso fino, con vencimiento y solo lectura/escritura de ese repo |
| el EXIF | se pierde al redibujar en canvas | las fotos no publican dónde ni cuándo se sacaron |

Además: `Content-Security-Policy` por `<meta>` (`script-src 'self'`,
`connect-src` solo `api.github.com`), `noindex`, `no-referrer`, y
ningún `innerHTML` con datos que vengan de la red.

Lo que GitHub Pages no deja hacer: mandar headers HTTP, así que
`frame-ancestors`, `X-Frame-Options` y `Strict-Transport-Security`
no se pueden aplicar desde acá.

**La clave no es una contraseña de verdad.** No la reutilices de
nada importante. Si alguna vez hiciera falta privacidad real para el
texto, hay que mover el sitio a un origen con autenticación.

### Lo que dijo la auditoría

El código pasó por una revisión externa (`agy`, Gemini 3.8 Flash) que
devolvió ocho hallazgos. Se verificaron uno por uno: **dos eran bugs
reales y se corrigieron, el resto son riesgos aceptados o falsos
positivos.** Los checksums antes y después confirman que la
herramienta no tocó ningún archivo.

Corregido:

- **HEIC rechazado como “no es una foto”.** Se comparaban cuatro
  caracteres hex contra los ocho de `ftyp`, así que la condición daba
  siempre falso. Un HEIC de iPhone ahora pasa la validación y, si el
  navegador no lo sabe decodificar, el mensaje lo dice (“sacala de
  nuevo en JPG”). En Safari sí se decodifica.
- **Nombre de archivo con `Math.random`.** Dos fotos del mismo segundo
  podían pisarse en el repo. Ahora el azar sale de
  `crypto.getRandomValues`.

Riesgos aceptados, con el porqué:

- **No hay `frame-ancestors` ni `X-Frame-Options`.** GitHub Pages no
  permite mandar headers. El sitio se podría embeber en un iframe,
  pero el portón y el token viven en `sessionStorage`, que es por
  pestaña: un iframe ajeno no hereda la sesión de otra pestaña y el
  texto es público igual. Se acepta.
- **`script-src 'self'` cubre todo `ssebas545.github.io`.** Otro Page
  de la misma cuenta podría servir un script que esta página
  aceptaría. Mitigación: no se carga nada de terceros, no se usa
  `innerHTML` con datos de la red y el token es de permiso fino, con
  vencimiento y limitado a un repo.
- **`connect-src` permite cualquier endpoint de `api.github.com`,** no
  solo el repo de fotos. Aun así, el token no puede tocar otro repo:
  el límite lo pone el token, no la CSP.
- **Los blobs quedan en memoria mientras la pestaña esté abierta.** Se
  guardan las fotos completas para que el lightbox no vuelva a pedir
  nada. Son unos pocos MB y se liberan al cerrar la pestaña; revocarlos
  rompería reabrir una foto.
- **`sessionStorage` no vence solo.** Al cerrar la pestaña se borra,
  pero si el navegador restaura la sesión (Chrome, “continuar donde
  quedaste”) el token sigue. Es el mismo dispositivo, el token vence a
  los 90 días y se puede revocar desde GitHub cuando quieras.

## Cambiar la clave

1. Abrir `clave.html` (en el sitio publicado o en local).
2. Escribir la palabra nueva dos veces y tocar *Generar*.
3. Pegar el bloque que devuelve en `config.js`, dentro de `acceso`.
4. Commit y push. Las sesiones abiertas se cierran solas: la marca
   de sesión guarda el hash, no un “sí”.

## Publicar

```sh
git add -A
git commit -m "…"
git push origin main
```

GitHub Pages publica `main` en uno o dos minutos. No hay entorno de
prueba: lo que se pushea, se ve.
