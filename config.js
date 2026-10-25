/* ============================================================
   Configuración del sitio.
   Es el único archivo que hay que tocar a mano.
   ============================================================ */

const CONFIG = {
  /* ----------------------------------------------------------
     Acceso.
     OJO: esto es DISUASIÓN, no seguridad. El contenido está en
     el HTML público y cualquiera puede leerlo con "ver código
     fuente". Sirve para que no entre alguien que pasaba por
     ahí, no para proteger nada. Lo que sí protege son las
     fotos: viven en un repo privado (ver galeria.js).
     ---------------------------------------------------------- */
  acceso: {
    activo: true,
    // Para cambiar la clave: abrí clave.html, escribí la nueva y
    // pegá acá el salt y el hash que te da.
    salt: '3R8BYkNT8vvLLlnpidPJDg==',
    hash: 'Ex6+EyFpy3DcKnVjTiIJ+Zmpmo+uR2FcPLcUVc1uVR8=',
    iteraciones: 150000
  },

  /* Fechas de la relación. Se usan para los contadores. */
  pareja: {
    nombre: 'Made',
    conocidos: '2025-02-12T00:00:00-03:00',
    novios: '2026-02-03T00:00:00-03:00'
  },

  /* ----------------------------------------------------------
     Galería de fotos.
     Las fotos NO están en este repo (sería público). Viven en
     un repo privado aparte, y se leen con un token que se pega
     una vez por sesión. Ver README.md, sección "Galería".
     ---------------------------------------------------------- */
  fotos: {
    usuario: 'SSebas545',
    repo: 'Regalo-7-Meses-fotos',
    rama: 'main',
    carpeta: 'fotos',
    // Compresión en el celular antes de subir.
    maxLado: 1600,
    calidad: 0.82,
    ladoMiniatura: 480,
    calidadMiniatura: 0.7,
    // Tope de entrada: si la foto original pesa más, se rechaza.
    maxMB: 25
  }
};
