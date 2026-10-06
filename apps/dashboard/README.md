# VeoBible Studio

Dashboard privado con Next.js App Router y ViNext, inspirado en el layout del dashboard de referencia. Tiene su propia API y una D1 independiente del backend. No usa OpenNext ni R2. No modifica el frontend público.

## Desarrollo

Requiere Node 22+ y pnpm. Los paquetes se instalan por separado para conservar los lockfiles existentes:

```sh
pnpm --dir apps/dashboard install
pnpm --dir tools/video-generator-api install
cp apps/dashboard/.dev.vars.example apps/dashboard/.dev.vars
cp tools/api-proxy/.env.example tools/api-proxy/.env
cp tools/video-generator-api/.env.example tools/video-generator-api/.env
pnpm db:dashboard:local
```

Configura el mismo `VIDEO_API_TOKEN` aleatorio de 32+ caracteres en `.dev.vars` y en `.env` del proxy. El proxy inicia la API hija y le transmite su entorno. La API tiene motores, dependencias, plantillas y `.env` propios; configura sus fuentes multimedia y modelos como describe [su README](../../tools/video-generator-api/README.md). No necesita instalar ni conservar las CLI.

Crea el primer administrador sin credenciales predeterminadas:

```sh
cd apps/dashboard
DASHBOARD_ADMIN_USERNAME=admin DASHBOARD_ADMIN_PASSWORD='<12+ caracteres>' pnpm db:admin
pnpm exec wrangler d1 execute DB --local --file imports/admin.sql
cd ../..
pnpm start:api-proxy
# Otra terminal:
pnpm dev:dashboard
```

Abre http://localhost:3003. Las sesiones opacas y revocables viven en D1. Las contraseñas usan PBKDF2 SHA-256 con 100.000 iteraciones y sal aleatoria. La API verifica sesión y rol en cada petición, limita intentos de login y exige mismo origen en mutaciones. Los callbacks tienen tokens individuales cuyo hash se guarda en D1. No hay secretos de respaldo.

Los administradores gestionan usuarios y deployments; los editores producen videos. El botón de usuarios del header permite crear, desactivar y cambiar roles. Cada usuario puede editar su perfil y contraseña.

## Migraciones e importación

Las migraciones SQL numeradas crean usuarios, sesiones, catálogo, versiones, proyectos, ajustes predeterminados e historial de trabajos. Incluyen 100 pasajes de `popular-verses.json` (catálogo estructurado de `popular-verses.md`) y los 365 episodios. El estado se distingue por pasaje **y versión**. No se usa la base del backend: su futura integración debe tener otro binding/cliente.

Añade migraciones nuevas para cambios futuros; no edites las ya aplicadas. Aplica el mismo historial con `wrangler d1 migrations apply DB --local` y `--remote --env production`. Wrangler registra el historial en `d1_migrations`.

```sh
cd apps/dashboard
pnpm db:import
pnpm exec wrangler d1 execute DB --local --file imports/cli.sql
cd ../..
pnpm --dir apps/dashboard db:import-media
```

El importador lee `~/Documents/veobible-shorts/outputs` y `~/Documents/veobible-longs/outputs`. Admite las variables `VEOBIBLE_SHORTS_OUTPUT_DIR`, `VEOBIBLE_LONGS_OUTPUT_DIR` y sus respectivas `WORKING_DIR`; para otras rutas, expórtalas antes de importar. El script de importación no carga los `.env` de las CLI.

Importa `status.json`, outputs existentes, volumen predeterminado y por proyecto, offsets de pasaje y versículos, metadatos y descripciones. Conserva la marca “usado” de la CLI por separado de la publicación: no presupone que se haya subido a redes. Un render sin estado, como el episodio de prueba, se importa como generado y sin publicar. Si el render no existe se conservan el registro y los ajustes como pendiente.

El SQL completa los drafts iniciales vacíos; repetirlo no sobrescribe proyectos editados o importados. Todos los pasajes tienen un proyecto real en D1 por cada versión, incluso si nunca se generaron. Los SQL y manifiestos generados quedan en `imports/`, ignorado por Git. El importador multimedia consulta los IDs reales en D1 y copia archivos sin mover ni borrar originales; usa clonación del filesystem cuando está disponible. Para producción aplica el SQL con `--remote --env production` y añade `--remote` al importador multimedia. El material permanece en la laptop.

