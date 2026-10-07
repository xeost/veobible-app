# VeoBible Studio

Dashboard privado con Next.js App Router y ViNext. Su API usa una base D1 exclusiva del dashboard. El generador de videos es un servicio independiente y recibe los ajustes desde el dashboard.

## Desarrollo

Requiere Node 22+ y pnpm. Instala los paquetes por separado:

```sh
pnpm --dir apps/dashboard install
pnpm --dir tools/video-project-api install
cp apps/dashboard/.dev.vars.example apps/dashboard/.dev.vars
cp tools/api-proxy/.env.example tools/api-proxy/.env
cp tools/video-project-api/.env.example tools/video-project-api/.env
pnpm db:dashboard:local
pnpm start:api-proxy
# En otra terminal:
pnpm dev:dashboard
```

Abre http://localhost:3003. La migración inicial crea únicamente el administrador `admin`, con contraseña `admin123` almacenada como hash PBKDF2 SHA-256. Puedes cambiarla desde el perfil. Configura un `JWT_SECRET` aleatorio de al menos 32 bytes y el mismo `VIDEO_API_TOKEN` aleatorio de 32+ caracteres en el dashboard y el proxy. La API hija recibe el token del proxy; los motores y fuentes se configuran en [el generador](../../tools/video-project-api/README.md).

La autenticación usa JWT HS256 mediante jose, con vencimiento de 30 días y cookie HttpOnly/SameSite=Lax, Secure por HTTPS. Cada petición verifica el usuario activo, rol y `auth_version`; las mutaciones exigen el mismo origen. Cambiar la contraseña o el acceso invalida los JWT anteriores. No hay tablas de sesiones ni de intentos de acceso. Los administradores gestionan usuarios, settings y deployments; los editores producen videos.

## Base de datos

`migrations/0001_dashboard.sql` contiene todo el esquema y un único INSERT: el administrador inicial. Las tablas son:

- `dashboard_users`: usuarios y autenticación.
- `bible_versions`: versiones bíblicas identificadas por idioma y código.
- `video_projects`: pasaje, versión, formato, ajustes y marca de uso.
- `site_settings`: configuración por clave.
- `deployments`: publicaciones del sitio público.

Los IDs de usuarios, versiones, proyectos y deployments son enteros autoincrementales. `site_settings` usa su clave natural. No existen `catalog`, `jobs`, `projects`, `users`, `versions` ni `version_settings`. Los proyectos no tienen campos de estado o publicación.

```sh
pnpm --dir apps/dashboard db:migrate:local
# Solo para una base de producción preparada para este esquema:
pnpm --dir apps/dashboard db:migrate:remote
```

La consolidación sustituye el historial anterior y requiere reconstruir una base existente; no constituye una migración incremental de sus datos. Wrangler registra la migración en `d1_migrations`. La base local se almacena en `apps/dashboard/.wrangler/state/v3/d1`. No hay inserciones automáticas de proyectos o settings.

## Proyectos y generación

En `/short-videos` y `/long-videos`, «Nuevo proyecto» pide versión, título, nombre corto y los libros, capítulos y versículos de inicio y final. Los largos requieren número de episodio. Los libros disponibles y sus límites se consultan al generador para la versión seleccionada; los pasajes se introducen manualmente y pueden cruzar libros. El servidor valida los extremos y rechaza nombres cortos duplicados dentro del formato y la versión. No hay una lista estática de pasajes en el dashboard. Las versiones se gestionan en `/bible-versions`. Los listados muestran proyectos creados y distinguen publicados y no publicados.

El menú de opciones de cada listado ofrece «Sincronizar presets de proyectos». Su modal permite elegir una versión bíblica y añadir las propuestas del formato correspondiente obtenidas del generador. La comparación usa formato, versión y el `slug` de la propuesta, almacenado en `video_projects.slug`. Repetir la sincronización no duplica proyectos, ni actualiza títulos, pasajes, ajustes o marcas de publicación existentes. Los proyectos nuevos toman los ajustes de volumen actuales del formato, idioma y versión. Los títulos usan los nombres de libros de esa versión y los largos conservan el número de episodio.

«Sincronizar proyectos existentes» no abre un modal: consulta los directorios `outputs-dev/<version>/<slug>` en desarrollo o `outputs/<version>/<slug>` en producción, según el entorno del dashboard y el formato. Solo actualiza el estado de proyectos ya registrados, emparejados por formato, idioma, versión y slug; los directorios sin un par se ignoran y nunca se crean proyectos con esta acción. Importa la marca CLI de usado como publicado, los offsets de audio y versículos, el volumen, el modo de audio y el fondo. Conserva los títulos y los ajustes ausentes de los archivos del proyecto. No modifica los archivos de origen. Omite proyectos con archivos inválidos o tareas activas y muestra los recuentos de actualizados y sin cambios. Repetir la acción sin cambios conserva las fechas de actualización.

Cada proyecto guarda `output_environment`: los proyectos nuevos del dashboard usan su entorno actual; los importados usan el entorno desde el que se sincronizan. Así el editor consulta y reproduce los archivos originales de las CLI incluso desde el dashboard en desarrollo. La cola incluye las tareas activas de ambos entornos.

