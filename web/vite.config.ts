import { defineConfig, type Plugin } from 'vite';
import type { IncomingMessage, OutgoingHttpHeaders, ServerResponse } from 'http';

const JAVASCRIPT_MIME = 'application/javascript';
const TS_MIME_PATTERN = /(?:application\/typescript|text\/vnd\.trolltech\.linguist)/i;

type HeaderValue = Parameters<ServerResponse['setHeader']>[1];
type ConnectMiddleware = (req: IncomingMessage, res: ServerResponse, next: (err?: unknown) => void) => void;

const normalizeContentTypeValue = (value: HeaderValue): HeaderValue => {
  if (typeof value === 'string') {
    return TS_MIME_PATTERN.test(value) ? JAVASCRIPT_MIME : value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => (typeof entry === 'string' && TS_MIME_PATTERN.test(entry) ? JAVASCRIPT_MIME : entry));
  }

  return value;
};

const ensureWriteHeadHeaders = (
  res: ServerResponse,
  headers: OutgoingHttpHeaders | undefined,
  shouldForceDefault: boolean
): OutgoingHttpHeaders | undefined => {
  if (!headers) {
    if (shouldForceDefault) {
      res.setHeader('Content-Type', JAVASCRIPT_MIME);
    }
    return headers;
  }

  let hasContentType = false;
  const updatedHeaders: OutgoingHttpHeaders = { ...headers };

  for (const [key, headerValue] of Object.entries(updatedHeaders)) {
    if (key.toLowerCase() !== 'content-type') {
      continue;
    }

    hasContentType = true;
    if (headerValue === undefined) {
      updatedHeaders[key] = JAVASCRIPT_MIME;
      continue;
    }

    updatedHeaders[key] = normalizeContentTypeValue(headerValue as HeaderValue);
  }

  if (!hasContentType && shouldForceDefault) {
    updatedHeaders['Content-Type'] = JAVASCRIPT_MIME;
  }

  return updatedHeaders;
};

const cleanRequestUrl = (url: string | null | undefined): string => url?.split('?')[0]?.split('#')[0] ?? '';

const createMimeTypeMiddleware = (): ConnectMiddleware => {
  return (req, res, next) => {
    const cleanUrl = cleanRequestUrl(req?.url ?? null);
    if (!cleanUrl.endsWith('.ts')) {
      next();
      return;
    }

    const serverResponse = res as ServerResponse;
    const originalSetHeader = serverResponse.setHeader.bind(serverResponse);
    serverResponse.setHeader = ((name: string, value: HeaderValue) => {
      if (typeof name === 'string' && name.toLowerCase() === 'content-type') {
        const normalized = normalizeContentTypeValue(value);
        return originalSetHeader(name, normalized);
      }
      return originalSetHeader(name, value);
    }) as typeof serverResponse.setHeader;

    const originalWriteHead = serverResponse.writeHead.bind(serverResponse);
    serverResponse.writeHead = ((
      statusCode: number,
      statusMessage?: string | OutgoingHttpHeaders,
      headers?: OutgoingHttpHeaders
    ) => {
      let resolvedStatusMessage = statusMessage;
      let resolvedHeaders = headers;

      if (typeof statusMessage !== 'string') {
        resolvedHeaders = statusMessage;
        resolvedStatusMessage = undefined;
      }

      const shouldForceDefault = (() => {
        const currentHeader = serverResponse.getHeader('Content-Type');
        if (typeof currentHeader === 'string') {
          return TS_MIME_PATTERN.test(currentHeader);
        }
        if (Array.isArray(currentHeader)) {
          return currentHeader.some((entry) => typeof entry === 'string' && TS_MIME_PATTERN.test(entry));
        }
        return currentHeader === undefined;
      })();

      const updatedHeaders = ensureWriteHeadHeaders(serverResponse, resolvedHeaders, shouldForceDefault);

      if (resolvedStatusMessage) {
        return originalWriteHead(statusCode, resolvedStatusMessage, updatedHeaders);
      }
      return updatedHeaders ? originalWriteHead(statusCode, updatedHeaders) : originalWriteHead(statusCode);
    }) as typeof serverResponse.writeHead;

    next();
  };
};

function ensureTypeScriptMimeType(): Plugin {
  const middleware = createMimeTypeMiddleware();

  return {
    name: 'ensure-typescript-mime-type',
    configureServer(server) {
      const stack = server.middlewares.stack as Array<{ route: string; handle: ConnectMiddleware }>;
      stack.unshift({ route: '', handle: middleware });
    },
    configurePreviewServer(server) {
      const stack = server.middlewares.stack as Array<{ route: string; handle: ConnectMiddleware }>;
      stack.unshift({ route: '', handle: middleware });
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
    },
    build: {
      rollupOptions: {
        output: {
          entryFileNames: 'assets/[name].js',
          chunkFileNames: 'assets/[name].js',
          assetFileNames: 'assets/[name][extname]'
        }
      }
    }
  };
});
