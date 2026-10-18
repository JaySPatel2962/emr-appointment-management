import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The API's CORS allows exactly one origin (CLIENT_URL, http://localhost:5173 by default), so
// both the dev server and the preview of a production build use that port and never move.
const CLIENT_PORT = 5173;

const packages = (...names: string[]): RegExp =>
  new RegExp(
    `node_modules[\\\\/](${names.map((name) => name.replace(/[.]/g, '\\.')).join('|')})[\\\\/]`,
  );

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { port: CLIENT_PORT, strictPort: true },
  preview: { port: CLIENT_PORT, strictPort: true },
  build: {
    rolldownOptions: {
      output: {
        // Libraries change far less often than the app, so they get chunks of their own: a
        // deploy then re-downloads only the app's code. Each group loads only where it's used
        // (forms and the socket with the pages that need them, not at startup).
        codeSplitting: {
          groups: [
            {
              name: 'vendor-react',
              test: packages('react', 'react-dom', 'scheduler', 'react-router'),
            },
            { name: 'vendor-data', test: packages('@tanstack', 'axios') },
            { name: 'vendor-zod', test: packages('zod') },
            { name: 'vendor-forms', test: packages('react-hook-form', '@hookform') },
            {
              name: 'vendor-socket',
              test: packages(
                'socket.io-client',
                'socket.io-parser',
                'engine.io-client',
                'engine.io-parser',
                '@socket.io',
              ),
            },
          ],
        },
      },
    },
  },
});
