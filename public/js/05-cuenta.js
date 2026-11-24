/* Dopta · Acceso y cuenta: registro, login, solicitudes del adoptante, notificaciones (sección 11)
   Los archivos de public/js/ se cargan como scripts clásicos, en orden (ver index.html), y comparten el mismo ámbito global. */
'use strict';

  /*  11. Acceso y cuenta  */
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

  /*  RF-05: iniciar sesión  */
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

  /* Nombre de un refugio o institución: largo, solo letras y sin nombres genéricos (mismas reglas que el servidor) */
  function validarNombreRefugio(nombre, mensaje = M.refugio) {
    if (!V.entre(nombre, 3, 120)) fallo(mensaje);
    if (!V.letras(nombre)) fallo(M.letras);
    revisarNombre(nombre, 'refugio');
  }

  function validarCamposRefugio(f, cat, conInstitucion = true) {
    const d = datosForm(f);
    if (conInstitucion) validarNombreRefugio(d.institucion, M.institucion);
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
  /* Lista desplegable de sugerencias (teclado y ratón) que comparten el buscador de dirección y el de calle.
     consultar(texto) devuelve null si no hay que buscar, o una función async que trae las opciones;
     itemHtml(opcion, i) pinta cada opción (su id debe ser `${prefijo}-${i}`); alElegir(opcion) recibe la elegida. */
  function listaSugerencias({ campo, lista, prefijo, consultar, itemHtml, alElegir, soloUsuario = false }) {
    let opciones = [];
    let activa = -1;
    let reloj;
    let pedido = 0;
    const cerrar = () => { lista.hidden = true; campo.setAttribute('aria-expanded', 'false'); campo.removeAttribute('aria-activedescendant'); activa = -1; };
    const marcar = (i) => {
      activa = i;
      $$('[role="option"]', lista).forEach((li, k) => li.setAttribute('aria-selected', String(k === i)));
      if (i >= 0) campo.setAttribute('aria-activedescendant', `${prefijo}-${i}`);
    };
    const pintar = () => {
      if (!opciones.length) return cerrar();
      lista.innerHTML = String(html`${opciones.map((o, i) => itemHtml(o, i))}
        <li class="direccion__google" aria-hidden="true">con tecnología de Google</li>`);
      lista.hidden = false;
      campo.setAttribute('aria-expanded', 'true');
    };
    campo.addEventListener('input', (e) => {
      if (soloUsuario && !e.isTrusted) return;
      clearTimeout(reloj);
      const pedir = consultar(campo.value.trim());
      if (!pedir) { opciones = []; return cerrar(); }
      reloj = setTimeout(async () => {
        const n = ++pedido;
        try {
          const r = await pedir();
          if (n !== pedido) return;
          opciones = r || [];
          pintar();
        } catch { if (n === pedido) { opciones = []; cerrar(); } }
      }, 300);
    });
    campo.addEventListener('keydown', (e) => {
      if (lista.hidden) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); marcar((activa + 1) % opciones.length); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); marcar((activa - 1 + opciones.length) % opciones.length); }
      else if (e.key === 'Enter' && activa >= 0) { e.preventDefault(); alElegir(opciones[activa]); }
      else if (e.key === 'Escape') cerrar();
    });
    lista.addEventListener('mousedown', (e) => {
      const li = e.target.closest('[role="option"]');
      if (!li) return;
      e.preventDefault(); // conserva el foco en el campo
      alElegir(opciones[Number(li.dataset.i)]);
    });
    campo.addEventListener('blur', () => setTimeout(cerrar, 150));
    return { cerrar };
  }

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
    const elegir = async (o) => {
      sug.cerrar();
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

    const sug = listaSugerencias({
      campo, lista, prefijo: 'dir-op',
      consultar: (texto) => (texto.length < 3 ? null : async () => (await api('/lugares/sugerencias', { metodo: 'POST', datos: { texto, sesion } })).sugerencias),
      itemHtml: (o, i) => html`
        <li role="option" id="dir-op-${i}" data-i="${i}" aria-selected="false"><strong>${o.principal}</strong><span>${o.secundario}</span></li>`,
      alElegir: elegir,
    });
  }

  /* 3) Calle: sugerencias de Google acotadas al C.P., la colonia y la alcaldía ya elegidos */
  function montarCalles(caja, cp, selCol) {
    const campo = $('#calle', caja);
    const lista = $('#calles-lista', caja);
    let sesion = nuevaSesion();
    const elegir = (o) => { campo.value = o.calle; sug.cerrar(); sesion = nuevaSesion(); campo.dispatchEvent(new Event('input')); $('[name="num_ext"]', caja).focus(); };
    const sug = listaSugerencias({
      campo, lista, prefijo: 'calle-op', soloUsuario: true,
      consultar: (texto) => (texto.length < 2 || !/^\d{5}$/.test(cp.value) || !selCol.value ? null
        : async () => (await api('/lugares/calles', { metodo: 'POST', datos: { cp: cp.value, colonia: selCol.value, texto, sesion } })).calles),
      itemHtml: (o, i) => html`
            <li role="option" id="calle-op-${i}" data-i="${i}" aria-selected="false"><strong>${o.calle}</strong><span>${o.zona}</span></li>`,
      alElegir: elegir,
    });
  }

  /* Solo dígitos en los campos de teléfono */
  const soloDigitos = (raiz) => $$('input[type="tel"]', raiz).forEach((t) => t.addEventListener('input', () => { t.value = t.value.replace(/\D/g, '').slice(0, 10); }));

  /*  RF-01 a RF-04: registro  */
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
            if (tipo === 'refugio') validarNombreRefugio(d.nombre);
            else {
              if (!V.nombre(d.nombre.replace(/\s+/g, ' '))) fallo(M.nombre);
              revisarNombre(d.nombre, 'persona');
            }
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

  /*  RF-25: verificación rechazada, el refugio reenvía todos sus datos  */
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
            validarNombreRefugio(d.nombre);
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

  /*  RF-08: recuperar contraseña  */
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

  /*  RF-07, RF-09, RF-10: mi cuenta  */
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

  /*  RF-24: notificaciones  */
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

  /*  RF-17: mis solicitudes  */
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
  /* Si se llegó desde una notificación (#/...?id=12), resalta esa solicitud */
  function enfocarSolicitud(raiz, id) {
    if (!id) return;
    const li = $(`[data-solicitud="${id}"]`, raiz);
    if (!li) return;
    li.classList.add('fila--resaltada');
    $$('details', li).forEach((d) => { if (d.matches('.chat')) d.open = true; });
    setTimeout(() => li.scrollIntoView({ block: 'center', behavior: 'smooth' }), 120);
  }
  const ETAPAS = { '1_semana': '1 semana', '1_mes': '1 mes', '3_meses': '3 meses' };
  const RESULTADOS = { bien: 'Todo bien', con_dudas: 'Con dudas', problema: 'Hay un problema', sin_contacto: 'Sin contacto' };

  /* Cita de adopción en tabla: qué día, a qué hora, dónde y qué llevar */
  function tablaCita(s, para) {
    const filas = para === 'adoptante'
      ? [
        ['Día', fechaBonita(s.cita_fecha)],
        ['Hora', `${s.cita_hora} h`],
        ['Refugio', s.refugio],
        ['Dirección', html`${s.direccion} · <a class="enlace" href="${mapaUrl(s, true)}" target="_blank" rel="noopener noreferrer">Cómo llegar</a>`],
        ['Teléfono', html`<a class="enlace" href="tel:${s.telefono}">${s.telefono}</a>`],
        ['Qué llevar', s.requisitos && s.requisitos.length ? html`<ul class="tabla-cita__lista">${s.requisitos.map((r) => html`<li>${r}</li>`)}</ul>` : 'Identificación oficial'],
      ]
      : [
        ['Día', fechaBonita(s.cita_fecha)],
        ['Hora', `${s.cita_hora} h`],
        ['Adoptante', s.adoptante],
        ['Teléfono', s.adoptante_telefono ? html`<a class="enlace" href="tel:${s.adoptante_telefono}">${s.adoptante_telefono}</a>` : 'Sin teléfono'],
        ['Mascota', s.animal],
      ];
    return html`<table class="tabla-cita"><caption> Cita de adopción</caption>
      <tbody>${filas.map(([k, v]) => html`<tr><th scope="row">${k}</th><td>${v}</td></tr>`)}</tbody></table>`;
  }

  async function vistaMisSolicitudes(ctx) {
    let lista = null;
    try { lista = await api('/solicitudes/mias'); } catch { /* se muestra el mensaje */ }
    const foco = idValido(ctx.query.get('id'));
    const activas = (lista || []).filter((s) => ['pendiente', 'aprobada'].includes(s.estado) && !s.concretada_en);
    return {
      html: html`
      <section class="principal">
        <div class="contenedor contenedor--estrecho">
          <h1 class="titulo-pagina">Mis solicitudes</h1>
          ${lista && lista.length ? html`<p class="nota centrado">${activas.length} activa${activas.length === 1 ? '' : 's'} de 5 posibles · Toca “Mensajes” para hablar con el refugio.</p>` : ''}
          ${lista === null ? html`<p class="mensaje mensaje--error">No se pudo cargar la lista. Intente de nuevo.</p>`
    : !lista.length ? html`<div class="vacio">${seguro(SVG_HUELLA)}No tiene solicitudes registradas.<p><a class="boton-contorno" href="#/">Ver el catálogo</a></p></div>`
      : html`<ul class="filas filas--solicitudes">${lista.map((s) => {
        const cerrada = ['rechazada', 'cancelada'].includes(s.estado);
        const sinRespuesta = s.estado === 'pendiente' && !s.mensajes.some((m) => !m.mio);
        return html`
            <li class="fila fila--solicitud" data-solicitud="${s.id}">
              <div class="fila__imagen">${imagenAnimal(s)}</div>
              <div class="fila__cuerpo">
                <div class="fila__cabeza">
                  <div><p class="fila__titulo"><a class="enlace" href="#/animal/${s.animal_id}">${s.animal}</a></p>
                    <p class="fila__meta"><a class="enlace" href="#/refugios/${s.refugio_id}">${s.refugio}</a> · Enviada ${s.enviada}</p></div>
                  ${insignia(s.concretada_en ? 'adoptada' : s.estado, s.concretada_en ? '¡Adoptado!' : ETQ[s.estado])}
                </div>
                ${lineaProceso(cerrada ? 0 : pasoActual(s) - 1, cerrada)}
                ${cerrada && s.motivo_rechazo ? html`<p class="fila__detalle">Motivo: ${s.motivo_rechazo}</p>` : ''}
                ${sinRespuesta ? html`<p class="fila__detalle">El refugio aún no responde. Abajo puedes ver lo que le enviaste.</p>` : ''}
                ${s.concretada_en ? html`<p class="fila__detalle"> Adopción concretada el ${s.concretada_en}.${s.entrega && s.entrega.ruac ? ` Folio RUAC: ${s.entrega.ruac}.` : ' Recuerda registrarlo en el RUAC.'}${s.entrega && s.entrega.esterilizar_antes ? ` Esterilización comprometida antes del ${s.entrega.esterilizar_antes}.` : ''}</p>
                  ${s.seguimientos.length ? html`<ul class="seguimiento">${s.seguimientos.map((x) => html`<li class="${x.realizado_en ? 'hecho' : ''}"><span>${ETAPAS[x.etapa]}</span><span>${x.realizado_en ? `✓ ${RESULTADOS[x.resultado]}` : `El refugio te contactará el ${x.programado}`}</span></li>`)}</ul>` : ''}`
    : s.cita_fecha ? tablaCita(s, 'adoptante')
      : s.estado === 'aprobada' ? html`<p class="fila__detalle"> El refugio aprobó tu solicitud y agendará tu cita pronto.</p>` : ''}
                ${s.visita && !s.concretada_en ? html`<p class="fila__detalle"> Visita domiciliaria: ${s.visita === 'realizada' ? `realizada el ${s.visita_en}` : 'no fue necesaria'}.</p>` : ''}
                ${resumenEnviado(s, 'Lo que enviaste al refugio', sinRespuesta && s.id === foco)}
                ${conversacion(s, s.id === foco)}
                <p class="acciones acciones--compactas">
                  ${['pendiente', 'aprobada'].includes(s.estado) && !s.concretada_en ? html`<button class="enlace enlace--peligro" type="button" data-cancelar-sol="${s.id}">Retirar solicitud</button> ·` : ''}
                  <button class="enlace" type="button" data-reportar-refugio="${s.refugio_id}">Reportar refugio</button>
                </p>
              </div>
            </li>`;
      })}</ul>`}
        </div>
      </section>`,
      montar(raiz) {
        montarConversaciones(raiz);
        enfocarSolicitud(raiz, foco);
        $$('[data-cancelar-sol]', raiz).forEach((b) => b.addEventListener('click', async () => {
          const ok = await dialogo({
            titulo: '¿Retirar tu solicitud?', texto: 'El refugio recibirá un aviso. Podrás volver a solicitar si el perro sigue disponible.', confirmar: 'Retirar', peligro: true,
            accion: () => api(`/solicitudes/${b.dataset.cancelarSol}/cancelar`, { metodo: 'POST' }),
          });
          if (ok) { aviso('Solicitud retirada.'); navegar(); }
        }));
        $$('[data-reportar-refugio]', raiz).forEach((b) => b.addEventListener('click', () => reportar('refugio', Number(b.dataset.reportarRefugio))));
      },
    };
  }
