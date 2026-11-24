# Dopta · plataforma de adopción de perros (CDMX)

Aplicación web: servidor Node.js (Express) + base de datos **MySQL**. Por defecto corre con MySQL local; también funciona con **Aiven for MySQL** (ver más abajo).

## Requisitos

- [Node.js](https://nodejs.org) 18 o más reciente (LTS recomendado).
- [MySQL Community Server](https://dev.mysql.com/downloads/mysql/) **8.0.16 o más reciente**, con el servicio iniciado. MariaDB no es compatible (Dopta usa `FOR UPDATE OF`, columnas JSON y restricciones `CHECK` de MySQL 8).

## Puesta en marcha

```bash
npm install            # solo la primera vez (npm start lo hace solo si faltan dependencias)
npm start
```

La primera vez, `npm start`:

1. crea el archivo `.env` a partir de `.env.example` (si no existía);
2. se conecta a MySQL, **crea la base `dopta`** si no existe y **crea las tablas** (`database/schema.sql`);
3. abre el servidor en <http://localhost:3000>.

Si tu MySQL tiene contraseña para `root` (lo normal), ponla en `DB_PASSWORD` dentro de `.env` y vuelve a ejecutar `npm start`. Mientras MySQL no esté disponible, la API responde con el motivo exacto y el servidor reintenta cada 5 segundos.

## Configuración (`.env`)

| Variable | Para qué sirve | Por defecto |
|---|---|---|
| `PORT` | Puerto del sitio | `3000` |
| `HOST` | Dirección en la que escucha. `127.0.0.1` = solo esta computadora; `0.0.0.0` = también la red | `127.0.0.1` |
| `DB_HOST`, `DB_PORT` | Dónde corre MySQL | `127.0.0.1`, `3306` |
| `DB_USER`, `DB_PASSWORD` | Credenciales de MySQL | `root`, *(vacía)* |
| `DB_NAME` | Nombre de la base | `dopta` |
| `SMTP_*` | Correo para recuperar contraseña. Vacío = el enlace se imprime en la consola donde corre `npm start` | vacío |
| `VALIDAR_CORREO_DNS` | `1` revisa que el dominio del correo exista (necesita internet) | `1` |
| `GOOGLE_MAPS_*` | Autocompletado de direcciones y mapa del administrador (opcional) | vacío |

El usuario de MySQL necesita permisos para crear la base (solo la primera vez) y para crear tablas, consultar y modificar datos en ella. Si prefieres no usar `root`:

```sql
CREATE USER 'dopta'@'localhost' IDENTIFIED BY 'una_clave';
GRANT ALL PRIVILEGES ON dopta.* TO 'dopta'@'localhost';
```

y pon `DB_USER=dopta` y `DB_PASSWORD=una_clave` en `.env` (con este usuario, crea antes la base: `CREATE DATABASE dopta CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`).

## Usar Aiven for MySQL

1. En Aiven crea un servicio **MySQL 8** y, en *Overview*, copia host, puerto, usuario (`avnadmin`) y contraseña; descarga el **CA certificate** como `certs/ca.pem` (la carpeta `certs/` no se sube a git).
2. En `.env` (o en las variables de entorno del hosting) pon:

```
DB_HOST=<servicio>-<proyecto>.aivencloud.com
DB_PORT=<puerto de Aiven>
DB_USER=avnadmin
DB_PASSWORD=<contraseña de Aiven>
DB_NAME=defaultdb
DB_SSL=1
DB_SSL_CA=certs/ca.pem
```

   Sin archivo (p. ej. Render): deja `DB_SSL_CA` vacío y pega el certificado en `DB_SSL_CA_PEM` con `\n` por cada salto de línea.
3. `npm run db` crea las tablas en esa base (el esquema ya no crea ni cambia de base: usa `DB_NAME`) y `npm run verificar` comprueba la conexión.
4. **Migrar los datos existentes** (opcional): `npm run respaldo` en la base local y luego `mysql -h <host> -P <puerto> -u avnadmin -p --ssl-ca=certs/ca.pem --ssl-mode=VERIFY_CA defaultdb < respaldos/dopta_....sql`. Si el respaldo trae `CREATE DATABASE`/`USE`, quítalos antes.
5. En un hosting pon también `HOST=0.0.0.0` (el `PORT` lo suele fijar el hosting).

`npm run respaldo` usa la misma conexión cifrada cuando `DB_SSL=1`. Rota la contraseña de `DB_PASSWORD` si alguna vez estuvo en git.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm start` | Inicia el sitio |
| `npm run dev` | Igual, reiniciando al editar archivos del servidor |
| `npm run db` | Crea o actualiza las tablas sin iniciar el sitio |
| `npm run admin -- correo@x.com "Nombre" Clave123` | Cambia al **único** Administrador (`--reemplazar`). El Administrador inicial (`admin@dopta.com`) ya viene en `database/schema.sql` |
| `npm run demo` | Carga refugios, perros y un adoptante de prueba (contraseña `Demo12345`) |
| `npm run respaldo` | Respaldo con `mysqldump` en `respaldos/` (conserva los últimos `RESPALDO_DIAS`) |
| `npm run verificar` | Diagnóstico: Node, dependencias, `.env`, MySQL, tablas y archivos |
| `npm run empaquetar` | Zip de entrega sin `.env` ni `node_modules` |

Para restaurar un respaldo: `mysql -u root -p dopta < respaldos/dopta_AAAA-MM-DD-....sql`.

## Estructura

```
server/      API (Express) y acceso a MySQL
  db.js        conexión (mysql2), consultas preparadas y transacciones
  arranque.js  crea la base y las tablas, diagnóstico de arranque
  ...          auth, animales, solicitudes, admin, cambios, lugares
database/schema.sql   esquema MySQL (idempotente)
public/      interfaz (HTML, CSS y JavaScript que sirve el propio servidor)
  js/          la aplicación del navegador, en 8 archivos que index.html carga en orden (01-base … 08-rutas-inicio)
```

## Notas sobre MySQL

- No se usan columnas `JSON`: el formato de adopción, la lista de entrega y los cambios de datos de refugios están en tablas con una columna por dato (`solicitud_cuestionarios`, `solicitud_entregas`, `refugio_cambio_campos`, `refugio_cambio_horarios`). Las bases creadas antes se migran solas al iniciar.
- El Administrador inicial se inserta desde `schema.sql` (con la contraseña como hash bcrypt) solo si aún no hay uno. Cambia la contraseña de esa cuenta antes de publicar el sitio.
- Las fechas se guardan como `DATETIME`/`DATE` en hora de la Ciudad de México (las calcula el servidor).
- La base usa la collation `utf8mb4_unicode_ci`: las búsquedas ignoran mayúsculas y acentos.
- MySQL no tiene índices únicos parciales; las reglas "correo y teléfono únicos solo entre cuentas vigentes", "un solo administrador" y "un solo cambio pendiente por refugio" se aplican con columnas generadas (`correo_vigente`, `telefono_vigente`, `es_admin`, `pendiente_de`) que el servidor nunca escribe.
- Si `npm start` dice que el esquema no se pudo aplicar, revisa primero la versión de MySQL (`SELECT VERSION();`).
