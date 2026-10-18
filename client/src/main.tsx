import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { env } from '@/config/env';
import '@/styles/index.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('The #root element is missing from index.html');
}

createRoot(container).render(
  <StrictMode>
    <main className="grid min-h-dvh place-content-center gap-2 p-6 text-center">
      <h1 className="text-2xl font-semibold">EMR Appointments</h1>
      <p>The client is set up and will call the API at {env.apiUrl}.</p>
    </main>
  </StrictMode>,
);
