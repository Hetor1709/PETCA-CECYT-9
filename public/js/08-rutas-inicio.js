/* Dopta · Rutas y navegación, sesión e inactividad, efectos visuales e inicio (secciones 14-17)
   Los archivos de public/js/ se cargan como scripts clásicos, en orden (ver index.html), y comparten el mismo ámbito global. */
'use strict';

  /*  14. Rutas y navegación  */
  const RUTAS = [];
  const ruta = (patron, vista, acceso = null, titulo = '') => RUTAS.push({
    re: new RegExp(`^${patron.replace(/:(\w+)/g, '(?<$1>\\d{1,10})')}$`), vista, acceso, titulo,
  });
  const TODOS = ['adoptante', 'refugio', 'admin', 'funcionario'];
  ruta('/', vistaCatalogo, null, 'Catálogo');
  ruta('/animal/:id', vistaAnimal, null, 'Ficha');
  ruta('/cuestionario', vistaCuestionario, null, 'Cuestionario');
  ruta('/nosotros', vistaNosotros, null, 'Sobre nosotros');
  ruta('/refugios', vistaRefugios, null, 'Refugios');
  ruta('/refugios/:id', vistaPerfilRefugio, null, 'Refugio');
  ruta('/login', vistaLogin, 'invitado', 'Iniciar sesión');
  ruta('/registro', vistaRegistro, 'invitado', 'Registro');
  ruta('/recuperar', vistaRecuperar, 'invitado', 'Recuperar contraseña');
  ruta('/restablecer', vistaRestablecer, 'invitado', 'Nueva contraseña');
  ruta('/verificacion-rechazada', vistaRechazada, 'invitado', 'Verificación rechazada');
  ruta('/solicitudes', vistaMisSolicitudes, ['adoptante'], 'Mis solicitudes');
  ruta('/solicitar/:id', vistaSolicitar, ['adoptante'], 'Formato de adopción');
  ruta('/notificaciones', vistaNotificaciones, TODOS, 'Notificaciones');
  ruta('/cuenta', vistaCuenta, TODOS, 'Mi cuenta');
  ruta('/refugio', vistaRefugio, ['refugio'], 'Mis animales');
  ruta('/refugio/animal/nuevo', vistaFormAnimal, ['refugio'], 'Publicar');
  ruta('/refugio/animal/:id', vistaFormAnimal, ['refugio'], 'Editar');
  ruta('/refugio/solicitudes', vistaRefugioSolicitudes, ['refugio'], 'Solicitudes');
  ruta('/refugio/perfil', vistaRefugioPerfil, ['refugio'], 'Perfil');
  ruta('/refugio/estadisticas', vistaRefugioEstadisticas, ['refugio'], 'Estadísticas');
  ruta('/admin', vistaAdmin, ['admin', 'funcionario'], 'Administración');
  ruta('/admin/verificacion', vistaAdminVerificacion, ['admin'], 'Verificación');
  ruta('/admin/refugios', vistaAdminRefugios, ['admin'], 'Refugios');
  ruta('/admin/publicaciones', vistaAdminPublicaciones, ['admin'], 'Publicaciones');
  ruta('/admin/reportes', vistaAdminReportes, ['admin', 'funcionario'], 'Reportes');
  ruta('/admin/cuentas', vistaAdminCuentas, ['admin'], 'Cuentas');
  ruta('/admin/catalogos', vistaAdminCatalogos, ['admin'], 'Catálogos');
  ruta('/admin/estadisticas', vistaAdminEstadisticas, ['admin', 'funcionario'], 'Estadísticas');
  ruta('/404', vista404, null, 'No encontrada');
  ruta('/500', vista500, null, 'Error');
  const R404 = { vista: vista404, acceso: null, titulo: 'No encontrada' };

  function resolver() {
    const h = location.hash || '#/';
    if (!h.startsWith('#/')) { history.replaceState(null, '', '#/'); return resolver(); }
    const [p, qs = ''] = h.slice(1).split('?');
    const camino = p.replace(/\/+$/, '') || '/';
    for (const r of RUTAS) {
      const m = camino.match(r.re);
      if (m) return { r, params: m.groups || {}, query: new URLSearchParams(qs), camino, hash: h };
    }
    return { r: R404, params: {}, query: new URLSearchParams(), camino, hash: h };
  }

  function rutaPermitida(destino, usuario) {
    const camino = destino.slice(1).split('?')[0].replace(/\/+$/, '') || '/';
    const r = RUTAS.find((x) => x.re.test(camino));
    if (!r) return false;
    if (r.acceso === 'invitado') return !usuario;
    if (Array.isArray(r.acceso)) return !!usuario && r.acceso.includes(usuario.tipo);
    return true;
  }

  let generacion = 0;
  let caminoAnterior = null;
  async function navegar() {
    const g = ++generacion;
    const m = resolver();
    const u = estado.usuario;
    // Guardas de acceso: redirigen según la sesión y el rol
    if (m.r.acceso === 'invitado' && u) { location.replace(estado.panel); return; }
    if (Array.isArray(m.r.acceso)) {
      if (!u) {
        estado.flash = estado.flash || { tipo: 'info', texto: 'Inicie sesión para continuar.' };
        location.replace(`#/login?next=${encodeURIComponent(m.hash)}`);
        return;
      }
      if (!m.r.acceso.includes(u.tipo)) { aviso('No tiene permiso para ver esa página.', 'error'); location.replace(estado.panel); return; }
    }
    pintarNav(m.camino);
    document.title = `${m.r.titulo ? `${m.r.titulo} · ` : ''}Dopta`;
    let res;
    try {
      res = await m.r.vista(m);
    } catch (e) {
      if (g !== generacion) return;
      if (e instanceof ErrorApi && e.status === 401) return;
      if (e instanceof ErrorApi && e.status === 403) { aviso(e.message || 'No tiene permiso para ver esa página.', 'error'); location.replace(estado.panel); return; }
      console.error(e);
      if (e instanceof ErrorApi && e.datos && e.datos.codigo === 'BD') res = vista500(e.message, 'BASE DE DATOS NO DISPONIBLE');
      else if (e instanceof ErrorApi && e.status === 404) res = vista404();
      else if (e instanceof ErrorApi && e.status === 0) res = vista500('No hay conexión con el servidor. Revisa que esté encendido (npm start) y vuelve a intentar.', 'SIN CONEXIÓN');
      else if (e instanceof ErrorApi) res = vista500(e.message || undefined);
      else res = vista500('La página encontró un problema. Recarga con Ctrl + F5; si sigue, abre la consola (F12) y comparte el mensaje en rojo.', 'ERROR EN LA PÁGINA');
    }
    if (g !== generacion || res === '') return;
    const vistaHtml = res instanceof Seguro ? res : res.html;
    // Contenedor nuevo en cada vista: así no se acumulan escuchadores de vistas anteriores
    const limpio = app.cloneNode(false);
    app.replaceWith(limpio);
    app = limpio;
    app.innerHTML = String(vistaHtml);
    if (m.camino !== caminoAnterior) window.scrollTo({ top: 0 });
    caminoAnterior = m.camino;
    const r = $('[data-reintentar]', app);
    if (r) r.addEventListener('click', navegar);
    if (res && res.montar) res.montar(app);
    montarOjitos(app);
  }

  /* Botón "ojito" para mostrar u ocultar cualquier contraseña */
  function montarOjitos(raiz) {
    $$('input[type="password"]', raiz).forEach((inp) => {
      if (inp.closest('.clave')) return;
      const caja = document.createElement('span');
      caja.className = 'clave';
      inp.replaceWith(caja);
      caja.append(inp);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'clave__ojo';
      b.setAttribute('aria-label', 'Mostrar contraseña');
      b.setAttribute('aria-pressed', 'false');
      b.innerHTML = String(ICONO.ojo);
      b.addEventListener('click', () => {
        const ver = inp.type === 'password';
        inp.type = ver ? 'text' : 'password';
        b.setAttribute('aria-pressed', String(ver));
        b.setAttribute('aria-label', ver ? 'Ocultar contraseña' : 'Mostrar contraseña');
        b.innerHTML = String(ver ? ICONO.ojoCerrado : ICONO.ojo);
        inp.focus();
      });
      caja.append(b);
    });
  }

  /* Barra de navegación según el rol */
  function pintarNav(camino) {
    const nav = $('#nav');
    const u = estado.usuario;
    const actual = (h) => si(`#${camino}` === h || (h !== '#/' && `#${camino}`.startsWith(`${h}/`)), 'aria-current="page"');
    const campana = html`<a class="boton-pastilla boton-pastilla--icono campana" href="#/notificaciones" aria-label="Notificaciones${estado.noLeidas ? `: ${estado.noLeidas} sin leer` : ''}"${actual('#/notificaciones')}>${ICONO.campana}${estado.noLeidas ? html`<span class="campana__numero">${estado.noLeidas > 99 ? '99+' : estado.noLeidas}</span>` : ''}</a>`;
    const salir = html`<button class="boton-pastilla" type="button" data-salir>Cerrar sesión</button>`;
    const pastillaCuenta = u ? html`<a class="boton-pastilla boton-pastilla--cuenta" href="#/cuenta"${actual('#/cuenta')}>${avatar(u, 'mini')}<span>Mi cuenta</span></a>` : '';
    let enlaces;
    if (!u) {
      enlaces = html`
        <a class="boton-pastilla" href="#/" aria-label="Inicio"${actual('#/')}>${ICONO.casa}</a>
        <a class="boton-pastilla" href="#/refugios"${actual('#/refugios')}>Refugios</a>
        <a class="boton-pastilla" href="#/nosotros"${actual('#/nosotros')}>Sobre nosotros</a>
        <a class="boton-pastilla" href="#/registro"${actual('#/registro')}>Registrarse</a>
        <a class="boton-pastilla" href="#/login"${actual('#/login')}>Iniciar sesión</a>`;
    } else if (u.tipo === 'adoptante') {
      enlaces = html`
        <a class="boton-pastilla" href="#/" aria-label="Catálogo"${actual('#/')}>${ICONO.casa}</a>
        <a class="boton-pastilla" href="#/refugios"${actual('#/refugios')}>Refugios</a>
        <a class="boton-pastilla" href="#/solicitudes"${actual('#/solicitudes')}>Mis solicitudes</a>
        ${pastillaCuenta}
        ${campana}${salir}`;
    } else if (u.tipo === 'refugio') {
      enlaces = html`
        <a class="boton-pastilla" href="#/refugio"${si(camino === '/refugio' || camino.startsWith('/refugio/'), 'aria-current="page"')}>Mi refugio</a>
        <a class="boton-pastilla" href="#/" aria-label="Catálogo público"${actual('#/')}>${ICONO.casa}</a>
        ${pastillaCuenta}
        ${campana}${salir}`;
    } else {
      enlaces = html`
        <a class="boton-pastilla" href="#/admin"${si(camino.startsWith('/admin'), 'aria-current="page"')}>${u.tipo === 'admin' ? 'Administración' : 'Panel'}</a>
        <a class="boton-pastilla" href="#/" aria-label="Catálogo público"${actual('#/')}>${ICONO.casa}</a>
        ${pastillaCuenta}
        ${campana}${salir}`;
    }
    nav.innerHTML = String(enlaces);
    $('[data-logo]').setAttribute('href', estado.panel);
    const b = $('[data-salir]', nav);
    if (b) b.addEventListener('click', cerrarSesion);
  }

  /* ======================= 15. Sesión e inactividad (RF-06) ======================= */
  async function actualizarYo(auto = false) {
    try {
      const r = await api('/auth/yo', { auto });
      if (!r.usuario && estado.usuario) { sesionTerminada(r.expirada ? 'Su sesión terminó por inactividad. Inicie sesión de nuevo.' : 'Inicie sesión de nuevo.'); return; }
      const cambio = (r.noLeidas || 0) !== estado.noLeidas;
      estado.usuario = r.usuario;
      estado.panel = r.panel || '#/';
      estado.noLeidas = r.noLeidas || 0;
      if (r.expirada) estado.flash = { tipo: 'info', texto: 'Su sesión terminó por inactividad. Inicie sesión de nuevo.' };
      if (cambio) pintarNav(resolver().camino);
    } catch { /* sin conexión: se reintenta en el siguiente ciclo */ }
  }

  function limpiarSesionLocal() {
    estado.usuario = null;
    estado.panel = '#/';
    estado.noLeidas = 0;
    estado.perfil = null;
  }
  function sesionTerminada(mensaje) {
    limpiarSesionLocal();
    estado.flash = { tipo: 'info', texto: mensaje || 'Su sesión terminó por inactividad. Inicie sesión de nuevo.' };
    if (location.hash.startsWith('#/login')) navegar(); else location.hash = '#/login';
  }
  async function cerrarSesion() {
    const ok = await dialogo({
      titulo: '¿Quieres cerrar sesión?',
      texto: 'Tendrás que volver a escribir tu correo y contraseña para entrar.',
      confirmar: 'Cerrar sesión',
      cancelar: 'Seguir aquí',
    });
    if (!ok) return;
    try { await api('/auth/logout', { metodo: 'POST' }); } catch { /* se limpia igual */ }
    limpiarSesionLocal();
    aviso('Sesión cerrada.');
    if ((location.hash || '#/') === '#/') navegar(); else location.hash = '#/';
  }

  const INACTIVIDAD = 30 * 60 * 1000;
  let ultimaInteraccion = Date.now();
  ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach((ev) => window.addEventListener(ev, () => { ultimaInteraccion = Date.now(); }, { passive: true }));
  function vigilarInactividad() {
    setInterval(async () => {
      if (!estado.usuario) return;
      const t = Date.now();
      if (t - ultimaInteraccion >= INACTIVIDAD) {
        await api('/auth/logout', { metodo: 'POST' }).catch(() => {});
        sesionTerminada('Su sesión terminó por inactividad. Inicie sesión de nuevo.');
        return;
      }
      // Si el usuario sigue activo pero no ha hecho peticiones, se mantiene viva la sesión en el servidor
      if (t - ultimaInteraccion < 5 * 60 * 1000 && t - ultimaServidor > 5 * 60 * 1000) actualizarYo(false);
    }, 30000);
    setInterval(() => { if (estado.usuario && !document.hidden) actualizarYo(true); }, 60000);
  }

  /* ======================= 16. Efectos visuales ======================= */
  function actualizarBotonTema() {
    const boton = $('[data-tema-boton]');
    if (!boton) return;
    const oscuro = raizDoc.getAttribute('data-theme') === 'oscuro';
    const t = oscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';
    boton.setAttribute('aria-label', t);
    boton.setAttribute('title', t);
    boton.setAttribute('aria-pressed', String(oscuro));
  }
  function montarTema() {
    const boton = $('[data-tema-boton]');
    if (!boton) return;
    boton.addEventListener('click', () => {
      const sig = raizDoc.getAttribute('data-theme') === 'oscuro' ? 'claro' : 'oscuro';
      aplicarTema(sig);
      guardarLS(CLAVE_TEMA, sig);
      actualizarBotonTema();
      const sel = $('[data-tema]');
      if (sel) sel.value = sig;
    });
    actualizarBotonTema();
  }

  const reducirMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Pantalla de carga inicial */
  function pantallaCarga() {
    if (reducirMovimiento) return () => {};
    const inicio = performance.now();
    const p = document.createElement('div');
    p.className = 'cargando';
    p.setAttribute('role', 'status');
    p.innerHTML = '<img src="img/cargando.svg" alt="Cargando la página"><p>CARGANDO...</p>';
    document.body.appendChild(p);
    return () => setTimeout(() => { p.classList.add('cargando--oculto'); setTimeout(() => p.remove(), 500); }, Math.max(0, 900 - (performance.now() - inicio)));
  }

  /* Rebote tipo croqueta al llegar con fuerza al fondo del catálogo */
  function croquetas() {
    if (reducirMovimiento) return;
    const ZONA = 100;
    const RUEDA = 100;
    let acumulado = 0;
    let relojRueda;
    let reloj;
    let ultimaY = window.scrollY;
    const azar = (a, b) => a + Math.random() * (b - a);
    const enFondo = () => window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - ZONA;
    const golpear = () => {
      if (!$('.catalogo', app) || !$('.croquetas', app) || document.body.classList.contains('impacto')) return;
      acumulado = 0;
      $$('.croqueta-pieza', app).forEach((h) => {
        const lado = Math.random() < 0.5 ? -1 : 1;
        h.style.setProperty('--x', `${(lado * azar(40, 240)).toFixed(0)}px`);
        h.style.setProperty('--y', `${-azar(90, 320).toFixed(0)}px`);
        h.style.setProperty('--r', `${azar(-200, 200).toFixed(0)}deg`);
        h.style.setProperty('--d', `${azar(0.9, 1.5).toFixed(2)}s`);
        h.style.setProperty('--retraso', `${azar(0, 180).toFixed(0)}ms`);
      });
      document.body.classList.add('impacto');
      clearTimeout(reloj);
      reloj = setTimeout(() => document.body.classList.remove('impacto'), 1800);
    };
    window.addEventListener('scroll', () => {
      const d = window.scrollY - ultimaY;
      ultimaY = window.scrollY;
      if (d > 0 && enFondo()) golpear();
    }, { passive: true });
    window.addEventListener('wheel', (e) => {
      if (e.deltaY <= 0 || !enFondo()) return;
      acumulado += e.deltaY;
      clearTimeout(relojRueda);
      relojRueda = setTimeout(() => { acumulado = 0; }, 250);
      if (acumulado >= RUEDA) golpear();
    }, { passive: true });
  }

  /* ======================= 17. Inicio ======================= */
  /* Aviso de cookies: informativo (la única cookie es la de sesión, necesaria). Se recuerda en el navegador al pulsar "Entendido". */
  function montarCookies() {
    const caja = $('#cookies');
    if (!caja || leerLS('dopta-cookies') === '1') return;
    caja.hidden = false;
    $('[data-cookies-ok]', caja).addEventListener('click', () => { guardarLS('dopta-cookies', '1'); caja.hidden = true; });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    app = $('#app');
    montarCookies();
    const ocultarCarga = pantallaCarga();
    montarTema();
    croquetas();
    await actualizarYo(true);
    window.addEventListener('hashchange', navegar);
    await navegar();
    ocultarCarga();
    vigilarInactividad();
  });
