import { defineConfig } from 'vite';

export default defineConfig(() => {
  const port = Number(process.env.PORT) || 5173;
  const previewPort = Number(process.env.PORT) || 4173;

  return {
    server: {
      host: '0.0.0.0',
      port,
      strictPort: true
    },
    preview: {
      host: '0.0.0.0',
      port: previewPort,
      strictPort: true
    }
  };
});
