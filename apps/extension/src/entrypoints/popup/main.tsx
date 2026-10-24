import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles/globals.css';
import { initI18n } from '@/i18n/core';
import { PopupApp } from './App';

if (window.matchMedia('(prefers-color-scheme: dark)').matches) document.documentElement.classList.add('dark');

// Load the chosen language before the first paint (English resolves immediately).
void initI18n().finally(() =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <PopupApp />
    </StrictMode>,
  ),
);
