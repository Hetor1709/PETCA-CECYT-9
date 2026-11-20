/* ==========================================================================
   Dopta · Aplicación web de una sola página
   Secciones: tema · seguridad · API · estado · razas · componentes · vistas · router · efectos
   ========================================================================== */
(() => {
  'use strict';

  /* ======================= 1. Tema (antes de pintar) ======================= */
  const CLAVE_TEMA = 'dopta-tema';
  const raizDoc = document.documentElement;
  const leerLS = (k) => { try { return window.localStorage.getItem(k); } catch { return null; } };
  const guardarLS = (k, v) => { try { window.localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } };
  const aplicarTema = (t) => (t === 'oscuro' ? raizDoc.setAttribute('data-theme', 'oscuro') : raizDoc.removeAttribute('data-theme'));
  aplicarTema(leerLS(CLAVE_TEMA));

  /* Si alguien incrusta Dopta en un iframe ajeno, se sale de él (además de frame-ancestors del servidor) */
  if (window.top !== window.self) {
    try { window.top.location = window.self.location; } catch { document.documentElement.hidden = true; }
  }

  /* ======================= 2. Seguridad del lado del cliente ======================= */
  /* Todo texto que viene del usuario o del servidor se convierte a entidades HTML antes de mostrarse */
  const ENTIDADES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;', '=': '&#61;', '/': '&#47;' };
  const esc = (v) => String(v ?? '').replace(/[&<>"'`=/]/g, (c) => ENTIDADES[c]);

  class Seguro { constructor(s) { this.s = s; } toString() { return this.s; } }
  const seguro = (s) => new Seguro(String(s));
  const fmt = (v) => {
    if (v instanceof Seguro) return v.s;
    if (Array.isArray(v)) return v.map(fmt).join('');
    if (v === null || v === undefined || v === false) return '';
    return esc(v);
  };
  /* Plantilla que escapa automáticamente cada valor interpolado */
  const html = (partes, ...valores) => seguro(partes.reduce((acc, p, i) => acc + p + (i < valores.length ? fmt(valores[i]) : ''), ''));
  const si = (cond, attr) => seguro(cond ? ` ${attr}` : '');

  /* Mientras se escribe, se eliminan los símbolos < > y caracteres invisibles de control */
  const RE_SIMBOLOS_PRUEBA = /[<>\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮]/;
  const RE_SIMBOLOS = /[<>\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮]/g;
  const SIN_LIMPIEZA = ['password', 'file', 'date', 'time', 'checkbox', 'radio', 'number', 'range', 'color'];
  document.addEventListener('input', (e) => {
    const el = e.target;
    if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) || SIN_LIMPIEZA.includes(el.type)) return;
    if (!RE_SIMBOLOS_PRUEBA.test(el.value)) return;
    const pos = el.selectionStart ?? el.value.length;
    const antes = el.value.length;
    el.value = el.value.replace(RE_SIMBOLOS, '');
    const nueva = Math.max(0, pos - (antes - el.value.length));
    try { el.setSelectionRange(nueva, nueva); } catch { /* tipos sin selección */ }
  }, true);

  /* Solo se aceptan destinos internos conocidos para redirigir (evita redirecciones abiertas) */
  const rutaSegura = (destino) => {
    if (typeof destino !== 'string' || destino.length > 200) return null;
    if (!/^#\/[A-Za-z0-9\-/]*(\?[A-Za-z0-9=&_\-]*)?$/.test(destino) || destino.includes('//')) return null;
    const ruta = destino.slice(1).split('?')[0].replace(/\/+$/, '') || '/';
    return RUTAS.some((r) => r.re.test(ruta)) ? destino : null;
  };

  const idValido = (v) => { const n = Number(v); return Number.isInteger(n) && n > 0 && n < 4294967295 ? n : null; };

  /* Aviso en consola contra el "self-XSS" (pegar código que alguien te pasó) */
  console.log('%c¡Alto!', 'color:#c9553a;font-size:28px;font-weight:bold');
  console.log('%cNo pegues aquí código que alguien te haya enviado: podría robar tu cuenta de Dopta.', 'font-size:14px');

  /* ======================= 3. Cliente de la API ======================= */
  /* Debe coincidir con "version" de package.json: si no, el navegador tiene una copia vieja en caché */
  const VERSION_APP = '2.0.0';
  let versionAvisada = false;
  class ErrorApi extends Error {
    constructor(status, mensaje, datos) { super(mensaje || ''); this.status = status; this.datos = datos || {}; }
  }
  /* Mensaje para el usuario: los fallos de red o del servidor muestran el texto del caso de uso */
  const textoError = (e, porDefecto = 'No se pudo completar la operación. Intente de nuevo.') => {
    if (e && e.datos && e.datos.codigo === 'BD' && e.message) return e.message; // causa exacta (base pausada, .env, etc.)
    return !e || e.status === 0 || e.status >= 500 || !e.message ? porDefecto : e.message;
  };

  let ultimaServidor = Date.now();
  async function api(ruta, { metodo = 'GET', datos, form, auto = false } = {}) {
    const ctrl = new AbortController();
    const reloj = setTimeout(() => ctrl.abort(), 20000);
    const headers = { 'X-Dopta': '1', Accept: 'application/json' };
    if (auto) headers['X-Dopta-Auto'] = '1';
    let body;
    if (form) body = form;
    else if (datos !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(datos); }
    let res;
    try {
      res = await fetch(`/api${ruta}`, { method: metodo, headers, body, credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal: ctrl.signal });
    } catch {
      throw new ErrorApi(0, '');
    } finally {
      clearTimeout(reloj);
    }
    if (!auto) ultimaServidor = Date.now();
    const vServidor = res.headers.get('X-Dopta-Version');
    if (vServidor && vServidor !== VERSION_APP && !versionAvisada) {
      versionAvisada = true;
      setTimeout(() => aviso(`Hay una versión distinta de Dopta en el servidor (${vServidor}). Recarga la página con Ctrl + F5.`, 'error'), 0);
    }
    let j = null;
    try { j = await res.json(); } catch { /* respuesta sin JSON */ }
    if (!res.ok) {
      if (res.status === 401 && j && j.codigo === 'SESION' && estado.usuario) sesionTerminada(j.error);
      throw new ErrorApi(res.status, j && j.error, j);
    }
    return j;
  }

  /* ======================= 4. Estado de la aplicación ======================= */
  const estado = { usuario: null, panel: '#/', noLeidas: 0, catalogos: null, flash: null, rechazado: null, perfil: null };

  async function catalogos(refrescar = false) {
    if (!estado.catalogos || refrescar) estado.catalogos = await api('/catalogos');
    return estado.catalogos;
  }
  const activos = (lista) => lista.filter((x) => x.activo);

  /* Fecha de hoy y operaciones en hora de la Ciudad de México */
  const hoyCDMX = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date());
  const sumarDias = (f, n) => { const d = new Date(`${f}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const diaSemana = (f) => (new Date(`${f}T12:00:00Z`).getUTCDay() + 6) % 7;
  const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  /* Nacimiento más antiguo posible según la edad ("3 meses", "2 años"), con margen de una unidad */
  const nacimientoMinimo = (edadNombre, base) => {
    const m = String(edadNombre || '').match(/(\d+)\s*(mes|año|ano)/i);
    if (!m) return null;
    const n = Number(m[1]) + 1;
    const d = new Date(`${base}T12:00:00Z`);
    if (/^mes/i.test(m[2])) d.setUTCMonth(d.getUTCMonth() - n); else d.setUTCFullYear(d.getUTCFullYear() - n);
    return d.toISOString().slice(0, 10);
  };
  const fechaBonita = (f) => {
    if (!f) return '';
    const d = new Date(`${String(f).slice(0, 10)}T12:00:00Z`);
    return `${DIAS[(d.getUTCDay() + 6) % 7]} ${new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(d)}`;
  };

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

  /* ======================= 9. Componentes ======================= */
  const botonRegresar = (destino, etiqueta = 'Regresar') => html`
    <a class="boton-contorno boton-contorno--icono" href="${destino}" aria-label="${etiqueta}" data-regresar>${ICONO.atras}</a>`;

  const insignia = (estadoTxt, texto) => html`<span class="insignia insignia--${estadoTxt}">${texto || estadoTxt}</span>`;
  const ETQ = {
    pendiente: 'Pendiente', aprobada: 'Aprobada', rechazada: 'Rechazada', disponible: 'Disponible', adoptado: 'Adoptado',
    abierto: 'Abierto', resuelto: 'Resuelto', descartado: 'Descartado', activa: 'Activa', baja: 'Dada de baja', eliminada: 'Eliminada',
    adoptante: 'Adoptante', refugio: 'Refugio', admin: 'Administrador', funcionario: 'Funcionario', cancelada: 'Cancelada', adoptada: 'Adoptada',
  };

  /* Tarjeta del catálogo con la ilustración de la raza */
  const tarjetaAnimal = (a, { enlace = true, pie = '' } = {}) => {
    const interior = html`
      <p class="tarjeta__raza">${razaCorta(a)}</p>
      <div class="tarjeta__foto">${imagenAnimal(a)}</div>
      <p class="tarjeta__datos">${a.nombre}<span>${[a.edad, a.tamano].filter(Boolean).join(' · ')}</span></p>
      ${pie}`;
    return enlace
      ? html`<li><a class="tarjeta" href="#/animal/${a.id}" aria-label="${a.nombre}, ${nombreRaza(a)}">${interior}</a></li>`
      : html`<li><article class="tarjeta ${a.estado === 'adoptado' ? 'tarjeta--adoptado' : ''}">${interior}</article></li>`;
  };

  const opciones = (lista, seleccionado, vacio) => html`
    ${vacio ? html`<option value="">${vacio}</option>` : ''}
    ${lista.filter((x) => x.activo || x.id === Number(seleccionado)).map((x) => html`<option value="${x.id}"${si(x.id === Number(seleccionado), 'selected')}>${x.nombre}${x.activo ? '' : ' (inactivo)'}</option>`)}`;

  /* Selector visual de raza. Si se elige "Mestizo" aparece un segundo selector para la raza más parecida. */
  const tileRaza = (nombre, id, etiqueta, svg, marcado, clase = '') => html`
    <label class="raza ${clase}" data-nombre="${etiqueta.toLowerCase()}">
      <input type="radio" name="${nombre}" value="${id}"${si(marcado, 'checked')}>
      <span class="raza__cuerpo">${seguro(svg)}<span class="raza__nombre">${etiqueta}</span></span>
    </label>`;

  const selectorRazas = (raza = '', aprox = '') => html`
    <fieldset class="campo campo--ancho razas" data-razas>
      <legend class="campo__etiqueta">Raza del perro</legend>
      <div class="razas__cabecera">
        <span class="campo__ayuda">Toca la ilustración que corresponda. Si es una cruza, elige “Mestizo”.</span>
        <input class="campo__entrada razas__buscar" type="search" placeholder="Buscar raza" aria-label="Buscar raza" data-filtro="principal">
      </div>
      <div class="razas__grid" role="radiogroup" aria-label="Razas" data-grid="principal">
        ${tileRaza('raza', 'mestizo', 'Mestizo', SVG_MESTIZO, raza === 'mestizo', 'raza--mestizo')}
        ${RAZAS.map((r) => tileRaza('raza', r.id, r.nombre, r.svg, raza === r.id))}
      </div>
      <div class="razas__aprox" data-aprox${si(raza !== 'mestizo', 'hidden')}>
        <div class="razas__cabecera">
          <div>
            <p class="razas__aprox-titulo">¿A qué raza se parece más?</p>
            <p class="campo__ayuda">Se usará su ilustración en el catálogo y ayudará a quien busque esa raza.</p>
          </div>
          <input class="campo__entrada razas__buscar" type="search" placeholder="Buscar raza" aria-label="Buscar raza parecida" data-filtro="aprox">
        </div>
        <div class="razas__grid" role="radiogroup" aria-label="Raza más parecida" data-grid="aprox">
          ${tileRaza('raza_aprox', '', 'No estoy seguro', SVG_MESTIZO, raza === 'mestizo' && !aprox, 'raza--mestizo')}
          ${RAZAS.map((r) => tileRaza('raza_aprox', r.id, r.nombre, r.svg, aprox === r.id))}
        </div>
      </div>
      <div class="razas__vista" data-vista aria-live="polite"></div>
    </fieldset>`;

  function montarRazas(raiz) {
    const caja = $('[data-razas]', raiz);
    if (!caja) return;
    const aproxCaja = $('[data-aprox]', caja);
    const vista = $('[data-vista]', caja);
    const norm = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    $$('[data-filtro]', caja).forEach((inp) => inp.addEventListener('input', () => {
      const t = norm(inp.value.trim());
      $$('.raza', $(`[data-grid="${inp.dataset.filtro}"]`, caja)).forEach((l) => { l.hidden = !!t && !norm(l.dataset.nombre).includes(t); });
    }));
    const pintar = () => {
      const r = ($('input[name="raza"]:checked', caja) || {}).value || '';
      const ap = ($('input[name="raza_aprox"]:checked', caja) || {}).value || '';
      aproxCaja.hidden = r !== 'mestizo';
      if (r === 'mestizo' && !$('input[name="raza_aprox"]:checked', caja)) $('input[name="raza_aprox"][value=""]', caja).checked = true;
      if (!r) { vista.innerHTML = String(html`<p>Elige la raza o “Mestizo” si es una cruza.</p>`); return; }
      const a = { raza: r, raza_aprox: r === 'mestizo' ? ap : '' };
      vista.innerHTML = String(html`${dibujo(a)}<p>Así se verá en el catálogo<strong>${nombreRaza(a)}</strong></p>`);
    };
    caja.addEventListener('change', (e) => {
      if (e.target.name === 'raza' && e.target.value === 'mestizo') aproxCaja.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      pintar();
    });
    pintar();
    // Lleva a la vista la raza ya elegida (al editar)
    const marcada = $('input[name="raza"]:checked', caja);
    if (marcada) marcada.closest('.raza').scrollIntoView({ block: 'nearest' });
  }

  /* Editor del horario de atención por día (RF-04) */
  const editorHorario = (horario = []) => html`
    <div class="horario" data-horario>
      ${DIAS.map((d, i) => {
    const h = horario.find((x) => Number(x.dia) === i) || { cerrado: i >= 5 ? 1 : 0, abre: '09:00', cierra: '17:00' };
    const cerrado = !!Number(h.cerrado);
    return html`
        <div class="horario__dia ${cerrado ? 'esta-cerrado' : ''}" data-dia="${i}">
          <span class="horario__nombre">${d}</span>
          <label class="horario__cerrado"><input type="checkbox" data-cerrado${si(cerrado, 'checked')}> Cerrado</label>
          <input class="campo__entrada" type="time" aria-label="${d}: apertura" data-abre value="${h.abre || '09:00'}">
          <input class="campo__entrada" type="time" aria-label="${d}: cierre" data-cierra value="${h.cierra || '17:00'}">
        </div>`;
  })}
    </div>`;

  function montarHorario(raiz) {
    $$('[data-horario] [data-cerrado]', raiz).forEach((c) => c.addEventListener('change', () => {
      c.closest('.horario__dia').classList.toggle('esta-cerrado', c.checked);
    }));
  }
  function leerHorario(raiz) {
    const aMin = (h) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3));
    const lista = $$('[data-horario] .horario__dia', raiz).map((f) => {
      if ($('[data-cerrado]', f).checked) return { cerrado: true };
      const abre = $('[data-abre]', f).value;
      const cierra = $('[data-cierra]', f).value;
      const dia = DIAS[Number(f.dataset.dia)];
      if (!/^\d{2}:\d{2}$/.test(abre) || !/^\d{2}:\d{2}$/.test(cierra) || abre >= cierra) fallo(`${M.horario} (${dia})`);
      if (aMin(cierra) - aMin(abre) < 60) fallo(`Cada día abierto debe tener al menos 1 hora de atención (${dia}).`);
      return { abre, cierra };
    });
    if (lista.every((d) => d.cerrado)) fallo('Indique al menos un día abierto para poder agendar citas.');
    return lista;
  }

  /* Tarjeta de refugio para búsquedas y listado */
  const tarjetaRefugio = (r) => html`
    <li><a class="tarjeta-refugio" href="#/refugios/${r.id}">
      <img src="img/logo-dopta.svg" alt="" width="48" height="43">
      <span class="tarjeta-refugio__texto"><strong>${r.nombre}</strong><span>${r.alcaldia || 'Ciudad de México'}${r.km != null ? html` · <b class="distancia">${r.aprox ? '≈ ' : ''}${r.km < 1 ? `${Math.round(r.km * 1000)} m` : `${r.km.toFixed(1)} km`}</b>` : ''}</span></span>
      <span class="insignia insignia--disponible">${r.disponibles} ${r.disponibles === 1 ? 'perro' : 'perros'}</span>
    </a></li>`;

  /* Ubicación actual del navegador (pide permiso al usuario). Solo funciona en https o localhost. */
  function ubicacionActual() {
    return new Promise((ok, mal) => {
      if (!window.isSecureContext || !navigator.geolocation) return mal(new Error('Tu navegador no permite usar la ubicación aquí (se necesita https o localhost).'));
      navigator.geolocation.getCurrentPosition(
        (p) => ok({ lat: p.coords.latitude, lng: p.coords.longitude }),
        (e) => mal(new Error(e.code === 1 ? 'No diste permiso para usar tu ubicación. Actívalo en el candado de la barra de direcciones.' : 'No se pudo obtener tu ubicación. Intenta de nuevo.')),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
      );
    });
  }
  /* Distancia en línea recta (km) entre dos puntos */
  const distanciaKm = (a, b) => {
    const rad = (x) => (x * Math.PI) / 180;
    const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
    return 12742 * Math.asin(Math.sqrt(h));
  };

  /* ¿Está abierto ahora? (hora de la CDMX) */
  const abiertoAhora = (horario) => {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date()).map((x) => [x.type, x.value]));
    const ahora = `${p.hour}:${p.minute}`;
    const h = horario.find((x) => Number(x.dia) === diaSemana(hoyCDMX()));
    return !!h && !Number(h.cerrado) && ahora >= h.abre && ahora < h.cierra;
  };

  /* Opciones cerradas de salud y temperamento (definidas en el servidor, llegan con /api/catalogos) */
  const CAMPOS_SALUD = ['salud_general', 'tratamiento'];
  const CAMPOS_TEMP = ['temp_general', 'temp_perros', 'temp_desconocidos', 'temp_comida'];
  const etiquetaOpcion = (cat, campo, valor) => (cat && cat.animal && cat.animal[campo] && cat.animal[campo].opciones[valor]) || '';
  const grupoCerrado = (cat, campo, valor) => {
    const def = cat.animal[campo];
    return html`
      <fieldset class="pregunta pregunta--compacta" data-cerrado="${campo}">
        <legend class="pregunta__titulo">${def.titulo}</legend>
        <div class="pregunta__opciones">
          ${Object.entries(def.opciones).map(([k, t]) => html`<label class="opcion"><input type="radio" name="${campo}" value="${k}"${si(k === valor, 'checked')}><span class="opcion__texto">${t}</span></label>`)}
        </div>
      </fieldset>`;
  };
  /* Lista de salud y temperamento para mostrar en fichas (con respaldo al texto libre de versiones anteriores) */
  const listaRasgos = (cat, a, campos, textoAnterior) => {
    const filas = campos.filter((c) => a[c]).map((c) => html`<li><span>${cat.animal[c].titulo}</span><strong>${etiquetaOpcion(cat, c, a[c])}</strong></li>`);
    if (filas.length) return html`<ul class="lista-simple">${filas}</ul>`;
    return textoAnterior ? html`<p>${textoAnterior}</p>` : html`<p>Sin información registrada.</p>`;
  };

  /* Paginación simple */
  const paginacion = (pagina, total, porPagina) => {
    const paginas = Math.max(1, Math.ceil(total / porPagina));
    if (paginas <= 1) return '';
    return html`<nav class="paginacion" aria-label="Paginación">
      <button class="boton-contorno boton-contorno--chico" type="button" data-pagina="${pagina - 1}"${si(pagina <= 1, 'disabled')}>Anterior</button>
      <span>Página ${pagina} de ${paginas}</span>
      <button class="boton-contorno boton-contorno--chico" type="button" data-pagina="${pagina + 1}"${si(pagina >= paginas, 'disabled')}>Siguiente</button>
    </nav>`;
  };
  const conQuery = (base, params) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') q.set(k, v); });
    const s = q.toString();
    return s ? `${base}?${s}` : base;
  };

  /* Periodo de estadísticas (RF-35 / RF-36) */
  const selectorPeriodo = () => html`
    <form class="periodo" data-periodo novalidate>
      <div class="pestanas" role="group" aria-label="Periodo">
        <button class="pestana" type="button" data-p="7" aria-pressed="true">Últimos 7 días</button>
        <button class="pestana" type="button" data-p="30" aria-pressed="false">Últimos 30 días</button>
        <button class="pestana" type="button" data-p="personalizado" aria-pressed="false">Personalizado</button>
      </div>
      <div class="periodo__fechas" data-fechas hidden>
        <label class="campo"><span class="campo__etiqueta">Inicio</span><input class="campo__entrada" type="date" name="inicio" max="${hoyCDMX()}"></label>
        <label class="campo"><span class="campo__etiqueta">Fin</span><input class="campo__entrada" type="date" name="fin" max="${hoyCDMX()}" value="${hoyCDMX()}"></label>
      </div>
      <button class="boton-contorno" type="submit">Consultar</button>
      <p class="mensaje mensaje--error" data-error role="alert"></p>
    </form>`;

  function montarPeriodo(raiz, alConsultar) {
    const f = $('[data-periodo]', raiz);
    let p = '7';
    $$('[data-p]', f).forEach((b) => b.addEventListener('click', () => {
      p = b.dataset.p;
      $$('[data-p]', f).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      $('[data-fechas]', f).hidden = p !== 'personalizado';
      if (p !== 'personalizado') f.requestSubmit(); // los periodos rápidos se consultan al instante
    }));
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorEn(f, '');
      const boton = $('button[type="submit"]', f);
      const params = p === 'personalizado' ? { inicio: f.inicio.value, fin: f.fin.value } : { periodo: p };
      if (p === 'personalizado') {
        if (!params.inicio || !params.fin) return errorEn(f, 'Ingrese la fecha de inicio y la fecha de fin en formato AAAA-MM-DD.');
        if (params.inicio < '2000-01-01') return errorEn(f, 'La fecha de inicio no puede ser anterior al año 2000.');
        if (params.inicio > params.fin) return errorEn(f, 'La fecha de inicio debe ser anterior o igual a la fecha de fin.');
        if (params.fin > hoyCDMX()) return errorEn(f, 'La fecha de fin debe ser igual o anterior a hoy.');
        const dias = Math.round((new Date(params.fin) - new Date(params.inicio)) / 864e5) + 1;
        if (dias > 365) return errorEn(f, 'El periodo máximo es de 365 días.');
      }
      ocupado(boton);
      try { await alConsultar(params); } catch (err) { errorEn(f, textoError(err)); } finally { ocupado(boton, false); }
    });    f.requestSubmit(); // primera consulta automática (últimos 7 días)
  }

  const AVISO_PRIVACIDAD = html`
    <div class="aviso-texto">
      <p><strong>Aviso de privacidad v1.0</strong> · Dopta, plataforma gratuita de apoyo a la adopción de perros en la Ciudad de México.</p>
      <h3>Datos que recabamos</h3>
      <p>Adoptantes: nombre completo y correo electrónico. Refugios: nombre del refugio e institución, correo, dirección, teléfono, alcaldía y horario de atención.</p>
      <h3>Para qué los usamos</h3>
      <p>Crear tu cuenta, enviar y gestionar solicitudes de adopción, agendar citas, enviarte notificaciones dentro de la plataforma, moderar el contenido y generar estadísticas sin datos personales.</p>
      <h3>Quién puede verlos</h3>
      <p>Tu correo como adoptante solo lo ven el refugio al que enviaste una solicitud y el equipo de administración. Los datos de contacto del refugio se muestran públicamente en sus fichas.</p>
      <h3>Seguridad</h3>
      <p>Las contraseñas se guardan cifradas con una función de hash y sal; el tráfico viaja cifrado por HTTPS.</p>
      <h3>Tus derechos</h3>
      <p>Puedes corregir tus datos desde tu cuenta o darla de baja; al hacerlo, tus datos personales se eliminan después de 30 días.</p>
    </div>`;

  /* ======================= 10. Vistas públicas ======================= */

  /* ---------- Catálogo (RNF-01) ---------- */
  const FILTROS = ['edad', 'alcaldia', 'energia', 'orden', 'esterilizado', 'vacunado', 'perros', 'desconocidos', 'sin_tratamiento'];
  async function vistaCatalogo(ctx) {
    const cat = await catalogos().catch(() => ({ tamano: [] }));
    const q = (ctx.query.get('q') || '').slice(0, 60);
    const tamano = idValido(ctx.query.get('tamano'));
    const raza = RAZA[ctx.query.get('raza')] ? ctx.query.get('raza') : '';
    const titulo = estado.usuario && estado.usuario.tipo === 'adoptante' ? `Hola, ${estado.usuario.nombre.split(' ')[0]}` : 'Catálogo de mascotas';
    return {
      html: html`
      <section class="principal">
        <h1 class="titulo-pagina">${titulo}</h1>
        <form class="buscador" role="search" data-buscador>
          <label class="sr-only" for="buscar">Buscar mascota</label>
          <input class="buscador__campo" id="buscar" name="q" type="search" placeholder="Buscar por raza o nombre" value="${q || (raza ? RAZA[raza].nombre : '')}" maxlength="60" autocomplete="off">
          ${ICONO.lupa}
        </form>
        <div class="filtros" role="group" aria-label="Filtrar por tamaño">
          <button class="pestana" type="button" data-tamano="" aria-pressed="${!tamano}">Todos</button>
          ${activos(cat.tamano).map((t) => html`<button class="pestana" type="button" data-tamano="${t.id}" aria-pressed="${t.id === tamano}">${t.nombre}</button>`)}
          <a class="pestana pestana--refugios" href="#/refugios">Ver refugios</a>
        </div>
        <details class="filtros-avanzados" data-filtros${si(FILTROS.some((k) => ctx.query.get(k)), 'open')}>
          <summary><span>Más filtros</span> <span class="filtros-avanzados__cuenta" data-cuenta-filtros></span></summary>
          <form class="filtros-avanzados__rejilla" data-form-filtros>
            <label class="campo"><span class="campo__etiqueta">Edad</span>
              <select class="campo__entrada" name="edad">${seguro(['', 'cachorro', 'joven', 'adulto', 'senior'].map((v) => `<option value="${v}"${ctx.query.get('edad') === v ? ' selected' : ''}>${{ '': 'Cualquiera', cachorro: 'Cachorro (menos de 1 año)', joven: 'Joven (1 a 2 años)', adulto: 'Adulto (3 a 7 años)', senior: 'Mayor (8 años o más)' }[v]}</option>`).join(''))}</select></label>
            <label class="campo"><span class="campo__etiqueta">Alcaldía</span>
              <select class="campo__entrada" name="alcaldia">${opciones(activos(cat.alcaldia || []), idValido(ctx.query.get('alcaldia')), 'Todas')}</select></label>
            <label class="campo"><span class="campo__etiqueta">Energía</span>
              <select class="campo__entrada" name="energia">${seguro(['', 'tranquilo', 'jugueton', 'activo', 'nervioso'].map((v) => `<option value="${v}"${ctx.query.get('energia') === v ? ' selected' : ''}>${{ '': 'Cualquiera', tranquilo: 'Tranquilo', jugueton: 'Juguetón', activo: 'Muy activo', nervioso: 'Nervioso' }[v]}</option>`).join(''))}</select></label>
            <label class="campo"><span class="campo__etiqueta">Ordenar</span>
              <select class="campo__entrada" name="orden">${seguro([['recientes', 'Más recientes'], ['esperando', 'Más tiempo esperando hogar'], ['nombre', 'Nombre (A-Z)']].map(([v, t]) => `<option value="${v}"${ctx.query.get('orden') === v ? ' selected' : ''}>${t}</option>`).join(''))}</select></label>
            <fieldset class="filtros-avanzados__casillas"><legend class="campo__etiqueta">Que sea…</legend>
              ${[['esterilizado', 'Esterilizado'], ['vacunado', 'Con vacunas'], ['perros', 'Sociable con perros'], ['desconocidos', 'Amigable con desconocidos'], ['sin_tratamiento', 'Sin tratamiento especial']]
    .map(([k, t]) => html`<label class="casilla-filtro"><input type="checkbox" name="${k}" value="1"${si(ctx.query.get(k) === '1', 'checked')}><span>${t}</span></label>`)}
            </fieldset>
            <div class="acciones"><button class="boton-contorno boton-contorno--chico" type="reset" data-limpiar-filtros>Quitar filtros</button></div>
          </form>
        </details>
        <section class="refugios-busqueda" data-refugios hidden>
          <h2 class="subtitulo-seccion">Refugios</h2>
          <ul class="refugios" data-lista-refugios></ul>
          <h2 class="subtitulo-seccion">Perros</h2>
        </section>
        <ul class="catalogo" data-lista aria-busy="true"></ul>
        <p class="buscador__vacio" data-vacio hidden>No encontramos mascotas con esa búsqueda. Prueba con otra raza o nombre.</p>
        <div class="mas" data-mas hidden><button class="boton-contorno" type="button">Ver más mascotas</button></div>
        <section class="test" aria-labelledby="titulo-test">
          <div><h2 class="test__texto" id="titulo-test">¿Quieres saber cuál sería tu mascota indicada?<span class="test__subtexto">¡Haz este test!</span></h2></div>
          <a class="boton-contorno" href="#/cuestionario">Haz el test</a>
        </section>
        <div class="croquetas" aria-hidden="true">${[1, 2, 3, 4, 5].map(() => html`<img class="croqueta-pieza" src="img/hueso.svg" alt="">`)}</div>
      </section>`,
      montar(raiz) {
        const lista = $('[data-lista]', raiz);
        const vacio = $('[data-vacio]', raiz);
        const mas = $('[data-mas]', raiz);
        const campo = $('#buscar', raiz);
        let filtroTamano = tamano || '';
        let pagina = 1;
        let pedido = 0;
        let hayRefugios = false;
        const cargar = async (agregar = false) => {
          const n = ++pedido;
          lista.setAttribute('aria-busy', 'true');
          const texto = campo.value.trim();
          try {
            const extra = leerFiltros();
            const [r, refs] = await Promise.all([
              api(conQuery('/animales', { q: texto, tamano: filtroTamano, pagina, ...extra })),
              texto.length >= 2 && !agregar ? api(conQuery('/refugios', { q: texto })).catch(() => []) : Promise.resolve(null),
            ]);
            if (n !== pedido) return;
            if (refs !== null) {
              const caja = $('[data-refugios]', raiz);
              caja.hidden = !refs.length;
              $('[data-lista-refugios]', raiz).innerHTML = String(html`${refs.slice(0, 6).map(tarjetaRefugio)}`);
              hayRefugios = refs.length > 0;
            } else if (!agregar) { $('[data-refugios]', raiz).hidden = true; hayRefugios = false; }
            const tarjetas = r.animales.map((a) => tarjetaAnimal(a));
            if (agregar) lista.insertAdjacentHTML('beforeend', String(html`${tarjetas}`));
            else lista.innerHTML = String(html`${tarjetas}`);
            $$('.tarjeta', lista).forEach((t, i) => t.style.setProperty('--i', i));
            vacio.hidden = r.total > 0;
            vacio.textContent = hayRefugios ? 'Ningún perro coincide con esa búsqueda, pero encontramos refugios.' : 'No encontramos mascotas con esa búsqueda. Prueba con otra raza o nombre.';
            mas.hidden = r.pagina * r.porPagina >= r.total;
          } catch (e) {
            if (n !== pedido) return;
            lista.innerHTML = '';
            vacio.hidden = false;
            vacio.textContent = textoError(e, 'No se pudo cargar el catálogo. Intente de nuevo.');
          } finally {
            lista.setAttribute('aria-busy', 'false');
          }
        };
        /* Filtros avanzados: se aplican al cambiar y quedan en la URL para compartir la búsqueda */
        const ff = $('[data-form-filtros]', raiz);
        const leerFiltros = () => {
          const o = {};
          FILTROS.forEach((k) => { const el = ff.elements[k]; const v = el.type === 'checkbox' ? (el.checked ? '1' : '') : el.value; if (v && !(k === 'orden' && v === 'recientes')) o[k] = v; });
          const n = Object.keys(o).filter((k) => k !== 'orden').length;
          $('[data-cuenta-filtros]', raiz).textContent = n ? `(${n})` : '';
          return o;
        };
        const aplicar = () => {
          pagina = 1;
          history.replaceState(null, '', conQuery('#/', { q: campo.value.trim(), tamano: filtroTamano, ...leerFiltros() }));
          cargar();
        };
        ff.addEventListener('change', aplicar);
        ff.addEventListener('reset', () => setTimeout(aplicar, 0));
        let espera;
        campo.addEventListener('input', () => { clearTimeout(espera); espera = setTimeout(() => { pagina = 1; cargar(); }, 280); });
        $('[data-buscador]', raiz).addEventListener('submit', (e) => { e.preventDefault(); pagina = 1; cargar(); });
        $$('[data-tamano]', raiz).forEach((b) => b.addEventListener('click', () => {
          filtroTamano = b.dataset.tamano;
          $$('[data-tamano]', raiz).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
          pagina = 1;
          cargar();
        }));
        $('button', mas).addEventListener('click', () => { pagina += 1; cargar(true); });
        cargar();
      },
    };
  }

  /* ---------- Ficha de detalle del animal ---------- */
  async function vistaAnimal(ctx) {
    const id = idValido(ctx.params.id);
    if (!id) return vista404();
    let a;
    const catFicha = await catalogos().catch(() => ({ animal: {} }));
    try { a = await api(`/animales/${id}`); } catch (e) {
      if (e.status === 404) {
        return html`<section class="error"><img src="img/error-404.svg" alt="" width="150" height="157"><p class="error__codigo">Ya no disponible</p><p class="error__texto">${e.message}</p><a class="boton-contorno" href="#/">Ver el catálogo</a></section>`;
      }
      throw e;
    }
    const u = estado.usuario;
    const textos = a.requisitos.filter((r) => r.tipo !== 'Documental');
    const docs = a.requisitos.filter((r) => r.tipo === 'Documental');
    const adoptado = a.estado === 'adoptado';
    let accion;
    if (adoptado) accion = html`<p class="mensaje mensaje--exito">¡${a.nombre} ya encontró un hogar!${a.adoptado_en ? ` Adoptado el ${a.adoptado_en}.` : ''} <a class="enlace" href="#/">Conoce a otros perros</a></p>`;
    else if (!u) accion = html`<a class="boton-contorno boton-contorno--relleno" href="#/login?next=${encodeURIComponent(`#/animal/${a.id}`)}">Inicia sesión para adoptar</a>`;
    else if (u.tipo !== 'adoptante') accion = html`<p class="nota">${u.tipo === 'refugio' ? 'Las cuentas de refugio publican perros; para adoptar se necesita una cuenta de adoptante.' : 'Las cuentas de administración no participan en adopciones.'}</p>`;
    else if (a.miSolicitud) accion = html`${insignia(a.miSolicitud.estado, `Tu solicitud: ${ETQ[a.miSolicitud.estado]}`)} <a class="enlace" href="#/solicitudes?id=${a.miSolicitud.id}">Ver mi solicitud</a>`;
    else accion = html`<a class="boton-contorno boton-contorno--relleno" href="#/solicitar/${a.id}">Quiero adoptarlo</a>`;

    return {
      html: html`
      <section class="principal">
        <div class="contenedor">
          ${botonRegresar('#/')}
          <div class="ficha">
            <div class="ficha__imagen">${imagenAnimal(a)}</div>
            <article class="panel">
              <h1 class="ficha__titulo">${a.nombre}</h1>
              <p class="ficha__raza">${nombreRaza(a)} · en <a class="enlace" href="#/refugios/${a.refugio_id}">${a.refugio}</a></p>
              <div class="ficha__chips">
                ${insignia(a.estado, ETQ[a.estado])}
                <span class="insignia">${a.edad}</span>
                <span class="insignia">${a.tamano}</span>
                ${a.peso_kg ? html`<span class="insignia">⚖️ ${Number(a.peso_kg)} kg</span>` : ''}
                ${a.altura_cm ? html`<span class="insignia">📏 ${a.altura_cm} cm</span>` : ''}
                <span class="insignia">${Number(a.esterilizado) ? `Esterilizado · ${a.fecha_esterilizacion}` : 'Sin esterilizar'}</span>
                <span class="insignia">Ingreso · ${a.fecha_ingreso}</span>
              </div>
              <div class="acciones">${accion}</div>
              <div class="ficha__bloque"><h2>Temperamento</h2>${listaRasgos(catFicha, a, CAMPOS_TEMP, a.temperamento)}</div>
              <div class="ficha__bloque"><h2>Estado de salud</h2>${listaRasgos(catFicha, a, CAMPOS_SALUD, a.salud)}</div>
              <div class="ficha__bloque"><h2>Vacunas</h2>
                ${a.vacunas.length ? html`<ul class="lista-simple">${a.vacunas.map((v) => html`<li><span>${v.nombre}</span><span>${v.fecha}</span></li>`)}</ul>` : html`<p>Sin vacunas registradas.</p>`}
              </div>
              <div class="ficha__bloque"><h2>Requisitos de adopción</h2>
                ${a.requisitos.length ? html`
                  <p class="nota">Todos se entregan en persona durante la cita en el refugio.</p>
                  ${textos.length ? html`<p><strong>Datos personales</strong></p><ul class="lista-simple">${textos.map((r) => html`<li>${r.nombre}</li>`)}</ul>` : ''}
                  ${docs.length ? html`<p><strong>Documentos</strong></p><ul class="lista-simple">${docs.map((r) => html`<li>${r.nombre}</li>`)}</ul>` : ''}`
    : html`<p>El refugio no solicita requisitos adicionales.</p>`}
              </div>
              <div class="ficha__bloque refugio-caja">
                <h3><a class="enlace" href="#/refugios/${a.refugio_id}">${a.refugio}</a></h3>
                <p>${a.institucion}</p>
                <p>${a.direccion}${a.alcaldia ? `, ${a.alcaldia}` : ''}</p>
                <p>Tel. ${a.telefono}</p>
                <p class="acciones"><a class="boton-contorno boton-contorno--chico" href="${mapaUrl(a, true)}" target="_blank" rel="noopener noreferrer">📍 Cómo llegar</a>
                  <a class="boton-contorno boton-contorno--chico" href="#/refugios/${a.refugio_id}">Ver refugio</a></p>
                <ul class="horario-lista">${a.horario.map((h) => html`<li><span>${DIAS[h.dia]}</span><span>${Number(h.cerrado) ? 'Cerrado' : `${h.abre}–${h.cierra}`}</span></li>`)}</ul>
              </div>
              ${u && u.tipo === 'adoptante' && !adoptado ? html`<p class="acciones ficha__bloque"><button class="enlace" type="button" data-reportar="animal">Reportar publicación</button> · <button class="enlace" type="button" data-reportar="refugio">Reportar refugio</button></p>` : ''}
            </article>
          </div>
        </div>
      </section>`,
      montar(raiz) {
        $$('[data-reportar]', raiz).forEach((btn) => btn.addEventListener('click', () => reportar(btn.dataset.reportar === 'animal' ? 'animal' : 'refugio', btn.dataset.reportar === 'animal' ? a.id : a.refugio_id)));
      },
    };
  }

  /* ---------- Reportes: adoptantes reportan fichas y refugios; refugios reportan adoptantes ---------- */
  let motivosReporte = null;
  async function reportar(tipo, id, nombre = '') {
    motivosReporte = motivosReporte || await api('/reportes/motivos');
    const motivos = motivosReporte[tipo] || [];
    const titulo = { animal: 'Reportar publicación', refugio: 'Reportar refugio', usuario: `Reportar a ${nombre || 'la persona adoptante'}` }[tipo];
    const ok = await dialogo({
      titulo,
      texto: 'El equipo de Dopta revisará el reporte. Quien es reportado no ve quién lo reportó.',
      cuerpo: html`
        <label class="campo"><span class="campo__etiqueta">Motivo</span>
          <select class="campo__entrada" name="motivo"><option value="">Selecciona un motivo</option>${motivos.map((m) => html`<option>${m}</option>`)}</select></label>
        <label class="campo"><span class="campo__etiqueta">Descripción</span>
          <textarea class="campo__textarea" name="descripcion" maxlength="300" placeholder="Cuéntanos qué pasa (10 a 300 caracteres)"></textarea></label>`,
      confirmar: 'Enviar reporte',
      accion: async (f) => {
        const d = datosForm(f);
        if (!motivos.includes(d.motivo)) fallo('Seleccione un motivo.');
        const descripcion = revisarTexto(d.descripcion, { min: 10, max: 300, campo: 'La descripción', minPalabras: 3, lineas: 4 });
        await api('/reportes', { metodo: 'POST', datos: { objetivo_tipo: tipo, objetivo_id: id, motivo: d.motivo, descripcion } });
      },
    });
    if (ok) aviso('Reporte enviado. El equipo de Dopta lo revisará.');
  }

  /* ---------- Protocolo de adopción ---------- */
  const PASOS = [
    ['Formato', 'Llenas el formato de adopción y aceptas la carta compromiso.'],
    ['Revisión', 'El refugio revisa tu solicitud y puede escribirte.'],
    ['Cita', 'Conoces al perro y entregas tus documentos.'],
    ['Visita', 'El refugio revisa que tu hogar sea adecuado.'],
    ['Entrega', 'Firmas la carta y te llevas a tu perro esterilizado, desparasitado y con cartilla.'],
    ['Seguimiento', 'El refugio te contacta a la semana, al mes y a los 3 meses.'],
  ];
  /* En qué paso va una solicitud */
  function pasoActual(s) {
    if (s.concretada_en) return (s.seguimientos || []).every((x) => x.realizado_en) && (s.seguimientos || []).length ? 6 : 5;
    if (s.estado === 'aprobada') return s.visita ? 4 : s.cita_fecha ? 3 : 2;
    return 1;
  }
  const lineaProceso = (actual = 0, cerrada = false) => html`
    <ol class="proceso${cerrada ? ' proceso--cerrado' : ''}" aria-label="Proceso de adopción">${PASOS.map(([t, d], i) => html`
      <li class="proceso__paso${i < actual ? ' proceso__paso--hecho' : ''}${i === actual && !cerrada ? ' proceso__paso--actual' : ''}" title="${d}"${si(i === actual && !cerrada, 'aria-current="step"')}>
        <span class="proceso__num">${i + 1}</span><span class="proceso__texto">${t}</span></li>`)}</ol>`;

  async function vistaSolicitar(ctx) {
    const id = idValido(ctx.params.id);
    if (!id) return vista404();
    const [a, formato, cuenta] = await Promise.all([api(`/animales/${id}`), api('/solicitudes/formato'), api('/cuenta')]);
    if (a.miSolicitud) { location.replace(`#/solicitudes?id=${a.miSolicitud.id}`); return ''; }
    if (a.estado !== 'disponible') { aviso(`${a.nombre} ya no está disponible.`, 'error'); location.replace(`#/animal/${id}`); return ''; }
    const O = formato.opciones;
    const pastillas = (nombre, ops) => html`<div class="pastillas" role="radiogroup">${Object.entries(ops).map(([v, t]) => html`
      <label class="pastilla"><input type="radio" name="${nombre}" value="${v}" required><span>${t}</span></label>`)}</div>`;
    return {
      html: html`
      <section class="principal">
        <div class="contenedor contenedor--angosto">
          ${botonRegresar(`#/animal/${id}`)}
          <header class="solicitar__cabeza">
            <div class="solicitar__foto">${imagenAnimal(a)}</div>
            <div><h1 class="titulo-pagina titulo-pagina--izq">Adoptar a ${a.nombre}</h1>
              <p class="nota">Formato de adopción de ${a.refugio}. Basado en el proceso de adopción de la Ciudad de México.</p></div>
          </header>
          ${lineaProceso(0)}
          <form class="formulario formulario--secciones" novalidate data-solicitar>
            <fieldset class="seccion"><legend>1. Tu hogar</legend>
              <div class="campo"><span class="campo__etiqueta">¿En qué tipo de vivienda vives?</span>${pastillas('vivienda', O.vivienda)}</div>
              <div class="campo"><span class="campo__etiqueta">La vivienda es…</span>${pastillas('tenencia', O.tenencia)}</div>
              <label class="casilla" data-permiso hidden><input type="checkbox" name="permiso"><span>Tengo permiso del arrendador para tener un perro.</span></label>
              <div class="campo"><span class="campo__etiqueta">¿Dónde pasará el perro la mayor parte del día?</span>${pastillas('espacio', O.espacio)}
                <span class="campo__ayuda" data-aviso-azotea hidden>La ley de la CDMX prohíbe mantener a un perro de forma permanente en la azotea. Debe tener un espacio protegido del sol y la lluvia.</span></div>
              <div class="fila-campos">
                <label class="campo"><span class="campo__etiqueta">¿Cuántas personas viven ahí?</span>
                  <input class="campo__entrada campo__entrada--numero" name="habitantes" type="number" min="1" max="20" step="1" inputmode="numeric" required></label>
                <div class="campo"><span class="campo__etiqueta">¿Hay niñas o niños?</span>${pastillas('ninos', O.ninos)}</div>
              </div>
              <label class="casilla"><input type="checkbox" name="de_acuerdo"><span>Todas las personas que viven conmigo están de acuerdo con la adopción.</span></label>
            </fieldset>
            <fieldset class="seccion"><legend>2. Experiencia y tiempo</legend>
              <div class="campo"><span class="campo__etiqueta">¿Tienes otras mascotas?</span>${pastillas('mascotas', O.mascotas)}</div>
              <div class="campo"><span class="campo__etiqueta">¿Has tenido perros antes?</span>${pastillas('experiencia', O.experiencia)}</div>
              <label class="campo"><span class="campo__etiqueta">¿Cuántas horas al día estará solo?</span>
                <input class="campo__entrada campo__entrada--numero" name="horas_solo" type="number" min="0" max="24" step="1" inputmode="numeric" required>
                <span class="campo__ayuda" data-aviso-horas hidden>Más de 8 horas solo al día es mucho para un perro: considera paseadores o compañía.</span></label>
              <label class="campo"><span class="campo__etiqueta">¿Por qué quieres adoptar a ${a.nombre}?</span>
                <textarea class="campo__textarea" name="motivo" maxlength="400" placeholder="Cuéntale al refugio sobre ti, tu rutina y cómo lo cuidarás (mínimo 20 caracteres)"></textarea></label>
            </fieldset>
            <fieldset class="seccion"><legend>3. Contacto</legend>
              <label class="campo"><span class="campo__etiqueta">Teléfono celular</span>
                <input class="campo__entrada" name="telefono" type="tel" inputmode="numeric" maxlength="10" value="${cuenta.telefono || ''}" placeholder="10 dígitos" required>
                <span class="campo__ayuda">Solo lo verá ${a.refugio} para coordinar la cita.</span></label>
              ${cuenta.mayor_edad ? '' : html`<label class="casilla"><input type="checkbox" name="mayor_edad"><span>Soy mayor de 18 años.</span></label>`}
              <label class="campo"><span class="campo__etiqueta">Mensaje para el refugio <span class="opcional">(opcional)</span></span>
                <textarea class="campo__textarea" name="mensaje" maxlength="300" placeholder="Algo más que quieras contarle al refugio"></textarea></label>
            </fieldset>
            <fieldset class="seccion seccion--compromiso"><legend>4. Carta compromiso</legend>
              <p class="nota">Si adopto a ${a.nombre}, me comprometo a:</p>
              ${Object.entries(formato.compromisos).map(([k, t]) => html`<label class="casilla"><input type="checkbox" name="c_${k}"><span>${t}</span></label>`)}
              <p class="nota">En la entrega firmarás esta carta en papel. Ley de Protección y Bienestar de los Animales de la Ciudad de México, art. 32.</p>
            </fieldset>
            <p class="mensaje mensaje--error" data-error role="alert"></p>
            <div class="acciones"><button class="boton-contorno boton-contorno--relleno" type="submit">Enviar solicitud</button></div>
          </form>
        </div>
      </section>`,
      montar(raiz) {
        const f = $('[data-solicitar]', raiz);
        soloDigitos(f);
        const valor = (n) => (f.elements[n] && f.elements[n].value) || '';
        f.addEventListener('change', () => {
          $('[data-permiso]', f).hidden = valor('tenencia') !== 'rentada';
          $('[data-aviso-azotea]', f).hidden = valor('espacio') !== 'azotea';
        });
        f.elements.horas_solo.addEventListener('input', () => { $('[data-aviso-horas]', f).hidden = !(Number(f.elements.horas_solo.value) > 8); });
        f.addEventListener('submit', async (e) => {
          e.preventDefault();
          const b = $('button[type="submit"]', f);
          try {
            const pide = (n, t) => valor(n) || fallo(`Responde: ${t}`);
            const cuestionario = {
              vivienda: pide('vivienda', '¿En qué tipo de vivienda vives?'),
              tenencia: pide('tenencia', 'la vivienda es propia, rentada o de un familiar.'),
              permiso: !!(f.elements.permiso && f.elements.permiso.checked),
              espacio: pide('espacio', '¿dónde pasará el perro el día?'),
              habitantes: Number(valor('habitantes')),
              ninos: pide('ninos', '¿hay niñas o niños en casa?'),
              de_acuerdo: f.elements.de_acuerdo.checked,
              mascotas: pide('mascotas', '¿tienes otras mascotas?'),
              experiencia: pide('experiencia', '¿has tenido perros antes?'),
              horas_solo: valor('horas_solo') === '' ? NaN : Number(valor('horas_solo')),
            };
            if (cuestionario.tenencia === 'rentada' && !cuestionario.permiso) fallo('Si rentas, necesitas el permiso del arrendador para tener un perro.');
            if (!Number.isInteger(cuestionario.habitantes) || cuestionario.habitantes < 1 || cuestionario.habitantes > 20) fallo('Indica cuántas personas viven en tu hogar (de 1 a 20).');
            if (!cuestionario.de_acuerdo) fallo('Todas las personas que viven contigo deben estar de acuerdo con la adopción.');
            if (!Number.isInteger(cuestionario.horas_solo) || cuestionario.horas_solo < 0 || cuestionario.horas_solo > 24) fallo('Indica cuántas horas al día estará solo (de 0 a 24).');
            cuestionario.motivo = revisarTexto(valor('motivo'), { min: 20, max: 400, campo: '¿Por qué quieres adoptar?', minPalabras: 4, lineas: 5 });
            const tel = valor('telefono');
            if (!V.telefono(tel)) fallo(M.telefono);
            if (!V.telefonoReal(tel)) fallo(M.telefonoReal);
            if (f.elements.mayor_edad && !f.elements.mayor_edad.checked) fallo('Para adoptar debes ser mayor de 18 años.');
            const compromisos = Object.fromEntries(Object.keys(formato.compromisos).map((k) => [k, f.elements[`c_${k}`].checked]));
            if (Object.values(compromisos).some((x) => !x)) fallo('Acepta cada punto de la carta compromiso para continuar.');
            const mensaje = valor('mensaje').replace(/\s/g, '') ? revisarTexto(valor('mensaje'), { min: 10, max: 300, campo: 'El mensaje', minPalabras: 2, lineas: 4 }) : null;
            ocupado(b);
            errorEn(f, '');
            const r = await api('/solicitudes', { metodo: 'POST', datos: { animal_id: id, cuestionario, compromisos, telefono: tel, mensaje, mayor_edad: f.elements.mayor_edad ? f.elements.mayor_edad.checked : undefined } });
            aviso('Solicitud enviada. Te avisaremos cuando el refugio responda.');
            location.hash = `#/solicitudes?id=${r.id}`;
          } catch (err) {
            errorEn(f, err instanceof ErrorApi ? textoError(err) : err.message);
          } finally { ocupado(b, false); }
        });
      },
    };
  }
