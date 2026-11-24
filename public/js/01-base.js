/* ==========================================================================
   Dopta · Tema, seguridad del cliente, cliente de la API y estado de la aplicación (secciones 1-4)
   Los archivos de public/js/ se cargan como scripts clásicos, en orden (ver index.html), y comparten el mismo ámbito global.
   ========================================================================== */
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
