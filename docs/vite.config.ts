import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  const projectRoot = path.resolve(__dirname, '.');

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': projectRoot,
      },
    },

    // Ensure Vite prebundles React properly (helps avoid production runtime hook mismatch)
    optimizeDeps: {
      include: ['react', 'react-dom'],
    },

    // Force singletons at bundling time (Vite 6 supports this via deps.optimizer config,
    // but aliasing with require.resolve broke due to ESM config loading)

    server: {
      allowedHosts: true as const,
      host: '0.0.0.0',
      port: 5000,
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});



