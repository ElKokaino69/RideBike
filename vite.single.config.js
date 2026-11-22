// Einzeldatei-Vorschau: komplette App als eine HTML-Datei (für Browser/Smartphone)
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  base: './',
  plugins: [viteSingleFile({ removeViteModuleLoader: true })],
  build: {
    outDir: 'dist-single',
    emptyOutDir: true,
    target: 'es2020',
    assetsInlineLimit: 100000000,
    chunkSizeWarningLimit: 5000
  }
});
