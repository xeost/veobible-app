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

Deployments consulta versiones del **Worker del dashboard** y permite invocar su deploy hook. Configura `DASHBOARD_DEPLOY_HOOK`, `DASHBOARD_WORKER_NAME`, `CLOUDFLARE_ACCOUNT_ID` y `CLOUDFLARE_API_TOKEN` como secretos/variables apropiados. Una respuesta positiva del hook se registra como solicitud; las versiones publicadas se muestran por separado. No despliega el frontend.

## Archivos y estados

El editor permite buscar y filtrar videos por versión, ajustar volumen, modo de audio, offsets y fondo; inspeccionar texto/contexto, guiones y tiempos; reutilizar o regenerar voces; renderizar, previsualizar, descargar y marcar publicaciones manualmente. Las publicaciones no envían mensajes ni suben archivos a redes.

D1 guarda la copia de ajustes de cada trabajo, resultados, guiones, descripciones, referencias a fuentes, tiempos, errores y marcas de uso/publicación. Los callbacks actualizan D1 sin depender del navegador. La consulta periódica reconcilia callbacks fallidos. Tras reiniciar la API, los trabajos perdidos se marcan interrumpidos durante la siguiente reconciliación; puedes reintentarlos desde sus ajustes. Si la laptop está apagada se conserva el estado hasta que vuelva a responder. No hay reanudación automática después de reiniciar.

La cola procesa un trabajo a la vez y admite hasta 20. La API guarda multimedia en `tools/video-generator-api/media/` (`VIDEO_MEDIA_DIR` permite otra ubicación):

- `sources/<short|long>/<UUID>/`: voces fuente conservadas entre renders.
- `renders/<short|long>/<UUID>/`: video y miniatura finales, descartables después de publicar.

No borres `sources/` si quieres reutilizar las voces exactas. Los audios bíblicos se configuran con `VIDEO_AUDIO_DIR`; los clips y muestras de voz se conservan en `tools/video-generator-api/material/`. El fondo elegido automáticamente se guarda en los ajustes al terminar para regenerarlo después.

La API usa directamente análisis, voces y render; no llama a `prepareShort`, `prepareEpisode`, `markUsed` ni a escritores de ajustes. No crea `status.json`, `default-version-settings.json` ni ajustes de proyecto en disco. Solo usa archivos temporales de síntesis/render, que limpia al terminar. Conserva materiales y entorno de modelos originales para reproducir una generación.

## Verificación

```sh
pnpm --dir apps/dashboard typecheck
pnpm --dir apps/dashboard test
pnpm --dir apps/dashboard build
pnpm --dir tools/video-generator-api check
pnpm --dir tools/api-proxy test
```
