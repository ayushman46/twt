import { mark } from '@/lib/perf';
mark('app:boot');
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles/globals.css';
import { App } from './App';

// Avoid a light flash before settings load.
if (window.matchMedia('(prefers-color-scheme: dark)').matches) document.documentElement.classList.add('dark');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
