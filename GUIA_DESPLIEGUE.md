# Guía: subir Dopta a Aiven (base de datos) y Render (sitio)

Orden: **1) GitHub → 2) Aiven → 3) Render → 4) comprobar**. Necesitas cuentas en GitHub, Aiven (https://aiven.io) y Render (https://render.com).

## 1. GitHub
1. Sube el proyecto al repo (`git push`). Comprueba que **no** aparezca `.env` en GitHub.
2. Si la contraseña local de MySQL estuvo alguna vez en git, cámbiala.

## 2. Crear MySQL en Aiven
1. **Create service → MySQL** (versión 8), plan y región (elige una cercana a la de Render, p. ej. Oregon/Ohio).
2. Espera a que el estado sea **Running**.
3. En **Overview → Connection information** anota: *Host*, *Port*, *User* (`avnadmin`), *Password* y *Database name* (`defaultdb`).
4. Descarga el **CA certificate** (`ca.pem`) y ábrelo con un editor de texto: lo vas a pegar en Render.
5. En **Allowed IP addresses** deja `0.0.0.0/0` (o agrega las IP de salida de tu servicio, que Render muestra en *Connect → Outbound*).

## 3. Render
1. **New → Web Service** → conecta tu repo de GitHub.
2. Configura:
   - **Runtime:** Node · **Build Command:** `npm install` · **Start Command:** `npm start`
   - **Instance type:** el que prefieras (el gratuito se "duerme" tras inactividad y tarda en despertar).
3. En **Environment** agrega:

   | Variable | Valor |
   |---|---|
   | `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` | los de Aiven |
   | `DB_NAME` | `defaultdb` |
   | `DB_SSL` | `1` |
   | `DB_SSL_CA_PEM` | contenido de `ca.pem` en **una línea**, con `\n` por cada salto de línea |
   | `NODE_VERSION` | `20` (o el LTS actual) |
   | `SMTP_*` | opcional: correo para recuperar contraseña (sin esto el enlace solo sale en los logs) |
   | `GOOGLE_MAPS_API_KEY`, `GOOGLE_MAPS_EMBED_KEY` | opcional |

   No pongas `DB_SSL_CA` (el archivo no se sube a git). Render ya define `PORT` y `RENDER`; con eso Dopta escucha en todas las interfaces y marca la cookie de sesión como `Secure`.
4. (Recomendado) En **Advanced → Health Check Path** pon `/api/version`.
5. **Create Web Service**. En el primer arranque Dopta crea las tablas solo y el **Administrador inicial** (`admin@dopta.com`, ver más abajo).

## 4. Comprobar
1. Abre `https://TU-SERVICIO.onrender.com/api/version`: debe responder `{"version":"2.0.0","bd":true}`.
   - `bd:false` o 503: el mensaje dice la causa (contraseña, certificado, host).
   - En Render → **Logs** verás `[✓] Base de datos conectada.`
2. Entra con el administrador inicial y **cambia su contraseña**. Para reemplazar la cuenta, en Render → **Shell**: `npm run admin -- tu@correo.com "Tu Nombre" TuClave123 --reemplazar`.
3. Crea un refugio de prueba y publica un perro.

## Pasar tus datos locales (opcional)
Con tu MySQL local: `npm run respaldo` y restaura el `.sql` en Aiven (README, sección Aiven; quita `CREATE DATABASE`/`USE` si aparecen).

## Notas
- Las tareas periódicas (limpieza de sesiones, avisos de seguimiento) corren dentro del servicio cada 15 min; si el servicio gratuito se duerme, se retrasan hasta que despierte.
- Cada nuevo despliegue reaplica el esquema (es idempotente) y migra datos de versiones anteriores si hace falta.
- El aviso de cookies es informativo: Dopta solo usa la cookie de sesión `dopta_sid`.
