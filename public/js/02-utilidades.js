/* ==========================================================================
   Dopta · Razas e ilustraciones, iconos, utilidades de interfaz y validaciones (secciones 5-8)
   Los archivos de public/js/ se cargan como scripts clásicos, en orden (ver index.html), y comparten el mismo ámbito global.
   ========================================================================== */
'use strict';

  /* ======================= 5. Razas e ilustraciones ======================= */
  const RAZAS = Array.isArray(window.DOPTA_RAZAS) ? window.DOPTA_RAZAS : [];
  const RAZA = Object.fromEntries(RAZAS.map((r) => [r.id, r]));
  const SVG_MESTIZO = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true" focusable="false"><path d="M15 34C5 12 20 3 35 19L28 40Z" fill="#8B6A58"/><path d="M85 34C95 12 80 3 65 19L72 40Z" fill="#311501"/><rect x="16" y="17" width="68" height="72" rx="26" fill="#EAD7C4"/><path d="M42 17H50V89H42C28 89 16 77 16 63V43C16 29 28 17 42 17Z" fill="#C59870"/><circle cx="68" cy="31" r="8" fill="#8B6A58"/><circle cx="36" cy="47" r="5" fill="#311501"/><circle cx="64" cy="47" r="5" fill="#311501"/><rect x="33" y="58" width="34" height="23" rx="11.5" fill="#F6EEE6"/><rect x="43" y="60" width="14" height="9" rx="4.5" fill="#311501"/><path d="M50 69V75" stroke="#311501" stroke-width="2.5" stroke-linecap="round"/></svg>';
  const SVG_HUELLA = '<svg class="tarjeta__foto-vacia" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="10" r="2"/><circle cx="9" cy="5" r="2"/><circle cx="15" cy="5" r="2"/><circle cx="19" cy="10" r="2"/><path d="M12 11c-3 0-6 4-6 7 0 1.5 1.2 2.5 2.6 2.5 1.3 0 2.2-.7 3.4-.7s2.1.7 3.4.7c1.4 0 2.6-1 2.6-2.5 0-3-3-7-6-7z"/></svg>';

  /* Un mestizo se muestra con el dibujo de la raza a la que más se parece */
  const dibujo = (a) => {
    if (a.raza !== 'mestizo' && RAZA[a.raza]) return seguro(RAZA[a.raza].svg);
    if (a.raza_aprox && RAZA[a.raza_aprox]) return seguro(RAZA[a.raza_aprox].svg);
    return seguro(a.raza === 'mestizo' ? SVG_MESTIZO : SVG_HUELLA);
  };
  const nombreRaza = (a) => {
    if (a.raza === 'mestizo') return a.raza_aprox && RAZA[a.raza_aprox] ? `Mestizo · parecido a ${RAZA[a.raza_aprox].nombre}` : 'Mestizo';
    return RAZA[a.raza] ? RAZA[a.raza].nombre : 'Raza no indicada';
  };
  const razaCorta = (a) => (a.raza === 'mestizo' ? 'Mestizo' : (RAZA[a.raza] ? RAZA[a.raza].nombre : 'Raza'));
  const imagenAnimal = (a) => dibujo(a); // sin fotos: siempre la ilustración de la raza

  /* ======================= 6. Iconos ======================= */
  const ICONO = {
    ojo: seguro('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>'),
    ojoCerrado: seguro('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.9 17.9A10.4 10.4 0 0 1 12 19c-6.4 0-10-7-10-7a18.4 18.4 0 0 1 5.1-5.9M9.9 5.2A9.6 9.6 0 0 1 12 5c6.4 0 10 7 10 7a18.6 18.6 0 0 1-2.2 3.2M14.1 14.2a3 3 0 0 1-4.2-4.2"/><path d="M2 2l20 20"/></svg>'),
    ubicacion: seguro('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="7"/></svg>'),
    casa: seguro('<svg class="boton-pastilla__icono" viewBox="0 0 97 126" fill="currentColor" aria-hidden="true"><path d="M45.46 1.23828C47.0357 -0.412501 49.6713 -0.412501 51.2471 1.23828L95.5928 47.6953C98.0221 50.2408 96.218 54.457 92.6992 54.457H88.3535V123.207C88.3534 124.312 87.458 125.207 86.3535 125.207H70.3535C69.249 125.207 68.3536 124.311 68.3535 123.207V90.207C68.3535 89.1025 67.4581 88.207 66.3535 88.207H31.3535C30.249 88.2071 29.3535 89.1025 29.3535 90.207V123.207C29.3534 124.312 28.458 125.207 27.3535 125.207H9.35352C8.80132 125.207 8.35362 124.759 8.35352 124.207V54.457H4.00781C0.489148 54.4569 -1.31494 50.2408 1.11426 47.6953L45.46 1.23828ZM33.3535 61.207C30.5921 61.2071 28.3535 63.2218 28.3535 65.707C28.3535 66.1746 28.433 66.6259 28.5801 67.0498C29.0247 68.3317 29.0248 70.0824 28.5801 71.3643C28.433 71.7883 28.3535 72.2394 28.3535 72.707C28.3536 75.1922 30.5922 77.207 33.3535 77.207C35.2463 77.207 36.8934 76.2601 37.7422 74.8643C38.2671 74.0011 39.0816 73.207 40.0918 73.207H58.8838C59.15 73.2072 59.3535 73.4408 59.3535 73.707C59.3536 76.1922 61.5922 78.207 64.3535 78.207C67.1149 78.207 69.3534 76.1922 69.3535 73.707C69.3535 73.2395 69.274 72.7881 69.127 72.3643C68.6821 71.0821 68.682 69.3309 69.127 68.0488C69.274 67.6251 69.3535 67.1745 69.3535 66.707C69.3535 64.2217 67.1149 62.207 64.3535 62.207C62.4607 62.207 60.8136 63.1539 59.9648 64.5498C59.44 65.4128 58.6253 66.207 57.6152 66.207H38.8232C38.5571 66.2068 38.3536 65.9732 38.3535 65.707C38.3535 63.2217 36.1149 61.207 33.3535 61.207Z"/></svg>'),
    campana: seguro('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>'),
    atras: seguro('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>'),
    quitar: seguro('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>'),
    lupa: seguro('<svg class="buscador__icono" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>'),
    subir: seguro('<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 16V4"/><path d="M7 9l5-5 5 5"/><path d="M4 20h16"/></svg>'),
  };

  /* ======================= 7. Utilidades de interfaz ======================= */
  const $ = (sel, raiz = document) => raiz.querySelector(sel);
  const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];
  let app;

  function aviso(texto, tipo = 'exito') {
    const caja = $('#avisos');
    if (!caja) return;
    const p = document.createElement('p');
    p.className = `mensaje mensaje--${tipo}`;
    p.textContent = texto;
    caja.appendChild(p);
    setTimeout(() => p.remove(), 4800);
  }

  const ocupado = (boton, si = true) => {
    if (!boton) return;
    boton.disabled = si;
    boton.setAttribute('aria-busy', String(si));
  };

  const errorEn = (raiz, texto = '') => {
    const caja = $('[data-error]', raiz);
    if (caja) caja.textContent = texto;
    if (texto && caja) caja.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };

  const datosForm = (form) => {
    const o = {};
    new FormData(form).forEach((v, k) => { if (typeof v === 'string') o[k] = v.trim(); });
    return o;
  };

  /* Contadores de caracteres para campos con maxlength */
  function montarContadores(raiz) {
    $$('textarea[maxlength]', raiz).forEach((t) => {
      const c = document.createElement('span');
      c.className = 'contador';
      const max = Number(t.maxLength);
      const pintar = () => { c.textContent = `${[...t.value].length} / ${max}`; c.classList.toggle('contador--limite', [...t.value].length >= max); };
      t.after(c);
      t.addEventListener('input', pintar);
      pintar();
    });
  }

  /* Diálogo modal reutilizable. "accion" recibe el formulario; si lanza error, se muestra dentro. */
  function dialogo({ titulo, texto = '', cuerpo = '', confirmar = 'Confirmar', cancelar = 'Cancelar', peligro = false, accion, montar, ancho = false }) {
    return new Promise((resolver) => {
      const d = document.createElement('dialog');
      d.className = ancho ? 'dialogo dialogo--ancho' : 'dialogo';
      d.setAttribute('aria-labelledby', 'dialogo-titulo');
      d.innerHTML = String(html`
        <form class="dialogo__contenido" novalidate>
          <h2 class="dialogo__titulo" id="dialogo-titulo">${titulo}</h2>
          ${texto ? html`<p class="dialogo__texto">${texto}</p>` : ''}
          ${cuerpo}
          <p class="mensaje mensaje--error" data-error role="alert"></p>
          <div class="acciones acciones--fin">
            ${cancelar ? html`<button class="boton-contorno boton-contorno--chico" type="button" data-cancelar>${cancelar}</button>` : ''}
            <button class="boton-contorno boton-contorno--chico ${peligro ? 'boton-contorno--peligro' : 'boton-contorno--relleno'}" type="submit">${confirmar}</button>
          </div>
        </form>`);
      document.body.appendChild(d);
      const form = $('form', d);
      let listo = false;
      const cerrar = (valor) => { if (listo) return; listo = true; d.close(); d.remove(); resolver(valor); };
      d.addEventListener('cancel', (e) => { e.preventDefault(); cerrar(false); });
      d.addEventListener('click', (e) => { if (e.target === d) cerrar(false); });
      const btnCancelar = $('[data-cancelar]', d);
      if (btnCancelar) btnCancelar.addEventListener('click', () => cerrar(false));
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!accion) return cerrar(true);
        const boton = $('button[type="submit"]', form);
        ocupado(boton);
        errorEn(form, '');
        try {
          const r = await accion(form);
          cerrar(r === undefined ? true : r);
        } catch (err) {
          errorEn(form, err instanceof ErrorApi ? textoError(err) : err.message);
          ocupado(boton, false);
        }
      });
      montarContadores(d);
      montarOjitos(d);
      if (montar) montar(d);
      d.showModal();
      const primero = $('input, select, textarea', d);
      if (primero) primero.focus();
    });
  }

  /* ======================= 8. Validaciones (mismos mensajes que el servidor) ======================= */
  const { Filtro, Reglas } = window; // public/filtro.js y public/reglas.js: mismas reglas que el servidor
  const largo = (v) => [...String(v || '')].length;
  const M = {
    vacios: 'Complete todos los campos obligatorios.',
    correo: 'Ingrese un correo electrónico válido.',
    contrasena: 'La contraseña debe tener de 8 a 64 caracteres, con al menos una letra y un número.',
    nombre: 'El nombre debe tener entre 2 y 100 caracteres y solo letras y espacios.',
    refugio: 'El nombre del refugio debe tener de 3 a 120 caracteres.',
    institucion: 'El nombre de la institución debe tener de 3 a 120 caracteres.',
    calle: 'La calle debe tener de 3 a 100 caracteres, con letras (puede incluir números y . , - #).',
    numExt: 'El número exterior debe ser un número (ej. 1200, 15-B o 12A) o S/N si no tiene.',
    numInt: 'El número interior puede tener hasta 10 letras o números (ej. 3, B, Depto 4).',
    colonia: 'La colonia debe tener de 3 a 80 caracteres, con letras.',
    cp: 'El código postal debe tener exactamente 5 dígitos.',
    cpCdmx: 'El código postal no pertenece a la Ciudad de México (debe estar entre 01000 y 16999).',
    telefono: 'El teléfono debe tener exactamente 10 dígitos numéricos.',
    telefonoReal: 'Ingrese un teléfono real de México: con una clave LADA válida y que no sea una serie como 5500000000 o 1234567890.',
    letras: 'El nombre debe incluir letras, no solo números o símbolos.',
    horario: 'El horario de apertura debe ser menor que el horario de cierre, en formato HH:MM de 24 horas.',
    aviso: 'Debe aceptar el aviso de privacidad para crear una cuenta.',
    coinciden: 'Las contraseñas no coinciden.',
    alcaldia: 'Seleccione una alcaldía de la lista.',
  };
  const V = {
    correo: (v) => !Filtro.problemaCorreo(v),
    contrasena: (v) => typeof v === 'string' && v.length >= 8 && v.length <= 64 && /[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(v) && /\d/.test(v),
    nombre: (v) => largo(v) >= 2 && largo(v) <= 100 && /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ ]+$/.test(v),
    entre: (v, a, b) => largo(v) >= a && largo(v) <= b,
    telefono: (v) => /^\d{10}$/.test(v),
    // Mismas reglas de coherencia que el servidor (server/util.js)
    // Revisión rápida; el servidor confirma además que la clave LADA exista (libphonenumber)
    telefonoReal: (t) => /^[2-9]\d{9}$/.test(t) && !/(\d)\1{5,}/.test(t)
      && !'01234567890123456789'.includes(t.slice(2)) && !'98765432109876543210'.includes(t.slice(2)),
    letras: (t, n = 2) => (String(t).match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g) || []).length >= n,
  };
  const fallo = (m) => { throw new Error(m); };
  /* Correo: formato, dominios mal escritos (.cum, gmial.com) y correos temporales */
  const revisarCorreo = (c) => { const p = Filtro.problemaCorreo(c); if (p) fallo(p); };
  /* Texto libre (mensajes, motivos): mismas reglas que V.texto() del servidor. Devuelve el texto limpio o lanza el error */
  const revisarTexto = (t, opciones) => {
    const r = Filtro.revisarTexto(t, opciones);
    if (r.error) fallo(r.error);
    return r.texto;
  };

  /* Reglas de nombres: idénticas a problemaNombre() en server/util.js */
  const sinAcentos = (t) => String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const GENERICOS = new Set(['perro', 'perra', 'perrito', 'perrita', 'can', 'mascota', 'animal', 'sin nombre', 'ninguno', 'ninguna',
    'nombre', 'test', 'prueba', 'asdf', 'qwerty', 'xxx', 'na', 'no', 'si', 'desconocido', 'desconocida', 'callejero', 'callejera']);
  function problemaNombre(texto, tipo) {
    const n = String(texto || '').trim().replace(/\s+/g, ' ');
    const plano = sinAcentos(n);
    if (tipo === 'refugio' && !/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9 .,&()\-]+$/.test(n)) return 'El nombre solo puede tener letras, números, espacios y . , & ( ) -';
    if (/(.)\1\1/.test(plano.replace(/\s/g, ''))) return 'El nombre no puede repetir la misma letra 3 o más veces seguidas.';
    if (!/[aeiouy]/.test(plano)) return 'El nombre debe incluir al menos una vocal.';
    if (Filtro.groseria(n)) return 'El nombre contiene palabras no permitidas.';
    if (Filtro.sinSentido(n)) return 'El nombre parece no tener sentido. Escríbelo con letras reales.';
    if (tipo === 'perro') {
      if (GENERICOS.has(plano) || RAZAS.some((x) => sinAcentos(x.nombre) === plano)) return 'Escriba el nombre del perro, no un término genérico o el nombre de su raza.';
      if (plano.split(' ').length > 3) return 'El nombre del perro puede tener máximo 3 palabras.';
    }
    if (tipo === 'persona' && plano.split(' ').length > 6) return 'El nombre puede tener máximo 6 palabras.';
    if (tipo === 'persona' && plano.split(' ').every((x) => x.length === 1)) return 'Escriba el nombre completo, no solo iniciales.';
    return null;
  }
  const revisarNombre = (n, tipo) => { const p = problemaNombre(n, tipo); if (p) fallo(p); };
