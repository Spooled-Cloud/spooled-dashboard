import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import node from '@astrojs/node';
import { LEGACY_ROUTE_REDIRECTS } from './src/lib/legacy-redirects.ts';

// https://astro.build/config
// Server output so middleware can attach security headers on every Node response.
// Pages are light Astro shells around React islands; SSR cost is negligible.
export default defineConfig({
  output: 'server',
  redirects: LEGACY_ROUTE_REDIRECTS,
  adapter: node({
    mode: 'standalone',
  }),
  integrations: [
    react(),
    tailwind({
      applyBaseStyles: false,
    }),
  ],
  vite: {
    ssr: {
      noExternal: ['@radix-ui/*'],
    },
  },
});