Las CLI mantienen su comportamiento. La importación es explícita y unidireccional; los cambios futuros hechos en CLI no se sincronizan automáticamente. El catálogo del importador pertenece a `resources/catalog/` del dashboard: borrar las CLI en el futuro no afecta al arranque, los catálogos ni los renders.

## Producción y tunnel

1. Crea una D1 exclusiva (`wrangler d1 create veobible-dashboard-production`). Reemplaza el UUID de ejemplo en `env.production.d1_databases` de `wrangler.jsonc`. Nunca reutilices el UUID del backend.
2. Configura las URLs reales de `VIDEO_API_URL` (hostname del tunnel) y `DASHBOARD_CALLBACK_URL` (dashboard Worker) en `env.production.vars`.
3. Guarda `VIDEO_API_TOKEN` con `wrangler secret put VIDEO_API_TOKEN --env production`. Si usas Cloudflare Access, guarda también `CF_ACCESS_CLIENT_ID` y `CF_ACCESS_CLIENT_SECRET`.
4. Aplica migraciones, SQL de usuario e importación con `--remote --env production`.
5. Compila con `CLOUDFLARE_ENV=production pnpm build` dentro de `apps/dashboard`. Publica explícitamente con `pnpm exec wrangler deploy --config dist/server/wrangler.json` (config generado por ViNext).
6. En la laptop, configura `DASHBOARD_ORIGINS` en el `.env` del proxy con el origen real del dashboard y los orígenes locales que uses. Arranca `pnpm start:api-proxy`. Configura un Cloudflare Tunnel nombrado hacia `http://127.0.0.1:8420`, instala `cloudflared`, define `CLOUDFLARE_TUNNEL_TOKEN` y ejecuta `pnpm tunnel:api-proxy`.

El navegador llama únicamente a la API del dashboard; esta usa el proxy directamente en desarrollo y HTTPS/tunnel en producción. No se exponen tokens al navegador. El proxy solo registra la API de video, pero permite añadir namespaces futuros detrás del mismo tunnel.

Deployments publica el **sitio público VeoBible** (`apps/frontend`, veobible.com). Aplica la migración `0006_site_deployments.sql` antes de usarlo. «Configurar» guarda la URL del deploy hook en `site_settings` con la clave `deploy_hook:veobible:site`, usando un upsert con fecha de modificación, como el dashboard de referencia. Una cadena vacía desactiva las publicaciones; `SITE_DEPLOY_HOOK` sirve de respaldo solo cuando todavía no hay un ajuste guardado. Los hooks anteriores del dashboard no se reutilizan y su historial queda separado. Configura `CLOUDFLARE_ACCOUNT_ID` y `CLOUDFLARE_API_TOKEN` para consultar el estado de Workers Builds. Sin esas credenciales, las solicitudes quedan pendientes de confirmación. Solo los administradores pueden consultar o modificar la configuración y publicar; las mutaciones requieren el mismo origen.

## Archivos y estados

Los listados `/short-videos` y `/long-videos` abren páginas propias en `/short-videos/[id]?version=…` y `/long-videos/[id]?version=…`. Ambas reutilizan `VideoProjectEditor`, conservan la versión bíblica seleccionada y cargan el proyecto directamente, sin abrir un modal. Los videos cortos usan formato vertical 9:16 (1080×1920); los largos, horizontal 16:9 (1920×1080).

El editor se organiza en bloques colapsables de intro, lectura por tramo de audio y cierre (al menos tres). La intro y el cierre son fijos. Cada uno permite generar su propia voz y escucharla sin renderizar el video; el servicio procesa estas tareas en la misma cola que los renders y conserva los WAV bajo `media/sources`. El estado se consulta por proyecto; al reiniciar el servicio los audios siguen disponibles. Reinicia la API de video tras actualizar su código para habilitar `/v1/projects/:id/voices`.

La sincronización decodifica el audio real con Web Audio y muestra su forma de onda con zoom, extremos arrastrables, ajustes por teclado de 0,01 s (0,1 s con Shift) y escucha por versículo. Los controles aplican límites por tramo y por los versículos vecinos. Los tiempos se expresan respecto a cada tramo en la interfaz y se convierten a offsets sobre la lectura completa al guardar, usando el mismo contrato que el render. «Guardar cambios» conserva la sincronización en D1 y «Generar video» incluye los ajustes actuales en el trabajo. Los elementos visuales y fondos no se editan aquí.

