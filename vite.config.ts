import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import packageJson from "./package.json"
import { defineConfig } from "vite"

function manualChunks(id: string) {
  if (!id.includes("node_modules")) {
    return undefined
  }

  if (/node_modules[\\/](react|react-dom)[\\/]/.test(id)) {
    return "vendor-react"
  }

  if (/node_modules[\\/]@supabase[\\/]/.test(id)) {
    return "vendor-supabase"
  }

  if (/node_modules[\\/](react-router|zustand)[\\/]/.test(id)) {
    return "vendor-routing-state"
  }

  return undefined
}

// https://vite.dev/config/
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks,
      },
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    allowedHosts: ["plot-unruly-getaway.ngrok-free.dev"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
