# VeoBible API Proxy

Proxy HTTP local basado en el ejemplo. Inicia únicamente `video-generator-api`, propaga su entorno y escucha en `127.0.0.1:8420`; la API hija usa `127.0.0.1:8422`. Todas las rutas, incluida `/health`, requieren el `VIDEO_API_TOKEN` compartido con el dashboard.

Copia `.env.example` a `.env`, configura un token aleatorio de 32+ caracteres y `DASHBOARD_ORIGINS`; ejecuta `pnpm start:api-proxy` desde la raíz. Un fallo del proceso hijo detiene el proxy. Se preservan streaming, Range y query strings. Las señales detienen ambos procesos.

En producción instala `cloudflared`, configura un tunnel nombrado hacia `http://127.0.0.1:8420`, define `CLOUDFLARE_TUNNEL_TOKEN` y ejecuta `pnpm tunnel:api-proxy`. No se crean tunnels ni se publica nada automáticamente. Puedes proteger el hostname con Cloudflare Access y configurar un service token en el dashboard.

Namespaces registrados: `/v1/jobs`, `/v1/projects`, `/v1/analyze`. `/health` agrega la disponibilidad de video. Para añadir otra API, registra el proceso en `index.mjs` y sus rutas en `proxy.mjs`; el mismo tunnel sirve ambas.

Consulta [el README del dashboard](../../apps/dashboard/README.md). `pnpm --dir tools/api-proxy test` verifica autenticación, rutas, forwarding y desconexión del upstream.
