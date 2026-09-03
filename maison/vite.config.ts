import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import legacy from '@vitejs/plugin-legacy';

// Cibles de la tablette du salon. Elles s'appliquent à tout le bundle :
// on ne sait pas séparer proprement le mur du téléphone dans un SPA unique,
// et payer le legacy sur l'interface téléphone coûte quelques kilo-octets —
// bien moins cher qu'une page blanche sur le mur.
const LEGACY_TARGETS = ['safari >= 12', 'chrome >= 70'];

export default defineConfig({
  plugins: [
    react(),
    legacy({
      targets: LEGACY_TARGETS,
      // Point de vigilance : Safari 12 sait charger `<script type=module>`
      // et prend donc le bundle « moderne », pas les chunks legacy. On
      // transpile ce bundle moderne jusqu'aux mêmes cibles et on lui donne
      // ses polyfills — sinon une page blanche sur la tablette, sans console
      // pour comprendre pourquoi.
      modernTargets: LEGACY_TARGETS,
      modernPolyfills: true,
      renderLegacyChunks: true,
    }),
  ],
  build: {
    // `build.target` est piloté par plugin-legacy (il l'écrase) ;
    // le CSS, lui, ne l'est pas : sans cette ligne esbuild minifie en
    // syntaxe moderne et la tablette perd des règles en silence.
    cssTarget: ['safari12', 'chrome70'],
  },
  server: {
    // `npm run dev` (front) + `npm run worker` (API) en parallèle.
    proxy: { '/api': 'http://127.0.0.1:8787' },
  },
});
