import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  root: '.',
  define: {
    // Required: CJS deps reference process.env.NODE_ENV at runtime in the browser
    'process.env.NODE_ENV': '"production"',
  },
  build: {
    outDir: 'dist/mxc-client',
    lib: {
      entry: 'src/client/mxc-entry.tsx',
      formats: ['es'],
      fileName: 'index',
    },
    // Do NOT externalize react/react-dom — bundle your own React version.
    // The MXC shell mounts your app in an isolated React root using your bundled ReactDOM.
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/client'),
    },
  },
});
