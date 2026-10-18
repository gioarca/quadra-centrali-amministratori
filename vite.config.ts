import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Demo: nessun server, i dati delle centrali sono simulati nel browser.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5180 },
  // Tutta la demo (logica e dati simulati compresi) sta in un file da ~180 KB compressi: va bene così.
  build: { chunkSizeWarningLimit: 800 },
});
