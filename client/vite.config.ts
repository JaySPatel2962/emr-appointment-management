import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The API's CORS allows exactly one origin (CLIENT_URL, http://localhost:5173 by default), so
// both the dev server and the preview of a production build use that port and never move.
const CLIENT_PORT = 5173;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { port: CLIENT_PORT, strictPort: true },
  preview: { port: CLIENT_PORT, strictPort: true },
});
