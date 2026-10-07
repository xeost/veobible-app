import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";
export default defineConfig({
  plugins: [
    vinext(),
    cloudflare({
      viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
    }),
  ],
  server: {
    host: "127.0.0.1",
    port: 3003,
    fs: { allow: [fileURLToPath(new URL("../../", import.meta.url))] },
  },
  resolve: { dedupe: ["react", "react-dom", "remotion", "@remotion/media"] },
});
