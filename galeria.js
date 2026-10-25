/* ============================================================
   Galería.

   De dónde salen las fotos
   ------------------------
   De un repo privado de GitHub (CONFIG.fotos), no de este repo,
   que es público. Se leen con un token de permiso fino que se
   pega una vez por sesión.

   El token vive en sessionStorage y no en localStorage a
   propósito: ssebas545.github.io es un origen compartido con
   cualquier otro Pages de la misma cuenta. Al menos así muere
   al cerrar la pestaña.

   Qué se sube
   -----------
   La foto se redibuja en un canvas antes de salir: eso le borra
   el EXIF (fecha, modelo de cámara, GPS) y la deja en 1600 px.
   Se suben dos archivos: la grande y una miniatura de 480 px.

   La lista de fotos no es un manifest: se lee del listado del
   repo. Así no hay dos verdades que se puedan desincronizar y
   una subida a medias se arregla sola.
   ============================================================ */

(function () {
  'use strict';

  var CLAVE_TOKEN = 'regalo.pat';
  var API = 'https://api.github.com';
  var MAXIMO_POR_TANDA = 10;
  var MESES = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ];

  var cfg = (typeof CONFIG !== 'undefined' && CONFIG.fotos) ? CONFIG.fotos : null;

  /* ---------- estado ---------- */

  var token = '';
  var fotos = [];
  var subiendo = false;
  var indice = -1;
  var panelAbierto = null;
  var disparador = null;
  var observador = null;

  var miniaturas = new Map(); // id -> objectURL de la miniatura
  var completas = new Map();  // id -> objectURL de la grande
  var pedidos = new Map();    // "id:tamano" -> promesa en curso
  var pedidoActual = 0;       // para descartar respuestas viejas del lightbox
  var fotosPorNodo = new WeakMap(); // botón de la grilla -> foto

  /* ---------- atajos al DOM ---------- */

  var $ = function (id) { return document.getElementById(id); };

  var sitio, grilla, cuenta, estado, velo;
  var panelToken, panelSubida, abrirSubida;
  var tokenCampo, tokenEstado, tokenGuardar, tokenBorrar;
  var archivoInput, elegir, cola, progreso, progresoTexto, progresoRelleno;
  var lightbox, lbImagen, lbFecha, lbCuenta, lbPrev, lbNext, lbCerrar;
  var regalo, regaloAbrir, regaloMensaje, galeriaCuerpo;

  /* ============================================================
     Token
     ============================================================ */

  function leerToken() {
    try {
      return sessionStorage.getItem(CLAVE_TOKEN) || '';
    } catch (error) {
      return '';
    }
  }

  function guardarToken(valor) {
    try {
      sessionStorage.setItem(CLAVE_TOKEN, valor);
      return true;
    } catch (error) {
      // Sin storage el token igual funciona, pero hay que pegarlo
      // de nuevo si se recarga la página.
      return false;
    }
  }

  function borrarToken() {
    try {
      sessionStorage.removeItem(CLAVE_TOKEN);
    } catch (error) {
      // Nada que borrar.
    }
  }

  function pareceToken(valor) {
    // Fino: github_pat_…  Clásico: ghp_…
    return /^(github_pat_[A-Za-z0-9_]{20,}|ghp_[A-Za-z0-9]{30,})$/.test(valor);
  }

  /* ============================================================
     API de GitHub
     ============================================================ */

  function errorApi(codigo, mensaje) {
    var error = new Error(mensaje);
    error.codigo = codigo;
    return error;
  }

  function mensajeDe(codigo, contexto) {
    if (codigo === 0) return 'No hay conexión. Revisá los datos y probá de nuevo.';
    if (codigo === 401) return 'El token no sirve o venció. Pegá uno nuevo.';
    if (codigo === 403) return 'GitHub no dejó hacer el pedido. Puede ser el límite de pedidos: esperá un minuto y probá de nuevo.';
    if (codigo === 404) {
      return contexto === 'archivo'
        ? 'Esa foto ya no está en el repo.'
        : 'No encuentro el repo privado. Revisá que exista y que el token tenga permiso sobre él.';
    }
    if (codigo === 409 || codigo === 422) return 'Hubo un choque con otro cambio. Probá de nuevo.';
    if (codigo >= 500) return 'GitHub está teniendo problemas. Probá en un rato.';
    return 'No se pudo completar el pedido (' + codigo + ').';
  }

  async function pedir(ruta, opciones, contexto) {
    var config = Object.assign({ cache: 'no-store' }, opciones || {});
    config.headers = Object.assign({
      Authorization: 'Bearer ' + token,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    }, config.headers || {});

    var respuesta;
    try {
      respuesta = await fetch(API + ruta, config);
    } catch (error) {
      throw errorApi(0, mensajeDe(0, contexto));
    }

    if (!respuesta.ok) {
      throw errorApi(respuesta.status, mensajeDe(respuesta.status, contexto));
    }
    return respuesta;
  }

  function rutaContenido(nombre) {
    var carpeta = cfg.carpeta ? cfg.carpeta.replace(/^\/+|\/+$/g, '') + '/' : '';
    return '/repos/' + encodeURIComponent(cfg.usuario) + '/' +
      encodeURIComponent(cfg.repo) + '/contents/' + carpeta +
      encodeURIComponent(nombre);
  }

  function rutaCarpeta() {
    var carpeta = cfg.carpeta ? cfg.carpeta.replace(/^\/+|\/+$/g, '') : '';
    return '/repos/' + encodeURIComponent(cfg.usuario) + '/' +
      encodeURIComponent(cfg.repo) + '/contents/' + carpeta +
      '?ref=' + encodeURIComponent(cfg.rama || 'main');
  }

  /* ============================================================
     Listado
     ============================================================ */

  async function listar() {
    var respuesta;
    try {
      respuesta = await pedir(rutaCarpeta(), {}, 'repo');
    } catch (error) {
      if (error.codigo === 404) {
        // Puede ser que el repo no exista o que la carpeta todavía
        // no esté. Se pregunta por el repo para distinguir.
        await pedir('/repos/' + encodeURIComponent(cfg.usuario) + '/' +
          encodeURIComponent(cfg.repo), {}, 'repo');
        return [];
      }
      throw error;
    }

    var lista = await respuesta.json();
    if (!Array.isArray(lista)) {
      throw errorApi(0, 'La respuesta del repo no se entiende.');
    }
    return armarFotos(lista);
  }

  // Nombres: 20261025-013045-a1b2.webp  y  20261025-013045-a1b2-min.webp
  var PATRON_FOTO = /^(\d{8}-\d{6}-[a-z0-9]{4,8})\.(webp|jpe?g|png)$/i;
  var PATRON_MINI = /^(\d{8}-\d{6}-[a-z0-9]{4,8})-min\.(webp|jpe?g|png)$/i;

  function armarFotos(lista) {
    var porId = new Map();

    lista.forEach(function (item) {
      if (!item || item.type !== 'file') return;
      var nombre = String(item.name || '');

      var mini = PATRON_MINI.exec(nombre);
      if (mini) {
        var idMini = mini[1];
        if (!porId.has(idMini)) porId.set(idMini, { id: idMini });
        porId.get(idMini).miniatura = nombre;
        return;
      }

      var grande = PATRON_FOTO.exec(nombre);
      if (grande) {
        var id = grande[1];
        if (!porId.has(id)) porId.set(id, { id: id });
        porId.get(id).archivo = nombre;
      }
    });

    var resultado = [];
    porId.forEach(function (foto) {
      if (!foto.archivo) return; // miniatura huérfana: no se muestra
      foto.miniatura = foto.miniatura || foto.archivo;
      foto.fecha = fechaDeId(foto.id);
      resultado.push(foto);
    });

    // El id arranca con la fecha y la hora: ordenar al revés deja
    // las últimas arriba.
    resultado.sort(function (a, b) {
      if (a.id === b.id) return 0;
      return a.id < b.id ? 1 : -1;
    });

    return resultado;
  }

  function fechaDeId(id) {
    return id.slice(0, 4) + '-' + id.slice(4, 6) + '-' + id.slice(6, 8);
  }

  function fechaLarga(fecha) {
    var partes = fecha.split('-');
    var mes = MESES[Number(partes[1]) - 1];
    if (!mes) return fecha;
    return Number(partes[2]) + ' de ' + mes + ' de ' + partes[0];
  }

  /* ============================================================
     Archivos: traer y cachear
     ============================================================ */

  function tipoPorNombre(nombre) {
    var ext = nombre.slice(nombre.lastIndexOf('.') + 1).toLowerCase();
    if (ext === 'png') return 'image/png';
    if (ext === 'webp') return 'image/webp';
    return 'image/jpeg';
  }

  async function traerArchivo(nombre) {
    var respuesta = await pedir(rutaContenido(nombre), {
      headers: { Accept: 'application/vnd.github.raw+json' }
    }, 'archivo');

    var bruto = await respuesta.blob();
    // GitHub puede devolver el tipo como octet-stream: se lo
    // forzamos para que el <img> no tenga que adivinar.
    return URL.createObjectURL(new Blob([bruto], { type: tipoPorNombre(nombre) }));
  }

  function urlDe(foto, tamano) {
    var mapa = tamano === 'min' ? miniaturas : completas;
    var clave = foto.id + ':' + tamano;

    if (mapa.has(foto.id)) return Promise.resolve(mapa.get(foto.id));
    if (pedidos.has(clave)) return pedidos.get(clave);

    var nombre = tamano === 'min' ? foto.miniatura : foto.archivo;
    var promesa = traerArchivo(nombre)
      .then(function (url) {
        mapa.set(foto.id, url);
        pedidos.delete(clave);
        return url;
      })
      .catch(function (error) {
        pedidos.delete(clave);
        throw error;
      });

    pedidos.set(clave, promesa);
    return promesa;
  }

  /* ============================================================
     Pintar la grilla
     ============================================================ */

  function pintar() {
    grilla.textContent = '';
    if (observador) observador.disconnect();

    fotos.forEach(function (foto, posicion) {
      var li = document.createElement('li');
      var boton = document.createElement('button');
      boton.type = 'button';
      boton.className = 'foto';
      boton.setAttribute('aria-label', 'Abrir la foto del ' + fechaLarga(foto.fecha));

      var imagen = document.createElement('img');
      imagen.alt = '';
      imagen.decoding = 'async';

      boton.appendChild(imagen);
      boton.addEventListener('click', function () {
        abrirLightbox(posicion, boton);
      });

      li.appendChild(boton);
      grilla.appendChild(li);

      vigilar(boton, foto);
    });

    if (fotos.length === 1) {
      cuenta.textContent = '1 foto';
    } else if (fotos.length > 1) {
      cuenta.textContent = fotos.length + ' fotos';
    } else {
      cuenta.textContent = '';
    }
  }

  function vigilar(boton, foto) {
    fotosPorNodo.set(boton, foto);

    if (!('IntersectionObserver' in window)) {
      cargarMini(boton, foto);
      return;
    }

    if (!observador) {
      observador = new IntersectionObserver(function (entradas) {
        entradas.forEach(function (entrada) {
          if (!entrada.isIntersecting) return;
          observador.unobserve(entrada.target);
          // La foto se busca en el mapa: el observador se crea una
          // sola vez y no puede cerrar sobre una foto en particular.
          var cual = fotosPorNodo.get(entrada.target);
          if (cual) cargarMini(entrada.target, cual);
        });
      }, { rootMargin: '400px 0px' });
    }

    observador.observe(boton);
  }

  function cargarMini(boton, foto) {
    var imagen = boton.querySelector('img');
    if (!imagen) return;

    urlDe(foto, 'min').then(function (url) {
      imagen.addEventListener('load', function () {
        imagen.setAttribute('data-cargada', 'si');
      }, { once: true });
      imagen.src = url;
      if (imagen.complete && imagen.naturalWidth) {
        imagen.setAttribute('data-cargada', 'si');
      }
    }).catch(function () {
      var aviso = document.createElement('span');
      aviso.className = 'foto__error';
      aviso.textContent = 'No se pudo cargar';
      boton.appendChild(aviso);
    });
  }

  /* ============================================================
     Avisos
     ============================================================ */

  function limpiarAviso() {
    estado.textContent = '';
    estado.hidden = true;
  }

  function mostrarAviso(titulo, texto, accion) {
    estado.textContent = '';

    var h = document.createElement('p');
    h.className = 'aviso__titulo';
    h.textContent = titulo;

    var p = document.createElement('p');
    p.className = 'aviso__texto';
    p.textContent = texto;

    estado.appendChild(h);
    estado.appendChild(p);

    if (accion) {
      var boton = document.createElement('button');
      boton.type = 'button';
      boton.className = 'boton';
      boton.textContent = accion.texto;
      boton.addEventListener('click', accion.alTocar);
      estado.appendChild(boton);
    }

    estado.hidden = false;
  }

  function avisoSinToken(detalle) {
    mostrarAviso(
      detalle || 'Falta la llave',
      'Las fotos están en un repo privado. Pegá el token una vez y esta ' +
      'pestaña las puede ver. El botón de arriba abre el panel.',
      { texto: 'Pegar el token', alTocar: function () { abrirPanel(panelToken); } }
    );
  }

  function avisoVacio() {
    mostrarAviso(
      'Todavía no hay fotos',
      'Subí la primera con el botón de arriba. Se puede desde el carrete ' +
      'o sacando la foto en el momento.',
      { texto: 'Subir una foto', alTocar: function () { abrirPanel(panelSubida); } }
    );
  }

  /* ============================================================
     Cargar
     ============================================================ */

  // Si el listado todavía no ve una foto recién subida (GitHub puede
  // tardar unos segundos en reflejarla), no se hace desaparecer: se
  // mantiene la que ya está en memoria.
  function unirFotos(delServidor, locales) {
    var ids = new Set(delServidor.map(function (foto) { return foto.id; }));

    var extra = locales.filter(function (foto) {
      return !ids.has(foto.id) && completas.has(foto.id);
    });

    return delServidor.concat(extra).sort(function (a, b) {
      if (a.id === b.id) return 0;
      return a.id < b.id ? 1 : -1;
    });
  }

  async function cargar() {
    if (!cfg) {
      mostrarAviso('Falta configurar', 'No está CONFIG.fotos en config.js.');
      return;
    }
    if (!token) {
      avisoSinToken();
      return;
    }

    limpiarAviso();
    cuenta.textContent = 'Cargando…';

    try {
      fotos = unirFotos(await listar(), fotos);
      pintar();
      if (!fotos.length) avisoVacio();
    } catch (error) {
      fotos = [];
      pintar();
      if (error.codigo === 401) {
        borrarToken();
        token = '';
        avisoSinToken(error.message);
      } else {
        mostrarAviso('No pude traer las fotos', error.message, {
          texto: 'Reintentar',
          alTocar: cargar
        });
      }
    }
  }

  /* ============================================================
     Lightbox
     ============================================================ */

  function abrirLightbox(posicion, origen) {
    var foto = fotos[posicion];
    if (!foto) return;

    indice = posicion;
    disparador = origen || null;

    pintarLightbox(foto);
    cargarCompleta(foto);

    if (typeof lightbox.showModal === 'function') {
      if (!lightbox.open) lightbox.showModal();
    } else {
      lightbox.setAttribute('open', '');
      lightbox.classList.add('abierto');
    }

    document.body.classList.add('sin-scroll');

    try {
      history.pushState({ foto: foto.id }, '', '#' + foto.id);
    } catch (error) {
      // Sin historial (file://) igual funciona, solo no cierra el "atrás".
    }
  }

  function pintarLightbox(foto) {
    lbImagen.removeAttribute('data-cargada');
    lbImagen.alt = 'Foto del ' + fechaLarga(foto.fecha);
    lbFecha.textContent = fechaLarga(foto.fecha);
    lbCuenta.textContent = (indice + 1) + ' de ' + fotos.length;
    lbPrev.disabled = indice === 0;
    lbNext.disabled = indice === fotos.length - 1;
  }

  function cargarCompleta(foto) {
    var turno = ++pedidoActual;

    urlDe(foto, 'full').then(function (url) {
      if (turno !== pedidoActual) return;
      lbImagen.addEventListener('load', function () {
        lbImagen.setAttribute('data-cargada', 'si');
      }, { once: true });
      lbImagen.src = url;
      if (lbImagen.complete && lbImagen.naturalWidth) {
        lbImagen.setAttribute('data-cargada', 'si');
      }
    }).catch(function (error) {
      if (turno !== pedidoActual) return;
      lbImagen.removeAttribute('src');
      lbImagen.removeAttribute('data-cargada');
      lbFecha.textContent = error.message;
    });

    // Se dejan pedidas las de al lado: cuando se pasa de foto ya
    // está, y si no hay red el error se ignora.
    [indice - 1, indice + 1].forEach(function (vecino) {
      var otra = fotos[vecino];
      if (otra) urlDe(otra, 'full').catch(function () {});
    });
  }

  function moverLightbox(paso) {
    var nuevo = indice + paso;
    if (nuevo < 0 || nuevo >= fotos.length) return;

    indice = nuevo;
    var foto = fotos[indice];
    pintarLightbox(foto);
    cargarCompleta(foto);

    try {
      history.replaceState({ foto: foto.id }, '', '#' + foto.id);
    } catch (error) {
      // Sin historial no pasa nada.
    }
  }

  function cerrarLightbox(desdeHistorial) {
    var estabaAbierto = lightbox.open || lightbox.hasAttribute('open');
    if (!estabaAbierto) return;

    if (typeof lightbox.close === 'function' && lightbox.open) {
      lightbox.close();
    } else {
      lightbox.removeAttribute('open');
      lightbox.classList.remove('abierto');
    }

    document.body.classList.remove('sin-scroll');
    indice = -1;
    pedidoActual++;

    if (!desdeHistorial && history.state && history.state.foto) {
      history.back();
    }

    if (disparador && disparador.isConnected) {
      disparador.focus({ preventScroll: true });
    }
    disparador = null;
  }

  /* ============================================================
     Paneles
     ============================================================ */

  function cerrarPaneles() {
    [panelToken, panelSubida].forEach(function (panel) {
      panel.setAttribute('data-abierto', 'no');
    });
    velo.setAttribute('data-abierto', 'no');
    abrirSubida.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('sin-scroll');
    panelAbierto = null;
  }

  function abrirPanel(panel) {
    if (!panel) return;
    cerrarPaneles();

    // La cola de la tanda anterior no se arrastra a la nueva.
    if (panel === panelSubida && !subiendo) {
      cola.textContent = '';
      progreso.hidden = true;
    }

    panelAbierto = panel;
    panel.setAttribute('data-abierto', 'si');
    velo.setAttribute('data-abierto', 'si');
    abrirSubida.setAttribute('aria-expanded', 'true');
    abrirSubida.setAttribute('aria-controls', panel.id);
    document.body.classList.add('sin-scroll');

    var foco = panel.querySelector('[data-foco]');
    if (foco) {
      window.setTimeout(function () {
        foco.focus({ preventScroll: true });
      }, 80);
    }
  }

  function focoAtrapado(evento) {
    if (!panelAbierto || evento.key !== 'Tab') return;

    var focos = Array.prototype.filter.call(
      panelAbierto.querySelectorAll('button, input, a[href]'),
      function (el) { return !el.disabled && el.tabIndex >= 0; }
    );
    if (!focos.length) return;

    var primero = focos[0];
    var ultimo = focos[focos.length - 1];

    if (evento.shiftKey && document.activeElement === primero) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && document.activeElement === ultimo) {
      evento.preventDefault();
      primero.focus();
    }
  }

  /* ============================================================
     Achicar y validar
     ============================================================ */

  function escalar(ancho, alto, maximo) {
    if (!ancho || !alto) throw new Error('La foto no tiene tamaño.');
    var factor = Math.min(1, maximo / Math.max(ancho, alto));
    return {
      ancho: Math.max(1, Math.round(ancho * factor)),
      alto: Math.max(1, Math.round(alto * factor))
    };
  }

  function cargarImagen(url) {
    return new Promise(function (resolver, rechazar) {
      var imagen = new Image();
      imagen.decoding = 'async';
      imagen.onload = function () { resolver(imagen); };
      imagen.onerror = function () {
        rechazar(new Error('No pude abrir esa foto. Si es HEIC, sacala de nuevo en JPG.'));
      };
      imagen.src = url;
    });
  }

  function aBlob(lienzo, calidad) {
    return new Promise(function (resolver, rechazar) {
      if (!lienzo.toBlob) {
        rechazar(new Error('Este navegador no puede achicar fotos.'));
        return;
      }

      lienzo.toBlob(function (blob) {
        // Safari viejo ignora el pedido de WebP y devuelve PNG:
        // se comprueba el tipo antes de confiar.
        if (blob && blob.type === 'image/webp') {
          resolver({ blob: blob, ext: 'webp' });
          return;
        }

        lienzo.toBlob(function (jpeg) {
          if (!jpeg) {
            rechazar(new Error('No pude achicar la foto.'));
            return;
          }
          resolver({ blob: jpeg, ext: 'jpg' });
        }, 'image/jpeg', calidad);
      }, 'image/webp', calidad);
    });
  }

  function dibujar(origen, medidas) {
    var lienzo = document.createElement('canvas');
    lienzo.width = medidas.ancho;
    lienzo.height = medidas.alto;

    var contexto = lienzo.getContext('2d');
    contexto.imageSmoothingEnabled = true;
    contexto.imageSmoothingQuality = 'high';
    // Fondo blanco: si el original tiene transparencia y toca
    // guardar en JPEG, no queda un rectángulo negro.
    contexto.fillStyle = '#ffffff';
    contexto.fillRect(0, 0, medidas.ancho, medidas.alto);
    contexto.drawImage(origen, 0, 0, medidas.ancho, medidas.alto);

    return lienzo;
  }

  async function validarArchivo(archivo) {
    var tope = (cfg.maxMB || 25) * 1024 * 1024;
    if (!archivo.size) throw new Error('El archivo está vacío.');
    if (archivo.size > tope) {
      throw new Error('Pesa más de ' + (cfg.maxMB || 25) + ' MB.');
    }

    // Se mira el contenido, no el nombre ni el type: los dos se
    // pueden mentir. SVG queda afuera a propósito.
    var cabecera = new Uint8Array(await archivo.slice(0, 16).arrayBuffer());
    var hex = Array.prototype.map.call(cabecera, function (byte) {
      return byte.toString(16).padStart(2, '0');
    }).join('');

    var esJpeg = hex.indexOf('ffd8ff') === 0;
    var esPng = hex.indexOf('89504e470d0a1a0a') === 0;
    var esWebp = hex.indexOf('52494646') === 0 && hex.slice(16, 24) === '57454250';
    // HEIC es ISO BMFF: bytes 4-7 = 'ftyp' y bytes 8-11 = la marca
    // mayor. Cada marca son cuatro bytes, o sea ocho caracteres hex.
    var esHeic = hex.slice(8, 16) === '66747970' &&
      ['68656963', '68656978', '68657663', '6865696d', '6d696631', '6d736631']
        .indexOf(hex.slice(16, 24)) !== -1;

    if (!esJpeg && !esPng && !esWebp && !esHeic) {
      throw new Error('Ese archivo no es una foto (JPG, PNG, WebP o HEIC).');
    }
  }

  async function preparar(archivo) {
    var url = URL.createObjectURL(archivo);

    try {
      var imagen = await cargarImagen(url);

      // El navegador ya aplica la orientación del EXIF al decodificar:
      // naturalWidth/naturalHeight vienen derechos.
      var grande = escalar(imagen.naturalWidth, imagen.naturalHeight, cfg.maxLado || 1600);
      var lienzo = dibujar(imagen, grande);
      var principal = await aBlob(lienzo, cfg.calidad || 0.82);

      var chica = escalar(grande.ancho, grande.alto, cfg.ladoMiniatura || 480);
      var lienzoMini = dibujar(lienzo, chica);
      var mini = await aBlob(lienzoMini, cfg.calidadMiniatura || 0.7);

      return {
        grande: principal,
        mini: mini,
        ancho: grande.ancho,
        alto: grande.alto
      };
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  /* ============================================================
     Subir
     ============================================================ */

  function nuevoId() {
    var ahora = new Date();
    var dos = function (numero) { return String(numero).padStart(2, '0'); };

    var fecha = String(ahora.getFullYear()) + dos(ahora.getMonth() + 1) + dos(ahora.getDate());
    var hora = dos(ahora.getHours()) + dos(ahora.getMinutes()) + dos(ahora.getSeconds());
    // crypto y no Math.random: dos fotos del mismo segundo tienen que
    // caer en nombres distintos. Math.random es predecible y, si se
    // repite, el PUT pisa una foto que ya estaba.
    var bytes = new Uint8Array(2);
    crypto.getRandomValues(bytes);
    var azar = Array.prototype.map.call(bytes, function (byte) {
      return byte.toString(16).padStart(2, '0');
    }).join('');

    return fecha + '-' + hora + '-' + azar;
  }

  function blobABase64(blob) {
    return new Promise(function (resolver, rechazar) {
      var lector = new FileReader();
      lector.onload = function () {
        var texto = String(lector.result || '');
        var coma = texto.indexOf(',');
        resolver(coma === -1 ? '' : texto.slice(coma + 1));
      };
      lector.onerror = function () { rechazar(new Error('No pude leer la foto.')); };
      lector.readAsDataURL(blob);
    });
  }

  // XHR y no fetch: fetch no informa el progreso de subida, y en
  // datos móviles eso se nota.
  async function subirArchivo(nombre, blob, mensaje, avance) {
    var contenido = await blobABase64(blob);
    var cuerpo = JSON.stringify({
      message: mensaje,
      content: contenido,
      branch: cfg.rama || 'main'
    });

    return new Promise(function (resolver, rechazar) {
      var pedido = new XMLHttpRequest();
      pedido.open('PUT', API + rutaContenido(nombre));
      pedido.setRequestHeader('Authorization', 'Bearer ' + token);
      pedido.setRequestHeader('Accept', 'application/vnd.github+json');
      pedido.setRequestHeader('X-GitHub-Api-Version', '2022-11-28');
      pedido.setRequestHeader('Content-Type', 'application/json');
      pedido.timeout = 120000;

      pedido.upload.onprogress = function (evento) {
        if (!evento.lengthComputable) return;
        avance(evento.loaded / evento.total);
      };

      pedido.onload = function () {
        if (pedido.status >= 200 && pedido.status < 300) {
          avance(1);
          resolver();
          return;
        }
        rechazar(errorApi(pedido.status, mensajeDe(pedido.status, 'archivo')));
      };

      pedido.onerror = function () {
        rechazar(errorApi(0, mensajeDe(0, 'archivo')));
      };

      pedido.ontimeout = function () {
        rechazar(errorApi(0, 'Tardó demasiado. Probá de nuevo.'));
      };

      pedido.send(cuerpo);
    });
  }

  async function subirFoto(preparada, avance) {
    var id = nuevoId();
    var nombre = id + '.' + preparada.grande.ext;
    var nombreMini = id + '-min.' + preparada.mini.ext;

    await subirArchivo(nombre, preparada.grande.blob, 'Foto ' + id, function (fraccion) {
      avance(fraccion * 0.9);
    });

    await subirArchivo(nombreMini, preparada.mini.blob, 'Miniatura ' + id, function (fraccion) {
      avance(0.9 + fraccion * 0.1);
    });

    return { id: id, archivo: nombre, miniatura: nombreMini };
  }

  // La foto recién subida se muestra ya, sin esperar a que GitHub
  // conteste el listado: los blobs están en memoria.
  function agregarLocal(entrada, preparada) {
    var repetida = fotos.some(function (foto) { return foto.id === entrada.id; });
    if (repetida) return;

    miniaturas.set(entrada.id, URL.createObjectURL(preparada.mini.blob));
    completas.set(entrada.id, URL.createObjectURL(preparada.grande.blob));

    fotos.unshift({
      id: entrada.id,
      archivo: entrada.archivo,
      miniatura: entrada.miniatura,
      fecha: fechaDeId(entrada.id)
    });

    pintar();
  }

  function crearItem(nombre) {
    var li = document.createElement('li');
    li.className = 'cola__item';

    var nombreEl = document.createElement('span');
    nombreEl.className = 'cola__nombre';
    nombreEl.textContent = nombre;

    var estadoEl = document.createElement('span');
    estadoEl.className = 'cola__estado';
    estadoEl.textContent = 'En cola';

    var barra = document.createElement('span');
    barra.className = 'cola__barra';
    var relleno = document.createElement('span');
    relleno.className = 'cola__relleno';
    barra.appendChild(relleno);

    li.appendChild(nombreEl);
    li.appendChild(estadoEl);
    li.appendChild(barra);
    cola.appendChild(li);

    return {
      progreso: function (fraccion) {
        var valor = Math.max(0, Math.min(1, fraccion));
        relleno.style.width = Math.round(valor * 100) + '%';
      },
      estado: function (texto) {
        estadoEl.textContent = texto;
      },
      listo: function () {
        estadoEl.textContent = 'Listo';
        relleno.style.width = '100%';
        li.setAttribute('data-estado', 'listo');
      },
      error: function (texto) {
        estadoEl.textContent = texto;
        li.setAttribute('data-estado', 'error');
      }
    };
  }

  async function procesarArchivos(lista) {
    if (subiendo) {
      progresoTexto.textContent = 'Esperá: todavía se están subiendo las anteriores.';
      return;
    }

    var archivos = Array.prototype.slice.call(lista || []);
    if (!archivos.length) return;

    var elegidas = archivos.length;
    if (elegidas > MAXIMO_POR_TANDA) {
      archivos = archivos.slice(0, MAXIMO_POR_TANDA);
    }

    subiendo = true;
    cola.textContent = '';
    progreso.hidden = false;
    progresoRelleno.style.width = '0%';

    if (elegidas > archivos.length) {
      var sobrante = crearItem('Quedaron ' + (elegidas - archivos.length) + ' afuera');
      sobrante.error('Entran hasta ' + MAXIMO_POR_TANDA + ' por vez: subilas en otra tanda.');
    }

    var total = archivos.length;
    var subidas = 0;
    var sinToken = false;

    for (var i = 0; i < archivos.length; i++) {
      var archivo = archivos[i];
      var item = crearItem(archivo.name || 'foto');
      progresoTexto.textContent = 'Foto ' + (i + 1) + ' de ' + total;

      try {
        item.estado('Revisando…');
        await validarArchivo(archivo);

        item.estado('Achicando…');
        var preparada = await preparar(archivo);

        item.estado('Subiendo…');
        var entrada = await subirFoto(preparada, function (fraccion) {
          item.progreso(fraccion);
          progresoRelleno.style.width =
            Math.round(((i + fraccion) / total) * 100) + '%';
        });

        agregarLocal(entrada, preparada);
        item.listo();
        subidas++;
      } catch (error) {
        item.error(error && error.message ? error.message : 'No se pudo.');
        if (error && error.codigo === 401) {
          sinToken = true;
          break;
        }
      }
    }

    subiendo = false;
    archivoInput.value = '';

    if (sinToken) {
      borrarToken();
      token = '';
      progresoTexto.textContent = 'El token dejó de servir. Pegá uno nuevo.';
      abrirPanel(panelToken);
      return;
    }

    progresoRelleno.style.width = '100%';
    progresoTexto.textContent = subidas === total
      ? (subidas === 1 ? 'Listo: 1 foto' : 'Listo: ' + subidas + ' fotos')
      : 'Subieron ' + subidas + ' de ' + total + '. Revisá los errores de arriba.';

    if (subidas) {
      await cargar();
      progresoTexto.textContent = subidas === 1
        ? 'Listo: 1 foto'
        : 'Listo: ' + subidas + ' fotos';
    }
  }

  /* ============================================================
     El regalo
     ============================================================ */

  function mostrarGaleria() {
    if (!galeriaCuerpo) return;

    // Con movimiento reducido no hay tapa que esperar.
    var quieto = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    window.setTimeout(function () {
      galeriaCuerpo.setAttribute('data-visible', 'si');
    }, quieto ? 0 : 620);
  }

  function abrirRegalo() {
    if (regalo.getAttribute('data-abierto') === 'si') {
      // Ya estaba abierto: se repite el mensaje, sin tocar las fotos.
      regaloMensaje.classList.remove('regalo__mensaje--otra');
      void regaloMensaje.offsetWidth; // fuerza el reflow para reanimar
      regaloMensaje.classList.add('regalo__mensaje--otra');
      return;
    }

    regalo.setAttribute('data-abierto', 'si');
    regaloAbrir.setAttribute('aria-expanded', 'true');
    // El texto se pone al abrir, no antes: así el lector de pantalla
    // lo anuncia como novedad (role="status") y no lo lee de entrada.
    regaloMensaje.textContent = 'Te amo, nunca lo dudes.';
    mostrarGaleria();
  }

  function iniciarRegalo() {
    if (!regalo || !regaloAbrir || !regaloMensaje) {
      // Si el HTML viejo no trae el regalo, la galería se muestra
      // igual: nunca se deja a las fotos detrás de algo que no existe.
      if (galeriaCuerpo) galeriaCuerpo.setAttribute('data-visible', 'si');
      return;
    }

    regaloAbrir.addEventListener('click', abrirRegalo);

    if (regalo.getAttribute('data-abierto') === 'si') {
      regaloAbrir.setAttribute('aria-expanded', 'true');
      regaloMensaje.textContent = 'Te amo, nunca lo dudes.';
      mostrarGaleria();
    }
  }

  /* ============================================================
     Arranque
     ============================================================ */

  function tomarNodos() {
    sitio = $('sitio');
    grilla = $('grilla');
    cuenta = $('cuenta');
    estado = $('estado');
    velo = $('velo');

    panelToken = $('panel-token');
    panelSubida = $('panel-subida');
    abrirSubida = $('abrir-subida');

    tokenCampo = $('token-campo');
    tokenEstado = $('token-estado');
    tokenGuardar = $('token-guardar');
    tokenBorrar = $('token-borrar');

    archivoInput = $('archivo');
    elegir = $('elegir');
    cola = $('cola');
    progreso = $('progreso');
    progresoTexto = $('progreso-texto');
    progresoRelleno = $('progreso-relleno');

    lightbox = $('lightbox');
    lbImagen = $('lightbox-img');
    lbFecha = $('lightbox-fecha');
    lbCuenta = $('lightbox-cuenta');
    lbPrev = $('lightbox-prev');
    lbNext = $('lightbox-next');
    lbCerrar = $('lightbox-cerrar');

    regalo = $('regalo');
    regaloAbrir = $('regalo-abrir');
    regaloMensaje = $('regalo-mensaje');
    galeriaCuerpo = $('galeria-contenido');
  }

  function conectar() {
    token = leerToken();

    /* --- botón de arriba --- */
    abrirSubida.addEventListener('click', function () {
      if (!token) {
        abrirPanel(panelToken);
        return;
      }
      abrirPanel(panelSubida);
    });

    /* --- velo y cierres --- */
    velo.addEventListener('click', cerrarPaneles);
    $('token-cerrar').addEventListener('click', cerrarPaneles);
    $('subida-cerrar').addEventListener('click', cerrarPaneles);
    $('subida-token').addEventListener('click', function () {
      tokenCampo.value = '';
      tokenEstado.textContent = '';
      abrirPanel(panelToken);
    });

    /* --- guardar token --- */
    tokenGuardar.addEventListener('click', function () {
      var valor = tokenCampo.value.trim();
      if (!pareceToken(valor)) {
        tokenEstado.textContent = 'Eso no parece un token de GitHub. Copialo entero, empieza con github_pat_.';
        return;
      }

      token = valor;
      var guardado = guardarToken(valor);
      tokenCampo.value = '';
      tokenEstado.textContent = guardado
        ? 'Guardado. Ya se pueden ver las fotos.'
        : 'Anda, pero este navegador no lo pudo guardar: si recargás, pegalo de nuevo.';

      cerrarPaneles();
      cargar();
    });

    tokenBorrar.addEventListener('click', function () {
      borrarToken();
      token = '';
      tokenCampo.value = '';
      tokenEstado.textContent = 'Token borrado.';
      fotos = [];
      pintar();
      avisoSinToken();
      cerrarPaneles();
    });

    /* --- subida --- */
    elegir.addEventListener('click', function () {
      archivoInput.click();
    });

    archivoInput.addEventListener('change', function () {
      procesarArchivos(archivoInput.files);
    });

    /* --- lightbox --- */
    lbCerrar.addEventListener('click', function () { cerrarLightbox(false); });
    lbPrev.addEventListener('click', function () { moverLightbox(-1); });
    lbNext.addEventListener('click', function () { moverLightbox(1); });

    lightbox.addEventListener('cancel', function (evento) {
      evento.preventDefault();
      cerrarLightbox(false);
    });

    var marco = lightbox.querySelector('.lightbox__marco');
    if (marco) {
      marco.addEventListener('click', function (evento) {
        // Solo cierra si el toque cayó en el marco vacío, no en la
        // foto ni en los botones.
        if (evento.target === marco) cerrarLightbox(false);
      });
    }

    window.addEventListener('popstate', function () {
      if (lightbox.open || lightbox.hasAttribute('open')) {
        cerrarLightbox(true);
      } else if (panelAbierto) {
        cerrarPaneles();
      }
    });

    /* --- teclado --- */
    document.addEventListener('keydown', function (evento) {
      if (panelAbierto) {
        if (evento.key === 'Escape') {
          evento.preventDefault();
          cerrarPaneles();
          abrirSubida.focus({ preventScroll: true });
          return;
        }
        focoAtrapado(evento);
      }

      if (!lightbox.open) return;

      if (evento.key === 'ArrowLeft') {
        evento.preventDefault();
        moverLightbox(-1);
      } else if (evento.key === 'ArrowRight') {
        evento.preventDefault();
        moverLightbox(1);
      }
    });

    /* --- deslizar en el celular --- */
    var toque = null;

    lbImagen.addEventListener('touchstart', function (evento) {
      if (evento.touches.length !== 1) return;
      toque = {
        x: evento.touches[0].clientX,
        y: evento.touches[0].clientY
      };
    }, { passive: true });

    lbImagen.addEventListener('touchend', function (evento) {
      if (!toque) return;
      var fin = evento.changedTouches[0];
      var dx = fin.clientX - toque.x;
      var dy = fin.clientY - toque.y;
      toque = null;

      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        moverLightbox(dx < 0 ? 1 : -1);
      }
    }, { passive: true });

    iniciarRegalo();
    cargar();
  }

  function iniciar() {
    tomarNodos();

    if (!sitio || !grilla || !lightbox) return;

    // La galería espera a que se pase el portón: si no, pediría el
    // token antes de que la persona vea nada.
    if (document.documentElement.getAttribute('data-listo') === 'si') {
      conectar();
    } else {
      document.addEventListener('regalo:listo', conectar, { once: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})();
