/* ==========================================================================
   Dopta · Vistas del Administrador (sección 13)
   Los archivos de public/js/ se cargan como scripts clásicos, en orden (ver index.html), y comparten el mismo ámbito global.
   ========================================================================== */
'use strict';

  /* ======================= 13. Vistas del Administrador ======================= */
  const SECCIONES_ADMIN = [['#/admin', 'Resumen'], ['#/admin/verificacion', 'Verificación'], ['#/admin/refugios', 'Refugios'], ['#/admin/publicaciones', 'Publicaciones'],
    ['#/admin/reportes', 'Reportes'], ['#/admin/cuentas', 'Cuentas'], ['#/admin/catalogos', 'Catálogos'], ['#/admin/estadisticas', 'Estadísticas']];
  const SECCIONES_FUNC = ['#/admin', '#/admin/reportes', '#/admin/estadisticas'];
  const MOTIVOS_PUBLICACION = ['Animal no doméstico', 'Contenido inapropiado', 'Información falsa', 'Otro'];
  const marcoAdmin = (actual, titulo, contenido) => html`
    <section class="principal">
      <h1 class="titulo-pagina">${titulo}</h1>
      <nav class="pestanas pestanas--admin" aria-label="Secciones de administración">
        ${SECCIONES_ADMIN.filter(([h]) => estado.usuario.tipo === 'admin' || SECCIONES_FUNC.includes(h))
    .map(([h, t]) => html`<a class="pestana" href="${h}"${si(h === actual, 'aria-current="page"')}>${t}</a>`)}
      </nav>
      <div class="contenedor">${contenido}</div>
    </section>`;

  async function vistaAdmin() {
    const r = await api('/admin/resumen');
    const esAdmin = r.rol === 'admin';
    return {
      html: marcoAdmin('#/admin', esAdmin ? 'Panel de administración' : 'Panel de funcionario', html`
        ${esAdmin && r.erroresNotificacion.length ? html`
          <div class="mensaje mensaje--error">No se pudo notificar al usuario de la solicitud o del animal. (${r.erroresNotificacion.length})
            <button class="enlace" type="button" data-revisados>Marcar como revisado</button></div><br>` : ''}
        <div class="tablero">
          ${esAdmin ? html`
          <a href="#/admin/verificacion"><article class="cifra cifra--durazno"><span class="cifra__numero">${r.refugiosPendientes}</span><span class="cifra__texto">refugios por verificar</span></article></a>
          <a href="#/admin/refugios?vista=cambios"><article class="cifra cifra--durazno"><span class="cifra__numero">${r.cambiosPendientes}</span><span class="cifra__texto">cambios de datos por aprobar</span></article></a>` : ''}
          <a href="#/admin/reportes"><article class="cifra cifra--azul"><span class="cifra__numero">${r.reportesAbiertos}</span><span class="cifra__texto">reportes abiertos</span></article></a>
          <a href="#/admin/estadisticas"><article class="cifra cifra--blanco"><span class="cifra__numero">📊</span><span class="cifra__texto">estadísticas y CSV</span></article></a>
        </div>`),
      montar(raiz) {
        const b = $('[data-revisados]', raiz);
        if (b) b.addEventListener('click', async () => { await api('/admin/errores-notificacion/revisados', { metodo: 'POST' }).catch(() => {}); navegar(); });
      },
    };
  }

  /* Bloque de verificación en Google Maps: la búsqueda que arma Dopta con los datos del refugio */
  const bloqueMapa = (m, titulo = 'Comprobar en Google Maps') => html`
    <div class="mapa-verificar">
      <p class="mapa-verificar__titulo">${titulo}</p>
      <p class="mapa-verificar__consulta"><code>${m.consulta}</code></p>
      ${m.embed ? html`<iframe class="mapa-verificar__marco" src="${m.embed}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="Mapa: ${m.consulta}"></iframe>` : ''}
      <p class="acciones acciones--compactas">
        <a class="boton-contorno boton-contorno--chico" href="${m.url}" target="_blank" rel="noopener noreferrer">Buscar el refugio ↗</a>
        <a class="boton-contorno boton-contorno--chico" href="${m.soloDireccion}" target="_blank" rel="noopener noreferrer">Solo la dirección ↗</a>
      </p>
    </div>`;
  const listaHorario = (horario) => html`<ul class="horario-lista">${(horario || []).map((h) => html`<li><span>${DIAS[h.dia]}</span><span>${Number(h.cerrado) ? 'Cerrado' : `${h.abre}–${h.cierra}`}</span></li>`)}</ul>`;

  /* RF-25 */
  async function vistaAdminVerificacion() {
    const lista = await api('/admin/refugios-pendientes');
    return {
      html: marcoAdmin('#/admin/verificacion', 'Verificar refugios', !lista.length
        ? html`<div class="vacio contenedor--estrecho contenedor">${seguro(SVG_HUELLA)}No hay refugios pendientes de verificación.</div>`
        : html`<ul class="filas contenedor contenedor--estrecho">${lista.map((x) => html`
          <li class="fila fila--sin-imagen fila--verificar">
            <div class="fila__cuerpo">
              <p class="fila__titulo">${x.nombre} ${x.plazo_vencido ? insignia('vencido', 'Plazo vencido') : ''}</p>
              <p class="fila__meta">${x.institucion} · ${x.correo}</p>
              <p class="fila__meta">Registro: ${String(x.creado).slice(0, 16)} · Aviso ${x.aviso_version} aceptado ${String(x.aviso_fecha).slice(0, 16)}</p>
              <p class="fila__detalle">${x.direccion}${x.alcaldia ? `, ${x.alcaldia}` : ''} · Tel. ${x.telefono} ${x.lat ? '· 📍 ubicación verificada por Google' : '· ubicación escrita a mano'}</p>
              ${listaHorario(x.horario)}
              ${x.coincidencias.length ? html`<div class="mensaje mensaje--aviso">⚠️ Mismo teléfono o dirección que: ${x.coincidencias.map((c) => `${c.nombre} (${ETQ[c.estado] || c.estado})`).join(', ')}</div>` : ''}
              ${bloqueMapa(x.mapa)}
              <div class="acciones">
                <button class="boton-contorno boton-contorno--chico boton-contorno--relleno" type="button" data-aceptar="${x.id}">Aceptar</button>
                <button class="boton-contorno boton-contorno--chico boton-contorno--peligro" type="button" data-rechazar="${x.id}">Rechazar</button>
              </div>
            </div>
          </li>`)}</ul>`),
      montar(raiz) {
        raiz.addEventListener('click', async (e) => {
          const b = e.target.closest('[data-aceptar], [data-rechazar]');
          if (!b) return;
          const aceptar = !!b.dataset.aceptar;
          const id = b.dataset.aceptar || b.dataset.rechazar;
          const x = lista.find((r) => r.id === Number(id));
          const ok = await dialogo({
            titulo: aceptar ? 'Aceptar refugio' : 'Rechazar refugio',
            texto: aceptar ? `${x.nombre} podrá iniciar sesión y publicar animales. ¿Comprobaste en el mapa que existe?` : `${x.nombre} verá el motivo y podrá corregir y reenviar sus datos.`,
            cuerpo: aceptar ? '' : html`<label class="campo"><span class="campo__etiqueta">Motivo del rechazo</span><textarea class="campo__textarea" name="motivo" maxlength="300" placeholder="Ej. No encontramos el refugio en la dirección indicada (10 a 300 caracteres)"></textarea></label>`,
            confirmar: aceptar ? 'Aceptar' : 'Rechazar', peligro: !aceptar,
            accion: async (f) => {
              const datos = aceptar ? undefined : { motivo: revisarTexto(f.motivo.value, { min: 10, max: 300, campo: 'El motivo', minPalabras: 2, lineas: 2 }) };
              await api(`/admin/refugios/${id}/${aceptar ? 'aceptar' : 'rechazar'}`, { metodo: 'POST', datos });
            },
          });
          if (ok) { aviso(aceptar ? 'Cuenta verificada.' : 'Cuenta rechazada.'); navegar(); }
        });
      },
    };
  }

  /* Refugios: tabla con indicadores, ficha de detalle y cambios de datos por aprobar */
  const valorCambio = (k, v, alcaldias) => {
    if (v == null || v === '') return '—';
    if (k === 'horario') return v.map((h) => `${DIAS[h.dia].slice(0, 3)} ${Number(h.cerrado) ? 'cerrado' : `${h.abre}–${h.cierra}`}`).join(' · ');
    if (k === 'alcaldia_id') return (alcaldias.find((a) => a.id === Number(v)) || {}).nombre || v;
    return String(v);
  };
  const CAMPOS_VISIBLES = ['nombre', 'institucion', 'direccion', 'colonia', 'cp', 'alcaldia_id', 'telefono', 'horario'];
  const ETQ_CAMPO = { nombre: 'Nombre', institucion: 'Institución', direccion: 'Dirección', colonia: 'Colonia', cp: 'C.P.', alcaldia_id: 'Alcaldía', telefono: 'Teléfono', horario: 'Horario' };

  async function vistaAdminRefugios(ctx) {
    const vista = ctx.query.get('vista') === 'cambios' ? 'cambios' : 'lista';
    const detalle = idValido(ctx.query.get('id'));
    const cat = await catalogos();
    const filtros = { q: (ctx.query.get('q') || '').slice(0, 60), estado: ctx.query.get('estado') || '', alcaldia: ctx.query.get('alcaldia') || '', orden: ctx.query.get('orden') || 'nombre' };
    const [lista, cambios, x] = await Promise.all([
      vista === 'lista' ? api(conQuery('/admin/refugios', filtros)) : [],
      api('/admin/refugio-cambios'),
      detalle ? api(`/admin/refugios/${detalle}`) : null,
    ]);
    const tabs = html`<div class="pestanas">
      <a class="pestana" href="#/admin/refugios"${si(vista === 'lista' && !detalle, 'aria-current="page"')}>Todos</a>
      <a class="pestana" href="#/admin/refugios?vista=cambios"${si(vista === 'cambios', 'aria-current="page"')}>Cambios por aprobar${cambios.length ? html` <span class="pestana__n">${cambios.length}</span>` : ''}</a></div>`;
    const tablaCambio = (c) => html`<table class="tabla tabla--comparar"><thead><tr><th>Dato</th><th>Actual</th><th>Nuevo</th></tr></thead><tbody>
      ${CAMPOS_VISIBLES.filter((k) => k in c.datos).map((k) => html`<tr><th scope="row">${ETQ_CAMPO[k]}</th><td data-col="Actual">${valorCambio(k, c.anteriores[k], cat.alcaldia)}</td><td data-col="Nuevo"><strong>${valorCambio(k, c.datos[k], cat.alcaldia)}</strong></td></tr>`)}
      </tbody></table>`;
    let cuerpo;
    if (detalle && x) {
      const kpi = [['Disponibles', x.animales.filter((a) => a.estado === 'disponible' && !Number(a.eliminado)).length], ['Adoptados', x.animales.filter((a) => a.estado === 'adoptado').length],
        ['Días promedio a adopción', x.dias_promedio_adopcion ?? '—'], ['Reportes', x.reportes.length]];
      cuerpo = html`
        ${botonRegresar('#/admin/refugios')}
        <section class="panel panel--ancho">
          <div class="perfil-admin">
            ${avatar({ id: x.id, nombre: x.nombre, avatar_v: x.avatar_v })}
            <div><h2 class="panel__titulo">${x.nombre} ${insignia(x.estado, ETQ[x.estado] || x.estado)}</h2>
              <p class="fila__meta">${x.institucion} · ${x.correo} · Tel. ${x.telefono}</p>
              <p class="fila__meta">Alta ${String(x.creado).slice(0, 10)}${x.verificado_en ? ` · Verificado ${String(x.verificado_en).slice(0, 10)}` : ''}</p></div>
          </div>
          <div class="cifras cifras--cuatro">${kpi.map(([t, n]) => html`<article class="cifra cifra--blanco"><span class="cifra__numero">${n}</span><span class="cifra__texto">${t}</span></article>`)}</div>
          <div class="dos-columnas">
            <div><h3 class="subtitulo">Ubicación y horario</h3><p class="fila__detalle">${x.direccion}${x.alcaldia ? `, ${x.alcaldia}` : ''}</p>${listaHorario(x.horario)}</div>
            ${bloqueMapa(x.mapa)}
          </div>
          <h3 class="subtitulo">Animales (${x.animales.length})</h3>
          ${!x.animales.length ? html`<p class="nota">Sin publicaciones.</p>` : html`<table class="tabla"><thead><tr><th>Animal</th><th>Publicado</th><th>Solicitudes</th><th>Estado</th></tr></thead><tbody>
            ${x.animales.map((a) => html`<tr><td data-col="Animal">${Number(a.eliminado) ? a.nombre : html`<a class="enlace" href="#/animal/${a.id}">${a.nombre}</a>`}</td><td data-col="Publicado">${a.publicado}</td><td data-col="Solicitudes">${a.solicitudes}</td>
              <td>${Number(a.eliminado) ? insignia('eliminada', 'Eliminado') : insignia(a.estado, ETQ[a.estado])}</td></tr>`)}</tbody></table>`}
          ${x.reportes.length ? html`<h3 class="subtitulo">Reportes recibidos</h3><ul class="lista-simple">${x.reportes.map((rp) => html`<li><strong>${rp.motivo}</strong> · ${rp.creado} · ${ETQ[rp.estado]}<br><span class="texto-largo">${rp.descripcion}</span></li>`)}</ul>` : ''}
          ${x.cambios.length ? html`<h3 class="subtitulo">Historial de cambios de datos</h3>${x.cambios.map((c) => html`<p class="fila__meta">${c.creado} · ${ETQ[c.estado] || c.estado}${c.motivo ? ` · ${c.motivo}` : ''}</p>${tablaCambio(c)}`)}` : ''}
        </section>`;
    } else if (vista === 'cambios') {
      cuerpo = html`${tabs}${!cambios.length ? html`<div class="vacio">No hay cambios de datos esperando aprobación.</div>` : html`
        <ul class="filas">${cambios.map((c) => html`
          <li class="fila fila--sin-imagen"><div class="fila__cuerpo">
            <p class="fila__titulo"><a class="enlace" href="#/admin/refugios?id=${c.refugio_id}">${c.nombre}</a> · ${c.institucion}</p>
            <p class="fila__meta">${c.correo} · Solicitado ${c.creado}</p>
            ${tablaCambio(c)}
            ${('direccion' in c.datos || 'institucion' in c.datos || 'nombre' in c.datos) ? html`<div class="dos-columnas">${bloqueMapa(c.mapa_actual, 'Datos actuales')}${bloqueMapa(c.mapa_nuevo, 'Datos nuevos')}</div>` : ''}
            <div class="acciones">
              <button class="boton-contorno boton-contorno--chico boton-contorno--relleno" type="button" data-aprobar-cambio="${c.id}">Aprobar y aplicar</button>
              <button class="boton-contorno boton-contorno--chico boton-contorno--peligro" type="button" data-rechazar-cambio="${c.id}">Rechazar</button>
            </div></div></li>`)}</ul>`}`;
    } else {
      const ORDENES = [['nombre', 'Nombre'], ['recientes', 'Más recientes'], ['adopciones', 'Más adopciones'], ['reportes', 'Más reportes']];
      const tot = (k) => lista.reduce((a, y) => a + Number(y[k] || 0), 0);
      cuerpo = html`${tabs}
        <form class="busqueda-admin" data-filtros>
          <input class="campo__entrada" name="q" type="search" placeholder="Nombre, institución, correo o teléfono" value="${filtros.q}" maxlength="60">
          <select class="campo__entrada" name="estado"><option value="">Todos los estados</option>${['activa', 'pendiente', 'rechazada', 'baja', 'eliminada'].map((e) => html`<option value="${e}"${si(e === filtros.estado, 'selected')}>${ETQ[e] || e}</option>`)}</select>
          <select class="campo__entrada" name="alcaldia"><option value="">Todas las alcaldías</option>${activos(cat.alcaldia).map((a) => html`<option value="${a.id}"${si(String(a.id) === filtros.alcaldia, 'selected')}>${a.nombre}</option>`)}</select>
          <select class="campo__entrada" name="orden">${ORDENES.map(([v, t]) => html`<option value="${v}"${si(v === filtros.orden, 'selected')}>${t}</option>`)}</select>
          <button class="boton-contorno boton-contorno--chico" type="submit">Filtrar</button>
        </form>
        <div class="cifras cifras--cuatro">
          ${[['Refugios', lista.length], ['Perros disponibles', tot('disponibles')], ['Adoptados', tot('adoptados')], ['Solicitudes activas', tot('activas')]]
    .map(([t, n]) => html`<article class="cifra cifra--blanco"><span class="cifra__numero">${n}</span><span class="cifra__texto">${t}</span></article>`)}
        </div>
        ${!lista.length ? html`<div class="vacio">No hay refugios con estos filtros.</div>` : html`
        <div class="tabla-desliza"><table class="tabla tabla--refugios">
          <thead><tr><th>Refugio</th><th>Alcaldía</th><th>Estado</th><th class="num">Disp.</th><th class="num">Adopt.</th><th class="num">Activas</th><th class="num">Reportes</th><th></th></tr></thead>
          <tbody>${lista.map((y) => html`<tr>
            <td data-col="Refugio"><a class="enlace" href="#/admin/refugios?id=${y.id}"><strong>${y.nombre}</strong></a><br><span class="fila__meta">${y.institucion} · Tel. ${y.telefono}</span></td>
            <td data-col="Alcaldía">${y.alcaldia || '—'}</td>
            <td>${insignia(y.estado, ETQ[y.estado] || y.estado)}${Number(y.cambios) ? html` <span class="insignia insignia--pendiente">cambio</span>` : ''}</td>
            <td class="num" data-col="Disponibles">${y.disponibles}</td><td class="num" data-col="Adoptados">${y.adoptados}</td><td class="num" data-col="Activas">${y.activas}</td>
            <td class="num" data-col="Reportes">${Number(y.reportes) ? html`<strong class="texto-alerta">${y.reportes}</strong>` : 0}</td>
            <td><a class="boton-contorno boton-contorno--chico" href="${y.mapa.url}" target="_blank" rel="noopener noreferrer" title="${y.mapa.consulta}">Mapa ↗</a></td>
          </tr>`)}</tbody></table></div>`}`;
    }
    return {
      html: marcoAdmin('#/admin/refugios', 'Refugios', cuerpo),
      montar(raiz) {
        const f = $('[data-filtros]', raiz);
        if (f) f.addEventListener('submit', (e) => { e.preventDefault(); location.hash = conQuery('#/admin/refugios', { q: f.q.value.trim(), estado: f.estado.value, alcaldia: f.alcaldia.value, orden: f.orden.value === 'nombre' ? '' : f.orden.value }); });
        raiz.addEventListener('click', async (e) => {
          const ap = e.target.closest('[data-aprobar-cambio]');
          const re = e.target.closest('[data-rechazar-cambio]');
          if (!ap && !re) return;
          const id = (ap || re).dataset.aprobarCambio || (re && re.dataset.rechazarCambio);
          const ok = await dialogo({
            titulo: ap ? 'Aprobar cambio de datos' : 'Rechazar cambio de datos',
            texto: ap ? 'Los nuevos datos se publicarán de inmediato en el perfil del refugio.' : 'El refugio conservará sus datos actuales y verá el motivo.',
            cuerpo: ap ? '' : html`<label class="campo"><span class="campo__etiqueta">Motivo</span><textarea class="campo__textarea" name="motivo" maxlength="300" placeholder="10 a 300 caracteres"></textarea></label>`,
            confirmar: ap ? 'Aprobar' : 'Rechazar', peligro: !ap,
            accion: async (fm) => {
              const datos = ap ? undefined : { motivo: revisarTexto(fm.motivo.value, { min: 10, max: 300, campo: 'El motivo', minPalabras: 2, lineas: 2 }) };
              const r = await api(`/admin/refugio-cambios/${id}/${ap ? 'aprobar' : 'rechazar'}`, { metodo: 'POST', datos });
              aviso(r.mensaje);
            },
          });
          if (ok) navegar();
        });
      },
    };
  }

  /* RF-26 / RF-27 */
  async function vistaAdminPublicaciones(ctx) {
    const pagina = idValido(ctx.query.get('pagina')) || 1;
    const r = await api(`/admin/publicaciones?pagina=${pagina}`);
    return {
      html: marcoAdmin('#/admin/publicaciones', 'Publicaciones', !r.publicaciones.length
        ? html`<div class="vacio">No hay publicaciones registradas.</div>`
        : html`
          <table class="tabla">
            <thead><tr><th>Publicada</th><th>Animal</th><th>Raza</th><th>Refugio</th><th>Estado</th><th></th></tr></thead>
            <tbody>${r.publicaciones.map((p) => html`
              <tr>
                <td data-col="Publicada">${p.publicado}</td>
                <td data-col="Animal"><strong>${p.nombre}</strong></td>
                <td data-col="Raza">${nombreRaza(p)}</td>
                <td data-col="Refugio">${p.refugio}</td>
                <td>${insignia(p.estado, ETQ[p.estado])}</td>
                <td><div class="acciones">${p.estado === 'disponible' ? html`<a class="boton-contorno boton-contorno--chico" href="#/animal/${p.id}">Ver</a>` : ''}
                  <button class="boton-contorno boton-contorno--chico boton-contorno--peligro" type="button" data-eliminar="${p.id}">Eliminar</button></div></td>
              </tr>`)}</tbody>
          </table>
          ${paginacion(r.pagina, r.total, r.porPagina)}`),
      montar(raiz) {
        $$('[data-pagina]', raiz).forEach((b) => b.addEventListener('click', () => { location.hash = `#/admin/publicaciones?pagina=${b.dataset.pagina}`; }));
        $$('[data-eliminar]', raiz).forEach((b) => b.addEventListener('click', async () => {
          const p = r.publicaciones.find((x) => x.id === Number(b.dataset.eliminar));
          const ok = await dialogo({
            titulo: `Eliminar publicación de ${p.nombre}`, confirmar: 'Eliminar', peligro: true,
            texto: 'Se retirará del catálogo y se notificará al refugio.',
            cuerpo: html`
              <label class="campo"><span class="campo__etiqueta">Motivo</span><select class="campo__entrada" name="motivo"><option value="">Selecciona un motivo</option>${MOTIVOS_PUBLICACION.map((m) => html`<option>${m}</option>`)}</select></label>
              <label class="campo" data-otro hidden><span class="campo__etiqueta">Descripción</span><textarea class="campo__textarea" name="descripcion" maxlength="300" placeholder="10 a 300 caracteres"></textarea></label>`,
            montar: (d) => $('[name="motivo"]', d).addEventListener('change', (e) => { $('[data-otro]', d).hidden = e.target.value !== 'Otro'; }),
            accion: async (f) => {
              if (!MOTIVOS_PUBLICACION.includes(f.motivo.value)) fallo('Seleccione un motivo.');
              if (f.motivo.value === 'Otro' && !V.entre(f.descripcion.value.trim(), 10, 300)) fallo('La descripción debe tener de 10 a 300 caracteres.');
              await api(`/admin/publicaciones/${p.id}/eliminar`, { metodo: 'POST', datos: { motivo: f.motivo.value, descripcion: f.descripcion.value.trim() } });
            },
          });
          if (ok) { aviso('Publicación eliminada.'); navegar(); }
        }));
      },
    };
  }

  /* RF-34: reportes de adoptantes (sobre publicaciones y refugios) y de refugios (sobre adoptantes) */
  const ETQ_OBJETIVO = { animal: 'Publicación', refugio: 'Refugio', usuario: 'Adoptante' };
  async function vistaAdminReportes(ctx) {
    const filtro = ['abierto', 'resuelto', 'descartado'].includes(ctx.query.get('estado')) ? ctx.query.get('estado') : 'abierto';
    const pagina = idValido(ctx.query.get('pagina')) || 1;
    const r = await api(`/admin/reportes?estado=${filtro}&pagina=${pagina}`);
    const esAdmin = estado.usuario.tipo === 'admin';
    const enlaceObjetivo = (x) => {
      if (!x.objetivo) return 'ya no existe';
      if (x.objetivo_tipo === 'animal') return html`<a class="enlace" href="#/animal/${x.objetivo_id}">${x.objetivo}</a>`;
      if (x.objetivo_tipo === 'refugio' && esAdmin) return html`<a class="enlace" href="#/admin/refugios?id=${x.objetivo_id}">${x.objetivo}</a>`;
      return x.objetivo;
    };
    return {
      html: marcoAdmin('#/admin/reportes', 'Reportes', html`
        <div class="pestanas">${['abierto', 'resuelto', 'descartado'].map((e) => html`<a class="pestana" href="#/admin/reportes?estado=${e}"${si(e === filtro, 'aria-current="page"')}>${ETQ[e]}s${r.cuentas[e] ? html` <span class="pestana__n">${r.cuentas[e]}</span>` : ''}</a>`)}</div>
        ${!r.reportes.length ? html`<div class="vacio contenedor contenedor--estrecho">No hay reportes con este estado.</div>` : html`
        <ul class="filas filas--reportes contenedor contenedor--estrecho">${r.reportes.map((x) => html`
          <li class="fila fila--sin-imagen fila--reporte">
            <div class="fila__cuerpo">
              <div class="fila__cabeza">
                <p class="fila__titulo">${x.motivo}</p>
                ${insignia(x.estado, ETQ[x.estado])}
              </div>
              <p class="fila__meta"><span class="insignia">${ETQ_OBJETIVO[x.objetivo_tipo]}</span> ${enlaceObjetivo(x)}${Number(x.veces_reportado) > 1 ? html` · <strong class="texto-alerta">reportado ${x.veces_reportado} veces</strong>` : ''}</p>
              <p class="fila__meta">Por ${x.autor} (${ETQ[x.autor_tipo]}) · ${x.autor_correo} · ${x.creado}</p>
              <p class="fila__detalle texto-largo">${x.descripcion}</p>
              ${x.nota ? html`<p class="fila__detalle texto-largo"><strong>Nota${x.atendio ? ` de ${x.atendio}` : ''}${x.cerrado ? ` (${x.cerrado})` : ''}:</strong> ${x.nota}</p>` : ''}
              ${x.estado === 'abierto' ? html`<div class="acciones">
                <button class="boton-contorno boton-contorno--chico boton-contorno--relleno" type="button" data-cerrar="resolver" data-id="${x.id}">Resolver</button>
                <button class="boton-contorno boton-contorno--chico" type="button" data-cerrar="descartar" data-id="${x.id}">Descartar</button></div>` : ''}
            </div>
          </li>`)}</ul>
        ${paginacion(r.pagina, r.total, r.porPagina)}`}`),
      montar(raiz) {
        $$('[data-pagina]', raiz).forEach((b) => b.addEventListener('click', () => { location.hash = `#/admin/reportes?estado=${filtro}&pagina=${b.dataset.pagina}`; }));
        $$('[data-cerrar]', raiz).forEach((b) => b.addEventListener('click', async () => {
          const accion = b.dataset.cerrar === 'resolver' ? 'resolver' : 'descartar';
          const ok = await dialogo({
            titulo: accion === 'resolver' ? 'Resolver reporte' : 'Descartar reporte', confirmar: accion === 'resolver' ? 'Resolver' : 'Descartar',
            texto: 'Quien reportó recibirá una notificación con tu nota.',
            cuerpo: html`<label class="campo"><span class="campo__etiqueta">Nota</span><textarea class="campo__textarea" name="nota" maxlength="300" placeholder="10 a 300 caracteres"></textarea></label>`,
            accion: async (f) => {
              const nota = revisarTexto(f.nota.value, { min: 10, max: 300, campo: 'La nota', minPalabras: 2, lineas: 3 });
              await api(`/admin/reportes/${b.dataset.id}/${accion}`, { metodo: 'POST', datos: { nota } });
            },
          });
          if (ok) { aviso('Reporte actualizado.'); navegar(); }
        }));
      },
    };
  }

  /* RF-28 / RF-32: un solo Administrador; se pueden subir cuentas a Funcionario (reportes y estadísticas) */
  async function vistaAdminCuentas(ctx) {
    const q = (ctx.query.get('q') || '').slice(0, 60);
    const TIPOS = ['adoptante', 'refugio', 'funcionario', 'admin'];
    const tipo = TIPOS.includes(ctx.query.get('tipo')) ? ctx.query.get('tipo') : '';
    const pagina = idValido(ctx.query.get('pagina')) || 1;
    const r = await api(conQuery('/admin/cuentas', { q, tipo, pagina }));
    return {
      html: marcoAdmin('#/admin/cuentas', 'Cuentas', html`
        <form class="busqueda-admin" data-buscar>
          <input class="campo__entrada" name="q" type="search" placeholder="Buscar por nombre o correo" value="${q}" maxlength="60">
          <select class="campo__entrada" name="tipo"><option value="">Todos los tipos</option>${TIPOS.map((t) => html`<option value="${t}"${si(t === tipo, 'selected')}>${ETQ[t]}</option>`)}</select>
          <button class="boton-contorno boton-contorno--chico" type="submit">Buscar</button>
        </form>
        <p class="nota">Solo existe un Administrador. Un Funcionario puede atender reportes y ver estadísticas.</p>
        ${!r.cuentas.length ? html`<div class="vacio">No se encontraron cuentas.</div>` : html`
        <div class="tabla-desliza"><table class="tabla">
          <thead><tr><th>Nombre</th><th>Correo</th><th>Tipo</th><th>Estado</th><th>Alta</th><th></th></tr></thead>
          <tbody>${r.cuentas.map((c) => html`
            <tr>
              <td data-col="Nombre"><span class="con-avatar">${avatar(c, 'mini')}<strong>${c.nombre}</strong></span></td>
              <td data-col="Correo" class="texto-largo">${c.correo}</td>
              <td data-col="Tipo">${ETQ[c.tipo]}</td>
              <td>${insignia(c.estado, ETQ[c.estado] || c.estado)}</td>
              <td data-col="Alta">${c.creado}</td>
              <td><div class="acciones">
                ${c.tipo === 'adoptante' && c.estado === 'activa' ? html`<button class="boton-contorno boton-contorno--chico" type="button" data-rol="funcionario" data-id="${c.id}">Hacer funcionario</button>` : ''}
                ${c.tipo === 'funcionario' ? html`<button class="boton-contorno boton-contorno--chico" type="button" data-rol="quitar-funcionario" data-id="${c.id}">Quitar funcionario</button>` : ''}
                ${c.tipo === 'refugio' ? html`<a class="boton-contorno boton-contorno--chico" href="#/admin/refugios?id=${c.id}">Ver refugio</a>` : ''}
                ${c.tipo !== 'admin' && c.estado !== 'eliminada' ? html`<button class="boton-contorno boton-contorno--chico boton-contorno--peligro" type="button" data-eliminar="${c.id}">Eliminar</button>` : ''}
              </div></td>
            </tr>`)}</tbody>
        </table></div>
        ${paginacion(r.pagina, r.total, r.porPagina)}`}`),
      montar(raiz) {
        const f = $('[data-buscar]', raiz);
        f.addEventListener('submit', (e) => { e.preventDefault(); location.hash = conQuery('#/admin/cuentas', { q: f.q.value.trim(), tipo: f.tipo.value }); });
        $$('[data-pagina]', raiz).forEach((b) => b.addEventListener('click', () => { location.hash = conQuery('#/admin/cuentas', { q, tipo, pagina: b.dataset.pagina }); }));
        $$('[data-rol]', raiz).forEach((b) => b.addEventListener('click', async () => {
          const c = r.cuentas.find((x) => x.id === Number(b.dataset.id));
          const subir = b.dataset.rol === 'funcionario';
          const ok = await dialogo({
            titulo: subir ? 'Hacer Funcionario' : 'Quitar rol de Funcionario',
            texto: subir ? `${c.nombre} podrá atender reportes y ver estadísticas. Mientras tenga el rol no podrá adoptar (debe no tener solicitudes activas).`
              : `${c.nombre} volverá a ser Adoptante.`,
            confirmar: subir ? 'Asignar' : 'Quitar',
            accion: async () => { aviso((await api(`/admin/cuentas/${c.id}/${b.dataset.rol}`, { metodo: 'POST' })).mensaje); },
          });
          if (ok) navegar();
        }));
        $$('[data-eliminar]', raiz).forEach((b) => b.addEventListener('click', async () => {
          const c = r.cuentas.find((x) => x.id === Number(b.dataset.eliminar));
          const ok = await dialogo({
            titulo: `Eliminar la cuenta de ${c.nombre}`, confirmar: 'Eliminar cuenta', peligro: true,
            cuerpo: html`<label class="campo"><span class="campo__etiqueta">Motivo</span><textarea class="campo__textarea" name="motivo" maxlength="300" placeholder="10 a 300 caracteres"></textarea></label>`,
            accion: async (fm) => {
              const motivo = revisarTexto(fm.motivo.value, { min: 10, max: 300, campo: 'El motivo', minPalabras: 2, lineas: 2 });
              await api(`/admin/cuentas/${c.id}/eliminar`, { metodo: 'POST', datos: { motivo } });
            },
          });
          if (ok) { aviso('Cuenta eliminada.'); navegar(); }
        }));
      },
    };
  }

  /* RF-29 a RF-31 */
  async function vistaAdminCatalogos() {
    const cat = await catalogos(true);
    const NOMBRES = { tamano: 'Tamaños', edad: 'Rangos de edad', tipo_requisito: 'Tipos de requisito', vacuna: 'Vacunas', documento: 'Documentos requeridos' };
    return {
      html: marcoAdmin('#/admin/catalogos', 'Catálogos', html`
        <div class="catalogos">${Object.entries(NOMBRES).map(([k, t]) => html`
          <section class="panel">
            <h2 class="panel__titulo">${t}</h2>
            ${cat[k].map((v) => html`
              <div class="valor ${v.activo ? '' : 'valor--inactivo'}">
                <span>${v.nombre}</span>
                <span class="acciones">
                  <button class="enlace" type="button" data-renombrar="${v.id}" data-nombre="${v.nombre}">Renombrar</button>
                  <button class="enlace" type="button" data-${v.activo ? 'desactivar' : 'activar'}="${v.id}">${v.activo ? 'Desactivar' : 'Activar'}</button>
                </span>
              </div>`)}
            <form class="agregar" data-agregar="${k}"><input class="campo__entrada" name="nombre" maxlength="50" placeholder="Nuevo valor" aria-label="Nuevo valor de ${t}"><button class="boton-contorno boton-contorno--chico" type="submit">Agregar</button></form>
          </section>`)}
        </div>`),
      montar(raiz) {
        const hecho = (m) => { aviso(m); estado.catalogos = null; navegar(); };
        $$('[data-agregar]', raiz).forEach((f) => f.addEventListener('submit', async (e) => {
          e.preventDefault();
          const n = f.nombre.value.trim();
          if (!V.entre(n, 1, 50)) return aviso('El nombre del valor debe tener de 1 a 50 caracteres.', 'error');
          try { const r = await api('/admin/catalogos', { metodo: 'POST', datos: { catalogo: f.dataset.agregar, nombre: n } }); hecho(r.mensaje); } catch (err) { aviso(textoError(err), 'error'); }
        }));
        $$('[data-renombrar]', raiz).forEach((b) => b.addEventListener('click', async () => {
          const ok = await dialogo({
            titulo: 'Renombrar valor', confirmar: 'Guardar',
            cuerpo: html`<label class="campo"><span class="campo__etiqueta">Nuevo nombre</span><input class="campo__entrada" name="nombre" maxlength="50" value="${b.dataset.nombre}"></label>`,
            accion: async (f) => {
              if (!V.entre(f.nombre.value.trim(), 1, 50)) fallo('El nombre del valor debe tener de 1 a 50 caracteres.');
              await api(`/admin/catalogos/${b.dataset.renombrar}`, { metodo: 'PUT', datos: { nombre: f.nombre.value.trim() } });
            },
          });
          if (ok) hecho('Valor renombrado.');
        }));
        $$('[data-desactivar], [data-activar]', raiz).forEach((b) => b.addEventListener('click', async () => {
          const des = !!b.dataset.desactivar;
          const ok = await dialogo({
            titulo: des ? 'Desactivar valor' : 'Activar valor', texto: des ? 'Dejará de aparecer en las nuevas selecciones. Las publicaciones existentes lo conservan.' : 'Volverá a aparecer en las listas de selección.',
            accion: () => api(`/admin/catalogos/${b.dataset.desactivar || b.dataset.activar}/${des ? 'desactivar' : 'activar'}`, { metodo: 'POST' }),
          });
          if (ok) hecho(des ? 'Valor desactivado.' : 'Valor activado.');
        }));
      },
    };
  }

  /* ---------- Gráficas SVG (sin librerías): serie de tiempo, barras horizontales y barra apilada ---------- */
  const SERIES = [['solicitudes', 'Solicitudes', 'g1'], ['ingresos', 'Ingresos', 'g2'], ['adopciones', 'Adopciones', 'g3']];
  const fmtClave = (k) => (k.length === 7 ? `${MESES_CORTOS[Number(k.slice(5)) - 1]} ${k.slice(2, 4)}` : `${Number(k.slice(8))} ${MESES_CORTOS[Number(k.slice(5, 7)) - 1]}`);
  const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  function graficaSerie(serie) {
    const W = 640; const H = 220; const m = { l: 34, r: 12, t: 12, b: 26 };
    const n = serie.claves.length;
    const max = Math.max(1, ...SERIES.flatMap(([k]) => serie[k]));
    const tope = max <= 4 ? 4 : Math.ceil(max / 4) * 4;
    const x = (i) => m.l + (n === 1 ? (W - m.l - m.r) / 2 : (i * (W - m.l - m.r)) / (n - 1));
    const y = (v) => H - m.b - (v / tope) * (H - m.t - m.b);
    const paso = Math.max(1, Math.ceil(n / 7));
    return html`
      <figure class="grafica">
        <ul class="leyenda">${SERIES.map(([k, t, c]) => html`<li><span class="leyenda__marca leyenda__marca--${c}"></span>${t} <strong>${serie[k].reduce((a, b) => a + b, 0)}</strong></li>`)}</ul>
        <svg class="grafica__svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Solicitudes, ingresos y adopciones por ${serie.claves[0] && serie.claves[0].length === 7 ? 'mes' : 'día'}">
          ${[0, 1, 2, 3, 4].map((i) => { const v = (tope / 4) * i; return html`<line class="grafica__rejilla" x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}"></line><text class="grafica__eje" x="${m.l - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`; })}
          ${serie.claves.map((k, i) => (i % paso === 0 ? html`<text class="grafica__eje" x="${x(i)}" y="${H - 8}" text-anchor="middle">${fmtClave(k)}</text>` : ''))}
          ${SERIES.map(([k, , c]) => html`<polyline class="grafica__linea grafica__linea--${c}" points="${serie[k].map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')}"></polyline>`)}
          ${serie.claves.map((k, i) => html`<g class="grafica__punto">
            <rect x="${x(i) - Math.max(4, (W - m.l - m.r) / Math.max(1, n - 1) / 2)}" y="${m.t}" width="${Math.max(8, (W - m.l - m.r) / Math.max(1, n - 1))}" height="${H - m.t - m.b}" fill="transparent"></rect>
            <line class="grafica__guia" x1="${x(i)}" x2="${x(i)}" y1="${m.t}" y2="${H - m.b}"></line>
            ${SERIES.map(([s, , c]) => html`<circle class="grafica__marca grafica__marca--${c}" cx="${x(i)}" cy="${y(serie[s][i])}" r="4"></circle>`)}
            <title>${fmtClave(k)} — ${SERIES.map(([s, t]) => `${t}: ${serie[s][i]}`).join(' · ')}</title></g>`)}
        </svg>
        <details class="grafica__tabla"><summary>Ver como tabla</summary>
          <div class="tabla-desliza"><table class="tabla"><thead><tr><th>Periodo</th>${SERIES.map(([, t]) => html`<th class="num">${t}</th>`)}</tr></thead>
          <tbody>${serie.claves.map((k, i) => html`<tr><td>${fmtClave(k)}</td>${SERIES.map(([s]) => html`<td class="num">${serie[s][i]}</td>`)}</tr>`)}</tbody></table></div></details>
      </figure>`;
  }
  const barras = (items, titulo, sufijo = '') => {
    const max = Math.max(1, ...items.map((x) => x.n));
    return html`<figure class="grafica grafica--barras"><figcaption class="grafica__titulo">${titulo}</figcaption>
      ${!items.length ? html`<p class="nota">Sin datos en el periodo.</p>` : html`<ul class="barras">${items.map((x) => html`
        <li class="barras__fila" title="${x.nombre}: ${x.n}${sufijo}"><span class="barras__nombre">${x.nombre}</span>
          <span class="barras__pista"><span class="barras__barra" data-ancho="${Math.max(2, (x.n / max) * 100).toFixed(1)}"></span></span><span class="barras__valor">${x.n}</span></li>`)}</ul>`}</figure>`;
  };
  const ESTADOS_SOL = [['pendiente', 'Pendientes', 'g4'], ['aprobada', 'En proceso', 'g1'], ['concretada', 'Adoptadas', 'g3'], ['rechazada', 'Rechazadas', 'g2'], ['cancelada', 'Canceladas', 'g5']];
  const apilada = (estados) => {
    const total = ESTADOS_SOL.reduce((a, [k]) => a + (estados[k] || 0), 0);
    return html`<figure class="grafica"><figcaption class="grafica__titulo">Solicitudes por estado (${total})</figcaption>
      ${!total ? html`<p class="nota">Sin solicitudes en el periodo.</p>` : html`
      <div class="apilada" role="img" aria-label="${ESTADOS_SOL.map(([k, t]) => `${t}: ${estados[k] || 0}`).join(', ')}">${ESTADOS_SOL.filter(([k]) => estados[k]).map(([k, t, c]) => html`<span class="apilada__seg apilada__seg--${c}" data-crece="${estados[k]}" title="${t}: ${estados[k]}"></span>`)}</div>
      <ul class="leyenda">${ESTADOS_SOL.map(([k, t, c]) => html`<li><span class="leyenda__marca leyenda__marca--${c}"></span>${t} <strong>${estados[k] || 0}</strong></li>`)}</ul>`}</figure>`;
  };

  /* RF-36 / RF-37 */
  function vistaAdminEstadisticas() {
    return {
      html: marcoAdmin('#/admin/estadisticas', 'Estadísticas generales', html`
        <section class="panel panel--ancho">${selectorPeriodo()}
          <div class="panel__acciones"><button class="boton-contorno boton-contorno--relleno" type="button" data-csv disabled>Exportar CSV</button></div>
          <p class="mensaje mensaje--error" data-error-csv role="alert"></p>
          <div data-cifras></div>
        </section>`),
      montar(raiz) {
        let ultimos = null;
        const btn = $('[data-csv]', raiz);
        montarPeriodo(raiz, async (params) => {
          const r = await api(conQuery('/admin/estadisticas', params));
          ultimos = params;
          btn.disabled = false;
          const kpi = [
            ['azul', r.animales_publicados, 'perros ingresaron'], ['durazno', r.adopciones_concretadas, 'adopciones concretadas'],
            ['blanco', r.solicitudes, 'solicitudes recibidas'], ['blanco', r.tasa_aprobacion == null ? '—' : `${r.tasa_aprobacion}%`, 'de solicitudes decididas se aprobaron'],
            ['blanco', r.dias_promedio_adopcion == null ? '—' : r.dias_promedio_adopcion, 'días promedio del ingreso a la adopción'],
            ['blanco', r.refugios_activos, 'refugios activos'], ['blanco', r.reportes, 'reportes recibidos'],
          ];
          $('[data-cifras]', raiz).innerHTML = String(html`
            <p class="nota">Periodo: ${r.inicio} a ${r.fin} · agrupado por ${r.agrupado === 'mes' ? 'mes' : 'día'}</p>
            <div class="cifras cifras--kpi">${kpi.map(([c, n, t]) => html`<article class="cifra cifra--${c}"><span class="cifra__numero">${n}</span><span class="cifra__texto">${t}</span></article>`)}</div>
            ${graficaSerie(r.serie)}
            ${apilada(r.solicitudes_por_estado)}
            <div class="dos-columnas">
              ${barras(r.top_refugios, 'Refugios con más adopciones', ' adopciones')}
              ${barras(r.refugios_por_alcaldia, 'Refugios activos por alcaldía', ' refugios')}
            </div>
            ${barras(r.por_tamano.map((x) => ({ nombre: x.nombre, n: x.adoptados })), 'Adopciones por tamaño (periodo)', ' adopciones')}
            ${barras(r.por_tamano.map((x) => ({ nombre: x.nombre, n: x.disponibles })), 'Perros disponibles hoy por tamaño', ' disponibles')}`);
          // Tamaños por CSSOM (la CSP no permite atributos style en línea)
          $$('[data-ancho]', raiz).forEach((e) => { e.style.width = `${e.dataset.ancho}%`; });
          $$('[data-crece]', raiz).forEach((e) => { e.style.flexGrow = e.dataset.crece; });
        });
        btn.addEventListener('click', async () => {
          if (!ultimos) return;
          const err = $('[data-error-csv]', raiz);
          err.textContent = '';
          ocupado(btn);
          try {
            const res = await fetch(conQuery('/api/admin/estadisticas.csv', ultimos), { credentials: 'same-origin', headers: { 'X-Dopta': '1' } });
            if (!res.ok) throw new Error();
            const blob = await res.blob();
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `estadisticas_dopta_${hoyCDMX()}.csv`;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
          } catch { err.textContent = 'No se pudo generar el archivo. Intente de nuevo.'; } finally { ocupado(btn, false); }
        });
      },
    };
  }
