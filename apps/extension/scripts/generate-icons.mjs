// Renders packages/shared/assets/logo.svg into the PNG sizes browsers need.
import { mkdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const svg = await readFile(resolve(here, '../../../packages/shared/assets/logo.svg'));
const outDir = resolve(here, '../public/icon');
await mkdir(outDir, { recursive: true });

for (const size of [16, 32, 48, 96, 128]) {
  await sharp(svg, { density: 384 }).resize(size, size).png({ compressionLevel: 9 }).toFile(resolve(outDir, `${size}.png`));
  console.log(`icon/${size}.png`);
}
