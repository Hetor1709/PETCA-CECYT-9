/* ==========================================================================
   Dopta · Vistas del Refugio (sección 12)
   Los archivos de public/js/ se cargan como scripts clásicos, en orden (ver index.html), y comparten el mismo ámbito global.
   ========================================================================== */
'use strict';

  /* ======================= 12. Vistas del Refugio ======================= */
  const subnavRefugio = (actual) => html`
    <nav class="pestanas" aria-label="Secciones del refugio">
      ${[['#/refugio', 'Mis animales'], ['#/refugio/solicitudes', 'Solicitudes'], ['#/refugio/estadisticas', 'Estadísticas'], ['#/refugio/perfil', 'Perfil']]
    .map(([h, t]) => html`<a class="pestana" href="${h}"${si(h === actual, 'aria-current="page"')}>${t}</a>`)}
    </nav>`;

  /* ---------- Mis animales (RF-13, RF-14, RF-15, RF-23) ---------- */
  /* Ficha de la mascota con todas sus solicitudes de adopción (vista del refugio) */
  async function verMascota(animalId) {
    let a; let sols; let cat;
    try {
      [a, sols, cat] = await Promise.all([
        api(`/refugio/animales/${animalId}`),
        api(`/refugio/solicitudes?animal_id=${animalId}`).then((r) => r.solicitudes),
        catalogos(),
      ]);
    } catch (e) { aviso(textoError(e, 'No se pudo cargar la ficha. Intente de nuevo.'), 'error'); return; }
    const nombreCat = (lista, id) => (lista.find((x) => x.id === Number(id)) || {}).nombre || '';
    const pendientes = sols.filter((x) => x.estado === 'pendiente').length;
    const ir = await dialogo({
      titulo: a.nombre,
      ancho: true,
      cuerpo: html`
        <div class="mini-ficha">
          <div class="tarjeta__foto">${imagenAnimal(a)}</div>
          <div>
            <p class="ficha__raza">${nombreRaza(a)}</p>
            <div class="ficha__chips">
              ${insignia(a.estado, ETQ[a.estado])}
              <span class="insignia">${nombreCat(cat.edad, a.edad_id)}</span>
              <span class="insignia">${nombreCat(cat.tamano, a.tamano_id)}</span>
              ${a.peso_kg ? html`<span class="insignia">${Number(a.peso_kg)} kg · ${a.altura_cm} cm</span>` : ''}
              <span class="insignia">${Number(a.esterilizado) ? 'Esterilizado' : 'Sin esterilizar'}</span>
            </div>
            <p><strong>Ingreso:</strong> ${a.fecha_ingreso} · <strong>Publicado:</strong> ${String(a.publicado_en).slice(0, 10)}</p>
            <p><strong>Salud:</strong> ${CAMPOS_SALUD.filter((c) => a[c]).map((c) => etiquetaOpcion(cat, c, a[c])).join(' · ') || a.salud || 'Sin información.'}</p>
            <p><strong>Temperamento:</strong> ${CAMPOS_TEMP.filter((c) => a[c]).map((c) => `${cat.animal[c].titulo}: ${etiquetaOpcion(cat, c, a[c]).toLowerCase()}`).join(' · ') || a.temperamento || 'Sin información.'}</p>
            <p><strong>Vacunas:</strong> ${a.vacunas.length ? a.vacunas.map((v) => `${v.nombre} (${v.fecha})`).join(', ') : 'Ninguna registrada'}</p>
            <p><strong>Requisitos:</strong> ${a.requisitos.length ? a.requisitos.map((r) => r.nombre).join(', ') : 'Ninguno'}</p>
          </div>
        </div>
        <h3 class="fila__titulo">Solicitudes de adopción (${sols.length})</h3>
        ${!sols.length ? html`<p class="vacio">Esta mascota aún no tiene solicitudes.</p>` : html`
        <ul class="filas">${sols.map((x) => html`
          <li class="fila fila--sin-imagen">
            <div>
              <p class="fila__titulo">${x.adoptante}</p>
              <p class="fila__meta">${x.adoptante_correo}${x.adoptante_telefono ? ` · Tel. ${x.adoptante_telefono}` : ''} · Enviada ${x.enviada}</p>
              ${x.motivo_rechazo ? html`<p class="fila__detalle">Motivo: ${x.motivo_rechazo}</p>` : ''}
              ${x.concretada_en ? html`<p class="fila__detalle">Adopción concretada el ${x.concretada_en}</p>`
    : x.cita_fecha ? tablaCita(x, 'refugio') : ''}
              ${resumenEnviado(x, 'Formato de adopción')}
              ${x.mensajes.length ? html`<p class="fila__meta">${x.mensajes.length} mensaje(s) · <a class="enlace" href="#/refugio/solicitudes?id=${x.id}">Abrir conversación</a></p>` : ''}
            </div>
            <div class="fila__lado">${insignia(x.estado, ETQ[x.estado])}</div>
          </li>`)}</ul>`}`,
      confirmar: pendientes ? `Responder pendientes (${pendientes})` : 'Ir a solicitudes',
      cancelar: 'Cerrar',
    });
    if (ir) location.hash = `#/refugio/solicitudes?animal_id=${animalId}`;
  }

  async function vistaRefugio(ctx) {
    const lista = await api('/refugio/animales');
    const ver = ctx.query.get('ver') === 'adoptados' ? 'adoptado' : 'disponible';
    const filtrados = lista.filter((a) => a.estado === ver);
    const pie = (a) => html`
      <div class="tarjeta__pie">
        ${insignia(a.estado, ETQ[a.estado])}
        ${Number(a.activas) ? html`<span class="insignia">${a.activas} activas</span>` : ''}
      </div>
      <div class="tarjeta__editar acciones acciones--centro">
        <button class="boton-contorno boton-contorno--chico boton-contorno--relleno" type="button" data-ver="${a.id}">Ver ficha y solicitudes</button>
        ${a.estado === 'disponible' ? html`<a class="boton-contorno boton-contorno--chico" href="#/refugio/animal/${a.id}">Editar</a>` : ''}
        <button class="boton-contorno boton-contorno--chico" type="button" data-estado="${a.id}">${a.estado === 'disponible' ? 'Adoptado' : 'Disponible'}</button>
        ${a.estado === 'disponible' ? html`<button class="boton-contorno boton-contorno--chico boton-contorno--peligro" type="button" data-eliminar="${a.id}">Eliminar</button>`
    : html`<button class="boton-contorno boton-contorno--chico" type="button" data-cerrar="${a.id}">Cerrar solicitudes</button>`}
      </div>`;
    return {
      html: html`
      <section class="principal">
        <h1 class="titulo-pagina">Mis animales</h1>
        ${subnavRefugio('#/refugio')}
        <div class="acciones acciones--centro">
          <a class="pestana" href="#/refugio"${si(ver === 'disponible', 'aria-current="page"')}>Disponibles (${lista.filter((a) => a.estado === 'disponible').length})</a>
          <a class="pestana" href="#/refugio?ver=adoptados"${si(ver === 'adoptado', 'aria-current="page"')}>Adoptados (${lista.filter((a) => a.estado === 'adoptado').length})</a>
          <a class="boton-contorno boton-contorno--relleno" href="#/refugio/animal/nuevo">Registrar un perro</a>
        </div>
        <br>
        ${filtrados.length ? html`<ul class="catalogo">${filtrados.map((a) => tarjetaAnimal(a, { enlace: false, pie: pie(a) }))}</ul>`
    : html`<div class="vacio contenedor contenedor--estrecho">${seguro(SVG_MESTIZO)}${ver === 'disponible' ? 'Aún no tienes animales disponibles. ¡Publica el primero!' : 'Todavía no hay adopciones registradas.'}</div>`}
      </section>`,
      montar(raiz) {
        const buscar = (id) => lista.find((a) => a.id === Number(id));
        $$('[data-ver]', raiz).forEach((b) => b.addEventListener('click', () => verMascota(b.dataset.ver)));
        $$('[data-estado]', raiz).forEach((b) => b.addEventListener('click', async () => {
          const a = buscar(b.dataset.estado);
          const nuevo = a.estado === 'disponible' ? 'adoptado' : 'disponible';
          if (nuevo === 'adoptado') {
            // La entrega se registra desde la solicitud aprobada (protocolo: visita y lista de entrega)
            const r = await api(`/refugio/solicitudes?animal_id=${a.id}`);
            const s = r.solicitudes.find((x) => x.estado === 'aprobada' && !x.concretada_en);
            if (!s) { aviso(`${a.nombre} no tiene una solicitud aprobada. Aprueba una solicitud antes de registrar la adopción.`, 'error'); return; }
            if (await entregar(s)) navegar();
            return;
          }
          const ok = await dialogo({
            titulo: `Cambiar a ${ETQ[nuevo]}`,
            texto: nuevo === 'adoptado'
              ? `Se concreta la adopción con la solicitud aprobada de ${a.nombre}. Saldrá del catálogo y las demás solicitudes se rechazarán con el motivo “El animal ya fue adoptado”.`
              : `${a.nombre} volverá a aparecer en el catálogo y la adopción registrada se revertirá.`,
            cuerpo: nuevo === 'adoptado'
              ? html`<label class="campo"><span class="campo__etiqueta">Fecha de concreción</span><input class="campo__entrada" type="date" name="fecha" max="${hoyCDMX()}" value="${hoyCDMX()}"></label>`
              : '',
            confirmar: 'Guardar',
            accion: (f) => {
              if (nuevo === 'adoptado' && (!f.fecha.value || f.fecha.value > hoyCDMX())) fallo('La fecha de concreción debe estar entre la fecha de aprobación y hoy.');
              return api(`/refugio/animales/${a.id}/estado`, { metodo: 'POST', datos: { estado: nuevo, fecha: nuevo === 'adoptado' ? f.fecha.value : undefined } });
            },
          });
          if (ok) { aviso('Estado actualizado.'); navegar(); }
        }));
        $$('[data-eliminar]', raiz).forEach((b) => b.addEventListener('click', async () => {
          const a = buscar(b.dataset.eliminar);
          const ok = await dialogo({
            titulo: `¿Eliminar a ${a.nombre}?`, texto: 'La publicación saldrá del catálogo. Su registro se conserva para tus estadísticas.',
            confirmar: 'Eliminar', peligro: true,
            accion: () => api(`/refugio/animales/${a.id}`, { metodo: 'DELETE' }),
          });
          if (ok) { aviso('Publicación eliminada.'); navegar(); }
        }));
        $$('[data-cerrar]', raiz).forEach((b) => b.addEventListener('click', async () => {
          const a = buscar(b.dataset.cerrar);
          const ok = await dialogo({
            titulo: 'Cerrar solicitudes', texto: `Las solicitudes pendientes de ${a.nombre} pasarán a Rechazada con el motivo “El animal ya fue adoptado”.`,
            accion: async () => { const r = await api(`/refugio/animales/${a.id}/cerrar-solicitudes`, { metodo: 'POST' }); aviso(r.mensaje); },
          });
          if (ok) navegar();
        }));
      },
    };
  }

  /* ---------- RF-12 / RF-13: publicar o editar un animal ---------- */
  const filaRequisito = (cat, r = {}) => html`
    <div class="repetible__fila">
      <input class="campo__entrada" name="req_nombre" type="text" maxlength="100" placeholder="Ej. Copia de INE" value="${r.nombre || ''}" aria-label="Nombre del requisito">
      <select class="campo__entrada" name="req_tipo" aria-label="Tipo de requisito">${opciones(cat.tipo_requisito, r.tipo_id, 'Tipo')}</select>
      <button class="boton-icono" type="button" data-quitar aria-label="Quitar">${ICONO.quitar}</button>
    </div>`;
  /* Documentos de la lista cerrada (catálogo "documento"): el refugio solo marca los que pide */
  const listaDocumentos = (cat, actuales = []) => {
    const elegidos = actuales.filter((r) => !Number(r.otro)).map((r) => r.nombre);
    const activos_ = activos(cat.documento || []).map((d) => d.nombre);
    const extra = elegidos.filter((n) => !activos_.includes(n)); // ya elegidos aunque el admin los haya desactivado
    return html`<div class="documentos" data-documentos>${[...activos_, ...extra].map((n) => html`
      <label class="documento"><input type="checkbox" data-doc value="${n}"${si(elegidos.includes(n), 'checked')}><span>${n}</span></label>`)}</div>`;
  };

  /* Dimensiones: mismas reglas que el servidor (public/reglas.js), con curva de crecimiento por meses */
  function rangoDims(cat, raza, aprox, tamanoNombre) {
    const rg = Reglas.rango(raza, tamanoNombre, cat.dims.razas, RAZA[raza] && RAZA[raza].nombre);
    if (!rg) return null;
    const parecido = raza === 'mestizo' && aprox && cat.dims.razas[aprox];
    return { ...rg, parecido: parecido || null };
  }

  /* Vacunas del catálogo con casilla y fecha de aplicación (opción múltiple, máx. 10) */
  const listaVacunas = (cat, actuales = []) => {
    const activas = activos(cat.vacuna || []).map((v) => v.nombre);
    const extra = actuales.map((v) => v.nombre).filter((n) => !activas.includes(n)); // vacunas antiguas o desactivadas ya registradas
    return html`<div class="vacunas" data-vacunas>${[...activas, ...extra].map((n) => {
      const v = actuales.find((x) => x.nombre === n);
      return html`
        <div class="vacuna ${v ? 'vacuna--activa' : ''}">
          <label class="vacuna__nombre"><input type="checkbox" data-vac value="${n}"${si(v, 'checked')}><span>${n}</span></label>
          <input class="campo__entrada" type="date" data-vac-fecha min="2000-01-01" max="${hoyCDMX()}" value="${v ? v.fecha : ''}" aria-label="Fecha de aplicación: ${n}"${si(!v, 'disabled')}>
        </div>`;
    })}</div>`;
  };

  async function vistaFormAnimal(ctx) {
    const cat = await catalogos(true);
    if (!cat.animal || !cat.vacuna) throw new ErrorApi(500, 'El servidor no tiene la versión más reciente de Dopta. Detén el servidor (Ctrl + C) y vuelve a ejecutar npm start.');
    const id = ctx.params.id ? idValido(ctx.params.id) : null;
    let a = {};
    if (ctx.params.id && !id) return vista404();
    if (id) {
      try { a = await api(`/refugio/animales/${id}?editar=1`); } catch (e) {
        if ([403, 404, 409].includes(e.status)) { aviso(e.message, 'error'); location.replace('#/refugio'); return ''; }
        throw e;
      }
    }
    const hoy = hoyCDMX();
    return {
      html: html`
      <section class="principal principal--cuenta">
        <div class="contenedor">
          ${botonRegresar('#/refugio')}
          <section class="panel panel--ancho">
            <h1 class="panel__titulo">${id ? `Editar a ${a.nombre}` : 'Agregar mascota al catálogo'}</h1>
            <form class="formulario formulario--dos" novalidate data-animal>
              <div class="campo"><label class="campo__etiqueta" for="nombre">Nombre de la mascota</label>
                <input class="campo__entrada" id="nombre" name="nombre" type="text" maxlength="30" placeholder="Ej. Luna" value="${a.nombre || ''}" required></div>
              <div class="campo"><label class="campo__etiqueta" for="fecha_ingreso">Fecha de ingreso al refugio</label>
                <input class="campo__entrada" id="fecha_ingreso" name="fecha_ingreso" type="date" min="2000-01-01" max="${hoy}" value="${a.fecha_ingreso || hoy}" required></div>
              ${selectorRazas(a.raza || '', a.raza_aprox || '')}
              <div class="campo"><label class="campo__etiqueta" for="edad">Edad</label>
                <select class="campo__entrada" id="edad" name="edad_id">${opciones(cat.edad, a.edad_id, 'Selecciona la edad')}</select></div>
              <div class="campo"><label class="campo__etiqueta" for="tamano">Tamaño</label>
                <select class="campo__entrada" id="tamano" name="tamano_id">${opciones(cat.tamano, a.tamano_id, 'Selecciona el tamaño')}</select>
                <span class="campo__ayuda" data-tamano-ayuda aria-live="polite"></span></div>
              <div class="campo"><label class="campo__etiqueta" for="peso">Peso (kg)</label>
                <input class="campo__entrada campo__entrada--numero" id="peso" name="peso_kg" type="number" inputmode="decimal" min="0.3" max="100" step="0.1" value="${a.peso_kg ?? ''}" placeholder="Ej. 12.5" required></div>
              <div class="campo"><label class="campo__etiqueta" for="altura">Altura a la cruz (cm)</label>
                <input class="campo__entrada campo__entrada--numero" id="altura" name="altura_cm" type="number" inputmode="numeric" min="8" max="110" step="1" value="${a.altura_cm ?? ''}" placeholder="Ej. 45" required></div>
              <p class="campo__ayuda campo--ancho dims-ayuda" data-dims-ayuda aria-live="polite">Elige la raza y la edad para sugerir el peso y la altura.</p>
              <p class="seccion-form">Estado de salud</p>
              ${CAMPOS_SALUD.map((c) => html`<div class="campo campo--ancho">${grupoCerrado(cat, c, a[c])}</div>`)}
              <p class="seccion-form">Temperamento</p>
              ${CAMPOS_TEMP.map((c) => html`<div class="campo campo--ancho">${grupoCerrado(cat, c, a[c])}</div>`)}

              <p class="seccion-form">Esterilización</p>
              <div class="campo"><span class="campo__etiqueta">¿Está esterilizado?</span>
                <div class="pregunta__opciones">
                  <label class="opcion"><input type="radio" name="esterilizado" value="si"${si(Number(a.esterilizado) === 1, 'checked')}><span class="opcion__texto">Sí</span></label>
                  <label class="opcion"><input type="radio" name="esterilizado" value="no"${si(Number(a.esterilizado) !== 1, 'checked')}><span class="opcion__texto">No</span></label>
                </div></div>
              <div class="campo"><span class="campo__etiqueta">¿Está desparasitado?</span>
                <div class="pregunta__opciones">
                  <label class="opcion"><input type="radio" name="desparasitado" value="si"${si(Number(a.desparasitado) === 1, 'checked')}><span class="opcion__texto">Sí</span></label>
                  <label class="opcion"><input type="radio" name="desparasitado" value="no"${si(Number(a.desparasitado) !== 1, 'checked')}><span class="opcion__texto">No</span></label>
                </div><span class="campo__ayuda">Debe estarlo al momento de la entrega.</span></div>
              <div class="campo" data-fecha-est${si(Number(a.esterilizado) !== 1, 'hidden')}><label class="campo__etiqueta" for="fecha_est">Fecha de esterilización</label>
                <input class="campo__entrada" id="fecha_est" name="fecha_esterilizacion" type="date" min="2000-01-01" max="${hoy}" value="${a.fecha_esterilizacion || ''}"></div>

              <p class="seccion-form">Vacunas <span class="campo__ayuda">(marca las aplicadas y su fecha · hasta 10)</span></p>
              <div class="campo campo--ancho">${listaVacunas(cat, a.vacunas || [])}</div>

              <p class="seccion-form">Requisitos de adopción <span class="campo__ayuda">(marca los documentos que pides · hasta 10 · se entregan en persona en la cita)</span></p>
              <div class="campo campo--ancho">${listaDocumentos(cat, a.requisitos || [])}</div>
              <div class="campo campo--ancho"><span class="campo__etiqueta">Otro requisito <span class="opcional">(si no está en la lista · hasta 3)</span></span>
                <div class="repetible" data-requisitos>${(a.requisitos || []).filter((r) => Number(r.otro)).map((r) => filaRequisito(cat, r))}</div>
                <div class="acciones"><button class="boton-contorno boton-contorno--chico" type="button" data-agregar="requisitos">Agregar otro requisito</button></div>
                <span class="campo__ayuda">Texto: datos personales (nombre, dirección, teléfono). Documental: documentos o imágenes.</span></div>

              <p class="mensaje mensaje--error campo--ancho" data-error role="alert"></p>
              <div class="panel__acciones campo--ancho"><button class="boton-contorno boton-contorno--relleno" type="submit">${id ? 'Guardar cambios' : 'Publicar mascota'}</button></div>
            </form>
          </section>
        </div>
      </section>`,
      montar(raiz) {
        const f = $('[data-animal]', raiz);
        montarRazas(f);
        montarContadores(f);
        const limite = 'Solo se permiten hasta 10 requisitos o hasta 10 vacunas.';
        /* Tamaño según la raza: en raza pura se asigna solo y se bloquea; en mestizo se sugiere el de la raza parecida */
        const selTam = $('#tamano', f);
        const ayudaTam = $('[data-tamano-ayuda]', f);
        let tamanoManual = !!a.tamano_id && a.raza === 'mestizo';
        const tamanoDe = (razaId) => {
          const r = RAZA[razaId];
          const t = r && activos(cat.tamano).find((x) => sinAcentos(x.nombre) === sinAcentos(r.tamano));
          return t ? String(t.id) : '';
        };
        const sincronizarTamano = () => {
          const raza = ($('input[name="raza"]:checked', f) || {}).value || '';
          const aprox = ($('input[name="raza_aprox"]:checked', f) || {}).value || '';
          const fijo = raza && raza !== 'mestizo' ? tamanoDe(raza) : '';
          selTam.disabled = !!fijo;
          selTam.classList.toggle('campo__entrada--fijo', !!fijo);
          if (fijo) {
            selTam.value = fijo;
            ayudaTam.textContent = `Asignado automáticamente: un ${RAZA[raza].nombre} siempre es de tamaño ${selTam.selectedOptions[0].textContent}.`;
          } else if (raza === 'mestizo') {
            const sug = tamanoDe(aprox);
            if (sug && !tamanoManual) selTam.value = sug;
            ayudaTam.textContent = sug ? `Sugerido por su parecido a ${RAZA[aprox].nombre}. Puedes cambiarlo.` : 'Elige el tamaño según su peso y altura.';
          } else ayudaTam.textContent = '';
        };
        selTam.addEventListener('change', () => { tamanoManual = true; });
        f.addEventListener('change', (e) => { if (e.target.name === 'raza' || e.target.name === 'raza_aprox') { if (e.target.name === 'raza') tamanoManual = false; sincronizarTamano(); } });
        sincronizarTamano();

        /* Peso y altura: se sugieren según raza, edad y tamaño hasta que el refugio los cambie a mano */
        const inPeso = $('#peso', f);
        const inAltura = $('#altura', f);
        const ayudaDims = $('[data-dims-ayuda]', f);
        let dimsManual = !!(a.peso_kg && a.altura_cm);
        const contexto = () => {
          const raza = ($('input[name="raza"]:checked', f) || {}).value || '';
          const aprox = ($('input[name="raza_aprox"]:checked', f) || {}).value || '';
          const tam = selTam.value ? selTam.selectedOptions[0].textContent : '';
          const edad = $('#edad', f).value ? $('#edad', f).selectedOptions[0].textContent : '';
          return { r: rangoDims(cat, raza, aprox, tam), meses: Reglas.mesesDeEdad(edad) };
        };
        const sincronizarDims = (forzar = false) => {
          const { r, meses } = contexto();
          if (!r) { ayudaDims.textContent = 'Elige la raza (y el tamaño si es mestizo) para sugerir el peso y la altura.'; return; }
          const l = Reglas.limites(r, meses);
          const sug = Reglas.sugerido(r, meses, r.parecido);
          if (!dimsManual || forzar) { inPeso.value = sug.peso; inAltura.value = sug.altura; }
          ayudaDims.innerHTML = String(html`📏 Típico de ${r.base} adulto: <strong>${r.peso[0]}–${r.peso[1]} kg</strong> y <strong>${r.altura[0]}–${r.altura[1]} cm</strong>.
            ${l.adulto ? '' : `A los ${meses} ${meses === 1 ? 'mes' : 'meses'} se acepta de ${l.peso[0]} a ${l.peso[1]} kg y de ${l.altura[0]} a ${l.altura[1]} cm. `}
            ${dimsManual ? html`<button class="enlace" type="button" data-dims-sugerir>Usar ${sug.peso} kg y ${sug.altura} cm</button>` : 'Valores sugeridos: ajústalos si lo pesaste o mediste.'}`);
        };
        [inPeso, inAltura].forEach((x) => x.addEventListener('input', () => { dimsManual = true; }));
        f.addEventListener('change', (e) => { if (['raza', 'raza_aprox', 'edad_id', 'tamano_id'].includes(e.target.name)) sincronizarDims(); });
        f.addEventListener('click', (e) => { if (e.target.closest('[data-dims-sugerir]')) { dimsManual = false; sincronizarDims(true); } });
        sincronizarDims();
        $$('[data-doc]', f).forEach((c) => c.addEventListener('change', () => {
          if (c.checked && $$('[data-doc]:checked', f).length + $('[data-requisitos]', f).children.length > 10) { c.checked = false; errorEn(f, limite); }
        }));
        $$('[data-agregar]', f).forEach((b) => b.addEventListener('click', () => {
          const caja = $(`[data-${b.dataset.agregar}]`, f);
          if (caja.children.length >= 3) return errorEn(f, 'Puede agregar hasta 3 requisitos en "Otro".');
          if (caja.children.length + $$('[data-doc]:checked', f).length >= 10) return errorEn(f, limite);
          caja.insertAdjacentHTML('beforeend', String(filaRequisito(cat)));
          $('input', caja.lastElementChild).focus();
        }));
        f.addEventListener('click', (e) => { const q = e.target.closest('[data-quitar]'); if (q) q.closest('.repetible__fila').remove(); });
        $$('[data-vac]', f).forEach((c) => c.addEventListener('change', () => {
          if (c.checked && $$('[data-vac]:checked', f).length > 10) { c.checked = false; return errorEn(f, limite); }
          const fila = c.closest('.vacuna');
          const fecha = $('[data-vac-fecha]', fila);
          fila.classList.toggle('vacuna--activa', c.checked);
          fecha.disabled = !c.checked;
          if (c.checked) fecha.focus(); else fecha.value = '';
        }));
        f.addEventListener('change', (e) => { if (e.target.name === 'esterilizado') $('[data-fecha-est]', f).hidden = e.target.value !== 'si'; });

        f.addEventListener('submit', async (e) => {
          e.preventDefault();
          errorEn(f, '');
          let datos;
          try {
            const d = datosForm(f);
            const raza = ($('input[name="raza"]:checked', f) || {}).value;
            const aprox = ($('input[name="raza_aprox"]:checked', f) || {}).value || null;
            if (!V.entre(d.nombre, 2, 30) || !V.nombre(d.nombre)) fallo('El nombre del perro debe tener de 2 a 30 caracteres, solo letras y espacios.');
            revisarNombre(d.nombre, 'perro');
            if (!raza) fallo('Seleccione la raza del animal.');
            if (!d.edad_id) fallo('Seleccione la edad del animal.');
            d.tamano_id = $('#tamano', f).value; // puede estar bloqueado (raza pura): se lee directo del selector
            if (!d.tamano_id) fallo('Seleccione el tamaño del animal.');
            const cerrados = {};
            [...CAMPOS_SALUD, ...CAMPOS_TEMP].forEach((c) => {
              if (!d[c]) fallo(`Seleccione una opción en “${cat.animal[c].titulo}”.`);
              cerrados[c] = d[c];
            });
            // Coherencia: fechas no futuras, no antes del 2000 ni antes del nacimiento estimado por la edad elegida
            const edadNombre = (cat.edad.find((x) => x.id === Number(d.edad_id)) || {}).nombre || '';
            const nacimiento = nacimientoMinimo(edadNombre, hoyCDMX());
            const pasada = (fecha, que) => {
              if (!fecha || fecha > hoyCDMX()) fallo('La fecha debe ser igual o anterior a la fecha de hoy.');
              if (fecha < '2000-01-01') fallo(`La fecha de ${que} no puede ser anterior al año 2000.`);
              if (nacimiento && fecha < nacimiento) fallo(`La fecha de ${que} (${fecha}) es anterior al nacimiento estimado por su edad (${edadNombre}). Revise la fecha o la edad.`);
            };
            pasada(d.fecha_ingreso, 'ingreso');
            // Peso y altura coherentes con la raza (o el tamaño) y la edad
            const peso = Number(d.peso_kg);
            const altura = Number(d.altura_cm);
            const { r: rd, meses } = contexto();
            const pd = Reglas.problema(d.peso_kg === '' ? NaN : peso, d.altura_cm === '' ? NaN : altura, rd, meses);
            if (pd) fallo(pd);
            const documentos = $$('[data-doc]:checked', f).map((c) => ({ nombre: c.value, otro: false }));
            const otros = $$('[data-requisitos] .repetible__fila', f).map((r) => {
              const nombre = $('[name="req_nombre"]', r).value.trim().replace(/\s+/g, ' ');
              const tipo = Number($('[name="req_tipo"]', r).value);
              if (!V.entre(nombre, 3, 100) || !V.letras(nombre, 3) || !tipo) fallo('Cada requisito "Otro" debe tener de 3 a 100 caracteres, con letras, y un tipo Texto o Documental.');
              revisarTexto(nombre, { min: 3, max: 100, campo: 'Cada requisito', lineas: 1 });
              return { nombre, tipo_id: tipo, otro: true };
            });
            if (otros.length > 3) fallo('Puede agregar hasta 3 requisitos en "Otro".');
            const requisitos = [...documentos, ...otros];
            const nombresReq = requisitos.map((x) => x.nombre.toLowerCase());
            if (new Set(nombresReq).size !== nombresReq.length) fallo('Hay requisitos repetidos. Cada requisito debe aparecer una sola vez.');
            const vacunas = $$('[data-vac]:checked', f).map((c) => {
              const fecha = $('[data-vac-fecha]', c.closest('.vacuna')).value;
              if (!fecha) fallo(`Indique la fecha de aplicación de “${c.value}”.`);
              pasada(fecha, `la vacuna ${c.value}`);
              return { nombre: c.value, fecha };
            });
            if (requisitos.length > 10 || vacunas.length > 10) fallo(limite);
            const ester = d.esterilizado === 'si';
            if (ester) { if (!d.fecha_esterilizacion) fallo('Ingrese la fecha de esterilización.'); pasada(d.fecha_esterilizacion, 'esterilización'); }
            datos = {
              nombre: d.nombre, raza, raza_aprox: raza === 'mestizo' ? aprox : null, edad_id: Number(d.edad_id), tamano_id: Number(d.tamano_id),
              ...cerrados, fecha_ingreso: d.fecha_ingreso, requisitos, vacunas, peso_kg: peso, altura_cm: altura,
              esterilizado: ester, fecha_esterilizacion: ester ? d.fecha_esterilizacion : null, desparasitado: d.desparasitado === 'si',
            };
          } catch (err) { return errorEn(f, err.message); }
          const b = $('button[type="submit"]', f);
          ocupado(b);
          try {
            let r;
            try {
              r = await api(id ? `/refugio/animales/${id}` : '/refugio/animales', { metodo: id ? 'PUT' : 'POST', datos });
            } catch (err) {
              if (err.status !== 409 || err.datos.codigo !== 'REINICIO') throw err;
              // Cambios fuertes con solicitudes activas: confirmar que se cancelan y se avisa a cada adoptante
              const seguir = await dialogo({
                titulo: 'Se cancelarán solicitudes', texto: err.message, confirmar: 'Guardar y cancelar solicitudes', peligro: true,
                accion: async () => { r = await api(`/refugio/animales/${id}`, { metodo: 'PUT', datos: { ...datos, confirmar_reinicio: true } }); },
              });
              if (!seguir) { ocupado(b, false); return; }
            }
            aviso(r.mensaje);
            location.hash = '#/refugio';
          } catch (err) {
            ocupado(b, false);
            errorEn(f, textoError(err, 'No se pudo publicar el animal. Intente de nuevo.'));
          }
        });
      },
    };
  }

  /* ---------- RF-18 a RF-22: solicitudes recibidas ---------- */
  async function perfilRefugio(refrescar) {
    if (!estado.perfil || refrescar) estado.perfil = await api('/refugio/perfil');
    return estado.perfil;
  }

  /* Bloques de 30 minutos dentro del horario del día (RF-21) */
  const bloques = (abre, cierra) => {
    const aMin = (h) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3));
    const res = [];
    for (let m = Math.ceil(aMin(abre) / 30) * 30; m + 30 <= aMin(cierra); m += 30) res.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
    return res;
  };

  async function agendarCita(s) {
    const p = await perfilRefugio();
    const hoy = hoyCDMX();
    const dias = Array.from({ length: 14 }, (_, i) => sumarDias(hoy, i + 1)).map((f) => {
      const h = p.horario.find((x) => x.dia === diaSemana(f));
      return { f, h, cerrado: !h || Number(h.cerrado) };
    });
    return dialogo({
      titulo: `Cita con ${s.adoptante}`,
      texto: `Para conocer a ${s.animal} y entregar los documentos. Fechas disponibles: las próximas 2 semanas.`,
      cuerpo: html`
        <label class="campo"><span class="campo__etiqueta">Fecha</span>
          <select class="campo__entrada" name="fecha"><option value="">Selecciona una fecha</option>
            ${dias.map((d) => html`<option value="${d.f}"${si(d.cerrado, 'disabled')}>${fechaBonita(d.f)} · ${d.f}${d.cerrado ? ' (cerrado)' : ''}</option>`)}</select></label>
        <label class="campo"><span class="campo__etiqueta">Hora</span><select class="campo__entrada" name="hora" disabled><option value="">Primero elige la fecha</option></select></label>`,
      confirmar: s.cita_fecha ? 'Reprogramar cita' : 'Agendar cita',
      montar(d) {
        const sf = $('[name="fecha"]', d);
        const sh = $('[name="hora"]', d);
        sf.addEventListener('change', () => {
          const dia = dias.find((x) => x.f === sf.value);
          sh.disabled = !dia || dia.cerrado;
          sh.innerHTML = String(dia && !dia.cerrado
            ? html`<option value="">Selecciona la hora</option>${bloques(dia.h.abre, dia.h.cierra).map((b) => html`<option>${b}</option>`)}`
            : html`<option value="">Primero elige la fecha</option>`);
        });
      },
      accion: async (f) => {
        if (!f.fecha.value) fallo('La fecha debe estar dentro de los próximos 14 días.');
        if (!f.hora.value) fallo('Seleccione una hora en bloques de 30 minutos.');
        await api(`/refugio/solicitudes/${s.id}/cita`, { metodo: 'POST', datos: { fecha: f.fecha.value, hora: f.hora.value } });
      },
    });
  }

  /* ---------- Protocolo: visita domiciliaria, entrega y seguimiento ---------- */
  function registrarVisita(s) {
    return dialogo({
      titulo: `Visita domiciliaria · ${s.adoptante}`,
      texto: 'Revisa que el hogar sea seguro y adecuado para el perro (espacio, protección del sol y la lluvia, convivencia).',
      cuerpo: html`
        <div class="pastillas" role="radiogroup">
          ${[['realizada', 'Realizada: el hogar es apto'], ['no_requerida', 'No fue necesaria'], ['no_apta', 'El hogar no es apto']].map(([v, t]) => html`
            <label class="pastilla"><input type="radio" name="resultado" value="${v}"${si(s.visita === v, 'checked')}><span>${t}</span></label>`)}
        </div>
        <label class="campo" data-fecha-visita><span class="campo__etiqueta">Fecha de la visita</span><input class="campo__entrada" type="date" name="fecha" min="${s.aprobada}" max="${hoyCDMX()}" value="${s.visita_en || hoyCDMX()}"></label>
        <label class="campo" data-motivo-visita hidden><span class="campo__etiqueta">¿Por qué no es apto?</span><textarea class="campo__textarea" name="motivo" maxlength="300" placeholder="Se le enviará a la persona adoptante (10 a 300 caracteres)"></textarea></label>`,
      confirmar: 'Guardar',
      montar(d) {
        const pintar = () => {
          const v = ($('input[name="resultado"]:checked', d) || {}).value;
          $('[data-fecha-visita]', d).hidden = v === 'no_requerida';
          $('[data-motivo-visita]', d).hidden = v !== 'no_apta';
        };
        d.addEventListener('change', pintar);
        pintar();
      },
      accion: async (f) => {
        const v = ($('input[name="resultado"]:checked', f) || {}).value;
        if (!v) fallo('Seleccione el resultado de la visita domiciliaria.');
        const datos = { resultado: v, fecha: f.fecha.value };
        if (v === 'no_apta') datos.motivo = revisarTexto(f.motivo.value, { min: 10, max: 300, campo: 'El motivo', minPalabras: 2, lineas: 1 });
        aviso((await api(`/refugio/solicitudes/${s.id}/visita`, { metodo: 'PUT', datos })).mensaje);
      },
    });
  }

  /* Lista de entrega (Ley de Protección y Bienestar de los Animales de la CDMX, art. 32) */
  function entregar(s) {
    const meses = Reglas.mesesDeEdad(s.edad);
    const esterilizado = Number(s.esterilizado) === 1;
    if (!s.visita) { aviso('Antes de entregar, registra la visita domiciliaria (realizada o no requerida).', 'error'); return Promise.resolve(false); }
    return dialogo({
      titulo: `Entrega de ${s.animal} a ${s.adoptante}`,
      texto: 'Confirma cada punto. Después se programa el seguimiento a la semana, al mes y a los 3 meses.',
      ancho: true,
      cuerpo: html`
        <label class="campo"><span class="campo__etiqueta">Fecha de entrega</span><input class="campo__entrada" type="date" name="fecha" min="${s.aprobada}" max="${hoyCDMX()}" value="${hoyCDMX()}"></label>
        <fieldset class="seccion seccion--compacta"><legend>Lista de entrega</legend>
          <label class="casilla"><input type="checkbox" name="carta_firmada"><span>La persona adoptante firmó la carta compromiso de adopción.</span></label>
          <label class="casilla"><input type="checkbox" name="desparasitado"><span>${s.animal} está desparasitado.</span></label>
          <label class="casilla"><input type="checkbox" name="cartilla"><span>Se entregó la cartilla de vacunación.</span></label>
          ${esterilizado ? html`<p class="nota">✓ ${s.animal} ya está registrado como esterilizado.</p>`
    : html`<label class="casilla"><input type="checkbox" name="esterilizado"><span>${s.animal} ya fue esterilizado.</span></label>
            ${meses != null && meses < 6 ? html`<label class="campo" data-compromiso><span class="campo__etiqueta">Si aún no: fecha comprometida para esterilizarlo (cachorro)</span>
              <input class="campo__entrada" type="date" name="esterilizar_antes" min="${sumarDias(hoyCDMX(), 1)}" max="${sumarDias(hoyCDMX(), 240)}"></label>` : html`<p class="nota">Un perro de 6 meses o más debe entregarse esterilizado.</p>`}`}
          <label class="campo"><span class="campo__etiqueta">Folio del RUAC <span class="opcional">(si ya se registró)</span></span>
            <input class="campo__entrada" name="ruac" maxlength="30" placeholder="Registro Único de Animales de Compañía"></label>
        </fieldset>`,
      confirmar: 'Registrar adopción',
      accion: async (f) => {
        if (!f.fecha.value || f.fecha.value > hoyCDMX() || f.fecha.value < s.aprobada) fallo('La fecha de entrega debe estar entre la fecha de aprobación y hoy.');
        const entrega = {
          carta_firmada: f.carta_firmada.checked, desparasitado: f.desparasitado.checked, cartilla: f.cartilla.checked,
          esterilizado: esterilizado || (f.esterilizado && f.esterilizado.checked), esterilizar_antes: f.esterilizar_antes ? f.esterilizar_antes.value : '', ruac: f.ruac.value.trim(),
        };
        if (!entrega.carta_firmada) fallo('La persona adoptante debe firmar la carta compromiso.');
        if (!entrega.desparasitado) fallo(`${s.animal} debe entregarse desparasitado.`);
        if (!entrega.cartilla) fallo('Entrega la cartilla de vacunación.');
        if (!entrega.esterilizado && !entrega.esterilizar_antes) fallo(meses != null && meses < 6 ? 'Indica la fecha comprometida para esterilizarlo.' : `${s.animal} debe entregarse esterilizado.`);
        const r = await api(`/refugio/solicitudes/${s.id}/adopcion`, { metodo: 'POST', datos: { fecha: f.fecha.value, entrega } });
        aviso(r.mensaje);
      },
    });
  }

  function registrarSeguimiento(x, s) {
    return dialogo({
      titulo: `Seguimiento de ${ETAPAS[x.etapa]} · ${s.animal}`,
      texto: `Contacta a ${s.adoptante}${s.adoptante_telefono ? ` (${s.adoptante_telefono})` : ''} y registra cómo está ${s.animal}.`,
      cuerpo: html`
        <div class="pastillas" role="radiogroup">${Object.entries(RESULTADOS).map(([v, t]) => html`<label class="pastilla"><input type="radio" name="resultado" value="${v}"><span>${t}</span></label>`)}</div>
        <label class="campo"><span class="campo__etiqueta">Notas <span class="opcional">(obligatorias si no todo está bien)</span></span><textarea class="campo__textarea" name="notas" maxlength="300"></textarea></label>`,
      confirmar: 'Guardar seguimiento',
      accion: async (f) => {
        const v = ($('input[name="resultado"]:checked', f) || {}).value;
        if (!v) fallo('Seleccione cómo está el perro.');
        const notas = f.notas.value.replace(/\s/g, '') || v !== 'bien' ? revisarTexto(f.notas.value, { min: 5, max: 300, campo: 'Las notas', minPalabras: 1, lineas: 4 }) : null;
        aviso((await api(`/refugio/seguimientos/${x.id}`, { metodo: 'PUT', datos: { resultado: v, notas } })).mensaje);
      },
    });
  }

  const VISTAS_SOL = [['pendiente', 'Pendientes'], ['aprobada', 'En proceso'], ['adoptada', 'Adoptadas'], ['rechazada', 'Cerradas']];
  async function vistaRefugioSolicitudes(ctx) {
    const foco = idValido(ctx.query.get('id'));
    const animalFiltro = idValido(ctx.query.get('animal_id'));
    const filtro = VISTAS_SOL.some(([v]) => v === ctx.query.get('estado')) ? ctx.query.get('estado') : 'pendiente';
    const r = await api(foco ? `/refugio/solicitudes?id=${foco}` : animalFiltro ? `/refugio/solicitudes?animal_id=${animalFiltro}` : `/refugio/solicitudes?estado=${filtro}`);
    const lista = r.solicitudes;
    const hoy = hoyCDMX();
    const acciones = (s) => {
      if (s.estado === 'pendiente') {
        return html`<button class="boton-contorno boton-contorno--chico boton-contorno--relleno" type="button" data-accion="aprobar" data-id="${s.id}">Aprobar</button>
          <button class="boton-contorno boton-contorno--chico boton-contorno--peligro" type="button" data-accion="rechazar" data-id="${s.id}">Rechazar</button>`;
      }
      if (s.estado === 'aprobada' && !s.concretada_en && s.animal_estado === 'disponible') {
        return html`<button class="boton-contorno boton-contorno--chico" type="button" data-accion="cita" data-id="${s.id}">${s.cita_fecha ? 'Reprogramar cita' : '1 · Agendar cita'}</button>
          <button class="boton-contorno boton-contorno--chico" type="button" data-accion="visita" data-id="${s.id}">${s.visita ? 'Cambiar visita' : '2 · Registrar visita'}</button>
          <button class="boton-contorno boton-contorno--chico boton-contorno--relleno" type="button" data-accion="adopcion" data-id="${s.id}"${si(!s.visita, 'disabled title="Registra primero la visita domiciliaria"')}>3 · Entregar</button>
          <button class="boton-contorno boton-contorno--chico boton-contorno--peligro" type="button" data-accion="rechazar" data-id="${s.id}">Cancelar aprobación</button>`;
      }
      return '';
    };
    const seguimientos = (s) => (s.concretada_en && s.seguimientos.length ? html`
      <ul class="seguimiento">${s.seguimientos.map((x) => html`
        <li class="${x.realizado_en ? 'hecho' : x.programado <= hoy ? 'toca' : ''}"><span>${ETAPAS[x.etapa]} · ${x.programado}</span>
          <span>${x.realizado_en ? `✓ ${RESULTADOS[x.resultado]}${x.notas ? ` — ${x.notas}` : ''}` : html`<button class="enlace" type="button" data-seguimiento="${x.id}" data-id="${s.id}">${x.programado <= sumarDias(hoy, 3) ? 'Registrar' : 'Pendiente'}</button>`}</span></li>`)}</ul>` : '');
    return {
      html: html`
      <section class="principal">
        <h1 class="titulo-pagina">Solicitudes recibidas</h1>
        ${subnavRefugio('#/refugio/solicitudes')}
        <div class="contenedor contenedor--estrecho">
          ${lineaProceso(-1)}
          <div class="pestanas" role="group" aria-label="Filtrar por estado">
            ${VISTAS_SOL.map(([v, t]) => html`<a class="pestana" href="#/refugio/solicitudes?estado=${v}"${si(!foco && !animalFiltro && v === filtro, 'aria-current="page"')}>${t}${r.cuentas[v] ? html` <span class="pestana__n">${r.cuentas[v]}</span>` : ''}</a>`)}
          </div>
          ${foco || animalFiltro ? html`<p class="nota centrado">${foco ? 'Mostrando la solicitud de la notificación.' : 'Mostrando las solicitudes de una mascota.'} <a class="enlace" href="#/refugio/solicitudes">Ver todas</a></p>` : ''}
          ${!lista.length ? html`<div class="vacio">${seguro(SVG_HUELLA)}No hay solicitudes en esta sección.</div>`
    : html`<ul class="filas filas--solicitudes">${lista.map((s) => {
      const cerrada = ['rechazada', 'cancelada'].includes(s.estado);
      return html`
            <li class="fila fila--solicitud" data-solicitud="${s.id}">
              <button class="boton-ficha" type="button" data-ver="${s.animal_id}" aria-label="Ver ficha de ${s.animal}"><span class="fila__imagen">${dibujo(s)}</span></button>
              <div class="fila__cuerpo">
                <div class="fila__cabeza">
                  <div><p class="fila__titulo"><button class="enlace" type="button" data-ver="${s.animal_id}">${s.animal}</button> · ${s.adoptante}</p>
                    <p class="fila__meta">${s.adoptante_correo}${s.adoptante_telefono ? html` · <a class="enlace" href="tel:${s.adoptante_telefono}">Tel. ${s.adoptante_telefono}</a>` : ''} · Enviada ${s.enviada}</p></div>
                  ${insignia(s.concretada_en ? 'adoptada' : s.estado, s.concretada_en ? 'Adoptada' : ETQ[s.estado])}
                </div>
                ${cerrada ? '' : lineaProceso(pasoActual(s) - 1)}
                ${s.motivo_rechazo ? html`<p class="fila__detalle">Motivo: ${s.motivo_rechazo}</p>` : ''}
                ${s.visita ? html`<p class="fila__detalle">🏠 Visita domiciliaria: ${{ realizada: `realizada el ${s.visita_en}`, no_requerida: 'no requerida', no_apta: `hogar no apto (${s.visita_en})` }[s.visita]}</p>` : ''}
                ${s.concretada_en ? html`<p class="fila__detalle">Entregado el ${s.concretada_en}${s.entrega && s.entrega.ruac ? ` · RUAC ${s.entrega.ruac}` : ''}${s.entrega && s.entrega.esterilizar_antes ? ` · Esterilizar antes del ${s.entrega.esterilizar_antes}` : ''}</p>`
    : s.cita_fecha ? tablaCita(s, 'refugio') : ''}
                ${seguimientos(s)}
                ${resumenEnviado(s, 'Formato de adopción', s.estado === 'pendiente')}
                ${conversacion(s, s.id === foco)}
                <div class="acciones">${acciones(s)}</div>
                <p class="acciones acciones--compactas"><button class="enlace" type="button" data-reportar-usuario="${s.adoptante_id}" data-nombre="${s.adoptante}">Reportar a esta persona</button></p>
              </div>
            </li>`;
    })}</ul>`}
        </div>
      </section>`,
      montar(raiz) {
        montarConversaciones(raiz);
        enfocarSolicitud(raiz, foco);
        raiz.addEventListener('click', async (e) => {
          const ver = e.target.closest('[data-ver]');
          if (ver) { verMascota(ver.dataset.ver); return; }
          const rep = e.target.closest('[data-reportar-usuario]');
          if (rep) { reportar('usuario', Number(rep.dataset.reportarUsuario), rep.dataset.nombre); return; }
          const sg = e.target.closest('[data-seguimiento]');
          if (sg) {
            const s = lista.find((x) => x.id === Number(sg.dataset.id));
            const x = s.seguimientos.find((y) => y.id === Number(sg.dataset.seguimiento));
            if (x.programado > sumarDias(hoy, 3)) { aviso(`Este seguimiento toca el ${x.programado}.`, 'error'); return; }
            if (await registrarSeguimiento(x, s)) navegar();
            return;
          }
          const b = e.target.closest('[data-accion]');
          if (!b) return;
          const s = lista.find((x) => x.id === Number(b.dataset.id));
          let ok = false;
          if (b.dataset.accion === 'aprobar') {
            ok = await dialogo({ titulo: 'Aprobar solicitud', texto: `Se notificará a ${s.adoptante} que su solicitud para ${s.animal} fue aprobada. Después agenda la cita y la visita domiciliaria.`, confirmar: 'Aprobar', accion: () => api(`/refugio/solicitudes/${s.id}/aprobar`, { metodo: 'POST' }) });
          } else if (b.dataset.accion === 'rechazar') {
            ok = await dialogo({
              titulo: s.estado === 'aprobada' ? 'Cancelar aprobación' : 'Rechazar solicitud',
              texto: s.estado === 'aprobada' ? `La solicitud de ${s.adoptante} pasará a Rechazada y se cancelará su cita. Así podrás aprobar otra solicitud para ${s.animal}.` : '',
              confirmar: 'Rechazar', peligro: true,
              cuerpo: html`<label class="campo"><span class="campo__etiqueta">Motivo del rechazo</span><textarea class="campo__textarea" name="motivo" maxlength="300" placeholder="Explica brevemente el motivo (10 a 300 caracteres)"></textarea></label>`,
              accion: async (f) => {
                if (!f.motivo.value.trim()) fallo('Debe ingresar el motivo del rechazo.');
                const m = revisarTexto(f.motivo.value, { min: 10, max: 300, campo: 'El motivo', minPalabras: 2, lineas: 1 });
                await api(`/refugio/solicitudes/${s.id}/rechazar`, { metodo: 'POST', datos: { motivo: m } });
              },
            });
          } else if (b.dataset.accion === 'cita') {
            ok = await agendarCita(s);
          } else if (b.dataset.accion === 'visita') {
            ok = await registrarVisita(s);
            if (ok) { navegar(); return; }
          } else if (b.dataset.accion === 'adopcion') {
            ok = await entregar(s);
            if (ok) { navegar(); return; }
          }
          if (ok) { aviso('Listo.'); navegar(); }
        });
      },
    };
  }

  /* ---------- RF-11: perfil del Refugio ---------- */
  const ETQ_CAMBIO = { nombre: 'nombre', institucion: 'institución', telefono: 'teléfono', horario: 'horario' };
  const camposCambio = (datos) => [...new Set(Object.keys(datos || {}).map((k) => ETQ_CAMBIO[k] || 'dirección'))].join(', ');
  async function vistaRefugioPerfil() {
    const [cat, p] = await Promise.all([catalogos(), perfilRefugio(true)]);
    return {
      html: html`
      <section class="principal">
        <h1 class="titulo-pagina">Perfil del refugio</h1>
        ${subnavRefugio('#/refugio/perfil')}
        <section class="panel panel--ancho">
          <h2 class="panel__titulo">${p.nombre}</h2>
          <p class="cuenta__subtitulo">${p.institucion} · ${p.correo}</p>
          ${p.cambio_pendiente ? html`<div class="mensaje mensaje--aviso" role="status">⏳ Enviaste un cambio el ${p.cambio_pendiente.creado_en} (${camposCambio(p.cambio_pendiente.datos)}). Se aplicará cuando el Administrador lo apruebe; mientras, tu perfil público muestra los datos actuales.</div>` : ''}
          ${!p.cambio_pendiente && p.ultimo_rechazo ? html`<div class="mensaje mensaje--error" role="status">Tu último cambio no fue aprobado (${p.ultimo_rechazo.revisado_en}): ${p.ultimo_rechazo.motivo}</div>` : ''}
          <p class="nota">Por seguridad, los cambios de institución, dirección, teléfono y horario los revisa el Administrador antes de publicarse.</p>
          <form class="formulario formulario--dos" novalidate data-perfil>
            ${camposRefugio(cat, { ...p, ...(p.cambio_pendiente ? p.cambio_pendiente.datos : {}) }, true)}
            <p class="mensaje mensaje--error campo--ancho" data-error role="alert"></p>
            <div class="panel__acciones campo--ancho acciones acciones--centro">
              <button class="boton-contorno boton-contorno--relleno" type="submit">${p.cambio_pendiente ? 'Actualizar cambio en revisión' : 'Enviar cambio a revisión'}</button>
              <a class="boton-contorno" href="#/cuenta">Nombre y contraseña</a>
            </div>
          </form>
        </section>
      </section>`,
      montar(raiz) {
        const f = $('[data-perfil]', raiz);
        montarHorario(f);
        soloDigitos(f);
        montarDireccion(f);
        f.addEventListener('submit', async (e) => {
          e.preventDefault();
          let datos;
          try { datos = validarCamposRefugio(f, cat, true); } catch (err) { return errorEn(f, err.message); }
          const b = $('button[type="submit"]', f);
          ocupado(b);
          try {
            const r = await api('/refugio/perfil', { metodo: 'PUT', datos });
            estado.perfil = null;
            aviso(r.mensaje);
            navegar();
          } catch (err) { errorEn(f, textoError(err)); ocupado(b, false); }
        });
      },
    };
  }

  /* ---------- RF-35: estadísticas propias ---------- */
  function vistaRefugioEstadisticas() {
    return {
      html: html`
      <section class="principal">
        <h1 class="titulo-pagina">Mis estadísticas</h1>
        ${subnavRefugio('#/refugio/estadisticas')}
        <section class="panel">${selectorPeriodo()}<div data-cifras></div></section>
      </section>`,
      montar(raiz) {
        const pintar = async (params) => {
          const r = await api(conQuery('/refugio/estadisticas', params));
          $('[data-cifras]', raiz).innerHTML = String(html`
            <div class="cifras">
              <article class="cifra cifra--azul"><span class="cifra__numero">${r.ingresos}</span><span class="cifra__texto">animales ingresaron</span></article>
              <article class="cifra cifra--durazno"><span class="cifra__numero">${r.adopciones}</span><span class="cifra__texto">adopciones concretadas</span></article>
            </div>
            <p class="nota">Periodo: ${r.inicio} a ${r.fin}</p>
            ${!r.ingresos && !r.adopciones ? html`<p class="mensaje">No hay animales ni adopciones en el periodo seleccionado.</p>` : ''}`);
        };
        montarPeriodo(raiz, pintar);
        pintar({ periodo: '7' }).catch(() => {});
      },
    };
  }
