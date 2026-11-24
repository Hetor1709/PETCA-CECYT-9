/* ==========================================================================
   Dopta · Vistas públicas: catálogo, fichas, refugios, cuestionario (sección 10)
   Los archivos de public/js/ se cargan como scripts clásicos, en orden (ver index.html), y comparten el mismo ámbito global.
   ========================================================================== */
'use strict';

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
