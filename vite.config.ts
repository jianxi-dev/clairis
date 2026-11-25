import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const host = process.env.TAURI_DEV_HOST;

// 并行会话隔离端口（scripts/session-worktree.sh 分配）；默认 1420 不变。
const devPort = Number(process.env.VITE_DEV_PORT) || 1420;

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: devPort,
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
      ignored: ["**/src-tauri/**"],
    },
  },
});
