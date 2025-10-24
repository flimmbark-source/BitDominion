import { defineConfig, type Plugin } from 'vite';
import type { ServerResponse } from 'http';

function ensureTypeScriptMimeType(): Plugin {
  const setMimeType = (res: ServerResponse, url?: string | null): void => {
    if (!url) {
      return;
    }
    const cleanUrl = url.split('?')[0]?.split('#')[0] ?? '';
    if (cleanUrl.endsWith('.ts')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
  };

  return {
    name: 'ensure-typescript-mime-type',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        setMimeType(res, req?.url ?? null);
        next();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        setMimeType(res, req?.url ?? null);
        next();
      });
    }
  };
}

export default defineConfig(() => {
  const port = Number(process.env.PORT) || 5173;
  const previewPort = Number(process.env.PORT) || 4173;
  return {
    plugins: [ensureTypeScriptMimeType()],
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
