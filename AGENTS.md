# Regalo 7 Meses

Sitio estático con HTML, CSS y JavaScript planos. El proyecto está en
`/home/sebas/GitHub/Regalo-7-Meses/`. Sin framework, sin build, sin
dependencias: lo que hay en el repo es lo que se publica.

## Estructura

| archivo | qué es |
|---|---|
| `index.html` | la narrativa del regalo |
| `galeria.html` | la galería de fotos y el panel de subida |
| `clave.html` | herramienta para generar el hash de la clave |
| `styles.css` | todos los estilos |
| `config.js` | fechas, hash de la clave y datos del repo de fotos |
| `acceso.js` | el portón de la clave |
| `app.js` | contadores, sobre, menú, tarjetas |
| `galeria.js` | token, listado, compresión, subida, lightbox |
| `clave.js` | generador de salt + hash |
| `fuentes/` | Fraunces variable + licencia OFL |
| `robots.txt` | `Disallow: /` |

## Convenciones

- HTML, CSS y JavaScript planos. Abrir `index.html` con un servidor
  local (`python3 -m http.server 8765`) tiene que funcionar.
- Los comentarios del código van en español, rioplatense.
- **Nada de scripts inline ni `onclick=`**: la CSP es
  `script-src 'self'`. Todo va en archivos y se engancha con
  `addEventListener`.
- **Nada de `innerHTML` con datos de la red.** Se arma con
  `createElement` y `textContent`.
- **Secretos**: el token de GitHub nunca va al repo, ni a la URL, ni
  a `localStorage`. Va en `sessionStorage` y se borra al cerrar la
  pestaña. La clave del portón es un hash con salt, no la clave.
- La galería habla **solo** con `api.github.com`. Cualquier otro
  dominio hay que agregarlo a la CSP de las dos páginas y explicar
  por qué.
- Las fotos no viven en este repo: están en
  `SSebas545/Regalo-7-Meses-fotos`, privado. Este repo es público y
  lo que se pushea a `main` se ve en minutos.

## Probar

```sh
node --check app.js
node --check acceso.js
node --check galeria.js
node --check clave.js
```

Para la galería hace falta un token real: sin token, lo que se puede
probar es el estado vacío, el panel y que no haya errores de consola.

## Contexto en el vault

- Nota índice: `~/.config/obsidian-notes/proyectos/Regalo-7-Meses.md`
  (estado, stack, decisiones, pendientes).
- Diseño: `proyectos/Regalo-7-Meses-diseno.md`.
- Contenido y qué del `.docx` no se puede publicar:
  `proyectos/Regalo-7-Meses-contenido.md`.
- Antes de dar algo por hecho, verificá con `git status` y `git log`.
- Historial: en 2026-10-18 un subagente (`big-pickle`) editó este repo
  sin avisar. No confíes en "el comando devolvió 0": revisá el diff.
- El `.docx` original tiene DNI, teléfono, mail, dirección y talles.
  **No va a ningún repo ni nota.**