El editor compartido se abre en `/short-videos/<id>` o `/long-videos/<id>` con el ID numérico del proyecto. Los cortos son verticales 9:16; los largos, horizontales 16:9. Intro y cierre son secciones fijas; cada tramo de lectura permite sincronizar versículos mediante waveform, recorte y reproducción. Las secciones comienzan colapsadas y las voces de intro/cierre se pueden generar y reproducir desde sus cabeceras.

Los ajustes se guardan en `video_projects`. Al abrir el editor, el estado se obtiene del generador: su cola informa si hay un render activo y los archivos indican si hay un resultado disponible. No se guarda un historial de renders en D1 ni se necesitan callbacks. El resultado se conserva en `_internal/render-result.json` junto a los archivos del proyecto y sigue disponible tras reiniciar el servicio.

El cuadro inferior del sidebar abre la cola global de voces y videos. Solo muestra tareas activas o pendientes, con enlaces al editor. Puedes cambiar de proyecto mientras se procesa una generación. La cola es serial, admite hasta 20 tareas y reside en memoria: no reanuda tareas pendientes después de reiniciar el servicio. Los archivos ya generados permanecen en disco.

El layout consulta la cola cada 3 segundos si hay pendientes y cada 30 segundos en reposo; también al enviar tareas, abrir el modal o regresar a la pestaña. El editor consulta periódicamente solo mientras tiene una generación pendiente. Los listados se actualizan al guardar o sincronizar proyectos.

`SHORTS_WORKING_DIR` y `LONGS_WORKING_DIR` separan los formatos:

- `material/`: fuentes de video, voz y audio bíblico.
- `outputs/<version>/<passage>/`: producción y herramientas CLI.
- `outputs-dev/<version>/<passage>/`: dashboard en desarrollo.

Ambos entornos usan la estructura de las CLI, con video, miniatura, textos y `_internal/` para voces y datos auxiliares. Los ajustes y marcas de uso de las CLI no se sincronizan automáticamente con el dashboard.

## Settings

En `/bible-versions`, los administradores crean, editan y eliminan versiones con nombre, idioma y código. Los códigos son únicos dentro del idioma; las versiones registradas alimentan los selectores y los ajustes por versión. Si hay proyectos asociados, solo se puede cambiar el nombre, para conservar las referencias y los archivos de esos proyectos. No se insertan versiones automáticamente. El menú de opciones ofrece «Sincronizar versiones»: consulta al generador, que descubre las versiones disponibles en `bible-data` y sus nombres desde `metadata.name` de cada índice. Solo se insertan pares nuevos de idioma y código; no se modifican ni eliminan los registros existentes.

En `/settings` se configuran manualmente cuentas de YouTube, X, Instagram, TikTok y Facebook por idioma, guardadas bajo `social_accounts` en `site_settings`. Los campos vacíos omiten esas redes del cierre.

Los modales Settings de cada formato incluyen «Settings de voz» y «Settings de proyectos». Las plantillas de intro/outro se guardan bajo `voice_templates:short` y `voice_templates:long`. El volumen por idioma y código de versión se guarda bajo `project_settings:short` y `project_settings:long`; el deslizador va de 0 a 4, con 1 como volumen original, y doble clic restablece 1. Los nuevos proyectos toman estos valores y los existentes conservan sus ajustes. No se precargan valores desde migraciones o scripts.

Cada tarea recibe una copia de las plantillas y cuentas relevantes. El generador no consulta D1 directamente ni necesita archivos locales de cuentas o plantillas.

## Producción y deployments

Crea una D1 exclusiva del dashboard y configura su UUID en `env.production.d1_databases` de `wrangler.jsonc`. Configura `VIDEO_API_URL` con el hostname del tunnel y guarda `JWT_SECRET`, `VIDEO_API_TOKEN` y, si corresponde, credenciales de Cloudflare Access como secretos del Worker. Prepara la base con la migración única. Compila con `pnpm --dir apps/dashboard build:production` y publica explícitamente con Wrangler usando el archivo generado `dist/server/wrangler.json`.

El navegador llama únicamente al dashboard, que se comunica con el proxy local o mediante HTTPS/tunnel. Configura `DASHBOARD_ORIGINS` en el proxy y consulta [su documentación](../../tools/api-proxy/README.md) para el tunnel.

Deployments publica el sitio público VeoBible. «Configurar» guarda el deploy hook en `site_settings`, clave `deploy_hook:veobible:site`. Una cadena vacía desactiva la publicación; `SITE_DEPLOY_HOOK` es respaldo únicamente si no hay un ajuste guardado. `CLOUDFLARE_ACCOUNT_ID` y `CLOUDFLARE_API_TOKEN` permiten consultar Workers Builds. El historial de deployments es independiente de la generación de videos.

## Verificación

```sh
pnpm --dir apps/dashboard typecheck
pnpm --dir apps/dashboard test
pnpm --dir apps/dashboard build
pnpm --dir tools/video-project-api check
pnpm --dir tools/video-project-api test:render
pnpm --dir tools/api-proxy test
```
