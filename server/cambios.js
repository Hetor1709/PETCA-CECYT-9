/* Cambios de datos del refugio que el Administrador aprueba antes de aplicarse
   (nombre, institución, dirección, teléfono y horario). Evita que un refugio se registre con datos reales,
   sea validado y después los cambie por otros que nunca se revisaron. */
const { q, uno, tx } = require('./db');
const { falla, ahora, notificar } = require('./util');

const CAMPOS_REFUGIO = ['institucion', 'direccion', 'calle', 'num_ext', 'num_int', 'colonia', 'cp', 'telefono', 'alcaldia_id', 'lat', 'lng', 'place_id'];
const ETIQUETAS = { nombre: 'Nombre', institucion: 'Institución', direccion: 'Dirección', telefono: 'Teléfono', horario: 'Horario' };

/* Valores vigentes del refugio en el mismo formato que los nuevos */
async function actuales(id, conn) {
  const r = await uno(
    `SELECT u.nombre, rf.institucion, rf.direccion, rf.calle, rf.num_ext, rf.num_int, rf.colonia, rf.cp, rf.telefono,
            rf.alcaldia_id, rf.lat, rf.lng, rf.place_id
       FROM usuarios u JOIN refugios rf ON rf.usuario_id = u.id WHERE u.id = ?`, [id], conn);
  r.lat = r.lat == null ? null : Number(r.lat);
  r.lng = r.lng == null ? null : Number(r.lng);
  r.horario = (await q('SELECT dia, cerrado, abre, cierra FROM refugio_horarios WHERE refugio_id = ? ORDER BY dia', [id], conn))
    .map((h) => ({ dia: h.dia, cerrado: Number(h.cerrado), abre: h.abre, cierra: h.cierra }));
  return r;
}

/* Un cambio se guarda en refugio_cambio_campos (un renglón por campo) y refugio_cambio_horarios (uno por día).
   cargarDetalle los vuelve a juntar como { datos, anteriores } para que la API y la interfaz no cambien. */
const NUMERICOS = new Set(['alcaldia_id', 'lat', 'lng']);
const aTexto = (v) => (v == null ? null : String(v));
const deTexto = (k, v) => (v == null ? null : NUMERICOS.has(k) ? Number(v) : v);

