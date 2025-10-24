import { mkdir, copyFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const distDir = resolve('dist/assets');
const targetDir = resolve('assets');
const assets = ['index.js', 'main.js', 'main.css'];

async function ensureExists(path) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

async function main() {
  const hasDist = await ensureExists(distDir);
  if (!hasDist) {
    throw new Error(`Missing build output directory: ${distDir}`);
  }

  await mkdir(targetDir, { recursive: true });

  await Promise.all(
    assets.map(async (asset) => {
      const source = resolve(distDir, asset);
      const destination = resolve(targetDir, asset);

      const exists = await ensureExists(source);
      if (!exists) {
        throw new Error(`Expected build asset not found: ${source}`);
      }

      await copyFile(source, destination);
    })
  );
}

main().catch((error) => {
  console.error('[sync-static-assets] Failed to copy assets from dist:', error);
  process.exitCode = 1;
});
