/* ============================================================
   Narrativa: contadores, sobre, menú, tarjetas que se dan vuelta.
   Sin dependencias. Si este archivo no corre, el contenido se ve
   igual (las clases de animación se agregan desde acá).
   ============================================================ */

(function () {
  'use strict';

  var MS_DIA = 86400000;

  /* ---------- contadores ---------- */

  // Días de calendario, no de 24 h: si no, a las 21 hs del día
  // anterior ya te muestra un día de más.
  function diasDeCalendario(iso) {
    var inicio = new Date(iso);
    if (isNaN(inicio.getTime())) return null;
    var a = Date.UTC(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
    var hoy = new Date();
    var b = Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    return Math.max(0, Math.round((b - a) / MS_DIA));
  }

  function pintarContadores() {
    var pares = [
      ['dias-conocidos', CONFIG.pareja.conocidos],
      ['dias-novios', CONFIG.pareja.novios]
    ];

    pares.forEach(function (par) {
      var el = document.getElementById(par[0]);
      if (!el) return;
      var dias = diasDeCalendario(par[1]);
      el.textContent = dias === null ? '—' : dias.toLocaleString('es-AR');
    });
  }

  /* ---------- sobre ---------- */

  function iniciarSobre() {
    var boton = document.getElementById('sobre-boton');
    var seccion = document.getElementById('sobre');
    var abierto = document.getElementById('sobre-abierto');
    if (!boton || !seccion || !abierto) return;

    boton.addEventListener('click', function () {
      if (seccion.getAttribute('data-abierto') === 'si') return;

      seccion.setAttribute('data-abierto', 'si');
      boton.setAttribute('aria-expanded', 'true');
      boton.setAttribute('tabindex', '-1');
      pintarContadores();

      // El foco se va al contenido que apareció, no se queda en el
      // botón que ahora está invisible. Hay que esperar a que el
      // navegador aplique el cambio de visibilidad: medido, si se
      // llama en el mismo cuadro el foco termina en <body>.
      var reduce = window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      window.setTimeout(function () {
        var titulo = abierto.querySelector('h1');
        if (!titulo) return;
        titulo.setAttribute('tabindex', '-1');
        titulo.focus({ preventScroll: true });
      }, reduce ? 0 : 320);
    });
  }

  /* ---------- menú ---------- */

  function iniciarMenu() {
    var abrir = document.getElementById('menu-abrir');
    var cerrar = document.getElementById('menu-cerrar');
    var menu = document.getElementById('menu');
    if (!abrir || !menu) return;

    function poner(estado) {
      menu.setAttribute('data-abierto', estado ? 'si' : 'no');
      abrir.setAttribute('aria-expanded', estado ? 'true' : 'false');
      document.body.classList.toggle('menu-abierto', estado);
      if (estado) {
        var primero = menu.querySelector('a');
        if (primero) primero.focus({ preventScroll: true });
      } else {
        abrir.focus({ preventScroll: true });
      }
    }

    abrir.addEventListener('click', function () { poner(true); });
    if (cerrar) cerrar.addEventListener('click', function () { poner(false); });

    menu.addEventListener('click', function (evento) {
      if (evento.target.closest('a')) poner(false);
    });

    document.addEventListener('keydown', function (evento) {
      if (evento.key === 'Escape' && menu.getAttribute('data-abierto') === 'si') {
        poner(false);
      }
    });
  }

  /* ---------- tarjetas que se dan vuelta ---------- */

  function iniciarVolteables() {
    var tarjetas = document.querySelectorAll('.volteable');
    Array.prototype.forEach.call(tarjetas, function (tarjeta) {
      tarjeta.addEventListener('click', function () {
        var abierta = tarjeta.getAttribute('aria-expanded') === 'true';
        tarjeta.setAttribute('aria-expanded', abierta ? 'false' : 'true');
      });
    });
  }

  /* ---------- aparición al scrollear ---------- */

  function iniciarRevelado() {
    var objetivos = document.querySelectorAll(
      '.puerta, .volteable, .cancion, .cupon, .carta, .promesa'
    );
    if (!objetivos.length) return;

    // Sin IntersectionObserver, todo queda visible: no se esconde nada.
    if (!('IntersectionObserver' in window)) return;

    var observador = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (entrada) {
        if (!entrada.isIntersecting) return;
        entrada.target.setAttribute('data-visible', 'si');
        observador.unobserve(entrada.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });

    Array.prototype.forEach.call(objetivos, function (el) {
      el.classList.add('revelar');
      observador.observe(el);
    });
  }

  /* ---------- arranque ---------- */

  function iniciar() {
    pintarContadores();
    iniciarSobre();
    iniciarMenu();
    iniciarVolteables();
    iniciarRevelado();

    // Se recalcula al volver del segundo plano y cada minuto:
    // en iOS el setInterval se congela con la pestaña dormida.
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) pintarContadores();
    });
    setInterval(pintarContadores, 60000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})();