async function guardarDetalle(c, cambioId, datos, anteriores) {
  await q('DELETE FROM refugio_cambio_campos WHERE cambio_id = ?', [cambioId], c);
  await q('DELETE FROM refugio_cambio_horarios WHERE cambio_id = ?', [cambioId], c);
  for (const [k, v] of Object.entries(datos)) {
    if (k === 'horario') continue;
    await q('INSERT INTO refugio_cambio_campos (cambio_id, campo, nuevo, anterior) VALUES (?, ?, ?, ?)', [cambioId, k, aTexto(v), aTexto((anteriores || {})[k])], c);
  }
  if (Array.isArray(datos.horario)) {
    const antes = new Map(((anteriores || {}).horario || []).map((h) => [Number(h.dia), h]));
    for (const x of datos.horario) {
      const a = antes.get(Number(x.dia)) || {};
      await q(`INSERT INTO refugio_cambio_horarios (cambio_id, dia, cerrado, abre, cierra, anterior_cerrado, anterior_abre, anterior_cierra)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [cambioId, x.dia, x.cerrado, x.abre ?? null, x.cierra ?? null, a.cerrado ?? null, a.abre ?? null, a.cierra ?? null], c);
    }
  }
}

/* Agrega datos y anteriores (objetos) a una fila o lista de filas de refugio_cambios (cada una con su id) */
async function cargarDetalle(filas, conn) {
  const lista = (Array.isArray(filas) ? filas : [filas]).filter(Boolean);
  for (const f of lista) { f.datos = {}; f.anteriores = {}; }
  if (!lista.length) return filas;
  const por = new Map(lista.map((f) => [f.id, f]));
  const ids = [...por.keys()];
  for (const x of await q('SELECT cambio_id, campo, nuevo, anterior FROM refugio_cambio_campos WHERE cambio_id IN (?)', [ids], conn)) {
    const f = por.get(x.cambio_id);
    f.datos[x.campo] = deTexto(x.campo, x.nuevo);
    f.anteriores[x.campo] = deTexto(x.campo, x.anterior);
  }
  const hs = await q('SELECT cambio_id, dia, cerrado, abre, cierra, anterior_cerrado, anterior_abre, anterior_cierra FROM refugio_cambio_horarios WHERE cambio_id IN (?) ORDER BY cambio_id, dia', [ids], conn);
  for (const x of hs) {
    const f = por.get(x.cambio_id);
    (f.datos.horario ||= []).push({ dia: x.dia, cerrado: Number(x.cerrado), abre: x.abre, cierra: x.cierra });
    (f.anteriores.horario ||= []).push({ dia: x.dia, cerrado: x.anterior_cerrado == null ? null : Number(x.anterior_cerrado), abre: x.anterior_abre, cierra: x.anterior_cierra });
  }
  return filas;
}

const igual = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/* Guarda (o actualiza) la solicitud de cambio pendiente con solo los campos que cambian */
async function solicitarCambioRefugio(usuario, nuevos) {
  return tx(async (c) => {
    const ant = await actuales(usuario.id, c);
    const pendiente = await uno("SELECT id FROM refugio_cambios WHERE refugio_id = ? AND estado = 'pendiente' FOR UPDATE", [usuario.id], c);
    if (pendiente) await cargarDetalle(pendiente, c);
    const datos = { ...(pendiente ? pendiente.datos : {}) };
    for (const [k, v] of Object.entries(nuevos)) {
      if (igual(v, ant[k])) delete datos[k]; else datos[k] = v;
    }
    // La dirección viaja completa: si cambia cualquier parte, se guardan todas
    if (['direccion', 'calle', 'num_ext', 'num_int', 'colonia', 'cp', 'alcaldia_id'].some((k) => k in datos)) {
      for (const k of ['direccion', 'calle', 'num_ext', 'num_int', 'colonia', 'cp', 'alcaldia_id', 'lat', 'lng', 'place_id']) if (k in nuevos) datos[k] = nuevos[k];
    }
    if (!Object.keys(datos).length) {
      if (pendiente) await q("UPDATE refugio_cambios SET estado = 'cancelado', revisado_en = ? WHERE id = ?", [ahora(), pendiente.id], c);
      return { mensaje: pendiente ? 'Se canceló el cambio pendiente: tus datos quedan como estaban.' : 'No hay cambios que guardar.', pendiente: false };
    }
    const anteriores = Object.fromEntries(Object.keys(datos).map((k) => [k, ant[k] ?? null]));
    if (pendiente) {
      await q('UPDATE refugio_cambios SET creado_en = ? WHERE id = ?', [ahora(), pendiente.id], c);
      await guardarDetalle(c, pendiente.id, datos, anteriores);
    } else {
      const ins = await q('INSERT INTO refugio_cambios (refugio_id, creado_en) VALUES (?, ?)', [usuario.id, ahora()], c);
      await guardarDetalle(c, ins.insertId, datos, anteriores);
    }
    const admin = await uno("SELECT id FROM usuarios WHERE tipo = 'admin' AND estado = 'activa'", [], c);
    if (admin && !pendiente) await notificar(admin.id, `${usuario.nombre} pidió cambiar sus datos de refugio. Revísalo antes de aplicarlo.`, c, '#/admin/refugios?vista=cambios');
    const campos = [...new Set(Object.keys(datos).map((k) => ETIQUETAS[k] || 'Dirección'))].join(', ');
    return { mensaje: `Cambio enviado (${campos}). Se aplicará cuando el Administrador lo apruebe; mientras, se muestran tus datos actuales.`, pendiente: true };
  });
}

/* Aplica un cambio aprobado */
async function aplicarCambio(c, cambio) {
  const d = cambio.datos;
  if ('nombre' in d) await q('UPDATE usuarios SET nombre = ? WHERE id = ?', [d.nombre, cambio.refugio_id], c);
  const sets = CAMPOS_REFUGIO.filter((k) => k in d);
  if (sets.length) {
    await q(`UPDATE refugios SET ${sets.map((k) => `${k} = ?`).join(', ')} WHERE usuario_id = ?`, [...sets.map((k) => d[k]), cambio.refugio_id], c);
  }
  if (Array.isArray(d.horario)) {
    for (const x of d.horario) {
      await q(`INSERT INTO refugio_horarios (refugio_id, dia, cerrado, abre, cierra) VALUES (?, ?, ?, ?, ?)
               ON DUPLICATE KEY UPDATE cerrado = VALUES(cerrado), abre = VALUES(abre), cierra = VALUES(cierra)`,
      [cambio.refugio_id, x.dia, x.cerrado, x.abre, x.cierra], c);
    }
  }
}

async function decidirCambio(req, aprobar) {
  const id = Number(req.params.id);
  const motivo = req.body && req.body.motivo;
  await tx(async (c) => {
    const cambio = await uno("SELECT id, refugio_id FROM refugio_cambios WHERE id = ? AND estado = 'pendiente' FOR UPDATE", [id], c);
    if (!cambio) falla('El cambio ya fue revisado o no existe.', 404);
    await cargarDetalle(cambio, c);
    if (aprobar) await aplicarCambio(c, cambio);
    await q('UPDATE refugio_cambios SET estado = ?, motivo = ?, revisor_id = ?, revisado_en = ? WHERE id = ?',
      [aprobar ? 'aprobado' : 'rechazado', aprobar ? null : motivo, req.usuario.id, ahora(), id], c);
    await notificar(cambio.refugio_id, aprobar
      ? 'El Administrador aprobó el cambio de tus datos de refugio: ya se muestran los nuevos.'
      : `El Administrador no aprobó el cambio de tus datos de refugio: ${motivo}`, c, '#/refugio/perfil');
  });
}

module.exports = { solicitarCambioRefugio, decidirCambio, actuales, cargarDetalle, guardarDetalle, ETIQUETAS };
