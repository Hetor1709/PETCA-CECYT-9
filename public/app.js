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

  /* ---------- Cuestionario de compatibilidad ---------- */
  function recomendar(r) {
    let tamano;
    if (r.jardin === 'no') tamano = r.tiempo === 'mucho' && r.energia === 'activos' ? 'Mediano' : 'Pequeño';
    else tamano = r.tiempo === 'mucho' ? 'Grande' : 'Mediano';
    let energia;
    if (r.energia === 'activos') energia = r.tiempo === 'poco' ? 'media' : 'alta';
    else energia = r.tiempo === 'mucho' ? 'media' : 'baja';
    const ordenT = ['Pequeño', 'Mediano', 'Grande'];
    const ordenE = ['baja', 'media', 'alta'];
    const puntos = (raza) => {
      let p = 0;
      const dt = Math.abs(ordenT.indexOf(raza.tamano) - ordenT.indexOf(tamano));
      const de = Math.abs(ordenE.indexOf(raza.energia) - ordenE.indexOf(energia));
      p += dt === 0 ? 3 : dt === 1 ? 1 : -2;
      p += de === 0 ? 3 : de === 1 ? 1 : -2;
      if (raza.exigente && r.experiencia === 'no') p -= 3;
      return p;
    };
    const razas = [...RAZAS].sort((x, y) => puntos(y) - puntos(x) || x.nombre.localeCompare(y.nombre)).slice(0, 3);
    return { tamano, energia, razas };
  }

  function vistaCuestionario() {
    const pregunta = (nombre, titulo, ops, def) => html`
      <fieldset class="pregunta">
        <legend class="pregunta__titulo">${titulo}</legend>
        <div class="pregunta__opciones">
          ${ops.map(([v, t]) => html`<label class="opcion"><input type="radio" name="${nombre}" value="${v}"${si(v === def, 'checked')}><span class="opcion__texto">${t}</span></label>`)}
        </div>
      </fieldset>`;
    return {
      html: html`
      <section class="cuenta">
        ${botonRegresar('#/', 'Atrás')}
        <section class="cuenta__tarjeta cuestionario__tarjeta" aria-labelledby="titulo-cuestionario">
          <h1 class="cuenta__titulo" id="titulo-cuestionario">¿Cuál es tu mascota ideal?</h1>
          <p class="cuenta__subtitulo">Responde estas preguntas y descubre qué compañero de hogar es perfecto para ti.</p>
          <form class="cuestionario" data-cuestionario>
            <div class="cuestionario__preguntas">
              ${pregunta('jardin', '¿Tienes jardín o patio?', [['si', 'Sí'], ['no', 'No']], 'si')}
              ${pregunta('tiempo', '¿Cuánto tiempo puedes dedicar al cuidado?', [['poco', 'Poco'], ['medio', 'Medio'], ['mucho', 'Mucho']], 'medio')}
              ${pregunta('experiencia', '¿Tienes experiencia con mascotas?', [['si', 'Sí'], ['no', 'No']], 'si')}
              ${pregunta('energia', '¿Prefieres animales activos o tranquilos?', [['activos', 'Activos'], ['tranquilos', 'Tranquilos']], 'tranquilos')}
            </div>
            <div class="cuestionario__accion"><button class="boton-pastilla" type="submit">Descubrir mi mascota ideal</button></div>
          </form>
          <div data-resultado></div>
        </section>
      </section>`,
      montar(raiz) {
        const form = $('[data-cuestionario]', raiz);
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const r = recomendar(datosForm(form));
          const caja = $('[data-resultado]', raiz);
          const energiaTxt = { baja: 'tranquila', media: 'moderada', alta: 'alta' }[r.energia];
          caja.innerHTML = String(html`
            <div class="resultado" role="status">
              <h2>Tu perfil ideal</h2>
              <p>Un perro de tamaño <strong data-tam>${r.tamano.toLowerCase()}</strong> con energía <strong>${energiaTxt}</strong>. Estas razas suelen encajar contigo:</p>
              <div class="resultado__razas">${r.razas.map((x) => html`<a class="resultado__raza" href="#/?raza=${x.id}">${seguro(x.svg)}<span>${x.nombre}</span></a>`)}</div>
              <p class="nota">Sugerencia orientativa: cada perro es único y muchos mestizos encajan con este perfil. Conócelo en el refugio antes de decidir.</p>
              <div data-sugeridos></div>
            </div>`);
          caja.scrollIntoView({ behavior: 'smooth', block: 'start' });
          try {
            const cat = await catalogos();
            // Se busca por posición (1.º, 2.º, 3.º tamaño del catálogo) y no por nombre, por si el admin lo renombra
            const pos = ['Pequeño', 'Mediano', 'Grande'].indexOf(r.tamano);
            const t = [...cat.tamano].sort((x, y) => x.orden - y.orden || x.id - y.id)[pos];
            if (t) $('[data-tam]', caja).textContent = t.nombre.toLowerCase();
            const res = await api(conQuery('/animales', { tamano: t && t.id }));
            const lista = res.animales.slice(0, 4);
            if (lista.length) {
              $('[data-sugeridos]', caja).innerHTML = String(html`<p><strong>Perros disponibles con ese tamaño:</strong></p><ul class="catalogo">${lista.map((a) => tarjetaAnimal(a))}</ul>`);
            }
          } catch { /* las sugerencias son opcionales */ }
        });
      },
    };
  }

  /* ---------- Refugios: listado público ---------- */
  async function vistaRefugios(ctx) {
    const q = (ctx.query.get('q') || '').slice(0, 60);
    return {
      html: html`
      <section class="principal">
        <h1 class="titulo-pagina">Refugios</h1>
        <form class="buscador" role="search" data-buscador>
          <label class="sr-only" for="buscar-refugio">Buscar refugio</label>
          <input class="buscador__campo" id="buscar-refugio" type="search" placeholder="Buscar por nombre o alcaldía" value="${q}" maxlength="60" autocomplete="off">
          ${ICONO.lupa}
        </form>
        <div class="acciones acciones--centro"><button class="boton-contorno boton-contorno--chico" type="button" data-cercanos aria-pressed="false">${ICONO.ubicacion} Más cercanos a mí</button></div>
        <p class="campo__ayuda centrado" data-cerca-estado aria-live="polite"></p>
        <ul class="refugios contenedor" data-lista aria-busy="true"></ul>
        <p class="buscador__vacio" data-vacio hidden>No encontramos refugios con esa búsqueda.</p>
      </section>`,
      montar(raiz) {
        const campo = $('#buscar-refugio', raiz);
        let n = 0;
        let reloj;
        let yo = null; // ubicación del usuario cuando pide "Más cercanos"
        const cargar = async () => {
          const k = ++n;
          try {
            let lista = await api(conQuery('/refugios', { q: campo.value.trim() }));
            if (k !== n) return;
            if (yo) {
              lista = lista.map((r) => ({ ...r, km: r.lat != null ? distanciaKm(yo, r) : null }))
                .sort((x, y) => (x.km ?? 1e9) - (y.km ?? 1e9));
            }
            $('[data-lista]', raiz).innerHTML = String(html`${lista.map(tarjetaRefugio)}`);
            $('[data-vacio]', raiz).hidden = lista.length > 0;
          } catch (e) { $('[data-vacio]', raiz).hidden = false; $('[data-vacio]', raiz).textContent = textoError(e, 'No se pudo cargar la lista. Intente de nuevo.'); }
          $('[data-lista]', raiz).setAttribute('aria-busy', 'false');
        };
        campo.addEventListener('input', () => { clearTimeout(reloj); reloj = setTimeout(cargar, 280); });
        $('[data-buscador]', raiz).addEventListener('submit', (e) => { e.preventDefault(); cargar(); });
        const bc = $('[data-cercanos]', raiz);
        const est = $('[data-cerca-estado]', raiz);
        bc.addEventListener('click', async () => {
          if (yo) { yo = null; bc.setAttribute('aria-pressed', 'false'); est.textContent = ''; cargar(); return; }
          est.textContent = 'Obteniendo tu ubicación…';
          try {
            yo = await ubicacionActual();
            bc.setAttribute('aria-pressed', 'true');
            est.textContent = 'Ordenados por distancia en línea recta desde tu ubicación (≈ = aproximada por alcaldía). Tu ubicación no se guarda.';
            cargar();
          } catch (e) { est.textContent = e.message; }
        });
        cargar();
      },
    };
  }

  /* ---------- Perfil público del refugio ---------- */
  async function vistaPerfilRefugio(ctx) {
    const id = idValido(ctx.params.id);
    if (!id) return vista404();
    let r;
    try { r = await api(`/refugios/${id}`); } catch (e) {
      if (e.status === 404) return html`<section class="error"><img src="img/error-404.svg" alt="" width="150" height="157"><p class="error__codigo">Refugio no disponible</p><p class="error__texto">${e.message}</p><a class="boton-contorno" href="#/refugios">Ver refugios</a></section>`;
      throw e;
    }
    const u = estado.usuario;
    const abierto = abiertoAhora(r.horario);
    const hoyDia = diaSemana(hoyCDMX());
    return {
      html: html`
      <section class="principal">
        <div class="contenedor">
          ${botonRegresar('#/refugios')}
          <div class="perfil-refugio">
            <article class="panel perfil-refugio__info">
              <img class="perfil-refugio__logo" src="img/logo-dopta.svg" alt="" width="72" height="65">
              <h1 class="ficha__titulo">${r.nombre}</h1>
              <p class="ficha__raza">${r.institucion}</p>
              <div class="ficha__chips">
                ${insignia(abierto ? 'disponible' : 'rechazada', abierto ? 'Abierto ahora' : 'Cerrado ahora')}
                <span class="insignia">✔ Refugio verificado</span>
              </div>
              <div class="ficha__bloque">
                <h2>Ubicación</h2>
                <p>${r.direccion}${r.alcaldia ? `, ${r.alcaldia}` : ''}</p>
                <p class="acciones"><a class="boton-contorno boton-contorno--chico" href="${mapaUrl(r, true)}" target="_blank" rel="noopener noreferrer">📍 Cómo llegar</a>
                  <a class="boton-contorno boton-contorno--chico" href="tel:${r.telefono}">📞 ${r.telefono}</a></p>
              </div>
              <div class="ficha__bloque">
                <h2>Horario de atención</h2>
                <ul class="lista-simple horario-hoy">${r.horario.map((h) => html`
                  <li class="${Number(h.dia) === hoyDia ? 'es-hoy' : ''}"><span>${DIAS[h.dia]}${Number(h.dia) === hoyDia ? ' (hoy)' : ''}</span><strong>${Number(h.cerrado) ? 'Cerrado' : `${h.abre} – ${h.cierra}`}</strong></li>`)}</ul>
              </div>
              ${u && u.tipo === 'adoptante' ? html`<p class="ficha__bloque"><button class="enlace" type="button" data-reportar-refugio>Reportar refugio</button></p>` : ''}
            </article>
            <div>
              <div class="cifras perfil-refugio__cifras">
                <article class="cifra cifra--durazno"><span class="cifra__numero">${r.animales.length}</span><span class="cifra__texto">perros en adopción</span></article>
                <article class="cifra cifra--azul"><span class="cifra__numero">${r.adoptados}</span><span class="cifra__texto">adopciones logradas</span></article>
              </div>
              <h2 class="subtitulo-seccion">Perros en adopción</h2>
              ${r.animales.length ? html`<ul class="catalogo perfil-refugio__catalogo">${r.animales.map((a) => tarjetaAnimal(a))}</ul>`
    : html`<div class="vacio">${seguro(SVG_HUELLA)}Este refugio no tiene perros publicados por ahora.</div>`}
            </div>
          </div>
        </div>
      </section>`,
      montar(raiz) {
        const b = $('[data-reportar-refugio]', raiz);
        if (b) b.addEventListener('click', () => reportar('refugio', r.id));
      },
    };
  }

  /* ---------- Sobre nosotros ---------- */
  const vistaNosotros = () => html`
    <div class="nosotros">
      <section class="nosotros__seccion nosotros__heroe">
        <div class="nosotros__contenedor">
          <p class="nosotros__eyebrow">Sobre Dopta</p>
          <h1 class="nosotros__titulo">Cada perrito merece una casa, y Dopta ayuda a encontrarla</h1>
          <p class="nosotros__texto">Somos un catálogo digital gratuito de animales en adopción. Reunimos a los refugios de perros y a las personas que quieren adoptar en un solo lugar, sin intermediarios.</p>
          <a class="boton-contorno" href="#/">Explorar mascotas</a>
        </div>
        <div class="nosotros__ilustracion" aria-hidden="true"><img src="img/logo-dopta.svg" alt="" width="180" height="162"></div>
      </section>
      <section class="nosotros__seccion">
        <div class="nosotros__contenedor">
          <div class="nosotros__cifras">
            <article class="cifra cifra--azul"><span class="cifra__numero">Gratis</span><span class="cifra__texto">para refugios y adoptantes</span></article>
            <article class="cifra cifra--durazno"><span class="cifra__numero">0%</span><span class="cifra__texto">de comisión por adopción</span></article>
            <article class="cifra cifra--blanco"><span class="cifra__numero">Verificados</span><span class="cifra__texto">refugios revisados antes de publicar</span></article>
          </div>
        </div>
      </section>
      <section class="nosotros__seccion">
        <div class="nosotros__contenedor">
          <p class="nosotros__eyebrow">Cómo funciona</p>
          <h2 class="nosotros__titulo">Tres pasos para conocer a tu compañero</h2>
          <p class="nosotros__texto">No necesitas experiencia previa ni un plan complicado. El proceso empieza con una pregunta honesta sobre tu vida diaria y termina con una cita en el refugio, donde conoces al animal cara a cara.</p>
          <ol class="nosotros__pasos">
            <li class="paso"><span class="paso__numero">1</span><h3 class="paso__titulo">Explora el catálogo</h3><p class="paso__texto">Revisa las fichas de los animales y responde el test para saber qué mascota encaja contigo.</p></li>
            <li class="paso"><span class="paso__numero">2</span><h3 class="paso__titulo">Crea tu cuenta</h3><p class="paso__texto">Regístrate como adoptante para enviar solicitudes y agendar tu cita en el refugio.</p></li>
            <li class="paso"><span class="paso__numero">3</span><h3 class="paso__titulo">Conoce en persona</h3><p class="paso__texto">Los requisitos de adopción se entregan durante la cita, para que conozcas al animal cara a cara.</p></li>
          </ol>
        </div>
      </section>
      <section class="nosotros__seccion">
        <div class="nosotros__contenedor">
          <p class="nosotros__eyebrow">Nuestra historia</p>
          <h2 class="nosotros__titulo">Por qué nace Dopta</h2>
          <div class="nosotros__parrafos">
            <p>Dopta nace de una idea sencilla: muchos perros esperan en refugios a que alguien los vea. Queremos que encontrarlos sea tan fácil como buscar cualquier otra cosa en internet, sin costos ocultos ni intermediarios.</p>
            <p>Creemos que una adopción funciona mejor cuando la información es clara desde el primer momento: cómo es el animal, qué salud tiene, qué vacunas y esterilización le corresponden y qué requisitos pide el refugio. Por eso cada ficha reúne esos datos y cada refugio pasa por una verificación antes de publicar.</p>
            <p>No vendemos animales ni cobramos comisiones. Dopta es un catálogo gratuito: el vínculo se construye entre el refugio y la persona, en la cita y no en la plataforma.</p>
          </div>
          <p class="nosotros__eyebrow">Lo que nos guía</p>
          <h2 class="nosotros__titulo">Tres principios para cada adopción</h2>
          <ol class="nosotros__pasos">
            <li class="paso"><span class="paso__numero">1</span><h3 class="paso__titulo">Transparencia</h3><p class="paso__texto">Cada animal se muestra con su edad, tamaño, salud, vacunas y esterilización, para que decidas con información completa.</p></li>
            <li class="paso"><span class="paso__numero">2</span><h3 class="paso__titulo">Gratuidad</h3><p class="paso__texto">Ni refugios ni adoptantes pagan por usar Dopta. No hay comisiones por adopción ni cobros ocultos.</p></li>
            <li class="paso"><span class="paso__numero">3</span><h3 class="paso__titulo">Privacidad</h3><p class="paso__texto">Las contraseñas se guardan cifradas y tu correo solo lo ven el refugio de tu solicitud y el equipo de moderación.</p></li>
          </ol>
        </div>
      </section>
      <section class="nosotros__seccion">
        <div class="nosotros__contenedor"><div class="nosotros__cta"><h2>¿Listo para encontrar a tu compañero?</h2><a class="boton-contorno" href="#/">Ver el catálogo</a></div></div>
      </section>
    </div>`;

  /* ---------- Errores ---------- */
  const vista404 = () => html`
    <section class="error">
      <img src="img/error-404.svg" alt="" width="150" height="157">
      <p class="error__codigo">ERROR 404</p>
      <p class="error__texto">Página no encontrada. Puede que la dirección esté mal escrita o que la página ya no exista.</p>
      <a class="boton-contorno" href="${estado.panel}">Volver al inicio</a>
    </section>`;
  const vista500 = (detalle = 'Algo salió mal en nuestro servidor. Intenta de nuevo en unos minutos.', codigo = 'ERROR 500') => html`
    <section class="error">
      <img src="img/error-500.svg" alt="" width="150" height="231">
      <p class="error__codigo">${codigo}</p>
      <p class="error__texto">${detalle}</p>
      <button class="boton-contorno" type="button" data-reintentar>Reintentar</button>
    </section>`;

  /* ======================= 11. Acceso y cuenta ======================= */
  const tarjetaCuenta = (id, titulo, subtitulo, contenido, ancho = false) => html`
    <section class="cuenta">
      ${botonRegresar('#/')}
      <section class="cuenta__tarjeta ${ancho ? 'cuestionario__tarjeta' : ''}" aria-labelledby="${id}">
        <h1 class="cuenta__titulo" id="${id}">${titulo}</h1>
        ${subtitulo ? html`<p class="cuenta__subtitulo">${subtitulo}</p>` : ''}
        ${contenido}
      </section>
    </section>`;

  const mensajeFlash = () => {
    const f = estado.flash;
    estado.flash = null;
    return f ? html`<p class="mensaje ${f.tipo === 'error' ? 'mensaje--error' : ''}" role="status">${f.texto}</p>` : '';
  };

  /* ---------- RF-05: iniciar sesión ---------- */
  function vistaLogin(ctx) {
    return {
      html: tarjetaCuenta('titulo-login', 'Iniciar Sesión', 'Ingresa a tu cuenta para adoptar o publicar mascotas', html`
        <form class="formulario" novalidate data-login>
          ${mensajeFlash()}
          <div class="campo"><label class="campo__etiqueta" for="correo">Email</label>
            <input class="campo__entrada" id="correo" name="correo" type="email" placeholder="tu@email.com" autocomplete="email" maxlength="254" required></div>
          <div class="campo"><label class="campo__etiqueta" for="contrasena">Contraseña</label>
            <input class="campo__entrada" id="contrasena" name="contrasena" type="password" placeholder="••••••••" autocomplete="current-password" maxlength="64" required></div>
          <p class="mensaje mensaje--error" data-error role="alert"></p>
          <button class="boton-contorno" type="submit">Ingresar</button>
        </form>
        <p class="cuenta__pie"><a href="#/recuperar">Olvidé mi contraseña</a></p>
        <p class="cuenta__pie">¿No tienes cuenta? <a href="#/registro">Registrarse</a></p>`),
      montar(raiz) {
        const f = $('[data-login]', raiz);
        f.addEventListener('submit', async (e) => {
          e.preventDefault();
          const d = datosForm(f);
          d.contrasena = f.contrasena.value;
          if (!V.correo(d.correo) || d.contrasena.length < 8 || d.contrasena.length > 64) return errorEn(f, 'Complete los campos con un formato válido.');
          const b = $('button[type="submit"]', f);
          ocupado(b);
          try {
            const r = await api('/auth/login', { metodo: 'POST', datos: d });
            estado.usuario = r.usuario;
            estado.panel = r.panel;
            estado.perfil = null;
            f.reset();
            await actualizarYo();
            const destino = rutaSegura(ctx.query.get('next'));
            const permitido = destino && rutaPermitida(destino, r.usuario);
            location.hash = permitido ? destino : r.panel;
          } catch (err) {
            ocupado(b, false);
            f.contrasena.value = '';
            if (err.datos && err.datos.codigo === 'RECHAZADA') {
              estado.rechazado = d.correo;
              location.hash = '#/verificacion-rechazada';
              return;
            }
            errorEn(f, textoError(err, 'No se pudo iniciar sesión. Intente de nuevo en unos minutos.'));
          }
        });
      },
    };
  }

  /* Campos institucionales del Refugio (RF-04) compartidos por registro, revalidación y perfil */
  const camposRefugio = (cat, d = {}, conInstitucion = true) => html`
    ${conInstitucion ? html`<div class="campo"><label class="campo__etiqueta" for="institucion">Nombre de la institución</label>
      <input class="campo__entrada" id="institucion" name="institucion" type="text" maxlength="120" value="${d.institucion || ''}" placeholder="Ej. Asociación Patitas A.C." required></div>` : ''}
    <fieldset class="ubicacion campo--ancho" data-direccion>
      <legend class="campo__etiqueta">Ubicación del refugio</legend>
      <div class="campo direccion" data-buscador hidden><label class="campo__etiqueta" for="buscar-dir">Buscar dirección <span class="opcional">(llena los campos por ti)</span></label>
        <div class="direccion__control">
          <input class="campo__entrada" id="buscar-dir" type="search" maxlength="200" placeholder="Ej. Av. Universidad 1200" autocomplete="off"
            role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="direccion-lista">
          <ul class="direccion__lista" id="direccion-lista" role="listbox" aria-label="Sugerencias de dirección" hidden></ul>
        </div>
        <button class="boton-contorno boton-contorno--chico ubicacion__actual" type="button" data-mi-ubicacion>${ICONO.ubicacion} Usar mi ubicación actual</button></div>
      <div class="ubicacion__rejilla">
        <div class="campo"><label class="campo__etiqueta" for="cp">Código postal <span class="paso-chico">1</span></label>
          <input class="campo__entrada" id="cp" name="cp" type="text" inputmode="numeric" maxlength="5" pattern="\\d{5}" value="${d.cp || ''}" placeholder="03330" autocomplete="postal-code" required></div>
        <div class="campo"><label class="campo__etiqueta" for="alcaldia-ver">Alcaldía</label>
          <input class="campo__entrada campo__entrada--fijo" id="alcaldia-ver" type="text" readonly tabindex="-1" value="${d.alcaldia || ''}" placeholder="Se llena con el C.P.">
          <input type="hidden" name="alcaldia_id" value="${d.alcaldia_id || ''}"></div>
        <div class="campo ubicacion__colonia"><label class="campo__etiqueta" for="colonia">Colonia <span class="paso-chico">2</span></label>
          <select class="campo__entrada" id="colonia" name="colonia" required data-colonia-actual="${d.colonia || ''}" disabled><option value="">Escribe primero el C.P.</option></select></div>
        <div class="campo ubicacion__calle direccion"><label class="campo__etiqueta" for="calle">Calle <span class="paso-chico">3</span></label>
          <div class="direccion__control">
            <input class="campo__entrada" id="calle" name="calle" type="text" maxlength="100" value="${d.calle || ''}" placeholder="Ej. Av. Universidad" autocomplete="off" required
              role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="calles-lista">
            <ul class="direccion__lista" id="calles-lista" role="listbox" aria-label="Calles sugeridas" hidden></ul>
          </div></div>
        <div class="campo"><label class="campo__etiqueta" for="num_ext">Núm. exterior</label>
          <input class="campo__entrada" id="num_ext" name="num_ext" type="text" maxlength="10" value="${d.num_ext || ''}" placeholder="1200 o S/N" required></div>
        <div class="campo"><label class="campo__etiqueta" for="num_int">Núm. interior <span class="opcional">(opcional)</span></label>
          <input class="campo__entrada" id="num_int" name="num_int" type="text" maxlength="10" value="${d.num_int || ''}" placeholder="Ej. 3 o B"></div>
      </div>
      <input type="hidden" name="lat" value="${d.lat ?? ''}"><input type="hidden" name="lng" value="${d.lng ?? ''}"><input type="hidden" name="place_id" value="${d.place_id || ''}">
      <span class="campo__ayuda" data-dir-estado>${d.lat ? html`📍 Ubicación verificada · <a href="${mapaUrl(d)}" target="_blank" rel="noopener noreferrer">Ver en el mapa</a>`
        : d.direccion && !d.calle ? `Dirección registrada: ${d.direccion}. Complétala por partes.` : 'Empieza por el código postal: la alcaldía se llena sola y eliges la colonia de la lista.'}</span>
    </fieldset>
    <div class="campo"><label class="campo__etiqueta" for="telefono">Teléfono</label>
      <input class="campo__entrada" id="telefono" name="telefono" type="tel" inputmode="numeric" maxlength="10" pattern="\\d{10}" value="${d.telefono || ''}" placeholder="10 dígitos" required></div>
    <div class="campo campo--ancho"><span class="campo__etiqueta">Horario de atención</span>${editorHorario(d.horario)}</div>`;

  /* Ubicación atomizada: mismas reglas que V.ubicacion() en server/util.js */
  const RE_CALLE = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9 .,#°\-]+$/;
  function validarUbicacion(d, cat) {
    const t = (v) => String(v || '').trim().replace(/\s+/g, ' ');
    const u = {
      calle: t(d.calle), num_ext: t(d.num_ext).toUpperCase().replace(/^S\/?N$/, 'S/N'), num_int: t(d.num_int).toUpperCase(),
      colonia: t(d.colonia), cp: t(d.cp), alcaldia_id: Number(d.alcaldia_id) || null,
    };
    if (!/^\d{5}$/.test(u.cp)) fallo(M.cp);
    if (Number(u.cp.slice(0, 2)) < 1 || Number(u.cp.slice(0, 2)) > 16) fallo(M.cpCdmx);
    if (!u.alcaldia_id) fallo('Escribe un código postal válido de la Ciudad de México para obtener la alcaldía.');
    if (!u.colonia) fallo('Selecciona la colonia de la lista del código postal.');
    if (!V.entre(u.calle, 3, 100) || !RE_CALLE.test(u.calle) || !V.letras(u.calle, 3)) fallo(M.calle);
    revisarTexto(u.calle, { min: 3, max: 100, campo: 'La calle', lineas: 1 });
    if (!/^(S\/N|\d{1,5}[A-Z]?(-[A-Z0-9]{1,3})?)$/.test(u.num_ext) || /^0+\D*$/.test(u.num_ext)) fallo(M.numExt);
    if (u.num_int && !/^[A-Z0-9][A-Z0-9 .\-]{0,9}$/.test(u.num_int)) fallo(M.numInt);
    return u;
  }

  function validarCamposRefugio(f, cat, conInstitucion = true) {
    const d = datosForm(f);
    if (conInstitucion && !V.entre(d.institucion, 3, 120)) fallo(M.institucion);
    if (conInstitucion && !V.letras(d.institucion)) fallo(M.letras);
    if (conInstitucion) revisarNombre(d.institucion, 'refugio');
    const u = validarUbicacion(d, cat);
    if (!V.telefono(d.telefono)) fallo(M.telefono);
    if (!V.telefonoReal(d.telefono)) fallo(M.telefonoReal);
    return {
      institucion: d.institucion, ...u, telefono: d.telefono, horario: leerHorario(f),
      lat: d.lat ? Number(d.lat) : null, lng: d.lng ? Number(d.lng) : null, place_id: d.place_id || null,
    };
  }

  /* Enlace a Google Maps (no consume API): por coordenadas o, si no hay, por texto de la dirección */
  function mapaUrl(r, ruta = false) {
    const p = new URLSearchParams({ api: '1' });
    const destino = r.lat && r.lng ? `${r.lat},${r.lng}` : [r.direccion, r.alcaldia, 'Ciudad de México'].filter(Boolean).join(', ');
    p.set(ruta ? 'destination' : 'query', destino);
    if (r.place_id) p.set(ruta ? 'destination_place_id' : 'query_place_id', r.place_id);
    return `https://www.google.com/maps/${ruta ? 'dir' : 'search'}/?${p}`;
  }

  /* Autocompletado de la dirección con Google Places (vía nuestro servidor). Si no está configurado, el campo es manual. */
  const nuevaSesion = () => (window.crypto && crypto.randomUUID ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`);
  async function montarDireccion(raiz) {
    const caja = $('[data-direccion]', raiz);
    if (!caja) return;
    const ayuda = $('[data-dir-estado]', caja);
    const oculto = (n) => $(`input[name="${n}"]`, caja);
    const alcaldia = $('input[name="alcaldia_id"]', caja);
    const campoDe = (n) => $(`[name="${n}"]`, caja);
    const cat = await catalogos();

    // 1) C.P. → alcaldía (automática) y colonias del catálogo SEPOMEX
    const cp = campoDe('cp');
    const verAlc = $('#alcaldia-ver', caja);
    const selCol = campoDe('colonia');
    let cpCargado = '';
    let coloniaDeseada = selCol.dataset.coloniaActual || '';
    const elegirColonia = (nombre) => {
      if (!nombre) return;
      const n = sinAcentos(nombre).replace(/^col(onia)?\.?\s+/, '');
      const op = [...selCol.options].find((o) => o.value && sinAcentos(o.value) === n)
        || [...selCol.options].find((o) => o.value && (sinAcentos(o.value).includes(n) || n.includes(sinAcentos(o.value))));
      if (op) selCol.value = op.value;
    };
    const cargarCp = async () => {
      if (!/^\d{5}$/.test(cp.value)) {
        cpCargado = ''; alcaldia.value = ''; verAlc.value = '';
        selCol.innerHTML = '<option value="">Escribe primero el C.P.</option>'; selCol.disabled = true;
        return;
      }
      if (cp.value === cpCargado) return;
      const valor = cp.value;
      ayuda.textContent = 'Buscando el código postal…';
      try {
        const r = await api(`/lugares/cp/${valor}`);
        if (cp.value !== valor) return;
        cpCargado = valor;
        alcaldia.value = r.alcaldia_id || '';
        verAlc.value = r.alcaldia;
        selCol.innerHTML = String(html`<option value="">Selecciona tu colonia (${r.colonias.length})</option>${r.colonias.map((c) => html`<option value="${c.nombre}">${c.nombre}${c.tipo && c.tipo !== 'Colonia' ? ` · ${c.tipo}` : ''}</option>`)}`);
        selCol.disabled = false;
        if (r.colonias.length === 1) selCol.value = r.colonias[0].nombre;
        elegirColonia(coloniaDeseada);
        coloniaDeseada = '';
        ayuda.textContent = `C.P. ${valor}: ${r.alcaldia}. Elige la colonia.`;
      } catch (e) {
        if (cp.value !== valor) return;
        cpCargado = ''; alcaldia.value = ''; verAlc.value = '';
        selCol.innerHTML = '<option value="">C.P. no válido</option>'; selCol.disabled = true;
        ayuda.textContent = e.status === 404 ? e.message : textoError(e, 'No se pudo consultar el código postal.');
      }
    };
    cp.addEventListener('input', () => { cp.value = cp.value.replace(/\D/g, '').slice(0, 5); cargarCp(); });
    await cargarCp();
    // Números en mayúsculas (15-B, S/N) y sin símbolos raros
    ['num_ext', 'num_int'].forEach((n) => campoDe(n).addEventListener('input', (e) => {
      e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9 ./\-]/g, '');
    }));
    // Si se edita a mano cualquier parte, las coordenadas anteriores ya no corresponden
    ['calle', 'num_ext', 'num_int', 'colonia', 'cp'].forEach((n) => campoDe(n).addEventListener('input', () => {
      if (!oculto('lat').value) return;
      oculto('lat').value = ''; oculto('lng').value = ''; oculto('place_id').value = '';
    }));
    selCol.addEventListener('change', () => { if (oculto('lat').value) { oculto('lat').value = ''; oculto('lng').value = ''; oculto('place_id').value = ''; } });

    if (estado.lugares === undefined) {
      try { estado.lugares = (await api('/lugares/estado', { auto: true })).activo; } catch { estado.lugares = false; }
    }
    if (!estado.lugares) return;
    $('[data-buscador]', caja).hidden = false;
    montarCalles(caja, cp, selCol);
    const campo = $('#buscar-dir', caja);
    const lista = $('.direccion__lista', caja);
    let sesion = nuevaSesion();
    let opciones = [];
    let activa = -1;
    let reloj;
    let pedido = 0;
    const cerrar = () => { lista.hidden = true; campo.setAttribute('aria-expanded', 'false'); campo.removeAttribute('aria-activedescendant'); activa = -1; };
    const marcar = (i) => {
      activa = i;
      $$('[role="option"]', lista).forEach((li, k) => li.setAttribute('aria-selected', String(k === i)));
      if (i >= 0) campo.setAttribute('aria-activedescendant', `dir-op-${i}`);
    };
    const pintar = () => {
      if (!opciones.length) return cerrar();
      lista.innerHTML = String(html`${opciones.map((o, i) => html`
        <li role="option" id="dir-op-${i}" data-i="${i}" aria-selected="false"><strong>${o.principal}</strong><span>${o.secundario}</span></li>`)}
        <li class="direccion__google" aria-hidden="true">con tecnología de Google</li>`);
      lista.hidden = false;
      campo.setAttribute('aria-expanded', 'true');
    };
    const elegir = async (o) => {
      cerrar();
      ayuda.textContent = 'Verificando dirección…';
      try {
        await rellenar(await api('/lugares/detalle', { metodo: 'POST', datos: { id: o.id, sesion } }));
      } catch (e) {
        ayuda.textContent = textoError(e, 'No se pudo consultar la dirección. Escríbala manualmente.');
      }
      sesion = nuevaSesion(); // cada búsqueda con su detalle es una sesión de cobro de Google
    };
    // "Usar mi ubicación actual": coordenadas del navegador → dirección (Google Geocoding) → campos
    $('[data-mi-ubicacion]', caja).addEventListener('click', async (e) => {
      const b = e.currentTarget;
      ocupado(b);
      ayuda.textContent = 'Obteniendo tu ubicación…';
      try {
        const pos = await ubicacionActual();
        ayuda.textContent = 'Buscando la dirección…';
        await rellenar(await api('/lugares/inversa', { metodo: 'POST', datos: pos }));
      } catch (err) {
        ayuda.textContent = err instanceof ErrorApi ? textoError(err) : err.message;
      } finally { ocupado(b, false); }
    });
    async function rellenar(d) {
      {
        campo.value = '';
        // Cada parte va a su campo; lo que Google no trae queda vacío para completarlo a mano
        campoDe('calle').value = d.calle || '';
        campoDe('num_ext').value = d.num_ext || '';
        cp.value = d.cp || '';
        coloniaDeseada = d.colonia || '';
        await cargarCp();
        elegirColonia(coloniaDeseada);
        oculto('lat').value = d.lat; oculto('lng').value = d.lng; oculto('place_id').value = d.place_id;
        const faltan = [['cp', 'código postal'], ['colonia', 'colonia'], ['calle', 'calle'], ['num_ext', 'número exterior']]
          .filter(([n]) => !campoDe(n).value).map(([, t]) => t);
        ayuda.innerHTML = String(html`📍 Ubicación verificada${faltan.length ? ` · completa: ${faltan.join(', ')}` : ''} · <a href="${mapaUrl(d)}" target="_blank" rel="noopener noreferrer">Ver en el mapa</a>`);
        const primero = faltan.length && campoDe({ calle: 'calle', 'número exterior': 'num_ext', colonia: 'colonia', 'código postal': 'cp' }[faltan[0]]);
        (primero || campoDe('num_int')).focus();
      }
    }

    campo.addEventListener('input', () => {
      clearTimeout(reloj);
      const texto = campo.value.trim();
      if (texto.length < 3) { opciones = []; return cerrar(); }
      reloj = setTimeout(async () => {
        const n = ++pedido;
        try {
          const r = await api('/lugares/sugerencias', { metodo: 'POST', datos: { texto, sesion } });
          if (n !== pedido) return;
          opciones = r.sugerencias || [];
          pintar();
        } catch { if (n === pedido) { opciones = []; cerrar(); } }
      }, 300);
    });
    campo.addEventListener('keydown', (e) => {
      if (lista.hidden) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); marcar((activa + 1) % opciones.length); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); marcar((activa - 1 + opciones.length) % opciones.length); }
      else if (e.key === 'Enter' && activa >= 0) { e.preventDefault(); elegir(opciones[activa]); }
      else if (e.key === 'Escape') cerrar();
    });
    lista.addEventListener('mousedown', (e) => {
      const li = e.target.closest('[role="option"]');
      if (!li) return;
      e.preventDefault(); // conserva el foco en el campo
      elegir(opciones[Number(li.dataset.i)]);
    });
    campo.addEventListener('blur', () => setTimeout(cerrar, 150));
  }

  /* 3) Calle: sugerencias de Google acotadas al C.P., la colonia y la alcaldía ya elegidos */
  function montarCalles(caja, cp, selCol) {
    const campo = $('#calle', caja);
    const lista = $('#calles-lista', caja);
    let sesion = nuevaSesion();
    let opciones = [];
    let activa = -1;
    let reloj;
    let pedido = 0;
    const cerrar = () => { lista.hidden = true; campo.setAttribute('aria-expanded', 'false'); campo.removeAttribute('aria-activedescendant'); activa = -1; };
    const marcar = (i) => {
      activa = i;
      $$('[role="option"]', lista).forEach((li, k) => li.setAttribute('aria-selected', String(k === i)));
      if (i >= 0) campo.setAttribute('aria-activedescendant', `calle-op-${i}`);
    };
    const elegir = (o) => { campo.value = o.calle; cerrar(); sesion = nuevaSesion(); campo.dispatchEvent(new Event('input')); $('[name="num_ext"]', caja).focus(); };
    campo.addEventListener('input', (e) => {
      if (!e.isTrusted) return;
      clearTimeout(reloj);
      const texto = campo.value.trim();
      if (texto.length < 2 || !/^\d{5}$/.test(cp.value) || !selCol.value) { opciones = []; return cerrar(); }
      reloj = setTimeout(async () => {
        const n = ++pedido;
        try {
          const r = await api('/lugares/calles', { metodo: 'POST', datos: { cp: cp.value, colonia: selCol.value, texto, sesion } });
          if (n !== pedido) return;
          opciones = r.calles || [];
          if (!opciones.length) return cerrar();
          lista.innerHTML = String(html`${opciones.map((o, i) => html`
            <li role="option" id="calle-op-${i}" data-i="${i}" aria-selected="false"><strong>${o.calle}</strong><span>${o.zona}</span></li>`)}
            <li class="direccion__google" aria-hidden="true">con tecnología de Google</li>`);
          lista.hidden = false;
          campo.setAttribute('aria-expanded', 'true');
        } catch { if (n === pedido) { opciones = []; cerrar(); } }
      }, 300);
    });
    campo.addEventListener('keydown', (e) => {
      if (lista.hidden) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); marcar((activa + 1) % opciones.length); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); marcar((activa - 1 + opciones.length) % opciones.length); }
      else if (e.key === 'Enter' && activa >= 0) { e.preventDefault(); elegir(opciones[activa]); }
      else if (e.key === 'Escape') cerrar();
    });
    lista.addEventListener('mousedown', (e) => {
      const li = e.target.closest('[role="option"]');
      if (!li) return;
      e.preventDefault();
      elegir(opciones[Number(li.dataset.i)]);
    });
    campo.addEventListener('blur', () => setTimeout(cerrar, 150));
  }

  /* Solo dígitos en los campos de teléfono */
  const soloDigitos = (raiz) => $$('input[type="tel"]', raiz).forEach((t) => t.addEventListener('input', () => { t.value = t.value.replace(/\D/g, '').slice(0, 10); }));

  /* ---------- RF-01 a RF-04: registro ---------- */
  async function vistaRegistro() {
    const cat = await catalogos();
    return {
      html: tarjetaCuenta('titulo-registro', 'Registro', '', html`
        <form class="formulario" novalidate data-registro>
          <fieldset class="campo campo--tipo">
            <legend class="campo__etiqueta">¿Cómo usarás Dopta?</legend>
            <div class="pregunta__opciones">
              <label class="opcion"><input type="radio" name="tipo" value="adoptante" checked><span class="opcion__texto">Quiero adoptar</span></label>
              <label class="opcion"><input type="radio" name="tipo" value="refugio"><span class="opcion__texto">Soy un refugio</span></label>
            </div>
          </fieldset>
          <div class="campo"><label class="campo__etiqueta" for="nombre" data-etq-nombre>Nombre completo</label>
            <input class="campo__entrada" id="nombre" name="nombre" type="text" placeholder="Tu nombre completo" autocomplete="name" maxlength="120" required></div>
          <div class="campo"><label class="campo__etiqueta" for="correo">Email</label>
            <input class="campo__entrada" id="correo" name="correo" type="email" placeholder="tu@email.com" autocomplete="email" maxlength="254" required></div>
          <div class="campo" data-solo-adoptante><label class="campo__etiqueta" for="telefono_adoptante">Teléfono celular</label>
            <input class="campo__entrada" id="telefono_adoptante" name="telefono_adoptante" type="tel" inputmode="numeric" maxlength="10" placeholder="10 dígitos" autocomplete="tel-national" required>
            <span class="campo__ayuda">Solo lo verá el refugio al que envíes una solicitud, para coordinar tu cita.</span></div>
          <div class="campo"><label class="campo__etiqueta" for="contrasena">Contraseña</label>
            <input class="campo__entrada" id="contrasena" name="contrasena" type="password" placeholder="••••••••" autocomplete="new-password" maxlength="64" required>
            <span class="campo__ayuda">De 8 a 64 caracteres, con al menos una letra y un número.</span></div>
          <div class="campo"><label class="campo__etiqueta" for="confirmar">Confirmar contraseña</label>
            <input class="campo__entrada" id="confirmar" name="confirmar" type="password" placeholder="••••••••" autocomplete="new-password" maxlength="64" required></div>
          <div class="formulario" data-solo-refugio hidden>
            <p class="seccion-form">Datos institucionales</p>
            ${camposRefugio(cat)}
          </div>
          <label class="campo campo--casilla" data-solo-adoptante data-mayor><input type="checkbox" name="mayor_edad" value="si"><span>Soy mayor de 18 años (requisito legal para adoptar en la CDMX).</span></label>
          <label class="campo campo--casilla"><input type="checkbox" name="aviso" value="si"><span>Acepto el <button class="enlace" type="button" data-ver-aviso>aviso de privacidad v1.0</button></span></label>
          <p class="mensaje mensaje--error" data-error role="alert"></p>
          <button class="boton-contorno" type="submit">Crear cuenta</button>
        </form>
        <p class="cuenta__pie">¿Ya tienes cuenta? <a href="#/login">Iniciar Sesión</a></p>`, true),
      montar(raiz) {
        const f = $('[data-registro]', raiz);
        const bloque = $('[data-solo-refugio]', f);
        const etq = $('[data-etq-nombre]', f);
        montarHorario(f);
        soloDigitos(f);
        montarDireccion(f);
        f.addEventListener('change', (e) => {
          if (e.target.name !== 'tipo') return;
          const ref = e.target.value === 'refugio';
          bloque.hidden = !ref;
          $$('[data-solo-adoptante]', f).forEach((x) => { x.hidden = ref; });
          etq.textContent = ref ? 'Nombre del refugio' : 'Nombre completo';
          f.nombre.placeholder = ref ? 'Ej. Refugio Patitas' : 'Tu nombre completo';
        });
        $('[data-ver-aviso]', f).addEventListener('click', () => dialogo({ titulo: 'Aviso de privacidad', cuerpo: AVISO_PRIVACIDAD, confirmar: 'Entendido', cancelar: '' }));
        f.addEventListener('submit', async (e) => {
          e.preventDefault();
          errorEn(f, '');
          const d = datosForm(f);
          const pass = f.contrasena.value;
          const tipo = d.tipo === 'refugio' ? 'refugio' : 'adoptante';
          let datos;
          try {
            if (!d.nombre || !d.correo || !pass) fallo(M.vacios);
            if (tipo === 'adoptante' && !V.nombre(d.nombre.replace(/\s+/g, ' '))) fallo(M.nombre);
            if (tipo === 'refugio' && !V.entre(d.nombre, 3, 120)) fallo(M.refugio);
            if (tipo === 'refugio' && !V.letras(d.nombre)) fallo(M.letras);
            revisarNombre(d.nombre, tipo === 'refugio' ? 'refugio' : 'persona');
            if (!V.correo(d.correo)) fallo(M.correo);
            revisarCorreo(d.correo);
            if (!V.contrasena(pass)) fallo(M.contrasena);
            if (pass !== f.confirmar.value) fallo(M.coinciden);
            datos = { tipo, nombre: d.nombre, correo: d.correo, contrasena: pass, confirmar: f.confirmar.value, aviso: f.aviso.checked };
            if (tipo === 'adoptante') {
              if (!V.telefono(d.telefono_adoptante)) fallo(M.telefono);
              if (!V.telefonoReal(d.telefono_adoptante)) fallo(M.telefonoReal);
              datos.telefono = d.telefono_adoptante;
              if (!f.mayor_edad.checked) fallo('Para adoptar debes ser mayor de 18 años. Confirma la casilla.');
              datos.mayor_edad = true;
            }
            if (tipo === 'refugio') Object.assign(datos, validarCamposRefugio(f, cat));
            if (!f.aviso.checked) fallo(M.aviso);
          } catch (err) { return errorEn(f, err.message); }
          const b = $('button[type="submit"]', f);
          ocupado(b);
          try {
            const r = await api('/auth/registro', { metodo: 'POST', datos });
            estado.flash = { tipo: 'exito', texto: r.mensaje === 'Cuenta creada' ? 'Cuenta creada. Ya puedes iniciar sesión.' : r.mensaje };
            location.hash = '#/login';
          } catch (err) {
            ocupado(b, false);
            errorEn(f, textoError(err, 'No se pudo completar el registro. Intente de nuevo en unos minutos.'));
          }
        });
      },
    };
  }

  /* ---------- RF-25: verificación rechazada, el refugio reenvía todos sus datos ---------- */
  async function vistaRechazada() {
    const cat = await catalogos();
    return {
      html: tarjetaCuenta('titulo-rechazada', 'Verificación rechazada', 'Su cuenta no fue verificada. Vuelva a enviar su solicitud de validación.', html`
        <form class="formulario" novalidate data-revalidar>
          <div class="campo"><label class="campo__etiqueta" for="correo">Email de la cuenta</label>
            <input class="campo__entrada" id="correo" name="correo" type="email" value="${estado.rechazado || ''}" maxlength="254" required></div>
          <div class="campo"><label class="campo__etiqueta" for="contrasena">Contraseña</label>
            <input class="campo__entrada" id="contrasena" name="contrasena" type="password" autocomplete="current-password" maxlength="64" required></div>
          <div class="campo"><label class="campo__etiqueta" for="nombre">Nombre del refugio</label>
            <input class="campo__entrada" id="nombre" name="nombre" type="text" maxlength="120" required></div>
          ${camposRefugio(cat)}
          <p class="mensaje mensaje--error" data-error role="alert"></p>
          <button class="boton-contorno" type="submit">Enviar solicitud de validación</button>
        </form>`, true),
      montar(raiz) {
        const f = $('[data-revalidar]', raiz);
        montarHorario(f);
        soloDigitos(f);
        montarDireccion(f);
        f.addEventListener('submit', async (e) => {
          e.preventDefault();
          let datos;
          try {
            const d = datosForm(f);
            if (!V.correo(d.correo)) fallo(M.correo);
            if (!V.entre(d.nombre, 3, 120)) fallo(M.refugio);
            if (!V.letras(d.nombre)) fallo(M.letras);
            revisarNombre(d.nombre, 'refugio');
            datos = { correo: d.correo, contrasena: f.contrasena.value, nombre: d.nombre, ...validarCamposRefugio(f, cat) };
          } catch (err) { return errorEn(f, err.message); }
          const b = $('button[type="submit"]', f);
          ocupado(b);
          try {
            const r = await api('/auth/revalidar', { metodo: 'POST', datos });
            estado.rechazado = null;
            estado.flash = { tipo: 'exito', texto: r.mensaje };
            location.hash = '#/login';
          } catch (err) { ocupado(b, false); errorEn(f, textoError(err)); }
        });
      },
    };
  }

  /* ---------- RF-08: recuperar contraseña ---------- */
  function vistaRecuperar() {
    return {
      html: tarjetaCuenta('titulo-recuperar', 'Recuperar contraseña', 'Te enviaremos un enlace de un solo uso, válido por 30 minutos.', html`
        <form class="formulario" novalidate data-recuperar>
          <div class="campo"><label class="campo__etiqueta" for="correo">Email de tu cuenta</label>
            <input class="campo__entrada" id="correo" name="correo" type="email" placeholder="tu@email.com" autocomplete="email" maxlength="254" required></div>
          <p class="mensaje mensaje--error" data-error role="alert"></p>
          <p class="mensaje mensaje--exito" data-ok role="status"></p>
          <button class="boton-contorno" type="submit">Enviar enlace</button>
        </form>
        <p class="cuenta__pie"><a href="#/login">Volver a iniciar sesión</a></p>`),
      montar(raiz) {
        const f = $('[data-recuperar]', raiz);
        f.addEventListener('submit', async (e) => {
          e.preventDefault();
          errorEn(f, '');
          $('[data-ok]', f).textContent = '';
          const correo = f.correo.value.trim();
          if (!V.correo(correo)) return errorEn(f, M.correo);
          const b = $('button[type="submit"]', f);
          ocupado(b);
          try {
            const r = await api('/auth/recuperar', { metodo: 'POST', datos: { correo } });
            $('[data-ok]', f).textContent = r.mensaje;
          } catch (err) { errorEn(f, textoError(err)); } finally { ocupado(b, false); }
        });
      },
    };
  }

  async function vistaRestablecer(ctx) {
    const token = ctx.query.get('token') || '';
    let problema = '';
    try { await api('/auth/recuperar/verificar', { metodo: 'POST', datos: { token } }); } catch (e) { problema = textoError(e); }
    if (problema) {
      return tarjetaCuenta('titulo-rest', 'Restablecer contraseña', '', html`
        <p class="mensaje mensaje--error" role="alert">${problema}</p>
        <p class="cuenta__pie"><a href="#/recuperar">Solicitar un enlace nuevo</a></p>`);
    }
    return {
      html: tarjetaCuenta('titulo-rest', 'Nueva contraseña', 'Elige una contraseña que no uses en otros sitios.', html`
        <form class="formulario" novalidate data-rest>
          <div class="campo"><label class="campo__etiqueta" for="nueva">Nueva contraseña</label>
            <input class="campo__entrada" id="nueva" name="nueva" type="password" autocomplete="new-password" maxlength="64" required>
            <span class="campo__ayuda">De 8 a 64 caracteres, con al menos una letra y un número.</span></div>
          <div class="campo"><label class="campo__etiqueta" for="confirmar">Confirmar contraseña</label>
            <input class="campo__entrada" id="confirmar" name="confirmar" type="password" autocomplete="new-password" maxlength="64" required></div>
          <p class="mensaje mensaje--error" data-error role="alert"></p>
          <button class="boton-contorno" type="submit">Guardar contraseña</button>
        </form>`),
      montar(raiz) {
        const f = $('[data-rest]', raiz);
        f.addEventListener('submit', async (e) => {
          e.preventDefault();
          if (!V.contrasena(f.nueva.value)) return errorEn(f, M.contrasena);
          if (f.nueva.value !== f.confirmar.value) return errorEn(f, M.coinciden);
          const b = $('button[type="submit"]', f);
          ocupado(b);
          try {
            const r = await api('/auth/restablecer', { metodo: 'POST', datos: { token, contrasena: f.nueva.value } });
            history.replaceState(null, '', '#/login'); // quita el token de la barra de direcciones
            estado.flash = { tipo: 'exito', texto: r.mensaje };
            navegar();
          } catch (err) { ocupado(b, false); errorEn(f, textoError(err)); }
        });
      },
    };
  }

  /* ---------- RF-07, RF-09, RF-10: mi cuenta ---------- */
  /* Silueta del usuario con sus iniciales y color propio (cambia según el tipo de cuenta) */
  function siluetaUsuario(nombre, tipo, grande = false) {
    const ini = String(nombre || '?').trim().split(/\s+/).filter((p) => /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(p)).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || '?';
    let tono = 0;
    for (const ch of String(nombre)) tono = (tono * 31 + ch.codePointAt(0)) % 997;
    const forma = tipo === 'refugio'
      ? '<path d="M14 54h36M18 54V30l14-10 14 10v24" stroke-width="3.2" fill="none"/><path d="M27 54v-9a5 5 0 0 1 10 0v9" stroke-width="3.2" fill="none"/>'
      : tipo === 'admin' || tipo === 'funcionario'
        ? '<path d="M32 12l17 6v11c0 11-7.5 19-17 23-9.5-4-17-12-17-23V18z" stroke-width="3.2" fill="none"/>'
        : '<circle cx="32" cy="25" r="10" stroke-width="3.2" fill="none"/><path d="M14 54c2-10 9.5-15 18-15s16 5 18 15" stroke-width="3.2" fill="none"/>';
    return html`<span class="silueta silueta--t${tono % 8}${grande ? ' silueta--grande' : ''}" aria-hidden="true">
      ${seguro(`<svg viewBox="0 0 64 64" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">${forma}</svg>`)}
      <span class="silueta__iniciales">${ini}</span></span>`;
  }
  /* Foto de perfil o, si no hay, la silueta con iniciales */
  const avatar = (u, tam = 'grande') => (u && Number(u.avatar_v) > 0
    ? html`<img class="avatar avatar--${tam}" src="/api/avatar/${u.id}?v=${u.avatar_v}" alt="" width="${tam === 'mini' ? 28 : tam === 'chico' ? 40 : 104}" height="${tam === 'mini' ? 28 : tam === 'chico' ? 40 : 104}" loading="lazy">`
    : tam === 'mini' ? html`<span class="avatar avatar--mini avatar--vacio" aria-hidden="true">${String(u && u.nombre || '?').trim()[0].toUpperCase()}</span>`
      : siluetaUsuario(u && u.nombre, u && u.tipo, tam === 'grande'));

  /* Recorta al centro en cuadrado de 256 px y comprime en WebP (o JPEG) para no pasar de 300 KB */
  async function prepararAvatar(file) {
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) fallo('La foto debe ser PNG, JPG o WebP.');
    if (file.size > 15 * 1024 * 1024) fallo('La foto es demasiado pesada (máximo 15 MB).');
    let img;
    try { img = await createImageBitmap(file); } catch { fallo('No se pudo leer la imagen. Prueba con otra.'); }
    const lado = Math.min(img.width, img.height);
    const c = document.createElement('canvas');
    c.width = 256; c.height = 256;
    c.getContext('2d').drawImage(img, (img.width - lado) / 2, (img.height - lado) / 2, lado, lado, 0, 0, 256, 256);
    img.close();
    for (const [tipo, q] of [['image/webp', 0.85], ['image/webp', 0.7], ['image/jpeg', 0.8]]) {
      const b = await new Promise((ok) => c.toBlob(ok, tipo, q));
      if (b && b.type === tipo && b.size <= 300 * 1024) return b;
    }
    return fallo('No se pudo comprimir la foto. Prueba con otra imagen.');
  }

  const tarjetaPerfil = (c) => html`
    <section class="panel perfil-tarjeta">
      <div class="perfil-tarjeta__foto">
        <span data-avatar>${avatar(c)}</span>
        <label class="boton-foto" title="Cambiar foto de perfil"><input type="file" accept="image/png,image/jpeg,image/webp" data-subir-avatar hidden><span aria-hidden="true">📷</span><span class="sr-only">Cambiar foto de perfil</span></label>
      </div>
      <div class="perfil-tarjeta__datos">
        <p class="perfil-tarjeta__nombre">${c.nombre}</p>
        <p class="perfil-tarjeta__rol">${{ adoptante: 'Adoptante', refugio: 'Refugio', admin: 'Administrador', funcionario: 'Funcionario' }[c.tipo]}${c.refugio ? ` · ${c.refugio.institucion}` : ''}</p>
        <p class="perfil-tarjeta__meta">${c.correo}${c.telefono ? ` · Tel. ${c.telefono}` : ''} · Miembro desde ${new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${String(c.creado).slice(0, 10)}T12:00:00Z`))}</p>
        <p class="acciones acciones--compactas">
          <button class="enlace" type="button" data-elegir-avatar>${Number(c.avatar_v) ? 'Cambiar foto' : 'Agregar foto de perfil'}</button>
          ${Number(c.avatar_v) ? html`· <button class="enlace" type="button" data-quitar-avatar>Quitar foto</button>` : ''}
        </p>
      </div>
    </section>`;

  function montarAvatar(raiz, c) {
    const input = $('[data-subir-avatar]', raiz);
    if (!input) return;
    const refrescar = (v) => {
      c.avatar_v = v;
      estado.usuario.avatar_v = v;
      navegar();
    };
    $('[data-elegir-avatar]', raiz).addEventListener('click', () => input.click());
    input.addEventListener('change', async () => {
      const file = input.files[0];
      input.value = '';
      if (!file) return;
      try {
        const blob = await prepararAvatar(file);
        const r = await api('/cuenta/avatar', { metodo: 'PUT', form: blob });
        aviso(r.mensaje);
        refrescar(r.avatar_v);
      } catch (e) { aviso(e instanceof ErrorApi ? textoError(e) : e.message, 'error'); }
    });
    const q = $('[data-quitar-avatar]', raiz);
    if (q) {
      q.addEventListener('click', async () => {
        const ok = await dialogo({ titulo: '¿Quitar tu foto de perfil?', texto: 'Se mostrará tu silueta con tus iniciales.', confirmar: 'Quitar foto', peligro: true });
        if (!ok) return;
        try { const r = await api('/cuenta/avatar', { metodo: 'DELETE' }); aviso(r.mensaje); refrescar(0); } catch (e) { aviso(textoError(e), 'error'); }
      });
    }
  }

  async function vistaCuenta() {
    const c = await api('/cuenta');
    const u = estado.usuario;
    const tema = raizDoc.getAttribute('data-theme') === 'oscuro' ? 'oscuro' : 'claro';
    return {
      html: html`
      <section class="principal principal--cuenta">
        <div class="contenedor contenedor--estrecho formulario">
          <h1 class="titulo-pagina">Mi cuenta</h1>
          ${tarjetaPerfil(c)}
          ${c.cambio_pendiente ? html`<p class="mensaje mensaje--aviso">Tienes un cambio de datos esperando la aprobación del Administrador (enviado el ${c.cambio_pendiente.creado_en}). Mientras, se muestran tus datos actuales.</p>` : ''}
          ${!['admin', 'funcionario'].includes(u.tipo) ? html`
          <section class="panel">
            <h2 class="panel__titulo">Datos de la cuenta</h2>
            <form class="formulario" novalidate data-nombre>
              <div class="campo"><label class="campo__etiqueta" for="nombre">${u.tipo === 'refugio' ? 'Nombre del refugio' : 'Nombre completo'}</label>
                <input class="campo__entrada" id="nombre" name="nombre" type="text" maxlength="120" value="${c.nombre}" required></div>
              ${u.tipo === 'refugio' ? html`<div class="campo"><label class="campo__etiqueta" for="institucion">Nombre de la institución</label>
                <input class="campo__entrada" id="institucion" name="institucion" type="text" maxlength="120" value="${c.refugio ? c.refugio.institucion : ''}" required></div>` : ''}
              <div class="campo"><span class="campo__etiqueta">Correo</span><p class="dato__valor">${c.correo}</p></div>
              ${u.tipo === 'refugio' ? html`<p class="campo__ayuda">Por seguridad, el cambio de nombre o institución lo aprueba el Administrador antes de publicarse.</p>` : ''}
              <p class="mensaje mensaje--error" data-error role="alert"></p>
              <button class="boton-contorno" type="submit">${u.tipo === 'refugio' ? 'Enviar cambio a revisión' : 'Guardar cambios'}</button>
            </form>
            ${u.tipo === 'adoptante' ? html`
            <form class="formulario formulario--linea" novalidate data-telefono>
              <div class="campo"><label class="campo__etiqueta" for="tel">Teléfono celular</label>
                <input class="campo__entrada" id="tel" name="telefono" type="tel" inputmode="numeric" maxlength="10" value="${c.telefono || ''}" placeholder="10 dígitos" required>
                <span class="campo__ayuda">${c.telefono ? 'Solo lo ven los refugios a los que envías una solicitud.' : 'Agrégalo: los refugios lo necesitan para coordinar tu cita.'}</span></div>
              <p class="mensaje mensaje--error" data-error role="alert"></p>
              <button class="boton-contorno" type="submit">Guardar teléfono</button>
            </form>` : ''}
            ${u.tipo === 'refugio' ? html`<p class="cuenta__pie"><a href="#/refugio/perfil">Editar teléfono, dirección y horario</a></p>` : ''}
          </section>` : ''}
          <section class="panel">
            <h2 class="panel__titulo">Cambiar contraseña</h2>
            <form class="formulario" novalidate data-pass>
              <div class="campo"><label class="campo__etiqueta" for="actual">Contraseña actual</label>
                <input class="campo__entrada" id="actual" name="actual" type="password" autocomplete="current-password" maxlength="64" required></div>
              <div class="campo"><label class="campo__etiqueta" for="nueva">Nueva contraseña</label>
                <input class="campo__entrada" id="nueva" name="nueva" type="password" autocomplete="new-password" maxlength="64" required>
                <span class="campo__ayuda">De 8 a 64 caracteres, con al menos una letra y un número, y distinta a la actual.</span></div>
              <p class="mensaje mensaje--error" data-error role="alert"></p>
              <button class="boton-contorno" type="submit">Guardar cambios</button>
            </form>
          </section>
          <section class="panel">
            <h2 class="panel__titulo">Ajustes</h2>
            <div class="ajustes__fila">
              <label class="ajustes__etiqueta" for="tema">Tema</label>
              <select class="ajustes__select" id="tema" data-tema><option value="claro"${si(tema === 'claro', 'selected')}>Claro</option><option value="oscuro"${si(tema === 'oscuro', 'selected')}>Oscuro</option></select>
            </div>
            <div class="ajustes__fila"><span class="ajustes__etiqueta">Aviso de privacidad aceptado</span><span>${c.aviso_version} · cuenta creada el ${String(c.creado).slice(0, 10)}</span></div>
          </section>
          ${!['admin', 'funcionario'].includes(u.tipo) ? html`
          <section class="panel">
            <h2 class="panel__titulo">Dar de baja la cuenta</h2>
            <p>Tu cuenta dejará de funcionar de inmediato y tus datos personales se eliminarán después de 30 días.</p>
            <div class="panel__acciones"><button class="boton-contorno boton-contorno--peligro" type="button" data-baja>Dar de baja cuenta</button></div>
          </section>` : ''}
        </div>
      </section>`,
      montar(raiz) {
        const fn = $('[data-nombre]', raiz);
        if (fn) {
          fn.addEventListener('submit', async (e) => {
            e.preventDefault();
            const d = datosForm(fn);
            const msg = 'El nombre debe tener de 2 a 100 caracteres, o de 3 a 120 caracteres para una institución.';
            if (u.tipo === 'adoptante' && !V.nombre(d.nombre)) return errorEn(fn, msg);
            if (u.tipo === 'refugio' && (!V.entre(d.nombre, 3, 120) || !V.entre(d.institucion, 3, 120))) return errorEn(fn, msg);
            const prob = u.tipo === 'refugio'
              ? problemaNombre(d.nombre, 'refugio') || problemaNombre(d.institucion, 'refugio')
              : problemaNombre(d.nombre, 'persona');
            if (prob) return errorEn(fn, prob);
            const b = $('button[type="submit"]', fn);
            ocupado(b);
            try {
              const r = await api('/cuenta/nombre', { metodo: 'PUT', datos: d });
              if (u.tipo !== 'refugio') estado.usuario.nombre = d.nombre;
              errorEn(fn, '');
              aviso(r.mensaje);
              if (r.pendiente !== undefined) navegar();
            } catch (err) { errorEn(fn, textoError(err)); } finally { ocupado(b, false); }
          });
        }
        const ft = $('[data-telefono]', raiz);
        if (ft) {
          soloDigitos(ft);
          ft.addEventListener('submit', async (e) => {
            e.preventDefault();
            const tel = ft.telefono.value.trim();
            if (!V.telefono(tel)) return errorEn(ft, M.telefono);
            if (!V.telefonoReal(tel)) return errorEn(ft, M.telefonoReal);
            const b = $('button[type="submit"]', ft);
            ocupado(b);
            try { aviso((await api('/cuenta/telefono', { metodo: 'PUT', datos: { telefono: tel } })).mensaje); errorEn(ft, ''); }
            catch (err) { errorEn(ft, textoError(err)); } finally { ocupado(b, false); }
          });
        }
        const fp = $('[data-pass]', raiz);
        fp.addEventListener('submit', async (e) => {
          e.preventDefault();
          if (!V.contrasena(fp.nueva.value)) return errorEn(fp, M.contrasena);
          if (fp.nueva.value === fp.actual.value) return errorEn(fp, 'La nueva contraseña debe ser distinta a la actual.');
          const b = $('button[type="submit"]', fp);
          ocupado(b);
          try {
            const r = await api('/cuenta/contrasena', { metodo: 'PUT', datos: { actual: fp.actual.value, nueva: fp.nueva.value } });
            fp.reset();
            errorEn(fp, '');
            aviso(r.mensaje);
          } catch (err) { errorEn(fp, textoError(err)); } finally { ocupado(b, false); }
        });
        montarAvatar(raiz, c);
        $('[data-tema]', raiz).addEventListener('change', (e) => { aplicarTema(e.target.value); guardarLS(CLAVE_TEMA, e.target.value); actualizarBotonTema(); });
        const bb = $('[data-baja]', raiz);
        if (bb) {
          bb.addEventListener('click', async () => {
            const ok = await dialogo({
              titulo: '¿Dar de baja tu cuenta?',
              texto: 'Esta acción cierra tu sesión. Confirma con tu contraseña actual.',
              cuerpo: html`<label class="campo"><span class="campo__etiqueta">Contraseña actual</span><input class="campo__entrada" name="contrasena" type="password" autocomplete="current-password" maxlength="64"></label>`,
              confirmar: 'Dar de baja',
              peligro: true,
              accion: (f) => api('/cuenta/baja', { metodo: 'POST', datos: { contrasena: f.contrasena.value } }),
            });
            if (ok) { limpiarSesionLocal(); aviso('Tu cuenta fue dada de baja.'); location.hash = '#/'; }
          });
        }
      },
    };
  }

  /* ---------- RF-24: notificaciones ---------- */
  async function vistaNotificaciones() {
    let lista;
    try { lista = await api('/notificaciones'); } catch (e) { lista = null; }
    return {
      html: html`
      <section class="principal">
        <div class="contenedor contenedor--estrecho">
          <h1 class="titulo-pagina">Notificaciones</h1>
          ${lista === null ? html`<p class="mensaje mensaje--error">No se pudo cargar la lista. Intente de nuevo.</p>`
    : !lista.length ? html`<div class="vacio">${seguro(SVG_HUELLA)}No tienes notificaciones.</div>`
      : html`
            <div class="acciones acciones--fin"><button class="boton-contorno boton-contorno--chico" type="button" data-todas${si(!lista.some((n) => !n.leida), 'disabled')}>Marcar todas como leídas</button></div>
            <ul class="filas">${lista.map((n) => html`
              <li class="fila fila--sin-imagen ${n.leida ? '' : 'fila--no-leida'} ${n.enlace && rutaPermitida(n.enlace, estado.usuario) ? 'fila--enlace' : ''}" data-id="${n.id}" data-enlace="${n.enlace && rutaPermitida(n.enlace, estado.usuario) ? n.enlace : ''}" tabindex="0" role="${n.enlace ? 'link' : 'button'}">
                <div><p class="fila__titulo">${n.texto}</p><p class="fila__meta">${String(n.creada_en).slice(0, 16)}${n.enlace ? ' · Toca para abrir' : ''}</p></div>
                <div class="fila__lado">${n.leida ? insignia('', 'Leída') : insignia('pendiente', 'No leída')}</div>
              </li>`)}</ul>`}
        </div>
      </section>`,
      montar(raiz) {
        // Al tocarla se marca como leída y, si menciona algo (una solicitud, una ficha), lleva a ese módulo
        const marcar = async (li) => {
          if (li.classList.contains('fila--no-leida')) {
            li.classList.remove('fila--no-leida');
            $('.fila__lado', li).innerHTML = String(insignia('', 'Leída'));
            await api(`/notificaciones/${li.dataset.id}/leida`, { metodo: 'POST' }).catch(() => {});
            actualizarYo();
          }
          if (li.dataset.enlace) location.hash = li.dataset.enlace;
        };
        $$('.fila', raiz).forEach((li) => {
          li.addEventListener('click', () => marcar(li));
          li.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); marcar(li); } });
        });
        const t = $('[data-todas]', raiz);
        if (t) t.addEventListener('click', async () => { await api('/notificaciones/leidas', { metodo: 'POST' }).catch(() => {}); await actualizarYo(); navegar(); });
      },
    };
  }

  /* ---------- RF-17: mis solicitudes ---------- */
  /* Lo que la persona adoptante envió (formato de adopción): visible para ambos lados */
  const resumenEnviado = (s, titulo = 'Lo que enviaste al refugio', abierto = false) => (s.resumen ? html`
    <details class="enviado"${si(abierto, 'open')}><summary>${titulo}</summary>
      <dl class="enviado__lista">${s.resumen.map(([k, v]) => html`<div><dt>${k}</dt><dd>${v}</dd></div>`)}</dl>
    </details>` : '');

  /* Conversación corta dentro de la solicitud */
  const burbujas = (mensajes) => (mensajes.length
    ? html`<ol class="chat__lista">${mensajes.map((m) => html`
        <li class="chat__msg${m.mio ? ' chat__msg--mio' : ''}"><p>${m.texto}</p><span class="chat__hora">${m.mio ? 'Tú' : m.autor_tipo === 'refugio' ? 'Refugio' : 'Adoptante'} · ${m.creado}</span></li>`)}</ol>`
    : html`<p class="chat__vacio">Aún no hay mensajes.</p>`);
  const conversacion = (s, abierto = false) => html`
    <details class="chat" data-chat="${s.id}"${si(abierto || s.sin_leer, 'open')}>
      <summary>Mensajes${s.mensajes.length ? ` (${s.mensajes.length})` : ''}${s.sin_leer ? html` <span class="chat__nuevos">${s.sin_leer} nuevo${s.sin_leer > 1 ? 's' : ''}</span>` : ''}</summary>
      <div data-burbujas>${burbujas(s.mensajes)}</div>
      ${s.puede_escribir ? html`
      <form class="chat__form" novalidate data-enviar-msg>
        <label class="sr-only" for="msg-${s.id}">Escribe un mensaje</label>
        <textarea class="campo__textarea chat__texto" id="msg-${s.id}" name="texto" maxlength="300" rows="2" placeholder="Mensaje corto (máx. 300 caracteres)"></textarea>
        <button class="boton-contorno boton-contorno--chico boton-contorno--relleno" type="submit">Enviar</button>
        <p class="mensaje mensaje--error" data-error role="alert"></p>
      </form>` : html`<p class="chat__vacio">La conversación está cerrada para esta solicitud.</p>`}
    </details>`;
  function montarConversaciones(raiz) {
    $$('[data-chat]', raiz).forEach((caja) => {
      const id = caja.dataset.chat;
      const refrescar = async () => {
        try { $('[data-burbujas]', caja).innerHTML = String(burbujas(await api(`/solicitudes/${id}/mensajes`))); } catch { /* se queda lo anterior */ }
        const n = $('.chat__nuevos', caja);
        if (n) { n.remove(); actualizarYo(); }
      };
      caja.addEventListener('toggle', () => { if (caja.open && $('.chat__nuevos', caja)) refrescar(); });
      const f = $('[data-enviar-msg]', caja);
      if (!f) return;
      f.addEventListener('submit', async (e) => {
        e.preventDefault();
        const b = $('button', f);
        try {
          const texto = revisarTexto(f.texto.value, { min: 2, max: 300, campo: 'El mensaje', minPalabras: 1, lineas: 4 });
          ocupado(b);
          await api(`/solicitudes/${id}/mensajes`, { metodo: 'POST', datos: { texto } });
          f.reset();
          errorEn(f, '');
          await refrescar();
        } catch (err) { errorEn(f, err instanceof ErrorApi ? textoError(err) : err.message); } finally { ocupado(b, false); }
      });
      f.texto.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) f.requestSubmit(); });
    });
  }