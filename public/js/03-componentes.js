/* Dopta · Componentes reutilizables (sección 9)
   Los archivos de public/js/ se cargan como scripts clásicos, en orden (ver index.html), y comparten el mismo ámbito global. */
'use strict';

  /*  9. Componentes  */
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
