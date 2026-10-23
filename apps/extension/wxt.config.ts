import { fileURLToPath } from 'node:url';
import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  // MV3 everywhere (Firefox 128+ supports MAIN-world content scripts in MV3).
  manifestVersion: 3,
  // Firefox review needs buildable sources, including the shared package.
  zip: {
    sourcesRoot: fileURLToPath(new URL('../..', import.meta.url)),
    includeSources: ['apps/extension/**', 'packages/shared/**', 'package.json', 'README.md'],
    excludeSources: ['**/node_modules/**', '**/.output/**', '**/.wxt/**'],
  },
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: ({ browser }) => ({
    name: 'twtdash — X Bookmarks Organizer',
    short_name: 'twtdash',
    description:
      'Sync, auto-categorize and beautifully browse your X (Twitter) bookmarks. Local-first, instant search, collections, tags and insights.',
    permissions: ['storage', 'unlimitedStorage'],
    host_permissions: ['https://x.com/*', 'https://twitter.com/*'],
    optional_host_permissions: ['https://integrate.api.nvidia.com/*'],
    action: {
      default_title: 'twtdash',
    },
    commands: {
      'open-dashboard': {
        suggested_key: { default: 'Alt+Shift+S' },
        description: 'Open the twtdash dashboard',
      },
    },
    ...(browser === 'firefox'
      ? {
          browser_specific_settings: {
            gecko: {
              id: 'twtdash@twtdash.app',
              strict_min_version: '128.0',
              // Nothing leaves the browser unless the user opts into AI features.
              data_collection_permissions: { required: ['none'], optional: ['websiteContent'] },
            },
          },
        }
      : {}),
  }),
});
