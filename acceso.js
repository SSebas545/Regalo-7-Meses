/* ============================================================
   Acceso.

   IMPORTANTE: esto es disuasión, no seguridad. El contenido
   está en el HTML público: cualquiera que abra "ver código
   fuente" lo lee sin escribir nada. Sirve para que no entre
   alguien que pasaba por ahí.

   Lo que sí protege de verdad son las fotos: están en un repo
   privado y sin token no se pueden ni listar.
   ============================================================ */

(function () {
  'use strict';

  var CLAVE_SESION = 'regalo.desbloqueado';

  function bytesDeBase64(b64) {
    var binario = atob(b64);
    var bytes = new Uint8Array(binario.length);
    for (var i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
    return bytes;
  }

  // Comparación de tiempo constante: no corta en el primer byte distinto.
  function iguales(a, b) {
    if (a.length !== b.length) return false;
    var diferencia = 0;
    for (var i = 0; i < a.length; i++) {
      diferencia |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return diferencia === 0;
  }

  function derivar(clave, saltB64, iteraciones) {
    var codificador = new TextEncoder();
    return crypto.subtle
      .importKey('raw', codificador.encode(clave), 'PBKDF2', false, ['deriveBits'])
      .then(function (llave) {
        return crypto.subtle.deriveBits(
          {
            name: 'PBKDF2',
            salt: bytesDeBase64(saltB64),
            iterations: iteraciones,
            hash: 'SHA-256'
          },
          llave,
          256
        );
      })
      .then(function (bits) {
        var bytes = new Uint8Array(bits);
        var texto = '';
        for (var i = 0; i < bytes.length; i++) {
          texto += String.fromCharCode(bytes[i]);
        }
        return btoa(texto);
      });
  }

  function iniciar() {
    var acceso = document.getElementById('acceso');
    var sitio = document.getElementById('sitio');
    if (!acceso || !sitio) return;

    function mostrarSitio() {
      acceso.hidden = true;
      sitio.hidden = false;
      document.documentElement.setAttribute('data-listo', 'si');
      // La galería escucha este evento para no pedir el token antes
      // de que se haya pasado el portón.
      document.dispatchEvent(new CustomEvent('regalo:listo'));

      // Si la URL trae un ancla, el navegador ya la intentó resolver
      // cuando el contenido estaba oculto y medía 0: no se movió. Se
      // repite ahora, en el cuadro siguiente, ya con layout.
      if (location.hash) window.requestAnimationFrame(irAlAncla);
    }

    function irAlAncla() {
      var crudo = location.hash;
      if (crudo.length < 2) return;

      // getElementById y no querySelector: el hash puede traer caracteres
      // escapados (%C3%B3) o ids que en CSS necesitan escape (#1carta).
      var id;
      try {
        id = decodeURIComponent(crudo.slice(1));
      } catch (error) {
        id = crudo.slice(1);
      }

      var destino = document.getElementById(id);
      if (!destino) return;

      // Sin animación: el salto puede ser de miles de píxeles y, con
      // scroll suave, se siente como que se traba a mitad de camino.
      var raiz = document.documentElement;
      var antes = raiz.style.scrollBehavior;
      raiz.style.scrollBehavior = 'auto';
      destino.scrollIntoView({ block: 'start' });
      raiz.style.scrollBehavior = antes;
    }

    var cfg = typeof CONFIG !== 'undefined' ? CONFIG.acceso : null;

    // Sin gate configurado, o sin WebCrypto (pasa en contextos no
    // seguros), se entra directo: el gate es disuasión y no vale
    // la pena romper la página por no poder calcular un hash.
    if (!cfg || !cfg.activo || !window.crypto || !crypto.subtle) {
      mostrarSitio();
      return;
    }

    try {
      // Se guarda el hash, no un "1": si se cambia la clave, la
      // sesión vieja deja de valer sola.
      if (sessionStorage.getItem(CLAVE_SESION) === cfg.hash) {
        mostrarSitio();
        return;
      }
    } catch (error) {
      // Storage bloqueado: se pide la clave igual.
    }

    var form = document.getElementById('acceso-form');
    var campo = document.getElementById('acceso-clave');
    var boton = document.getElementById('acceso-entrar');
    var error = document.getElementById('acceso-error');

    acceso.hidden = false;
    if (campo) campo.focus();

    if (!form || !campo || !boton) {
      mostrarSitio();
      return;
    }

    form.addEventListener('submit', function (evento) {
      evento.preventDefault();
      var clave = campo.value.trim();
      if (!clave) return;

      boton.disabled = true;
      if (error) error.textContent = '';

      derivar(clave, cfg.salt, cfg.iteraciones)
        .then(function (hash) {
          if (!iguales(hash, cfg.hash)) {
            if (error) error.textContent = 'No es esa. Probá de nuevo.';
            campo.value = '';
            campo.focus();
            return;
          }
          try {
            sessionStorage.setItem(CLAVE_SESION, cfg.hash);
          } catch (e) {
            // Sin storage igual entra: solo se va a pedir de nuevo.
          }
          mostrarSitio();
        })
        .catch(function () {
          if (error) error.textContent = 'No se pudo verificar. Probá de nuevo.';
        })
        .then(function () {
          boton.disabled = false;
        });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})();
