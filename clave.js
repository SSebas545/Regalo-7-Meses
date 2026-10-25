/* ============================================================
   Generador del hash de la clave.

   Hace lo mismo que acceso.js para verificar, pero al revés: toma
   la palabra nueva, inventa un salt y devuelve el par para pegar
   en config.js. Nada sale del navegador.
   ============================================================ */

(function () {
  'use strict';

  var ITERACIONES = 150000;
  var LARGO_MINIMO = 4;

  var form = document.getElementById('clave-form');
  var campoNueva = document.getElementById('clave-nueva');
  var campoRepetir = document.getElementById('clave-repetir');
  var boton = document.getElementById('clave-generar');
  var error = document.getElementById('clave-error');
  var resultado = document.getElementById('clave-resultado');
  var salida = document.getElementById('clave-salida');
  var copiar = document.getElementById('clave-copiar');

  if (!form || !campoNueva || !campoRepetir || !boton) return;

  function base64DeBytes(bytes) {
    var texto = '';
    for (var i = 0; i < bytes.length; i++) texto += String.fromCharCode(bytes[i]);
    return btoa(texto);
  }

  function derivar(clave, salt, iteraciones) {
    var codificador = new TextEncoder();
    return crypto.subtle
      .importKey('raw', codificador.encode(clave), 'PBKDF2', false, ['deriveBits'])
      .then(function (llave) {
        return crypto.subtle.deriveBits({
          name: 'PBKDF2',
          salt: salt,
          iterations: iteraciones,
          hash: 'SHA-256'
        }, llave, 256);
      })
      .then(function (bits) {
        return base64DeBytes(new Uint8Array(bits));
      });
  }

  function avisar(texto) {
    if (error) error.textContent = texto;
  }

  form.addEventListener('submit', function (evento) {
    evento.preventDefault();
    avisar('');

    if (!window.crypto || !crypto.subtle) {
      avisar('Este navegador no deja calcular el hash acá. Probá por https o en localhost.');
      return;
    }

    var nueva = campoNueva.value;
    var repetida = campoRepetir.value;

    if (nueva.length < LARGO_MINIMO) {
      avisar('Poné al menos ' + LARGO_MINIMO + ' caracteres.');
      campoNueva.focus();
      return;
    }
    if (nueva !== repetida) {
      avisar('Las dos no coinciden.');
      campoRepetir.value = '';
      campoRepetir.focus();
      return;
    }

    boton.disabled = true;
    boton.textContent = 'Calculando…';

    var salt = crypto.getRandomValues(new Uint8Array(16));

    derivar(nueva, salt, ITERACIONES)
      .then(function (hash) {
        var saltB64 = base64DeBytes(salt);
        salida.textContent =
          'acceso: {\n' +
          '  activo: true,\n' +
          "  salt: '" + saltB64 + "',\n" +
          "  hash: '" + hash + "',\n" +
          '  iteraciones: ' + ITERACIONES + '\n' +
          '}';

        resultado.hidden = false;
        campoNueva.value = '';
        campoRepetir.value = '';
        resultado.scrollIntoView({ behavior: 'smooth', block: 'start' });
      })
      .catch(function () {
        avisar('No se pudo calcular el hash. Probá de nuevo.');
      })
      .then(function () {
        boton.disabled = false;
        boton.textContent = 'Generar';
      });
  });

  if (copiar) {
    copiar.addEventListener('click', function () {
      var texto = salida.textContent || '';

      function listo() {
        copiar.textContent = 'Copiado';
        window.setTimeout(function () { copiar.textContent = 'Copiar'; }, 1600);
      }

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(texto).then(listo, function () {
          avisar('No se pudo copiar. Seleccionalo a mano.');
        });
        return;
      }

      // Sin clipboard API: se selecciona el texto para copiar a mano.
      var rango = document.createRange();
      rango.selectNodeContents(salida);
      var seleccion = window.getSelection();
      if (seleccion) {
        seleccion.removeAllRanges();
        seleccion.addRange(rango);
      }
      avisar('Seleccionado: copialo con Ctrl+C.');
    });
  }
})();
