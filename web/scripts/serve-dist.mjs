import { createServer } from 'node:http';
import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sirv from 'sirv';
import { spawn } from 'node:child_process';

const currentDir = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(currentDir, '..');
const distDir = resolve(root, 'dist');

async function ensureDistBuild() {
  try {
    const stats = await stat(distDir);
    if (!stats.isDirectory()) {
      throw new Error('dist exists but is not a directory');
    }
    return;
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code !== 'ENOENT') {
      throw error;
    }
  }

  await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn('npm', ['run', 'build'], {
      cwd: root,
      stdio: 'inherit',
      env: process.env
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolvePromise();
      } else {
        rejectPromise(new Error(`npm run build failed with exit code ${code}`));
      }
    });

    child.on('error', (childError) => {
      rejectPromise(childError);
    });
  });
}

async function startServer() {
  await ensureDistBuild();

  const port = Number(process.env.PORT) || 4173;
  const serve = sirv(distDir, {
    single: true,
    dev: false,
    etag: true
  });

  const server = createServer((req, res) => {
    serve(req, res, () => {
      res.statusCode = 404;
      res.end('Not found');
    });
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(`Production server running at http://0.0.0.0:${port}`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start production server:', error);
  process.exit(1);
});
