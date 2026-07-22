import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { cpSync, createReadStream, existsSync } from "node:fs";
import { visualizer } from "rollup-plugin-visualizer";
import type { Plugin } from "vite";

const host = process.env.TAURI_DEV_HOST;
const materialIconsDir = path.resolve(
  __dirname,
  "node_modules/vscode-material-icons/generated/icons",
);

function materialIconsPlugin(): Plugin {
  const urlPrefix = "/assets/material-icons/";

  return {
    name: "material-icons-assets",
    configureServer(server) {
      server.middlewares.use(urlPrefix, (request, response, next) => {
        const iconFile = decodeURIComponent(
          request.url?.split("?")[0].replace(/^\/+/, "") ?? "",
        );
        if (!/^[\w-]+\.svg$/.test(iconFile)) {
          next();
          return;
        }

        const iconPath = path.join(materialIconsDir, iconFile);
        if (!existsSync(iconPath)) {
          next();
          return;
        }

        response.setHeader("Content-Type", "image/svg+xml");
        createReadStream(iconPath).pipe(response);
      });
    },
    writeBundle(options) {
      const outputDir = options.dir ?? path.resolve(__dirname, "dist");
      cpSync(
        materialIconsDir,
        path.join(outputDir, "assets/material-icons"),
        { recursive: true },
      );
    },
  };
}

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [
    react(),
    tailwindcss(),
    materialIconsPlugin(),
    visualizer({
      open: true,
      filename: "bundle-stats.html",
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@c": path.resolve(__dirname, "./src/components"),
      "@lib": path.resolve(__dirname, "./src/lib"),
      "@stores": path.resolve(__dirname, "./src/stores"),
      "@widgets": path.resolve(__dirname, "./src/widgets"),
      "@typings": path.resolve(__dirname, "./src/types"),
      "@t": path.resolve(__dirname, "./src/types"),
    },
  },
  
  // Explicitly tell Vite to include and optimize the icons package
  optimizeDeps: {
    include: ["@fluentui/react-icons", "recharts"],
  },
  
  // Enforce aggressive tree-shaking during the production build
  build: {
    rollupOptions: {
      treeshake: true,
    },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));