El editor permite buscar y filtrar videos por versión, ajustar volumen, modo de audio, offsets y fondo; inspeccionar texto/contexto, guiones y tiempos; reutilizar o regenerar voces; renderizar, previsualizar, descargar y marcar publicaciones manualmente. Las publicaciones no envían mensajes ni suben archivos a redes.

D1 guarda la copia de ajustes de cada trabajo, resultados, guiones, descripciones, referencias a fuentes, tiempos, errores y marcas de uso/publicación. Los callbacks actualizan D1 sin depender del navegador. La consulta periódica reconcilia callbacks fallidos. Tras reiniciar la API, los trabajos perdidos se marcan interrumpidos durante la siguiente reconciliación; puedes reintentarlos desde sus ajustes. Si la laptop está apagada se conserva el estado hasta que vuelva a responder. No hay reanudación automática después de reiniciar.

La cola procesa un trabajo a la vez y admite hasta 20. `SHORTS_WORKING_DIR` y `LONGS_WORKING_DIR` definen directorios independientes para cada formato. En esta laptop son `/Users/fabian/Documents/veobible-shorts` y `/Users/fabian/Documents/veobible-longs`:

- `material/videos/` y `material/voices/`: clips y muestras de voz.
- `media/sources/<UUID>/`: voces fuente conservadas entre renders.
- `outputs/<UUID>/`: video y miniatura finales.

No borres `media/sources/` si quieres reutilizar las voces exactas. Los audios bíblicos se pueden configurar con `VIDEO_AUDIO_DIR` para usar la biblioteca externa. El fondo elegido automáticamente se guarda en los ajustes al terminar para regenerarlo después.

La API usa directamente análisis, voces y render; no llama a `prepareShort`, `prepareEpisode`, `markUsed` ni a escritores de ajustes. No crea `status.json`, `default-version-settings.json` ni ajustes de proyecto en disco. Solo usa archivos temporales de síntesis/render, que limpia al terminar. Conserva materiales y entorno de modelos originales para reproducir una generación.

## Settings

Los botones Settings de `/short-videos` y `/long-videos` abren los textos de intro y outro para los tres idiomas. Se almacenan por separado en `site_settings` con las claves `voice_templates:short` y `voice_templates:long`, sin inserciones iniciales. Los administradores pueden editarlos y los editores consultarlos. El dashboard envía los textos del formato e idioma correspondiente en `voiceTemplates` al analizar, generar una voz o renderizar. Los trabajos encolados conservan su copia de los textos. El generador no necesita archivos de plantillas; si falta un texto necesario, se solicita configurarlo antes de generar.

Los administradores configuran en `/settings` las cuentas de YouTube, X, Instagram, TikTok y Facebook para español, inglés y portugués. Se guardan como un objeto por idioma en `site_settings`, clave `social_accounts`. No se insertan cuentas iniciales al abrir la página, desde migraciones ni desde scripts; los campos empiezan vacíos y se guardan solo al enviar el formulario. Cada render enviado desde el dashboard incluye una copia de las cuentas guardadas del idioma correspondiente; los campos vacíos omiten esas redes del cierre. Los trabajos ya encolados conservan la copia que recibieron al enviarse.

## Cola de generación

El cuadro inferior del sidebar abre la cola global. La cola del servicio local procesa intro, outro y video en orden, permite ambas voces del mismo proyecto y continúa al cambiar de página o cerrar el editor. Los items enlazan al proyecto y versión correspondientes. Se admiten hasta 20 trabajos pendientes y se muestran los últimos 100 trabajos de la sesión del servicio; la cola de voces reside en memoria y requiere mantener el servicio local en ejecución. Los resultados de render continúan reconciliándose con los trabajos guardados en la base de datos.

El layout consulta `/api/generation-queue` cada 3 segundos cuando hay pendientes y cada 30 segundos en reposo; también actualiza al enviar un trabajo, abrir el modal o volver a la pestaña. El editor solo consulta estados de proyecto y voz periódicamente cuando tiene una generación pendiente.

## Verificación

```sh
pnpm --dir apps/dashboard typecheck
pnpm --dir apps/dashboard test
pnpm --dir apps/dashboard build
pnpm --dir tools/video-generator-api check
pnpm --dir tools/api-proxy test
```
